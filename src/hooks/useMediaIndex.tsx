import { useState, useEffect } from 'react';
import { detectSupabaseIssueFromResponse } from '@/lib/projectHealth';
import { findPreviewForFolder, probeStream, getFolderMetadata } from '@/lib/hidrive';

export type MediaType = 'image' | 'video';

export interface MediaItem {
  orderKey: string;
  folder: string;
  title: string;
  previewUrl: string;
  previewType: MediaType;
  fullUrl: string;
  fullType: MediaType;
  thumbnailUrl?: string;
  meta?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive';
}

interface UseMediaIndexReturn {
  mediaItems: MediaItem[];
  isLoading: boolean;
  error: string | null;
  isSupabasePaused: boolean;
  refetch: () => void;
}

export const useMediaIndex = (): UseMediaIndexReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupabasePaused, setIsSupabasePaused] = useState(false);

  const fetchMediaManifest = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/media.manifest.json');
      
      if (!response.ok) {
        // Check if this looks like a Supabase issue
        const contentType = response.headers.get('content-type') || '';
        if (detectSupabaseIssueFromResponse(response.status, contentType)) {
          setIsSupabasePaused(true);
        }
        throw new Error(`Failed to load media manifest: ${response.status} ${response.statusText}`);
      }
      
      const manifest: MediaManifest = await response.json();
      
      // Log manifest shape for debugging (before processing)
      console.log("MANIFEST_JSON_SAMPLE", {
        hasItems: Array.isArray(manifest?.items),
        firstKeys: manifest?.items?.[0] ? Object.keys(manifest.items[0]) : [],
        firstMeta: manifest?.items?.[0]?.meta ?? null,
        firstTwo: (manifest?.items || []).slice(0,2)
      });
      
      // Validate manifest structure
      if (!manifest.items || !Array.isArray(manifest.items)) {
        throw new Error('Invalid manifest structure: missing items array');
      }
      
      // Sort items by orderKey to ensure correct order
      const sortedItems = manifest.items.sort((a, b) => 
        a.orderKey.localeCompare(b.orderKey, undefined, { numeric: true })
      );
      
      const mapHiDriveUrlToProxy = (url: string): string => {
        if (!url) return url;
        try {
          const webdavMatch = url.match(/^https?:\/\/webdav\.hidrive\.strato\.com\/users\/([^/]+)(\/.*)$/);
          if (webdavMatch) {
            const owner = webdavMatch[1];
            const path = webdavMatch[2];
            return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path)}`;
          }
          if (url.startsWith('hidrive://')) {
            // Optional owner prefix: hidrive://<owner>/public/...
            const ownerMatch = url.match(/^hidrive:\/\/([^/]+)(\/.*)$/);
            if (ownerMatch) {
              const owner = ownerMatch[1];
              const path = ownerMatch[2];
              return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?owner=${encodeURIComponent(owner)}&path=${encodeURIComponent(path.startsWith('/') ? path : '/' + path)}`;
            }
            const path = url.replace('hidrive://', '');
            return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path.startsWith('/') ? path : '/' + path)}&owner=juliecamus`;
          }
        } catch {}
        return url;
      };
      
      // Import diagnostics first
      const { diag, flushDiagToEdge, buildDiagSummary } = await import('../debug/diag');
      let manifestExampleFlushed = false;
      let cachedWithMetaCount = 0;
      
      // Map to proxy URLs and attach cached meta from manifest if available
      const proxiedItems = sortedItems.map((item) => {
        const finalItem = {
          ...item,
          previewUrl: mapHiDriveUrlToProxy(item.previewUrl),
          fullUrl: mapHiDriveUrlToProxy(item.fullUrl),
          // thumbnailUrl is already a relative path, no need to proxy
          // Keep existing meta from build-time if present, otherwise empty object
          meta: item.meta || {},
        };
        
        // Log cached metadata for diagnostics - check original item.meta
        if (item.meta && (item.meta.title || item.meta.description)) {
          cachedWithMetaCount++;
          diag('MANIFEST', 'manifest_meta_cached', {
            folder: item.folder,
            title: item.meta?.title || null,
            descriptionLen: item.meta?.description?.length || 0
          });
          
          // Flush edge example for the first folder with cached meta (avoid spam)
          if (!manifestExampleFlushed && item.meta.title) {
            flushDiagToEdge(buildDiagSummary({
              manifest_example_0: { folder: item.folder, title: item.meta.title }
            }));
            manifestExampleFlushed = true;
          }
        }
        
        return finalItem;
      });

      // Log scan result for dev debugging
      diag('MANIFEST', 'manifest_meta_cached_scan', { cachedWithMeta: cachedWithMetaCount });
      if ((import.meta.env.DEV || new URL(location.href).searchParams.get("debug") === "1") && cachedWithMetaCount === 0) {
        console.warn("DEV_ASSERT: No cached meta found in /media.manifest.json — tiles will wait for background probe.");
      }


      const requiresProxy = proxiedItems.some(
        (it) =>
          it.previewUrl.includes('functions.supabase.co/hidrive-proxy') ||
          it.fullUrl.includes('functions.supabase.co/hidrive-proxy')
      );

      // Optional probe (non-blocking)
      if (requiresProxy && proxiedItems.length > 0) {
        try {
          const res = await fetch(proxiedItems[0].previewUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          const contentType = res.headers.get('content-type') || '';
          console.log('HiDrive proxy probe', { status: res.status, contentType });
        } catch (e) {
          console.warn('HiDrive proxy probe failed:', e);
        }
      }

      // Try to heal obvious 404s: case-sensitive extension, uppercase basename, or use fullUrl
      const healedItems = await Promise.all(
        proxiedItems.map(async (it) => {
          const tryHead = async (url: string) => {
            try {
              const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
              const ct = res.headers.get('content-type') || '';
              const isMedia = ct.startsWith('video/') || ct.startsWith('image/');
              return { ok: (res.ok || res.status === 206) && isMedia, status: res.status, ct };
            } catch (e) {
              return { ok: false, status: 0, ct: '' };
            }
          };

          // Only attempt healing for preview
          const previewCheck = await tryHead(it.previewUrl);
          if (previewCheck.ok) return it;

          // Try uppercasing the extension for common cases
          try {
            const u = new URL(it.previewUrl);
            const path = u.searchParams.get('path') || '';
            const dot = path.lastIndexOf('.');
            if (dot > -1) {
              const ext = path.slice(dot);
              const upperExt = ext.toUpperCase();
              if (ext !== upperExt) {
                const altPath = path.slice(0, dot) + upperExt;
                u.searchParams.set('path', altPath);
                const altUrl = u.toString();
                const altCheck = await tryHead(altUrl);
                if (altCheck.ok) {
                  console.log('Healed preview by uppercasing extension', { altPath });
                  return { ...it, previewUrl: altUrl };
                }
              }

              // Try uppercasing the basename as well
              const slash = path.lastIndexOf('/');
              if (slash > -1) {
                const base = path.slice(slash + 1, dot);
                const upperBase = base.toUpperCase();
                if (base !== upperBase) {
                  const altPath2 = path.slice(0, slash + 1) + upperBase + path.slice(dot).toUpperCase();
                  u.searchParams.set('path', altPath2);
                  const altUrl2 = u.toString();
                  const altCheck2 = await tryHead(altUrl2);
                  if (altCheck2.ok) {
                    console.log('Healed preview by uppercasing basename+ext', { altPath: altPath2 });
                    return { ...it, previewUrl: altUrl2 };
                  }
                }
              }
            }
          } catch {}

          // Fall back to fullUrl for preview if available and valid
          const fullCheck = await tryHead(it.fullUrl);
          if (fullCheck.ok) {
            console.log('Healed preview by using fullUrl');
            return { ...it, previewUrl: it.fullUrl, previewType: it.fullType };
          }

          return it; // Keep as-is; tile will show clear error
        })
      );

      // Auto-discover additional numbered folders (01-50) not present in the manifest
      const proxyBase = 'https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy';

      const headRangePath = async (p: string): Promise<{ ok: boolean; ct: string }> => {
        try {
          const u = new URL(proxyBase);
          u.searchParams.set('path', p);
          const r = await fetch(u.toString(), { method: 'GET', headers: { Range: 'bytes=0-0' } });
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          const ok = (r.ok || r.status === 206) && (ct.startsWith('image/') || ct.startsWith('video/'));
          return { ok, ct };
        } catch {
          return { ok: false, ct: '' };
        }
      };

      const probePublicFirstMedia = async (nn: string): Promise<string | null> => {
        const folderPath = `/public/${nn}/`;
        console.log(`🔍 Discovering media in folder: ${folderPath}`);
        
        // Use shared helper to find media in the folder
        const previewUrl = await findPreviewForFolder(folderPath);
        if (previewUrl) {
          // Extract the path from the proxy URL for return
          const match = previewUrl.match(/path=([^&]+)/);
          if (match) {
            const decodedPath = decodeURIComponent(match[1]);
            console.log(`✅ discovered public media: ${decodedPath}`);
            return decodedPath;
          }
        }
        
        console.log(`❌ No media found in folder: ${folderPath}`);
        return null;
      };

      const manifestFolders = new Set(sortedItems.map((it) => it.folder));
      const candidates = Array.from({ length: 50 }, (_, i) => (i + 1).toString().padStart(2, '0'));
      const missing = candidates.filter((nn) => !manifestFolders.has(nn));

      const discoveredRaw = await Promise.all(
        missing.map(async (nn) => {
          const firstPath = await probePublicFirstMedia(nn);
          if (!firstPath) return null;
          const proxied = `${proxyBase}?path=${encodeURIComponent(firstPath)}`;
          const isVideo = /\.(mp4|mov)$/i.test(firstPath);
          
          const extra: MediaItem = {
            orderKey: nn,
            folder: nn,
            title: `Folder ${nn}`,
            previewUrl: proxied,
            previewType: isVideo ? 'video' : 'image',
            fullUrl: proxied,
            fullType: isVideo ? 'video' : 'image',
            meta: {}, // Will be populated by background check
          };
          return extra;
        })
      );

      const discovered = discoveredRaw.filter(Boolean) as MediaItem[];

      // Merge and sort by orderKey numerically
      const combined = [...healedItems];
      const existingFolders = new Set(combined.map((i) => i.folder));
      
      // Add discovered items (de-duplicate by folder)
      for (const d of discovered) {
        if (!existingFolders.has(d.folder)) {
          // Ensure discovered items have the same structure as healed items
          combined.push({
            ...d,
            meta: d.meta || {}
          });
        }
      }
      
      // Sort strictly by numeric folder value ascending
      combined.sort((a, b) => {
        const numA = parseInt(a.folder, 10);
        const numB = parseInt(b.folder, 10);
        return numA - numB;
      });
      
      // Log sorted items for debugging AFTER items are fully built
      const foldersList = combined.map(item => item.folder);
      console.log(`📦 items_sorted=[${foldersList.join(',')}]`);
      
      // Diagnostics: Log the final sorted order with proper counts
      const realItemsCount = combined.length;
      const placeholderCount = 0; // No placeholders in current implementation
      
      diag('ORDER', 'items_sorted', { folders: foldersList });
      diag('ORDER', 'placeholders_after_real', { count: placeholderCount });
      
      // Flush ORDER summary to edge logs
      flushDiagToEdge(buildDiagSummary({
        items_sorted: foldersList,
        placeholders_after_real: placeholderCount
      }));

      // Set the media items AFTER all diagnostics are emitted
      setMediaItems(combined);
      setIsSupabasePaused(false); // Reset on success
      console.log(`✅ Loaded ${combined.length} media items from manifest (HiDrive proxied where applicable)`);

      // Background task: Check for MANIFEST.md updates after grid loads
      setTimeout(async () => {
        await backgroundManifestCheck(combined, setMediaItems);
      }, 1000);

      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading media manifest';
      console.error('❌ Error loading media manifest:', errorMessage);
      setError(errorMessage);
      setMediaItems([]); // Fallback to empty array
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchMediaManifest();
  };

  useEffect(() => {
    fetchMediaManifest();
  }, []);

  return {
    mediaItems,
    isLoading,
    error,
    isSupabasePaused,
    refetch
  };
};

// Background task to check for MANIFEST.md updates
const backgroundManifestCheck = async (
  items: MediaItem[], 
  setMediaItems: (items: MediaItem[]) => void
) => {
  try {
    const { diag, flushDiagToEdge, buildDiagSummary } = await import('../debug/diag');
    let hasUpdates = false;
    const updatedItems = [...items];

    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      const folderPath = `/public/${item.folder}/`;
      
      try {
        // Always fetch current MANIFEST.md metadata for all folders (including cached ones)
        const currentMeta = await getFolderMetadata(folderPath);
        
        // Compare with cached metadata
        const cachedMeta = item.meta || {};
        
        // Check if we have current metadata (either from MANIFEST.md or cache)
        if (currentMeta.title || currentMeta.description) {
          // Check for differences
          const hasChanges = (
            currentMeta.title !== cachedMeta.title ||
            currentMeta.description !== cachedMeta.description ||
            JSON.stringify(currentMeta.tags || []) !== JSON.stringify(cachedMeta.tags || [])
          );
          
          if (hasChanges) {
            // Update item with new metadata
            const changedKeys = [];
            if (currentMeta.title !== cachedMeta.title) changedKeys.push('title');
            if (currentMeta.description !== cachedMeta.description) changedKeys.push('description');
            if (JSON.stringify(currentMeta.tags || []) !== JSON.stringify(cachedMeta.tags || [])) changedKeys.push('tags');
            
            updatedItems[i] = {
              ...item,
              title: currentMeta.title || item.title,
              meta: currentMeta
            };
            
            hasUpdates = true;
            
            diag('MANIFEST', 'manifest_md_updated', {
              folder: item.folder,
              changedKeys
            });
            
            // Flush individual update to edge
            if (currentMeta.title) {
              flushDiagToEdge(buildDiagSummary({
                manifest_example_0: { folder: item.folder, title: currentMeta.title }
              }));
            }
          }
        }
        // Note: getFolderMetadata already emits manifest_md_missing/manifest_md_ok internally
        
      } catch (error) {
        // Background check failed, don't break the UI but log it
        console.warn(`Background manifest check failed for folder ${item.folder}:`, error);
        
        // Still emit missing diagnostic if we couldn't check the folder
        diag('MANIFEST', 'manifest_md_missing', { folder: item.folder });
      }
    }
    
    // Update state if there were changes
    if (hasUpdates) {
      setMediaItems(updatedItems);
      console.log('📝 Updated metadata from background MANIFEST.md check');
    }
  } catch (error) {
    console.warn('Background manifest check failed:', error);
  }
};