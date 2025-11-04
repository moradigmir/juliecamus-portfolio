import { motion } from 'framer-motion';
import Navigation from '../components/Navigation';
import MasonryGrid from '../components/MasonryGrid';
import { projects } from '../data/projects';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Projects Gallery */}
      <section className="pt-24 md:pt-28 pb-24">
        <MasonryGrid projects={projects} />
      </section>
    </div>
  );
};

export default Index;
