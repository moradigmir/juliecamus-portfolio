import Navigation from '../components/Navigation';
import HeroSplashMatch from '../components/HeroSplashMatch';
import MasonryGrid from '../components/MasonryGrid';
import { projects } from '../data/projects';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div style={{ paddingTop: "64px" }}>
        <HeroSplashMatch />

        {/* Projects Gallery - starts immediately after hero */}
        <section style={{ marginTop: "18px", paddingBottom: "96px" }}>
          <MasonryGrid projects={projects} />
        </section>
      </div>
    </div>
  );
};

export default Index;
