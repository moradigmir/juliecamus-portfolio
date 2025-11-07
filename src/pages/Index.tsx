import Navigation from '../components/Navigation';
import HeroSplashMatch from '../components/HeroSplashMatch';
import MasonryGrid from '../components/MasonryGrid';
import ScrollToTop from '../components/ScrollToTop';
import { projects } from '../data/projects';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSplashMatch />
      
      {/* Projects Gallery - starts immediately after hero */}
      <section style={{ paddingTop: "0px", marginTop: "0px", paddingBottom: "96px" }}>
        <MasonryGrid projects={projects} />
      </section>
      
      <ScrollToTop />
    </div>
  );
};

export default Index;
