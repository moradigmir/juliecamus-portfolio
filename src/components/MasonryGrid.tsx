import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 1024) {
        setColumns(3); // Minimum 3 columns at all times
      } else if (window.innerWidth < 1440) {
        setColumns(4);
      } else {
        setColumns(5);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Create columns array
  const columnArrays = Array.from({ length: columns }, () => [] as Project[]);
  
  // Distribute projects across columns
  projects.forEach((project, index) => {
    columnArrays[index % columns].push(project);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="gallery-grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {projects.map((project, index) => (
        <motion.div
          key={project.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.6 }}
        >
          <ProjectTile
            project={project}
            index={index}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default MasonryGrid;