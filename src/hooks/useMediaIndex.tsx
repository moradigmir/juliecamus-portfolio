import { useState, useEffect } from 'react';

export type MediaType = 'image' | 'video';

export interface MediaItem {
  orderKey: string;
  folder: string;
  title: string;
  previewUrl: string;
  previewType: MediaType;
  fullUrl: string;
  fullType: MediaType;
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
  refetch: () => void;
}

export const useMediaIndex = (): UseMediaIndexReturn => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMediaManifest = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/media.manifest.json');
      
      if (!response.ok) {
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
            return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?owner=${encodeURIComponent(owner)}&path=${encodeURIComponent(path)}`;
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
      }));

      const requiresProxy = proxiedItems.some(
        (it) =>
          it.previewUrl.includes('functions.supabase.co/hidrive-proxy') ||
          it.fullUrl.includes('functions.supabase.co/hidrive-proxy')
      );

      // Optional probe (non-blocking)
      if (requiresProxy && proxiedItems.length > 0) {
        try {
          const head = await fetch(proxiedItems[0].previewUrl, { method: 'HEAD' });
          const contentType = head.headers.get('content-type') || '';
          console.log('HiDrive proxy probe', { status: head.status, contentType });
        } catch (e) {
          console.warn('HiDrive proxy probe failed:', e);
        }
      }

      // Try to heal obvious 404s: case-sensitive extension, uppercase basename, or use fullUrl
      const healedItems = await Promise.all(
        proxiedItems.map(async (it) => {
          const tryHead = async (url: string) => {
            try {
              const res = await fetch(url, { method: 'HEAD' });
              const ct = res.headers.get('content-type') || '';
              const isMedia = ct.startsWith('video/') || ct.startsWith('image/');
              return { ok: res.ok && isMedia, status: res.status, ct };
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
      
      setMediaItems(healedItems);
      console.log(`✅ Loaded ${healedItems.length} media items from manifest (HiDrive proxied where applicable)`);
      
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
    refetch
  };
};