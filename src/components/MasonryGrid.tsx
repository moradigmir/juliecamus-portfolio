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
      toast({
        title: "Checking folders...",
        description: "Scanning /public directory for media folders",
      });

      // Derive HiDrive owner from manifest
      const getOwner = async (): Promise<string | null> => {
        try {
          const res = await fetch('/media.manifest.json');
          if (!res.ok) return null;
          const manifest = await res.json();
          const first = manifest?.items?.[0];
          const anyUrl = (first?.previewUrl || first?.fullUrl) as string | undefined;
          if (typeof anyUrl === 'string') {
            const m1 = anyUrl.match(/webdav\.hidrive\.strato\.com\/users\/([^/]+)/);
            if (m1) return m1[1];
            const m2 = anyUrl.match(/[?&]owner=([^&]+)/);
            if (m2) return decodeURIComponent(m2[1]);
          }
          return 'juliecamus';
        } catch {
          return null;
        }
      };

      const owner = await getOwner();

      // Check if /public directory exists and has folders
      const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
      url.searchParams.set('path', '/public/');
      url.searchParams.set('list', '1');
      if (owner) url.searchParams.set('owner', owner);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const folders = Array.from(doc.getElementsByTagName('response'))
        .map(response => {
          const href = response.getElementsByTagName('href')[0]?.textContent || '';
          const isDir = response.getElementsByTagName('collection')[0];
          if (isDir && href.includes('/public/')) {
            const parts = href.split('/').filter(Boolean);
            const folderName = parts[parts.length - 1];
            return folderName;
          }
          return null;
        })
        .filter(Boolean) as string[];

      if (folders.length > 0) {
        toast({
          title: "Folders found!",
          description: `Found ${folders.length} folders: ${folders.join(', ')}. Refreshing media...`,
        });
        // Trigger media refetch to pick up any changes
        refetch();
      } else {
        toast({
          title: "No media folders found",
          description: "No numbered folders (01, 02, etc.) found in /public directory",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Folder check failed:', error);
      toast({
        title: "Folder check failed",
        description: "Could not access /public directory. Use HiDrive Browser to verify your folder structure.",
        variant: "destructive",
      });
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