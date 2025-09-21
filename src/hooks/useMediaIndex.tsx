import { useState, useEffect } from 'react';
import { detectSupabaseIssueFromResponse } from '@/lib/projectHealth';
import { findPreviewForFolder, probeStream } from '@/lib/hidrive';

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
      
      // Map to proxy
      const proxiedItems = sortedItems.map((item) => ({
        ...item,
        previewUrl: mapHiDriveUrlToProxy(item.previewUrl),
        fullUrl: mapHiDriveUrlToProxy(item.fullUrl),
        // thumbnailUrl is already a relative path, no need to proxy
      }));

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
        if (!existingFolders.has(d.folder)) combined.push(d);
      }
      
      // Sort strictly by numeric folder value ascending
      combined.sort((a, b) => {
        const numA = parseInt(a.folder, 10);
        const numB = parseInt(b.folder, 10);
        return numA - numB;
      });
      
      // Log sorted items for debugging
      const foldersList = combined.map(item => item.folder);
      console.log(`📦 items_sorted=[${foldersList.join(',')}]`);
      
      // Diagnostics: Log the final sorted order
      const { diag } = await import('../debug/diag');
      diag('ORDER', 'items_sorted', { folders: foldersList });
      
      setMediaItems(combined);
      setIsSupabasePaused(false); // Reset on success
      console.log(`✅ Loaded ${combined.length} media items from manifest (HiDrive proxied where applicable)`);

      
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