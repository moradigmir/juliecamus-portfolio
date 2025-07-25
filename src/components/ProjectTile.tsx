import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

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

const ProjectTile = ({ project, index }: ProjectTileProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 992);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Mobile video teaser on viewport entry
    if (project.coverVideo && tileRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && isMobile && videoRef.current) {
              videoRef.current.play();
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.pause();
                  videoRef.current.currentTime = 0;
                }
              }, 2000); // 2s teaser
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(tileRef.current);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', checkMobile);
      };
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, [project.coverVideo, isMobile]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowPreview(true);
    if (project.coverVideo && videoRef.current && !isMobile) {
      videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    if (videoRef.current && !isMobile) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowPreview(!showPreview);
    } else if (e.key === 'Escape') {
      setShowPreview(false);
    }
  };

  return (
    <div ref={tileRef} className="relative group cursor-pointer">
      <Link to={`/projects/${project.slug}`} className="block w-full h-full">
        <motion.div
          className="relative overflow-hidden rounded-lg"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label={`View ${project.title} project`}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="relative aspect-square overflow-hidden bg-muted rounded-lg shadow-lg"
            style={{
              boxShadow: isHovered ? '0 25px 50px -12px rgba(224, 176, 255, 0.25)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}
          >
            {project.coverVideo ? (
              <video
                ref={videoRef}
                src={project.coverVideo}
                className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
                muted
                loop
                playsInline
                preload="metadata"
                poster={project.coverImage}
              />
            ) : (
              <img
                src={project.coverImage}
                alt={project.title}
                className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
                loading="lazy"
              />
            )}
            
            {/* Hover overlay with gradient */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-4 pointer-events-none"
            >
              <div className="text-white pointer-events-none">
                <h3 className="font-playfair text-lg font-semibold drop-shadow-lg pointer-events-none">
                  {project.title}
                </h3>
              </div>
            </motion.div>

            {/* Inline Preview Panel - renders inside tile to prevent hover flicker */}
            {showPreview && project.images && project.images.length > 0 && !isMobile && (
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="absolute inset-x-0 bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-4 pointer-events-none"
                style={{ 
                  transformOrigin: 'bottom',
                  backdropFilter: 'blur(12px) saturate(180%)'
                }}
              >
                <h4 className="font-playfair text-sm font-semibold mb-2 text-card-foreground pointer-events-none">
                  {project.title}
                </h4>
                <div className="grid grid-cols-3 gap-1 mb-2 pointer-events-none">
                  {project.images.slice(0, 3).map((image, idx) => (
                    <div 
                      key={idx} 
                      className="aspect-square overflow-hidden rounded-sm pointer-events-none"
                    >
                      <img
                        src={image}
                        alt={`${project.title} ${idx + 1}`}
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
              </motion.div>
            )}
          </div>
        </motion.div>
      </Link>

      {/* Mobile Preview Modal (<992px) */}
      {showPreview && project.images && project.images.length > 0 && isMobile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-card rounded-lg p-4 max-w-sm w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-playfair text-lg font-semibold mb-3 text-card-foreground">
              {project.title}
            </h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {project.images.slice(0, 6).map((image, idx) => (
                <div key={idx} className="aspect-square overflow-hidden rounded">
                  <img
                    src={image}
                    alt={`${project.title} ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            {project.images.length > 6 && (
              <p className="text-sm text-primary font-medium mb-3">
                +{project.images.length - 6} more images
              </p>
            )}
            <button 
              onClick={() => setShowPreview(false)}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ProjectTile;