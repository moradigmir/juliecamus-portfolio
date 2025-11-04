import { useState, useEffect } from 'react';
import { detectSupabaseIssueFromResponse } from '@/lib/projectHealth';
import { findPreviewForFolder, probeStream, getFolderMetadata, toProxyStrict } from '@/lib/hidrive';
import { loadMetaCache, saveMetaCache, Meta as ManifestMeta } from '@/lib/metaCache';

// HARD BOOT TRACER – proves this file is the one actually running
// Do not remove.
console.log("[BOOT] useMediaIndex.tsx loaded", { ts: Date.now() });
// --- BEGIN HARD STARTUP TRACE ---
try {
  console.log("[HARD-DIAG:MANIFEST] BOOT_PROOF", { ts: Date.now() });

  const owner = "juliecamus";
  const cacheKey = `manifestMetaCache:v1:${owner}`;
  const raw = localStorage.getItem(cacheKey);

  if (raw) {
    const parsed = JSON.parse(raw);
    const folders = Object.keys(parsed?.metaByFolder || {});
    console.log("[HARD-DIAG:MANIFEST] manifest_meta_cached_scan", { count: folders.length });
    folders.forEach(f => {
      console.log("[HARD-DIAG:MANIFEST] manifest_meta_cached", {
        folder: f,
        title: parsed.metaByFolder[f]?.title,
        descriptionLen: parsed.metaByFolder[f]?.description?.length ?? 0
      });
    });
  } else {
    console.log("[HARD-DIAG:MANIFEST] manifest_meta_cached_scan", { count: 0 });
  }
} catch (e) {
  console.log("[HARD-DIAG:MANIFEST] boot_trace_failed", { err: String(e) });
}
// --- END HARD STARTUP TRACE ---

// --- BEGIN unskippable tracer shim ---
type DiagEntry = { t:number; tag:string; msg:string; data?:any };
function emit(tag:string, msg:string, data?:any) {
  try {
    // console
    // Use a unique, unmistakable prefix so we can grep it reliably
    console.log(`[HARD-DIAG:${tag}] ${msg}`, data ?? '');
    // ring buffer on window (never throws if window exists)
    if (typeof window !== 'undefined') {
      const w = window as any;
      w.__diag = Array.isArray(w.__diag) ? w.__diag : [];
      w.__diag.push({ t: Date.now(), tag, msg, data } as DiagEntry);
      if (w.__diag.length > 500) w.__diag.shift();
    }
  } catch {/* never throw from tracer */}
}
// --- END unskippable tracer shim ---

// Use the strict proxy function for consistent /public/ prefix
const toProxy = toProxyStrict;
import { diag, flushDiagToEdge, buildDiagSummary } from '@/debug/diag';

// Tiny tracer helpers for guaranteed logging
function __safeDiag(tag: string, msg: string, data?: any) {
  try { diag(tag, msg, data); } catch (_) { /* noop */ }
}

function __onceEdgeFlush(payload: any) {
  try {
    if (!window.__once_cached_manifest_flush && payload && payload.manifest_example_0) {
      window.__once_cached_manifest_flush = true;
      flushDiagToEdge(buildDiagSummary(payload));
      console.log("CACHED_EDGE_FLUSHED", payload.manifest_example_0);
    }
  } catch (e) {
    console.warn("TRACE(edge_flush_failed)", e);
  }
}

declare global {
  interface Window {
    __once_cached_manifest_flush?: boolean;
  }
}

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
  description?: string;
  tags?: string[];
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
      
      emit('MANIFEST','manifest_fetch_begin', { url: '/media.manifest.json' });
      const response = await fetch('/media.manifest.json');
      emit('MANIFEST','manifest_fetch_status', { ok: response.ok, status: response.status });
      
      if (!response.ok) {
        emit('MANIFEST','manifest_fetch_fail', { status: response.status });
        console.warn('MANIFEST_FETCH_FAILED', { status: response.status });
        __safeDiag('MANIFEST', 'manifest_fetch_failed', { status: response.status });
        // Check if this looks like a Supabase issue
        const contentType = response.headers.get('content-type') || '';
        if (detectSupabaseIssueFromResponse(response.status, contentType)) {
          setIsSupabasePaused(true);
        }
        // continue gracefully; discovery can still run
      }
      
      const manifest = response.ok ? await response.json().catch(() => null) : null;
      emit('MANIFEST','manifest_json_sample', {
        hasItems: Array.isArray(manifest?.items),
        count: Array.isArray(manifest?.items) ? manifest.items.length : 0,
        firstMetaPresent: !!manifest?.items?.[0]?.meta
      });
      
      // Build meta lookup from build-time file
      const buildMeta: Record<string, {title?:string;description?:string;tags?:string[]}> = {};
      (manifest?.items ?? []).forEach((it:any) => {
        if (it?.folder && it?.meta) buildMeta[it.folder] = it.meta;
      });
      
      // Validate manifest structure
      if (!manifest.items || !Array.isArray(manifest.items)) {
        throw new Error('Invalid manifest structure: missing items array');
      }
      
      // Sort items by orderKey to ensure correct order
      const sortedItems = (manifest?.items ?? []).sort((a, b) => 
        a.orderKey.localeCompare(b.orderKey, undefined, { numeric: true })
      );

      // Restore session cache (localStorage)
      const owner = 'juliecamus';
      const KEY = (o:string) => `manifestMetaCache:v1:${o}`;
      let sessionMeta: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(KEY(owner));
        if (raw) {
          const blob = JSON.parse(raw);
          if (blob?.owner === owner && blob?.metaByFolder) sessionMeta = blob.metaByFolder;
        }
      } catch {}

      const mergedMeta: Record<string, any> = { ...buildMeta, ...sessionMeta };
      
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
      
      // Map to proxy URLs and immediately attach cached meta before setState
      let applied = 0;
      const proxiedItems = sortedItems.map((entry) => {
        // Map URLs to proxy using toProxyStrict function for guaranteed /public/ prefix
        const item = {
          ...entry,
          previewUrl: toProxy(entry.previewUrl),
          fullUrl: toProxy(entry.fullUrl),
        };
        
        // Attach cached meta immediately if it exists
        const m = mergedMeta[entry.folder];
        if (!m) return item;
        
        item.meta = { ...(item.meta ?? {}), ...m };
        if (m.title) item.title = m.title;
        if (m.description) item.description = m.description;
        if (m.tags) item.tags = m.tags;
        applied++;
        emit('MANIFEST','CACHED_ATTACH_APPLIED', {
          folder: entry.folder, title: item.title, descriptionLen: item.description?.length ?? 0
        });
        
        return item;
      });
      
      emit('MANIFEST','manifest_meta_cached_scan', { count: applied });
      
      if ((import.meta?.env?.DEV || new URL(location.href).searchParams.get("debug")==="1") && applied===0) {
        console.warn("DEV_ASSERT: No cached meta present in /media.manifest.json — UI will rely on background probe.");
        __safeDiag("MANIFEST","manifest_meta_absent_in_build",{ reason:"no meta fields in manifest" });
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

      // Step 2.5: Enhance items with long video detection
      const enhancedItems = await Promise.all(
        healedItems.map(async (item) => {
          // Skip if not a video or if fullUrl is already different from previewUrl
          if (item.fullType !== 'video' || item.fullUrl !== item.previewUrl) {
            return item;
          }

          try {
            // Extract path and folder from preview URL to look for long version
            const match = item.previewUrl.match(/path=([^&]+)/);
            if (!match) return item;

            const decodedPath = decodeURIComponent(match[1]);
            const pathParts = decodedPath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const folderPath = pathParts.slice(0, -1).join('/') + '/';

            // Derive base name and try to find long version
            let baseName = fileName.replace(/\.[^.]+$/, ''); // remove extension
            const extension = fileName.match(/\.[^.]+$/)?.[0] || '.mp4';

            // Remove _short suffix if present to get base name
            baseName = baseName.replace(/_short$/i, '');

            // Try different long version patterns
            const longCandidates = [
              `${baseName}_long${extension}`,
              `${baseName}_long.mp4`,
              `${baseName}_long.mov`,
              `${baseName}_long.MP4`,
              `${baseName}_long.MOV`
            ];

            // Test each candidate by trying to fetch it
            for (const candidate of longCandidates) {
              const longPath = folderPath + candidate;
              const longUrl = `${proxyBase}?path=${encodeURIComponent(longPath)}&owner=juliecamus`;

              try {
                const res = await fetch(longUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                const ct = res.headers.get('content-type') || '';
                if ((res.ok || res.status === 206) && ct.startsWith('video/')) {
                  console.log(`✅ Found long version for ${item.folder}: ${candidate}`);
                  return { ...item, fullUrl: longUrl };
                }
              } catch {
                // Continue to next candidate
              }
            }

            console.log(`ℹ️ No long version found for ${item.folder}, using preview as full`);
            return item;
          } catch (error) {
            console.warn(`⚠️ Error checking for long version in ${item.folder}:`, error);
            return item;
          }
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
      const candidates = Array.from({ length: 99 }, (_, i) => (i + 1).toString().padStart(2, '0'));
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

        // Merge with discovery using merge-preserve approach
        const combined = mergeByFolder(enhancedItems, discovered);
      
      // Sort strictly by numeric folder value ascending
      combined.sort((a, b) => {
        const numA = parseInt(a.folder, 10);
        const numB = parseInt(b.folder, 10);
        return numA - numB;
      });
      
      // Step 9: ORDER diagnostics AFTER final array built
      const foldersList = combined.map(item => item.folder);
      const placeholderCount = 0; // No placeholders in current implementation
      console.log(`📦 items_sorted=[${foldersList.join(',')}]`);
      
      __safeDiag("ORDER","items_sorted",{ folders: foldersList });
      __safeDiag("ORDER","placeholders_after_real",{ count: placeholderCount });
      try { 
        flushDiagToEdge(buildDiagSummary({ items_sorted: foldersList, placeholders_after_real: placeholderCount })); 
      } catch(_) {}

      // Set the media items AFTER all diagnostics are emitted
      setMediaItems(combined);
      setIsSupabasePaused(false); // Reset on success
      console.log(`✅ Loaded ${combined.length} media items from manifest (HiDrive proxied where applicable)`);

      // Background task: Check for MANIFEST.md updates IMMEDIATELY (no delay)
      // This ensures metadata is cached before user might reload
      backgroundManifestCheck(combined, setMediaItems, owner).catch(err => 
        console.warn('Background manifest check error:', err)
      );

      
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
    const DIAG = (msg: string, data?: any) =>
      console.log("[HARD-DIAG:MANIFEST]", msg, data ?? "");
  
    // ✅ Single source of truth for session cache
    const OWNER = "juliecamus";
    const KEY = (o: string) => `manifestMetaCache:v1:${o}`;
  
    // 0) Scan the cache and log what’s there (no mutation yet)
    try {
      const raw = localStorage.getItem(KEY(OWNER));
      if (raw) {
        const blob = JSON.parse(raw);
        const map = blob?.metaByFolder || {};
        const folders = Object.keys(map);
        DIAG("manifest_meta_cached_scan", { count: folders.length });
        folders.forEach((f) => {
          const m = map[f] || {};
          DIAG("manifest_meta_cached", {
            folder: f,
            title: m.title,
            descriptionLen: m.description?.length ?? 0,
          });
        });
      } else {
        DIAG("manifest_meta_cached_scan", { count: 0 });
      }
    } catch (e) {
      DIAG("cached_hydrate_failed", { err: String(e) });
    }
  
    // 1) Fetch /media.manifest.json and attach build-time meta immediately
    (async () => {
      try {
        const res = await fetch("/media.manifest.json", { cache: "no-store" });
        if (!res.ok) {
          DIAG("manifest_json_fetch_failed", { status: res.status });
          return;
        }
        const json = await res.json();
        const items: Array<{ folder?: string; meta?: any }> = Array.isArray(json?.items)
          ? json.items
          : [];
        DIAG("manifest_json_sample", {
          hasItems: items.length > 0,
          count: items.length,
          firstMetaPresent: !!items[0]?.meta,
        });
  
        // Build {folder->meta} from build-time manifest
        const fromBuild: Record<string, any> = {};
        for (const it of items) {
          const folder = it?.folder;
          const meta = it?.meta;
          if (folder && meta) fromBuild[folder] = meta;
        }
        const folders = Object.keys(fromBuild);
  
        if (folders.length) {
          // Attach to UI *after* the list exists (fetchMediaManifest builds the list),
          // but in case list already exists, enrich current items too.
          setMediaItems((prev) =>
            prev.map((it) =>
              it.folder && fromBuild[it.folder]
                ? { ...it, meta: { ...(it.meta ?? {}), ...fromBuild[it.folder] }, title: it.title ?? fromBuild[it.folder].title, description: it.description ?? fromBuild[it.folder].description, tags: it.tags ?? fromBuild[it.folder].tags }
                : it
            )
          );
          console.log("[HARD-DIAG:MANIFEST] CACHED_ATTACH_APPLIED", { folders });
  
          // Persist build-time meta into the SAME cache (so next reload shows instantly)
          try {
            const raw = localStorage.getItem(KEY(OWNER));
            const old = raw ? JSON.parse(raw) : { owner: OWNER, updatedAt: 0, metaByFolder: {} };
            const merged = { ...old, owner: OWNER, metaByFolder: { ...(old.metaByFolder || {}) } };
            folders.forEach((f) => {
              merged.metaByFolder[f] = {
                ...fromBuild[f],
                ...(merged.metaByFolder[f] ?? {}),
                ts: Date.now(),
              };
            });
            merged.updatedAt = Date.now();
            localStorage.setItem(KEY(OWNER), JSON.stringify(merged));
            DIAG("manifest_meta_persisted", { count: folders.length, source: "build" });
          } catch (e) {
            DIAG("persist_failed", { err: String(e) });
          }
        } else {
          DIAG("manifest_json_no_meta_items", { count: items.length });
        }
      } catch (e) {
        DIAG("manifest_json_exception", { err: String(e) });
      }
    })();
  }, []); // IMPORTANT: run once on mount

  useEffect(() => {
    fetchMediaManifest();
  }, []);

  // Step 6: Safety net - dev-only effect that runs once after items are in state
  useEffect(() => {
    if (!(import.meta?.env?.DEV || new URL(location.href).searchParams.get("debug")==="1")) return;
    try {
      const current = mediaItems || [];
      const has = current.filter(x => x?.meta && (x.meta.title || x.meta.description)).length;
      console.log("CACHED_POSTSTATE_SCAN", { count: has });
      __safeDiag("MANIFEST","manifest_meta_poststate_scan",{ count: has });
    } catch(_) {}
  }, [mediaItems?.length]);

  return {
    mediaItems,
    isLoading,
    error,
    isSupabasePaused,
    refetch
  };
};

// Merge function for preserving meta during discovery
function mergeByFolder<T extends { folder:string; title?:string; description?:string; tags?:string[]; meta?:any }>(
  base: T[], inc: T[]
): T[] {
  const map = new Map<string, T>();
  base.forEach(b => map.set(b.folder, b));
  inc.forEach(n => {
    const prev = map.get(n.folder);
    if (!prev) { map.set(n.folder, n); return; }
    map.set(n.folder, {
      ...n,
      meta: prev.meta ?? n.meta,
      title: prev.title ?? n.title,
      description: prev.description ?? n.description,
      tags: prev.tags ?? n.tags,
    });
  });
  const out = Array.from(map.values());
  emit('MANIFEST','merge_preserved_meta', { preserved: out.filter(i => i.meta).length });
  return out;
}

// Background task to check for MANIFEST.md updates
const backgroundManifestCheck = async (
  items: MediaItem[], 
  setMediaItems: (items: MediaItem[]) => void,
  owner: string
) => {
  try {
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
          // Check for differences OR if this is a new folder without cache
          const hasChanges = (
            !cachedMeta.title || // No cached data = treat as changed to persist
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
            
            // Persist probe results to cache
            const { title, description, tags } = currentMeta;
            try {
              const KEY = (o:string) => `manifestMetaCache:v1:${o}`;
              const raw = localStorage.getItem(KEY(owner));
              const before = raw ? JSON.parse(raw) : { owner, updatedAt: 0, metaByFolder: {} };
              before.metaByFolder = before.metaByFolder || {};
              before.metaByFolder[item.folder] = { title, description, tags };
              before.updatedAt = Date.now();
              before.owner = owner;
              localStorage.setItem(KEY(owner), JSON.stringify(before));
              emit('MANIFEST','manifest_meta_persisted', { folder: item.folder, source: 'probe' });
            } catch (e) {
              emit('MANIFEST','manifest_meta_persist_fail', { folder: item.folder });
            }
            
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