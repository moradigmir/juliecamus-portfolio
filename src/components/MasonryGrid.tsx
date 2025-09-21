import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import ProjectTile from './ProjectTile';
import AutoMediaTile from './AutoMediaTile';
import { useMediaIndex, type MediaItem } from '../hooks/useMediaIndex';
import Lightbox from './Lightbox';
import HiDriveBrowser from './HiDriveBrowser';
import ProjectStatusIndicator from './ProjectStatusIndicator';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { MediaManifestGenerator } from '../utils/mediaManifestGenerator';
import { useToast } from '@/hooks/use-toast';

interface Project {
  slug: string;
  title: string;
  coverImage: string;
  coverVideo?: string;
  images?: string[];
}

interface MasonryGridProps {
  projects: Project[];
}

type GridItem = 
  | { type: 'project'; project: Project; index: number }
  | { type: 'media'; media: MediaItem; index: number }
  | { type: 'accordion'; project: Project; imageIndex: number; image: string };

const MasonryGrid = ({ projects }: MasonryGridProps) => {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxProject, setLightboxProject] = useState<Project | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  const [showHiDriveBrowser, setShowHiDriveBrowser] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Load auto-discovered media from HiDrive
  const { 
    mediaItems: autoMediaItems, 
    isLoading: mediaLoading, 
    error: mediaError, 
    isSupabasePaused, 
    refetch 
  } = useMediaIndex();

  // Debounced hover handlers to prevent mouse chase flicker
  const handleTileHover = useCallback((index: number) => {
    setExpandedTile(index);
  }, []);

  const handleTileLeave = useCallback(() => {
    const timeout = setTimeout(() => {
      setExpandedTile(null);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Lightbox handlers
  const openLightbox = useCallback((project: Project, imageIndex: number = 0) => {
    setLightboxProject(project);
    setLightboxMedia(null);
    setLightboxImageIndex(imageIndex);
    setLightboxOpen(true);
  }, []);

  const openMediaLightbox = useCallback((media: MediaItem) => {
    setLightboxMedia(media);
    setLightboxProject(null);
    setLightboxImageIndex(0);
    setLightboxOpen(true);
  }, []);


  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxProject(null);
    setLightboxMedia(null);
    setLightboxImageIndex(0);
  }, []);

  const nextImage = useCallback(() => {
    if (!lightboxProject) return;
    const allImages = [lightboxProject.coverImage, ...(lightboxProject.images || [])];
    setLightboxImageIndex((prev) => (prev + 1) % allImages.length);
  }, [lightboxProject]);

  const prevImage = useCallback(() => {
    if (!lightboxProject) return;
    const allImages = [lightboxProject.coverImage, ...(lightboxProject.images || [])];
    setLightboxImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  }, [lightboxProject]);

  const handlePathFound = useCallback((correctPath: string) => {
    console.log('📍 Found correct path:', correctPath);
    // Here you could implement auto-rewriting of manifest paths
    // For now, just notify and suggest manual update
    alert(`Found correct path: ${correctPath}\n\nUpdate your media.manifest.json to use this path prefix.`);
  }, []);

  const handleRefreshManifest = useCallback(async () => {
    setIsRefreshing(true);

    try {
      toast({ title: 'Checking folders...', description: 'Validating folders from manifest' });

      const res = await fetch('/media.manifest.json');
      if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
      const manifest = await res.json();
      const items: Array<{ folder?: string; previewUrl?: string; fullUrl?: string }> = Array.isArray(manifest?.items) ? manifest.items : [];
      const folders = Array.from(new Set(items.map((it) => it.folder).filter(Boolean))) as string[];

      if (folders.length === 0) {
        toast({ title: 'No folders in manifest', description: 'Nothing to check', variant: 'destructive' });
        return;
      }

      const mapToProxy = (url?: string): string | undefined => {
        if (!url) return undefined;
        try {
          if (url.includes('functions.supabase.co/hidrive-proxy')) return url;
          const m = url.match(/^https?:\/\/webdav\.hidrive\.strato\.com\/users\/([^/]+)(\/.*)$/);
          if (m) {
            const path = m[2];
            return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path)}`;
          }
          if (url.startsWith('hidrive://')) {
            const ownerMatch = url.match(/^hidrive:\/\/([^/]+)(\/.*)$/);
            if (ownerMatch) {
              const owner = ownerMatch[1];
              const path = ownerMatch[2];
              return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?owner=${encodeURIComponent(owner)}&path=${encodeURIComponent(path.startsWith('/') ? path : '/' + path)}`;
            }
            const path = url.replace('hidrive://', '');
            return `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path.startsWith('/') ? path : '/' + path)}`;
          }
        } catch {}
        return url;
      };

      const tryHead = async (u?: string) => {
        if (!u) return false;
        try {
          const r = await fetch(u, { method: 'HEAD' });
          const ct = r.headers.get('content-type') || '';
          return r.ok && (ct.startsWith('video/') || ct.startsWith('image/'));
        } catch {
          return false;
        }
      };

      const probeFolder = async (folder: string) => {
        const bases = ['/public', '/Common'];

        // Try WebDAV PROPFIND on both bases to verify folder and detect media files
        for (const base of bases) {
          try {
            const p = `${base}/${folder}/`;
            const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
            url.searchParams.set('path', p);
            const r = await fetch(url.toString(), { method: 'PROPFIND', headers: { Depth: '1' } });
            if (r.ok || r.status === 207) {
              const xml = await r.text();
              const doc = new DOMParser().parseFromString(xml, 'application/xml');
              const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));
              const files = responses.filter((resp) => resp.getElementsByTagNameNS('*', 'collection').length === 0);
              // If at least one file has media content-type or no type (some servers omit it), mark OK
              const hasMedia = files.some((resp) => {
                const ct = (resp.getElementsByTagNameNS('*', 'getcontenttype')[0]?.textContent || '').toLowerCase();
                return !ct || ct.startsWith('image/') || ct.startsWith('video/');
              });
              if (responses.length > 0 && hasMedia) {
                return { folder, ok: true } as const;
              }
            }
          } catch {}
        }

        // Fallback: HEAD the sample manifest URLs mapped to proxy
        const sample = items.find((it) => it.folder === folder);
        const ok = (await tryHead(mapToProxy(sample?.previewUrl))) || (await tryHead(mapToProxy(sample?.fullUrl)));
        return { folder, ok } as const;
      };

      const results = [] as Array<{ folder: string; ok: boolean }>;
      for (const f of folders) {
        results.push(await probeFolder(f as string));
      }

      const okCount = results.filter((r) => r.ok).length;
      if (okCount === folders.length) {
        toast({ title: 'All folders OK', description: `Verified ${okCount}/${folders.length}: ${folders.join(', ')}` });
      } else {
        const bad = results.filter((r) => !r.ok).map((r) => r.folder);
        toast({ title: 'Some folders failed', description: `OK ${okCount}/${folders.length}. Failed: ${bad.join(', ')}`, variant: 'destructive' });
      }

      refetch();
    } catch (error) {
      console.error('Folder check failed:', error);
      toast({ title: 'Check failed', description: 'Unexpected error while checking folders', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, toast]);

  const createGridItems = useCallback((): GridItem[] => {
    const items: GridItem[] = [];
    
    // Only use auto-discovered media; no legacy fallback
    if (autoMediaItems.length > 0) {
      items.push({ 
        type: 'media', 
        media: autoMediaItems[0], 
        index: 0 
      });
    }
    
    // Then add projects with accordion expansion
    projects.forEach((project, projectIndex) => {
      const itemIndex = items.length;
      
      // Add the main project tile
      items.push({ 
        type: 'project', 
        project, 
        index: itemIndex 
      });
      
      // Add accordion images if this project is expanded
      if (expandedTile === itemIndex && project.images) {
        project.images.forEach((image, imageIndex) => {
          items.push({ 
            type: 'accordion', 
            project, 
            imageIndex, 
            image 
          });
        });
      }
    });
    
    // Add remaining media items
    if (autoMediaItems.length > 1) {
      for (let i = 1; i < autoMediaItems.length; i++) {
        items.push({ 
          type: 'media', 
          media: autoMediaItems[i], 
          index: items.length 
        });
      }
    }
    
    return items;
  }, [projects, expandedTile, autoMediaItems]);

  const gridItems = createGridItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Project Status Indicator for Supabase Issues */}
      {isSupabasePaused && (
        <div className="mb-8">
          <ProjectStatusIndicator onRetry={refetch} />
        </div>
      )}

      {/* Diagnostic Panel */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowHiDriveBrowser(!showHiDriveBrowser)}
            variant="outline"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            {showHiDriveBrowser ? 'Hide' : 'Show'} HiDrive Browser
          </Button>
          {(mediaError || autoMediaItems.length === 0) && !isSupabasePaused && (
            <Button onClick={refetch} variant="outline" size="sm" disabled={mediaLoading}>
              {mediaLoading ? 'Retrying…' : 'Retry Loading'}
            </Button>
          )}
          <Button 
            onClick={handleRefreshManifest} 
            variant="outline" 
            size="sm" 
            disabled={isRefreshing}
            className="text-xs"
          >
            {isRefreshing ? 'Checking...' : 'Check Folders'}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {isSupabasePaused ? (
            'Backend services unavailable'
          ) : autoMediaItems.length > 0 ? (
            `${autoMediaItems.length} auto-discovered media items`
          ) : (
            'No media loaded'
          )}
        </div>
      </div>

      {/* HiDrive Browser Panel */}
      {showHiDriveBrowser && (
        <div className="mb-8">
          <HiDriveBrowser onPathFound={handlePathFound} />
        </div>
      )}

      {/* Show loading or error states */}
      {mediaLoading && !isSupabasePaused && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading media...</p>
        </div>
      )}
      
      {mediaError && !isSupabasePaused && (
        <div className="text-center py-8">
          <p className="text-destructive">Error loading media: {mediaError}</p>
          <p className="text-muted-foreground text-sm">Falling back to demo content...</p>
        </div>
      )}

      {/* Flowing grid */}
      <div className="flowing-grid">
        {gridItems.map((item, idx) => {
          if (item.type === 'project') {
            return (
              <ProjectTile
                key={`project-${item.project.slug}-${item.index}`}
                project={item.project}
                index={item.index}
                onHover={handleTileHover}
                onClick={() => openLightbox(item.project, 0)}
              />
            );
          } else if (item.type === 'media') {
            return (
              <AutoMediaTile
                key={`auto-media-${item.media.folder}-${item.index}`}
                media={item.media}
                index={item.index}
                onHover={() => {}}
                onLeave={() => {}}
                onClick={openMediaLightbox}
              />
            );
          } else if (item.type === 'accordion') {
            return (
              <motion.div
                key={`accordion-${item.project.slug}-${item.imageIndex}-${idx}`}
                className="gallery-tile-wrapper accordion-tile"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, delay: item.imageIndex * 0.05 }}
              >
                <div 
                  className="gallery-tile accordion-preview cursor-pointer"
                  onClick={() => openLightbox(item.project, item.imageIndex)}
                >
                  <img
                    src={item.image}
                    alt={`${item.project.title} - Image ${item.imageIndex + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              </motion.div>
            );
          }
        })}
      </div>

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        project={lightboxProject}
        media={lightboxMedia}
        imageIndex={lightboxImageIndex}
        onClose={closeLightbox}
        onNext={nextImage}
        onPrev={prevImage}
      />
    </motion.div>
  );
};

export default MasonryGrid;