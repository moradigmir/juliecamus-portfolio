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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.6 }}
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
            transition={{ duration: 0.3 }}
            className="relative aspect-[4/5] overflow-hidden bg-muted rounded-lg"
          >
            {project.coverVideo ? (
              <video
                ref={videoRef}
                src={project.coverVideo}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                poster={project.coverImage}
              />
            ) : (
              <img
                src={project.coverImage}
                alt={project.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            
            {/* Hover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              className="absolute inset-0 bg-black/20 flex items-end p-4"
            >
              <div className="text-white">
                <h3 className="font-playfair text-lg font-semibold">
                  {project.title}
                </h3>
              </div>
            </motion.div>
            
            {/* Subtle shadow on hover */}
            {isHovered && (
              <div className="absolute inset-0 shadow-2xl shadow-primary/20 rounded-lg" />
            )}
          </motion.div>
        </Link>
      </motion.div>

      {/* Preview Panel for larger screens */}
      {showPreview && project.images && project.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="hidden lg:block absolute left-full top-0 ml-4 w-80 bg-card border border-border rounded-lg p-4 shadow-xl z-10"
        >
          <h4 className="font-playfair text-lg font-semibold mb-3 text-card-foreground">
            {project.title}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {project.images.slice(0, 4).map((image, idx) => (
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
          {project.images.length > 4 && (
            <p className="text-sm text-muted-foreground mt-2">
              +{project.images.length - 4} more images
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ProjectTile;