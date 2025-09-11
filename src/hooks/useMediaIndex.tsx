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
      
      setMediaItems(sortedItems);
      console.log(`✅ Loaded ${sortedItems.length} media items from manifest`);
      
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