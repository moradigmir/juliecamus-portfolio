import Navigation from '../components/Navigation';
import HeroSplashMatch from '../components/HeroSplashMatch';
import MasonryGrid from '../components/MasonryGrid';
import { projects } from '../data/projects';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSplashMatch />
      
      {/* Projects Gallery - starts immediately after hero */}
      <section style={{ paddingTop: isMobile ? "0px" : "64px", marginTop: "0px", paddingBottom: "96px" }}>
        <MasonryGrid projects={projects} />
      </section>
    </div>
  );
};

export default Index;
