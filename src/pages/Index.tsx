import { motion } from 'framer-motion';
import Navigation from '../components/Navigation';
import MasonryGrid from '../components/MasonryGrid';
import { projects } from '../data/projects';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="pt-24 pb-12 text-center"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-playfair text-4xl md:text-6xl font-bold text-foreground mb-6">
            Julie Camus
          </h1>
          <p className="font-inter text-xl md:text-2xl text-muted-foreground mb-8">
            French High-End Makeup Artist
          </p>
          <p className="font-inter text-lg text-muted-foreground max-w-2xl mx-auto">
            Specializing in editorial, fashion, and artistic makeup with over a decade of experience 
            in the luxury beauty industry across Paris, Milan, and New York.
          </p>
        </div>
      </motion.section>

      {/* Projects Gallery */}
      <section className="pb-24">
        <MasonryGrid projects={projects} />
      </section>
    </div>
  );
};

export default Index;
