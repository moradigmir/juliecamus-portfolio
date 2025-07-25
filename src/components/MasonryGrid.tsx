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
      if (window.innerWidth < 640) {
        setColumns(1);
      } else if (window.innerWidth < 1024) {
        setColumns(2);
      } else {
        setColumns(3);
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
      className="grid gap-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {columnArrays.map((column, columnIndex) => (
        <div key={columnIndex} className="space-y-4">
          {column.map((project, projectIndex) => (
            <ProjectTile
              key={project.slug}
              project={project}
              index={columnIndex * Math.ceil(projects.length / columns) + projectIndex}
            />
          ))}
        </div>
      ))}
    </motion.div>
  );
};

export default MasonryGrid;