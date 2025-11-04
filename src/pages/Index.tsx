import Navigation from '../components/Navigation';
import HeroSplashMatch from '../components/HeroSplashMatch';
import MasonryGrid from '../components/MasonryGrid';
import { projects } from '../data/projects';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSplashMatch />

      {/* Projects Gallery */}
      <section className="pb-24">
        <MasonryGrid projects={projects} />
      </section>
    </div>
  );
};

export default Index;
