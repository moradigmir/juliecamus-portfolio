import { motion } from 'framer-motion';
import { useState } from 'react';
import ProjectTile from './ProjectTile';

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

const MasonryGrid = ({ projects }: MasonryGridProps) => {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);

  const handleTileHover = (index: number) => {
    setExpandedTile(index);
  };

  const handleTileLeave = () => {
    setExpandedTile(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Dynamic flowing grid that supports expansion */}
      <div className="flowing-grid">
        {projects.map((project, index) => (
          <motion.div
            key={project.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            className={`gallery-tile-wrapper ${expandedTile === index ? 'expanded' : ''}`}
            onMouseEnter={() => handleTileHover(index)}
            onMouseLeave={handleTileLeave}
          >
            <ProjectTile
              project={project}
              index={index}
              isExpanded={expandedTile === index}
              onHover={handleTileHover}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default MasonryGrid;