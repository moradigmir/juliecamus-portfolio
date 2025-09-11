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
          const webdavMatch = url.match(/^https?:\/\/webdav\.hidrive\.strato\.com\/users\/[^/]+(\/.*)$/);
          if (webdavMatch) {
            const path = webdavMatch[1];
            return `/functions/v1/hidrive-proxy?path=${encodeURIComponent(path)}`;
          }
          if (url.startsWith('hidrive://')) {
            const path = url.replace('hidrive://', '');
            return `/functions/v1/hidrive-proxy?path=${encodeURIComponent(path.startsWith('/') ? path : '/' + path)}`;
          }
        } catch {}
        return url;
      };
      
      // Map to proxy and probe availability (avoid 404 if Supabase edge function isn't deployed)
      const proxiedItems = sortedItems.map((item) => ({
        ...item,
        previewUrl: mapHiDriveUrlToProxy(item.previewUrl),
        fullUrl: mapHiDriveUrlToProxy(item.fullUrl),
      }));

      const requiresProxy = proxiedItems.some(
        (it) =>
          it.previewUrl.startsWith('/functions/v1/hidrive-proxy') ||
          it.fullUrl.startsWith('/functions/v1/hidrive-proxy')
      );

      if (requiresProxy && proxiedItems.length > 0) {
        try {
          const head = await fetch(proxiedItems[0].previewUrl, { method: 'HEAD' });
          if (!head.ok) {
            console.warn('HiDrive proxy not reachable (status ' + head.status + '). Falling back to legacy content.');
            setMediaItems([]); // Trigger fallback in MasonryGrid
            return;
          }
        } catch (e) {
          console.warn('HiDrive proxy check failed, falling back to legacy content.');
          setMediaItems([]);
          return;
        }
      }
      
      setMediaItems(proxiedItems);
      console.log(`✅ Loaded ${proxiedItems.length} media items from manifest (HiDrive proxied where applicable)`);
      
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