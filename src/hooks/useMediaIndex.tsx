import { useState, useEffect, useCallback, SetStateAction, Dispatch } from 'react';
import { normalizeMediaPath, getFolderMetadata, persistFolderMetaToCache } from '@/lib/hidrive';

import { loadMetaCache, saveMetaCache, Meta as ManifestMeta } from '@/lib/metaCache';

// HARD BOOT TRACER – proves this file is the one actually running
// Do not remove.
console.log("[BOOT] useMediaIndex.tsx loaded", { ts: Date.now() });
// --- BEGIN HARD STARTUP TRACE ---
try {
  console.log("[HARD-DIAG:MANIFEST] BOOT_PROOF", { ts: Date.now() });

  const owner = "juliecamus";
  const cacheKey = `manifestMetaCache:v2:${owner}`;
  const raw = localStorage.getItem(cacheKey);

  // Nuclear cache clear if ?clearcache=1 URL param is present
  if (new URLSearchParams(window.location.search).get('clearcache') === '1') {
    console.log("[HARD-DIAG:MANIFEST] NUCLEAR_CACHE_CLEAR", { reason: 'URL param' });
    ['manifestMetaCache:v1:juliecamus', 'manifestMetaCache:v2:juliecamus', 'manifest:last_refresh_ts', 'manifest:last_result']
      .forEach(k => localStorage.removeItem(k));
    window.history.replaceState({}, '', window.location.pathname);
  }

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

export interface ManifestFileMeta {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  contentType?: string;
}

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
    source?: 'file' | 'absent';
  };
  files?: ManifestFileMeta[];
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive' | 'local';
}

export interface MetaStats {
  processed: number;
  total: number;
  found: number;
  missing: number;
  errors: number;
  lastRefreshTs: number;
}

interface UseMediaIndexReturn {
  mediaItems: MediaItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  metaStats: MetaStats;
  forceRefreshManifests: () => void;
}

export const useMediaIndex = (): UseMediaIndexReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metaStats, setMetaStats] = useState<MetaStats>({
    processed: 0,
    total: 0,
    found: 0,
    missing: 0,
    errors: 0,
    lastRefreshTs: 0
  });

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
        // continue gracefully
      }

      const manifest = response.ok ? await response.json().catch(() => null) : null;
      emit('MANIFEST','manifest_json_sample', {
        hasItems: Array.isArray(manifest?.items),
        count: Array.isArray(manifest?.items) ? manifest.items.length : 0,
        firstMetaPresent: !!manifest?.items?.[0]?.meta
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
      const KEY = (o:string) => `manifestMetaCache:v2:${o}`;
      let sessionMeta: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(KEY(owner));
        if (raw) {
          const blob = JSON.parse(raw);
          if (blob?.owner === owner && blob?.metaByFolder) sessionMeta = blob.metaByFolder;
        }
      } catch {}

      const mergedMeta: Record<string, any> = Object.fromEntries(
        Object.entries(sessionMeta).filter(([_, v]: any) => v && v.source === 'file')
      );

      // Map to local media paths and immediately attach meta
      let applied = 0;
      const proxiedItems = sortedItems.map((entry) => {
        // Map URLs to local media paths
        const item: any = {
          ...entry,
          previewUrl: normalizeMediaPath(entry.previewUrl),
          fullUrl: normalizeMediaPath(entry.fullUrl),
          files: entry.files,
        };

        // Keep build-time meta as an immediate fallback (title/description/tags)
        // Then overlay any cached MANIFEST file meta on top when available
        const m = mergedMeta[entry.folder];
        if (m && m.source === 'file') {
          item.meta = { ...(entry.meta ?? {}), ...m };
          if (m.title) item.title = m.title;
          if (m.description) item.description = m.description;
          if (m.tags) item.tags = m.tags;
          applied++;
          emit('MANIFEST','CACHED_ATTACH_APPLIED', {
            folder: entry.folder, title: item.title, descriptionLen: item.description?.length ?? 0
          });
        } else {
          // Ensure meta object exists if manifest provided at build time
          if (entry.meta) item.meta = { ...(entry.meta), source: (entry.meta.source as any) ?? 'build' };
        }

        return item as typeof entry;
      });

      emit('MANIFEST','manifest_meta_cached_scan', { count: applied });

      if ((import.meta?.env?.DEV || new URL(location.href).searchParams.get("debug")==="1") && applied===0) {
        console.warn("DEV_ASSERT: No cached meta present in /media.manifest.json — UI will rely on background probe.");
        __safeDiag("MANIFEST","manifest_meta_absent_in_build",{ reason:"no meta fields in manifest" });
      }

      const healedItems = proxiedItems;

      // Step 2.5: Enhance items with long video detection
      const enhancedItems = healedItems.map((item) => {
        if (item.fullType !== 'video' || item.fullUrl !== item.previewUrl) {
          return item;
        }

        const files = item.files ?? [];
        const longFile = files.find((file) =>
          file.type === 'file' && /_long\.(mp4|mov|m4v)$/i.test(file.name)
        );

        if (!longFile) {
          return item;
        }

        const longUrl = normalizeMediaPath(`/public/${item.folder}/${longFile.name}`);
        console.log(`✅ Using long video for ${item.folder}: ${longFile.name}`);
        return {
          ...item,
          fullUrl: longUrl,
        };
      });

      const combined = enhancedItems;

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

      // CRITICAL: Set items immediately so UI shows SOMETHING
      console.log(`🎯 [CRITICAL] Setting ${combined.length} media items NOW`);
      setMediaItems(combined);
      console.log(`✅ Loaded ${combined.length} media items from manifest (HiDrive proxied where applicable)`);

      // Video pre-warmer: prime browser cache for faster playback
      setTimeout(() => {
        (async () => {
          const videos = combined.filter(item => item.previewType === 'video');

          console.log(`🔥 Pre-warming ${videos.length} videos...`);

          const PREFETCH_CONCURRENCY = 4;
          const queue = [...videos];

          async function warmOne() {
            while (queue.length) {
              const item = queue.shift();
              if (!item) break;

              try {
                const url = normalizeMediaPath(item.previewUrl || item.fullUrl);
                await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' } });

                console.log(`✓ Pre-warmed: ${item.folder}`);
              } catch {
                // Ignore errors
              }
            }
          }

          await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, () => warmOne()));
          console.log(`✅ Pre-warming complete`);
        })();
      }, 500);

      // FORCE MANIFEST CHECK on every load to prove it runs
      console.log(`🚀 [CRITICAL] FORCING MANIFEST CHECK NOW`);
      setTimeout(() => {
        backgroundManifestCheck(combined, setMediaItems, owner, true, setMetaStats)
          .then(() => console.log('✅ [MANIFEST] Background check COMPLETED'))
          .catch(err => console.error('❌ [MANIFEST] Background check FAILED:', err));
      }, 100);

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

  const forceRefreshManifests = useCallback(() => {
    console.log('⚡ Force refreshing MANIFEST.txt files...');
    const owner = 'juliecamus';
    backgroundManifestCheck(mediaItems, setMediaItems, owner, true, setMetaStats).catch(err =>
      console.error('❌ Force refresh error:', err)
    );
  }, [mediaItems]);

  useEffect(() => {
    console.log('[MANIFEST] build meta hydration disabled');
  }, []);

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
    refetch,
    metaStats,
    forceRefreshManifests
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
    // IMPORTANT: prefer incoming values (e.g., MANIFEST-derived title) over previous placeholder
    map.set(n.folder, {
      ...prev,
      ...n,
      meta: { ...(prev.meta ?? {}), ...(n.meta ?? {}) },
      title: (n.title ?? prev.title),
      description: (n.description ?? prev.description),
      tags: (n.tags ?? prev.tags),
    });
  });
  const out = Array.from(map.values());
  emit('MANIFEST','merge_preserved_meta', { preserved: out.filter(i => i.meta).length });
  return out;
}

// Ensure consistent ordering by numeric folder/orderKey
function sortMedia(items: MediaItem[]): MediaItem[] {
  try {
    return [...items].sort((a, b) => {
      const aKey = parseInt((a.orderKey || a.folder || '0').toString(), 10);
      const bKey = parseInt((b.orderKey || b.folder || '0').toString(), 10);
      return aKey - bKey;
    });
  } catch {
    return items;
  }
}

// Background task to check for MANIFEST updates (prioritized, cached, concurrency-limited)
// FORCE MODE: On first load, ignores all cache and fetches MANIFEST.txt for ALL folders
const backgroundManifestCheck = async (
  items: MediaItem[], 
  setMediaItems: Dispatch<SetStateAction<MediaItem[]>>,
  owner: string,
  forceRefresh = false,
  setMetaStats?: (stats: MetaStats) => void
) => {
  try {
    console.log(`🔍 [MANIFEST CHECK START] ${items.length} folders, forceRefresh=${forceRefresh}`);
    
    const CONCURRENCY = 2; // Reduced to avoid starving video loads
    const NEGATIVE_CACHE_TTL = 30 * 1000; // 30 seconds
    const POSITIVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const KEY = (o:string) => `manifestMetaCache:v2:${o}`;
    const MANIFEST_REFRESH_KEY = 'manifest:last_refresh_ts';
    const MANIFEST_RESULT_KEY = 'manifest:last_result';
    
    // Load existing cache
    let cachedData: any = {};
    try {
      const raw = localStorage.getItem(KEY(owner));
      if (raw) {
        const blob = JSON.parse(raw);
        cachedData = blob?.metaByFolder || {};
      }
    } catch {}
    
    // Stats tracking
    let statsProcessed = 0;
    let statsFound = 0;
    let statsMissing = 0;
    let statsErrors = 0;
    
    // Sort indices to prioritize lower folder numbers
    const indices = items
      .map((item, i) => ({ i, folder: parseInt(item.folder, 10) || 999 }))
      .sort((a, b) => a.folder - b.folder)
      .map(x => x.i);
    
    console.log(`📋 [MANIFEST QUEUE] ${indices.length} folders prioritized by number`);

    async function processIndex(i: number) {
      const item = items[i];
      const folderPath = `/public/${item.folder}/`;
      const cachedMeta = cachedData[item.folder];
      
      console.log(`🔎 [MANIFEST ${item.folder}] Processing...`);
      statsProcessed++;
      
      // Update stats
      if (setMetaStats) {
        setMetaStats({
          processed: statsProcessed,
          total: indices.length,
          found: statsFound,
          missing: statsMissing,
          errors: statsErrors,
          lastRefreshTs: Date.now()
        });
      }
      
      // Check if needs refresh (missing metadata)
      const needsRefresh = !item.title || item.title === item.folder || !item.meta?.title;
      
      // FORCE MODE: Skip cache completely on first load
      if (forceRefresh) {
        console.log(`⚡ [MANIFEST ${item.folder}] FORCE FETCH (initial load)`);
      } else if (cachedMeta?.ts && !needsRefresh) {
        const age = Date.now() - cachedMeta.ts;
        
        // Skip if negative cache is still valid
        if (cachedMeta.__absent && age < NEGATIVE_CACHE_TTL) {
          console.log(`⏭️ [MANIFEST ${item.folder}] Skip: absent cached (${Math.round(age/1000)}s ago)`);
          statsMissing++;
          return;
        }
        
        // Skip if positive cache is fresh AND came from a real MANIFEST file
        if (cachedMeta.source === 'file' && cachedMeta.title && age < POSITIVE_CACHE_TTL) {
          console.log(`⏭️ [MANIFEST ${item.folder}] Skip: cached (${Math.round(age/1000)}s ago)`);
          statsFound++;
          return;
        }
      }
      
      if (needsRefresh) {
        console.log(`🔄 [MANIFEST ${item.folder}] Needs refresh: missing metadata`);
      }
      
      try {
        console.log(`📡 [MANIFEST ${item.folder}] Fetching MANIFEST.txt...`);
        const currentMeta = await getFolderMetadata(folderPath);
        
        // No manifest found
        if (!currentMeta.title && !currentMeta.description && !currentMeta.tags) {
          console.log(`📭 [MANIFEST ${item.folder}] NOT FOUND - no MANIFEST.txt file`);
          persistFolderMetaToCache(item.folder, { __absent: true });
          cachedData[item.folder] = { __absent: true, source: 'absent', ts: Date.now() };
          statsMissing++;
          return;
        }
        
        console.log(`✅ [MANIFEST ${item.folder}] FOUND!`, { 
          title: currentMeta.title, 
          descLen: currentMeta.description?.length || 0,
          tags: currentMeta.tags?.length || 0
        });
        statsFound++;
        
        // Check for changes
        const itemMeta = item.meta || {};
        const hasChanges = (
          !itemMeta.title ||
          currentMeta.title !== itemMeta.title ||
          currentMeta.description !== itemMeta.description ||
          JSON.stringify(currentMeta.tags || []) !== JSON.stringify(itemMeta.tags || [])
        );
        
        if (hasChanges || forceRefresh) {
          console.log(`📝 [MANIFEST ${item.folder}] UPDATING UI`, { title: currentMeta.title });
          
          const updatedItem = {
            ...item,
            title: currentMeta.title || item.title,
            description: currentMeta.description || item.description,
            tags: currentMeta.tags || item.tags,
            meta: { ...(item.meta ?? {}), ...currentMeta, source: 'file' as const },
          };
          
          // Persist to cache with source marker
          persistFolderMetaToCache(item.folder, { ...currentMeta, source: 'file' });
          cachedData[item.folder] = { ...currentMeta, source: 'file', ts: Date.now() };
          
          // Incremental UI update - use functional setState to preserve discovered items
          setMediaItems(prev => sortMedia(mergeByFolder(prev, [updatedItem])));
        } else {
          console.log(`✓ [MANIFEST ${item.folder}] No changes`);
        }
      } catch (error) {
        console.error(`❌ [MANIFEST ${item.folder}] Error:`, error);
        statsErrors++;
      }
    }

    async function worker() {
      while (indices.length) {
        const i = indices.shift();
        if (typeof i !== 'number') break;
        await processIndex(i);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    console.log(`✅ [MANIFEST CHECK COMPLETE] Processed all folders`);
    
    // Save final stats
    const finalStats = {
      processed: statsProcessed,
      total: indices.length,
      found: statsFound,
      missing: statsMissing,
      errors: statsErrors,
      lastRefreshTs: Date.now()
    };
    
    if (setMetaStats) {
      setMetaStats(finalStats);
    }
    
    // Persist last refresh timestamp and result
    try {
      localStorage.setItem(MANIFEST_REFRESH_KEY, Date.now().toString());
      localStorage.setItem(MANIFEST_RESULT_KEY, JSON.stringify(finalStats));
    } catch {}
  } catch (error) {
    console.error('❌ [MANIFEST CHECK FAILED]', error);
  }
};