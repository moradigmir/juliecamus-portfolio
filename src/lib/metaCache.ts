// src/lib/metaCache.ts
type Folder = string;
export type Meta = { title?: string; description?: string; tags?: string[]; source?: 'file' | 'absent'; ts?: number };
type CacheBlob = { owner: string; updatedAt: number; metaByFolder: Record<Folder, Meta> };

const KEY = (owner: string) => `manifestMetaCache:v2:${owner}`;

export function loadMetaCache(owner: string): CacheBlob | null {
  try {
    const raw = localStorage.getItem(KEY(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheBlob;
    if (!parsed || parsed.owner !== owner) return null;
    return parsed;
  } catch { return null; }
}

export function saveMetaCache(owner: string, metaByFolder: Record<Folder, Meta>) {
  const blob: CacheBlob = { owner, updatedAt: Date.now(), metaByFolder };
  try { localStorage.setItem(KEY(owner), JSON.stringify(blob)); } catch {}
}

export function getMetaCacheStats(owner: string): { updatedAt: number; count: number } | null {
  try {
    const cache = loadMetaCache(owner);
    if (!cache) return null;
    const count = Object.values(cache.metaByFolder || {}).filter((m: any) => m && m.source === 'file').length;
    return { updatedAt: cache.updatedAt, count };
  } catch {
    return null;
  }
}

export function clearMetaCache(owner: string) {
  try {
    const keys = [
      `manifestMetaCache:v1:${owner}`,
      `manifestMetaCache:v2:${owner}`,
      'manifest:last_refresh_ts',
      'manifest:last_result'
    ];
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}

