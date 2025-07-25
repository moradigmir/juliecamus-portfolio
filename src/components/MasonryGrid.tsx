import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
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
  // Breakpoint configuration ensuring minimum 3 columns
  const breakpointCols = {
    default: 5,
    1440: 4,
    1024: 4,
    768: 3,
    320: 3
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      <Masonry
        breakpointCols={breakpointCols}
        className="gallery-masonry"
        columnClassName="gallery-masonry-col"
      >
        {projects.map((project, index) => (
          <motion.div
            key={project.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            className="gallery-tile"
          >
            <ProjectTile
              project={project}
              index={index}
            />
          </motion.div>
        ))}
      </Masonry>
    </motion.div>
  );
};

export default MasonryGrid;