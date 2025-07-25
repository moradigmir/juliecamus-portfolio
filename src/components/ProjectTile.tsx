import { useState, useRef } from 'react';
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
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowPreview(true);
    if (project.coverVideo && videoRef.current) {
      videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    if (videoRef.current) {
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
    <div className="relative group">
      <motion.div
        className="relative overflow-hidden rounded-lg cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View ${project.title} project`}
      >
        <Link to={`/projects/${project.slug}`}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.25 }}
            className="relative aspect-[4/5] overflow-hidden bg-muted rounded-lg shadow-lg"
            style={{
              boxShadow: isHovered ? '0 25px 50px -12px rgba(224, 176, 255, 0.25)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}
          >
            {project.coverVideo ? (
              <video
                ref={videoRef}
                src={project.coverVideo}
                className="w-full h-full object-cover transition-all duration-300"
                muted
                loop
                playsInline
                poster={project.coverImage}
              />
            ) : (
              <img
                src={project.coverImage}
                alt={project.title}
                className="w-full h-full object-cover transition-all duration-300"
                loading="lazy"
              />
            )}
            
            {/* Hover overlay with gradient */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-4"
            >
              <div className="text-white">
                <h3 className="font-playfair text-lg font-semibold drop-shadow-lg">
                  {project.title}
                </h3>
              </div>
            </motion.div>
          </motion.div>
        </Link>
      </motion.div>

      {/* Preview Panel for desktop (≥992px) */}
      {showPreview && project.images && project.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="hidden lg:block absolute left-full top-0 ml-4 w-80 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-2xl z-20"
          style={{ boxShadow: '0 25px 50px -12px rgba(224, 176, 255, 0.25)' }}
        >
          <h4 className="font-playfair text-lg font-semibold mb-3 text-card-foreground">
            {project.title}
          </h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {project.images.slice(0, 4).map((image, idx) => (
              <motion.div 
                key={idx} 
                className="aspect-square overflow-hidden rounded"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <img
                  src={image}
                  alt={`${project.title} ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
          {project.images.length > 4 && (
            <p className="text-sm text-primary font-medium">
              +{project.images.length - 4} more images
            </p>
          )}
        </motion.div>
      )}

      {/* Mobile Preview Modal (<992px) */}
      {showPreview && project.images && project.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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