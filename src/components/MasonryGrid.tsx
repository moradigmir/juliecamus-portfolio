import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import ProjectTile from './ProjectTile';
import MediaTile from './MediaTile';
import Lightbox from './Lightbox';
import { mediaItems, MediaItem } from '../lib/mediaConfig';

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

type GridItem = {
  type: 'project' | 'media' | 'accordion';
  data: Project | MediaItem;
  accordionImages?: string[];
  accordionProjectSlug?: string;
};

const MasonryGrid = ({ projects }: MasonryGridProps) => {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxProject, setLightboxProject] = useState<Project | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced hover handlers to prevent mouse chase flicker
  const handleTileHover = useCallback((index: number) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    setExpandedTile(index);
  }, [hoverTimeout]);

  const handleTileLeave = useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    const timeout = setTimeout(() => {
      setExpandedTile(null);
    }, 100); // Small delay to prevent flicker when moving between related tiles
    setHoverTimeout(timeout);
  }, [hoverTimeout]);

  // Handle accordion tile hover - maintain current expansion without changing it
  const handleAccordionHover = useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    // Don't change expanded state, just clear any pending collapse
  }, [hoverTimeout]);

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
    // Keep accordion expansion when closing lightbox
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

  // Create the grid items array with media items first, then project tiles
  const createGridItems = () => {
    const items: { type: 'media' | 'project' | 'accordion'; project?: Project; media?: MediaItem; originalIndex?: number; imageIndex?: number; imageSrc?: string }[] = [];
    
    // Add media items first (Google Drive content)
    mediaItems.forEach((media) => {
      items.push({ type: 'media', media });
    });
    
    projects.forEach((project, index) => {
      // Add main project tile
      items.push({ type: 'project', project, originalIndex: index });
      
      // If this project is expanded, add its images as full-sized tiles after it
      if (expandedTile === index && project.images && project.images.length > 0) {
        project.images.slice(0, 4).forEach((imageSrc, imageIndex) => {
          items.push({ 
            type: 'accordion', 
            project, 
            originalIndex: index, 
            imageIndex, 
            imageSrc 
          });
        });
      }
    });
    
    return items;
  };

  const gridItems = createGridItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Flexbox flowing grid that supports natural expansion */}
      <div className="flowing-grid">
        {gridItems.map((item, index) => {
          if (item.type === 'media') {
            return (
              <motion.div
                key={`media-${item.media!.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="gallery-tile-wrapper"
              >
                <MediaTile
                  media={item.media!}
                  index={index}
                  onClick={() => openMediaLightbox(item.media!)}
                />
              </motion.div>
            );
          } else if (item.type === 'project') {
            return (
              <motion.div
                key={`project-${item.project.slug}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item.originalIndex! * 0.1, duration: 0.6 }}
                className="gallery-tile-wrapper"
                onMouseEnter={() => handleTileHover(item.originalIndex!)}
                onMouseLeave={handleTileLeave}
              >
                <ProjectTile
                  project={item.project}
                  index={item.originalIndex!}
                  isExpanded={expandedTile === item.originalIndex}
                  onHover={handleTileHover}
                  onClick={expandedTile === item.originalIndex ? () => openLightbox(item.project, 0) : undefined}
                />
              </motion.div>
            );
          } else {
            // Accordion image as full-sized tile
            return (
              <motion.div
                key={`accordion-${item.project.slug}-${item.imageIndex}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="gallery-tile-wrapper accordion-tile"
                onMouseEnter={handleAccordionHover}
                onMouseLeave={handleTileLeave}
              >
                <div
                  className="gallery-tile block relative group focus:outline-none focus-ring cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${item.project.title} image ${item.imageIndex! + 1}`}
                  onClick={() => {
                    // Open lightbox at specific image index (+ 1 to account for cover image)
                    openLightbox(item.project, item.imageIndex! + 1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(item.project, item.imageIndex! + 1);
                    }
                  }}
                >
                  <motion.div className="relative w-full h-full rounded-lg overflow-hidden bg-card border border-border shadow-lg">
                    <img
                      src={item.imageSrc}
                      alt={`${item.project.title} image ${item.imageIndex! + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300"
                      loading="lazy"
                    />
                    
                    {/* Accordion tile overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-accent/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Image index indicator */}
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center">
                      <span className="text-xs font-medium text-foreground">
                        {item.imageIndex! + 1}
                      </span>
                    </div>
                  </motion.div>
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