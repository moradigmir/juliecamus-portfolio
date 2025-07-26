import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ProjectTileProps {
  project: {
    slug: string;
    title: string;
    coverImage: string;
    coverVideo?: string;
    images?: string[];
  };
  index: number;
  isExpanded?: boolean;
  onHover?: (index: number) => void;
}

const ProjectTile: React.FC<ProjectTileProps> = ({ project, index, isExpanded = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLAnchorElement>(null);

  // Intersection observer for mobile video teasers (touch devices)
  useEffect(() => {
    if (!project.coverVideo || !videoRef.current) return;

    const video = videoRef.current;
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    
    if (supportsHover) return; // Only for touch devices

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.currentTime = 0;
            video.play().catch(console.error);
            setTimeout(() => {
              if (video && !video.paused) {
                video.pause();
              }
            }, 2000);
          } else {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [project.coverVideo]);

  return (
    <div className="flex">
      {/* Main Tile */}
      <Link
        ref={tileRef}
        to={`/project/${project.slug}`}
        className="gallery-tile block relative group focus:outline-none focus-ring cursor-pointer flex-shrink-0"
        tabIndex={0}
        role="button"
        aria-label={`View ${project.title} project`}
      >
        <motion.div
          className="relative w-full h-full rounded-lg overflow-hidden bg-card border border-border shadow-lg"
        >
          {project.coverVideo ? (
            <video
              ref={videoRef}
              src={project.coverVideo}
              className="cover-video w-full h-full object-cover transition-transform duration-300 pointer-events-none"
              muted
              loop
              playsInline
              poster={project.coverImage}
            />
          ) : (
            <img
              src={project.coverImage}
              alt={project.title}
              className="w-full h-full object-cover transition-transform duration-300 pointer-events-none"
              loading="lazy"
            />
          )}

          {/* Gradient overlay that appears on hover */}
          <div
            className="video-overlay absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent opacity-0 transition-opacity duration-300 pointer-events-none"
          />

          {/* Title overlay - always visible but more prominent on hover */}
          <div
            className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none"
          >
            <h3 className="font-playfair text-lg font-semibold tracking-wide pointer-events-none">
              {project.title}
            </h3>
          </div>

        </motion.div>
      </Link>

      {/* Right-Side Accordion Preview */}
      {isExpanded && project.images && project.images.length > 0 && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'auto', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="accordion-preview flex overflow-hidden rounded-r-lg border-r border-t border-b border-border bg-card"
          style={{ pointerEvents: 'none' }} // Prevent hover interference
        >
          <div className="flex gap-2 p-4">
            {project.images.slice(0, 4).map((image, idx) => (
              <div 
                key={idx} 
                className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden"
              >
                <img
                  src={image}
                  alt={`${project.title} preview ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {project.images.length > 4 && (
              <div className="flex-shrink-0 w-32 h-32 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground font-medium">
                  +{project.images.length - 4}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProjectTile;