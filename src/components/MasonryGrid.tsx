import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import ProjectTile from './ProjectTile';
import MediaTile from './MediaTile';
import AutoMediaTile from './AutoMediaTile';
import { useMediaIndex, type MediaItem } from '../hooks/useMediaIndex';
import { legacyMediaItems, convertLegacyToNew, type LegacyMediaItem } from '../lib/mediaConfig';
import Lightbox from './Lightbox';

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
  | { type: 'legacy-media'; media: LegacyMediaItem; index: number }
  | { type: 'accordion'; project: Project; imageIndex: number; image: string };

const MasonryGrid = ({ projects }: MasonryGridProps) => {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxProject, setLightboxProject] = useState<Project | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  
  // Load auto-discovered media from HiDrive
  const { mediaItems: autoMediaItems, isLoading: mediaLoading, error: mediaError } = useMediaIndex();

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

  const openLegacyMediaLightbox = useCallback((media: LegacyMediaItem) => {
    // Convert legacy media to new format for lightbox
    const newMedia = convertLegacyToNew(media);
    setLightboxMedia(newMedia);
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

  const createGridItems = useCallback((): GridItem[] => {
    const items: GridItem[] = [];
    
    // Use auto-discovered media if available, otherwise fallback to legacy
    const allMediaItems = autoMediaItems.length > 0 ? autoMediaItems : legacyMediaItems;
    
    // First, add the first media item (01 folder) as the first tile
    if (autoMediaItems.length > 0) {
      items.push({ 
        type: 'media', 
        media: autoMediaItems[0], 
        index: 0 
      });
    } else if (legacyMediaItems.length > 0) {
      items.push({ 
        type: 'legacy-media', 
        media: legacyMediaItems[0], 
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
    } else if (legacyMediaItems.length > 1) {
      for (let i = 1; i < legacyMediaItems.length; i++) {
        items.push({ 
          type: 'legacy-media', 
          media: legacyMediaItems[i], 
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
      {/* Show loading or error states */}
      {mediaLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading media...</p>
        </div>
      )}
      
      {mediaError && (
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
          } else if (item.type === 'legacy-media') {
            return (
              <MediaTile
                key={`legacy-media-${item.media.id}-${item.index}`}
                media={item.media}
                index={item.index}
                onHover={() => {}}
                onLeave={() => {}}
                onClick={openLegacyMediaLightbox}
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