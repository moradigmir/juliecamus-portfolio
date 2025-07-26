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

  // Create the grid items array with accordion images as full-sized tiles
  const createGridItems = () => {
    const items: { type: 'project' | 'accordion'; project: Project; originalIndex?: number; imageIndex?: number; imageSrc?: string }[] = [];
    
    projects.forEach((project, index) => {
      // Add main project tile
      items.push({ type: 'project', project, originalIndex: index });
      
      // If this project is expanded, add its images as full-sized tiles after it
      if (expandedTile === index && project.images && project.images.length > 0) {
        project.images.slice(0, 4).forEach((imageSrc, imageIndex) => {
          items.push({ 
            type: 'accordion', 
            project, 
            originalIndex: index, 
            imageIndex, 
            imageSrc 
          });
        });
      }
    });
    
    return items;
  };

  const gridItems = createGridItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Flexbox flowing grid that supports natural expansion */}
      <div className="flowing-grid">
        {gridItems.map((item, index) => {
          if (item.type === 'project') {
            return (
              <motion.div
                key={`project-${item.project.slug}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item.originalIndex! * 0.1, duration: 0.6 }}
                className="gallery-tile-wrapper"
                onMouseEnter={() => handleTileHover(item.originalIndex!)}
                onMouseLeave={handleTileLeave}
              >
                <ProjectTile
                  project={item.project}
                  index={item.originalIndex!}
                  isExpanded={false}
                  onHover={handleTileHover}
                />
              </motion.div>
            );
          } else {
            // Accordion image as full-sized tile
            return (
              <motion.div
                key={`accordion-${item.project.slug}-${item.imageIndex}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="gallery-tile-wrapper accordion-tile"
              >
                <div
                  className="gallery-tile block relative group focus:outline-none focus-ring cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${item.project.title} image ${item.imageIndex! + 1}`}
                  onClick={() => {
                    // Navigate to project detail with image index
                    window.location.href = `/project/${item.project.slug}?image=${item.imageIndex}`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.location.href = `/project/${item.project.slug}?image=${item.imageIndex}`;
                    }
                  }}
                >
                  <motion.div className="relative w-full h-full rounded-lg overflow-hidden bg-card border border-border shadow-lg">
                    <img
                      src={item.imageSrc}
                      alt={`${item.project.title} image ${item.imageIndex! + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300"
                      loading="lazy"
                    />
                    
                    {/* Accordion tile overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-accent/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Image index indicator */}
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center">
                      <span className="text-xs font-medium text-foreground">
                        {item.imageIndex! + 1}
                      </span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          }
        })}
      </div>
    </motion.div>
  );
};

export default MasonryGrid;