// src/lib/metaCache.ts
type Folder = string;
export type Meta = { title?: string; description?: string; tags?: string[] };
type CacheBlob = { owner: string; updatedAt: number; metaByFolder: Record<Folder, Meta> };

const KEY = (owner: string) => `manifestMetaCache:v1:${owner}`;

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