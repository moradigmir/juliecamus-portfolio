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
}

const ProjectTile: React.FC<ProjectTileProps> = ({ project, index }) => {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
    >
      <Link
        ref={tileRef}
        to={`/project/${project.slug}`}
        className="gallery-tile block relative group focus:outline-none focus-ring cursor-pointer"
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

          {/* Inline Preview Panel - renders inside tile to prevent hover flicker */}
          {project.images && project.images.length > 0 && (
            <div
              className="tile-preview absolute inset-x-0 bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-4 pointer-events-none"
              style={{ 
                backdropFilter: 'blur(12px) saturate(180%)'
              }}
            >
              <div className="grid grid-cols-3 gap-2 mb-3 pointer-events-none">
                {project.images.slice(0, 3).map((image, idx) => (
                  <div key={idx} className="aspect-square rounded overflow-hidden pointer-events-none">
                    <img
                      src={image}
                      alt={`${project.title} preview ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              
              {project.images.length > 3 && (
                <p className="text-xs text-primary font-medium pointer-events-none">
                  +{project.images.length - 3} more images
                </p>
              )}
            </div>
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default ProjectTile;