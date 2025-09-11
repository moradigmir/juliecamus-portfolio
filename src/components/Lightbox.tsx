import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '../lib/mediaConfig';

interface Project {
  slug: string;
  title: string;
  coverImage: string;
  coverVideo?: string;
  images?: string[];
}

interface LightboxProps {
  isOpen: boolean;
  project?: Project | null;
  media?: MediaItem | null;
  imageIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({
  isOpen,
  project,
  media,
  imageIndex,
  onClose,
  onNext,
  onPrev
}) => {
  // Handle media vs project content
  const title = media ? media.title : project?.title || '';
  const isVideo = media?.fullType === 'video';
  
  // Get all images/content
  let allContent: string[] = [];
  if (media) {
    allContent = [media.fullUrl];
  } else if (project) {
    allContent = [project.coverImage, ...(project.images || [])];
  }
  
  const currentContent = allContent[imageIndex];
  const hasNavigation = allContent.length > 1 && !media; // Media items don't have navigation

  // Keyboard navigation (disabled for media items since they're single content)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasNavigation) {
            e.preventDefault();
            onPrev();
          }
          break;
        case 'ArrowRight':
          if (hasNavigation) {
            e.preventDefault();
            onNext();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasNavigation, onClose, onNext, onPrev]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!project && !media) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
            aria-label="Close lightbox"
          >
            <X size={24} />
          </button>

          {/* Navigation buttons - only show for projects with multiple images */}
          {hasNavigation && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors disabled:opacity-50"
                disabled={imageIndex === 0}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors disabled:opacity-50"
                disabled={imageIndex === allContent.length - 1}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Content container */}
          <div
            className="flex items-center justify-center w-full h-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideo ? (
              <motion.div
                key={currentContent}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-4xl max-h-full"
              >
                {media?.fullUrl?.includes('drive.google.com/file') ? (
                  <iframe
                    src={currentContent}
                    className="w-full aspect-video rounded-lg shadow-2xl"
                    frameBorder="0"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={currentContent}
                    className="w-full aspect-video rounded-lg shadow-2xl"
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
              </motion.div>
            ) : (
              <motion.img
                key={currentContent}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                src={currentContent}
                alt={`${title} image ${imageIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>

          {/* Content counter - only show for projects with multiple images */}
          {hasNavigation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-sm text-foreground">
                {imageIndex + 1} / {allContent.length}
              </span>
            </div>
          )}

          {/* Title */}
          <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
            <h2 className="text-lg font-playfair font-semibold text-foreground">
              {title}
            </h2>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Lightbox;