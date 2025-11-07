import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import Navigation from '../components/Navigation';
import HeroSplashMatch from '../components/HeroSplashMatch';
import MasonryGrid from '../components/MasonryGrid';
import ManifestEditor from '../components/ManifestEditor';
import ScrollToTop from '../components/ScrollToTop';
import { Button } from '@/components/ui/button';
import { projects } from '../data/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaIndex } from '@/hooks/useMediaIndex';

const Index = () => {
  const isMobile = useIsMobile();
  const [editorOpen, setEditorOpen] = useState(false);
  const { mediaItems, refetch } = useMediaIndex();
  
  const handleEditorSave = () => {
    // Trigger refetch of media items to reflect updated metadata
    refetch();
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSplashMatch />
      
      {/* Floating Edit Button */}
      <Button
        onClick={() => setEditorOpen(true)}
        className="fixed bottom-6 right-6 z-50 shadow-lg"
        size="lg"
      >
        <Edit3 className="w-5 h-5 mr-2" />
        Edit Manifests
      </Button>

      {/* Manifest Editor Dialog */}
      <ManifestEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mediaItems={mediaItems}
        onSave={handleEditorSave}
      />
      
      {/* Projects Gallery - starts immediately after hero */}
      <section style={{ paddingTop: "0px", marginTop: "0px", paddingBottom: "96px" }}>
        <MasonryGrid projects={projects} />
      </section>
      
      <ScrollToTop />
    </div>
  );
};

export default Index;
