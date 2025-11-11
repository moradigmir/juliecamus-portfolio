import { useState } from 'react';
import React from 'react';
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
  const { mediaItems, refetch, forceRefreshManifests } = useMediaIndex();
  const showEditButton = typeof window !== 'undefined' && 
    new URLSearchParams(window.location.search).get('diagnostics') === '1';
  
  // DEBUG: Force reload manifest to bypass cache
  React.useEffect(() => {
    const forceReload = () => {
      fetch('/media.manifest.json?t=' + Date.now())
        .then(r => r.json())
        .then(manifest => {
          console.log('DEBUG: Manifest loaded with', manifest.items.length, 'items');
        });
    };
    forceReload();
  }, []);
  
  const handleEditorSave = async () => {
    // Trigger refetch of media items to reflect updated metadata
    await refetch();
    // Force refresh manifests to reload metadata from disk
    await forceRefreshManifests();
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSplashMatch />
      
      {/* Floating Edit Button - only visible with ?diagnostics=1 */}
      {showEditButton && (
        <Button
          onClick={() => setEditorOpen(true)}
          className="fixed bottom-6 right-6 z-50 shadow-lg"
          size="lg"
        >
          <Edit3 className="w-5 h-5 mr-2" />
          Edit Manifests
        </Button>
      )}

      {/* Manifest Editor Dialog */}
      <ManifestEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mediaItems={mediaItems}
        onSave={handleEditorSave}
      />
      
      {/* Projects Gallery - starts immediately after hero */}
      <section id="gallery" style={{ paddingTop: "clamp(120px, 15vh, 180px)", marginTop: "0px", paddingBottom: "96px" }}>
        <MasonryGrid />
      </section>
      
      <ScrollToTop />
    </div>
  );
};

export default Index;
