import { motion } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo } from 'react';
import ProjectTile from './ProjectTile';
import AutoMediaTile from './AutoMediaTile';
import { useMediaIndex, type MediaItem, type MediaManifest, type ManifestFileMeta } from '../hooks/useMediaIndex';
import Lightbox from './Lightbox';
import { DiagnosticsModal } from '../debug/DiagnosticsModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Save, Copy, Bug, Download, ArrowUp, Tag, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { diag, flushDiagToEdge, buildDiagSummary } from '../debug/diag';
import { Input } from '@/components/ui/input';
import { normalizeMediaPath } from '@/lib/hidrive';

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

type GridItem = 
  | { type: 'project'; project: Project; index: number }
  | { type: 'media'; media: MediaItem; index: number }
  | { type: 'accordion'; project: Project; imageIndex: number; image: string };

const MasonryGrid = ({ projects }: MasonryGridProps) => {
  const [expandedTile, setExpandedTile] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxProject, setLightboxProject] = useState<Project | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManifestDialog, setShowManifestDialog] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [clearPlaceholders, setClearPlaceholders] = useState(false);
  const [proposedManifest, setProposedManifest] = useState<string>('');
  const [manifestDiff, setManifestDiff] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const { toast } = useToast();

  // Show dev controls only on /?diagnostics=1 route
  const showDevControls = window.location.pathname === '/' && new URLSearchParams(window.location.search).get('diagnostics') === '1';
  
  // Track dev toolbar height and expose as CSS variable
  useEffect(() => {
    if (!showDevControls) {
      document.documentElement.style.setProperty('--dev-toolbar-h', '0px');
      return;
    }
    const toolbar = document.querySelector('[data-dev-toolbar]');
    if (!toolbar) return;
    
    const updateHeight = () => {
      const h = toolbar.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--dev-toolbar-h', `${h}px`);
    };
    updateHeight();
    const obs = new ResizeObserver(updateHeight);
    obs.observe(toolbar);
    return () => obs.disconnect();
  }, [showDevControls]);

  // Auto-open diagnostics if on /?diagnostics=1 route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDiagnosticsMode = params.get('diagnostics') === '1';
    
    if (window.location.pathname === '/' && isDiagnosticsMode) {
      setShowDiagnostics(true);
    }

    // Hide placeholders by default, only show when ?diagnostics=1
    setClearPlaceholders(!isDiagnosticsMode);
  }, []);
  
  // Load auto-discovered media from HiDrive
  const {
    mediaItems: autoMediaItems,
    isLoading: mediaLoading,
    error: mediaError,
    refetch,
    metaStats,
    forceRefreshManifests
  } = useMediaIndex();

  const toMediaUrl = useCallback((folder: string, file: ManifestFileMeta) => {
    return normalizeMediaPath(`/public/${folder}/${file.name}`);
  }, []);

  const isImageFile = useCallback((file: ManifestFileMeta) => {
    if (file.type !== 'file') return false;
    if (file.contentType?.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name);
  }, []);

  const isVideoFile = useCallback((file: ManifestFileMeta) => {
    if (file.type !== 'file') return false;
    if (file.contentType?.startsWith('video/')) return true;
    return /\.(mp4|mov|m4v|webm)$/i.test(file.name);
  }, []);

  // Keep lightbox media in sync with latest metadata (e.g., MANIFEST updates)
  useEffect(() => {
    if (!lightboxMedia) return;
    const latest = autoMediaItems.find((m) => m.folder === lightboxMedia.folder);
    if (latest && (latest.meta !== lightboxMedia.meta || latest.title !== lightboxMedia.title)) {
      setLightboxMedia(latest);
    }
  }, [autoMediaItems, lightboxMedia]);

  // Debounced hover handlers to prevent mouse chase flicker
  const handleTileHover = useCallback((index: number) => {
    setExpandedTile(index);
  }, []);

  const handleTileLeave = useCallback(() => {
    const timeout = setTimeout(() => {
      setExpandedTile(null);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Lightbox handlers
  const openLightbox = useCallback((project: Project, imageIndex: number = 0) => {
    setLightboxProject(project);
    setLightboxMedia(null);
    setLightboxImageIndex(imageIndex);
    setLightboxOpen(true);
  }, []);

  const openMediaLightbox = useCallback((media: MediaItem) => {
    const files = media.files ?? [];
    const imageFiles = files.filter(isImageFile).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (media.fullType === 'image' && media.previewType === 'image' && imageFiles.length > 1) {
      const imageUrls = imageFiles.map((file) => toMediaUrl(media.folder, file));
      const currentUrl = normalizeMediaPath(media.previewUrl || media.fullUrl || imageUrls[0]);
      const currentIndex = Math.max(0, imageUrls.findIndex((url) => url === currentUrl));

      const project: Project = {
        slug: media.folder,
        title: media.title,
        coverImage: imageUrls[0],
        images: imageUrls.slice(1),
      };

      openLightbox(project, currentIndex);
      return;
    }

    const latest = autoMediaItems.find((m) => m.folder === media.folder) || media;
    setLightboxMedia({
      ...latest,
      previewUrl: normalizeMediaPath(latest.previewUrl),
      fullUrl: normalizeMediaPath(latest.fullUrl),
    });
    setLightboxProject(null);
    setLightboxImageIndex(0);
    setLightboxOpen(true);
  }, [autoMediaItems, isImageFile, openLightbox, toMediaUrl]);


  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxProject(null);
    setLightboxMedia(null);
    setLightboxImageIndex(0);
  }, []);

  const nextImage = useCallback(() => {
    if (!lightboxProject) return;
    const allImages = [lightboxProject.coverImage, ...(lightboxProject.images || [])];
    setLightboxImageIndex((prev) => (prev + 1) % allImages.length);
  }, [lightboxProject]);

  const prevImage = useCallback(() => {
    if (!lightboxProject) return;
    const allImages = [lightboxProject.coverImage, ...(lightboxProject.images || [])];
    setLightboxImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  }, [lightboxProject]);

  const handleRefreshManifest = useCallback(async () => {
    setIsRefreshing(true);

    try {
      toast({ title: 'Checking folders...', description: 'Validating local media files' });

      if (autoMediaItems.length === 0) {
        toast({ title: 'No media items', description: 'Nothing to validate yet', variant: 'destructive' });
        return;
      }

      const validationTargets = autoMediaItems.map((item) => item.folder);
      diag('VALIDATE', 'start', { folders: validationTargets });

      const results = await Promise.all(
        autoMediaItems.map(async (item) => {
          const mediaFiles = (item.files ?? []).filter((file) => file.type === 'file');
          const previewCandidate = mediaFiles.find((file) => /^preview\./i.test(file.name))
            ?? mediaFiles.find(isVideoFile)
            ?? mediaFiles.find(isImageFile);

          if (!previewCandidate) {
            diag('VALIDATE', 'folder_fail', {
              folder: item.folder,
              reason: 'No media files listed in manifest',
            });
            return { folder: item.folder, ok: false, reason: 'No media files listed in manifest' };
          }

          const previewUrl = toMediaUrl(item.folder, previewCandidate);
          try {
            const res = await fetch(previewUrl, { method: 'HEAD' });
            const ok = res.ok;
            const ct = res.headers.get('Content-Type') ?? undefined;

            diag('VALIDATE', ok ? 'folder_ok' : 'folder_fail', {
              folder: item.folder,
              file: previewCandidate.name,
              status: res.status,
            });

            if (ok) {
              return { folder: item.folder, ok, status: res.status, file: previewCandidate.name, ct };
            }

            return {
              folder: item.folder,
              ok: false,
              status: res.status,
              file: previewCandidate.name,
              ct,
              reason: `HTTP ${res.status}`,
            };
          } catch (error) {
            diag('VALIDATE', 'folder_fail', {
              folder: item.folder,
              reason: 'HEAD request failed',
            });
            return {
              folder: item.folder,
              ok: false,
              file: previewCandidate.name,
              reason: 'HEAD request failed',
            };
          }
        })
      );

      const okCount = results.filter((r) => r.ok).length;
      const failedCount = results.length - okCount;

      diag('VALIDATE', 'summary', {
        folders_ok: okCount,
        folders_failed: failedCount,
        total: results.length,
      });

      flushDiagToEdge(buildDiagSummary({
        validate_start: validationTargets,
        validate_ok: results
          .filter((r) => r.ok)
          .map((r) => ({
            folder: r.folder,
            file: r.file ?? '',
            status: r.status ?? 0,
            ct: r.ct ?? '',
          })),
        validate_fail: results
          .filter((r) => !r.ok)
          .map((r) => ({
            folder: r.folder,
            reason: r.reason ?? 'Unknown failure',
          })),
        validate_summary: { folders_ok: okCount, folders_failed: failedCount, total: results.length },
      }));

      if (failedCount === 0) {
        toast({
          title: 'All folders OK',
          description: `Verified ${okCount}/${results.length}: ${validationTargets.join(', ')}`,
        });
      } else {
        const failed = results.filter((r) => !r.ok).map((r) => r.folder);
        toast({
          title: `Verified ${okCount}/${results.length}`,
          description: `Failed: ${failed.join(', ')}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Folder check failed:', error);
      toast({ title: 'Check failed', description: 'Unexpected error while checking folders', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [autoMediaItems, toast]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch (error) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  }, [toast]);

  const downloadManifest = useCallback((proposed: string) => {
    try {
      const proposedObject = JSON.parse(proposed);
      const json = JSON.stringify(proposedObject, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "media.manifest.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      // Diagnostics: Log download action
      diag('PERSIST', 'download_manifest_clicked', { count: proposedObject.items?.length || 0 });
      flushDiagToEdge(buildDiagSummary({ manifest_proposed_count: proposedObject.items?.length || 0 }));
      
      toast({ title: 'Downloaded', description: 'Manifest saved as media.manifest.json' });
    } catch (error) {
      toast({ title: 'Download failed', description: 'Could not download manifest', variant: 'destructive' });
    }
  }, [toast]);

  const handleClearPlaceholdersToggle = useCallback((checked: boolean) => {
    setClearPlaceholders(checked);
    
    // Diagnostics: Log toggle change
    diag('ORDER', 'clear_placeholders_toggled', { on: checked });
    
    // Flush to edge with current state
    const currentFolders = autoMediaItems.map(item => item.folder);
    const placeholdersCount = checked ? 0 : projects.length;
    
    flushDiagToEdge(buildDiagSummary({
      items_sorted: currentFolders,
      placeholders_after_real: placeholdersCount
    }));
  }, [autoMediaItems, projects.length]);

  // Compute all unique tags from media items
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();

    autoMediaItems.forEach(item => {
      const tags = (item.meta?.source === 'file' ? item.meta?.tags : undefined) || [];
      tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [autoMediaItems]);

  // Filter media items by selected tags and search text
  const filteredMediaItems = useMemo(() => {
    let filtered = autoMediaItems;
    
    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item => {
        const itemTags = item.meta?.tags || item.tags || [];
        return selectedTags.every(tag => itemTags.includes(tag));
      });
    }
    
    // Apply text search
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item.meta?.title || item.title || '').toLowerCase();
        const description = (item.meta?.description || item.description || '').toLowerCase();
        const tags = (item.meta?.tags || item.tags || []).join(' ').toLowerCase();
        return title.includes(search) || description.includes(search) || tags.includes(search);
      });
    }
    
    return filtered;
  }, [autoMediaItems, selectedTags, searchText]);

  const createGridItems = useCallback((): GridItem[] => {
    const items: GridItem[] = [];
    
    // FIRST: Add all filtered real media items (sorted numerically by folder)
    filteredMediaItems.forEach((media, index) => {
      items.push({ 
        type: 'media', 
        media, 
        index: items.length 
      });
    });
    
    // SECOND: Add projects with accordion expansion (these act as placeholders)
    // Only add if clearPlaceholders is false
    if (!clearPlaceholders) {
      projects.forEach((project, projectIndex) => {
        const itemIndex = items.length;
        
        // Add the main project tile
        items.push({ 
          type: 'project', 
          project, 
          index: itemIndex 
        });
        
        // Add accordion images if this project is expanded
        if (expandedTile === itemIndex && project.images) {
          project.images.forEach((image, imageIndex) => {
            items.push({ 
              type: 'accordion', 
              project, 
              imageIndex, 
              image 
            });
          });
        }
      });
    }

    // Diagnostics: Log current state after item creation
    const currentFolders = autoMediaItems.map(item => item.folder);
    const placeholdersCount = clearPlaceholders ? 0 : projects.length;
    
    diag('ORDER', 'items_sorted', { folders: currentFolders });
    diag('ORDER', 'placeholders_after_real', { count: placeholdersCount });
    
    // Flush current state to edge (only if not from toggle - avoid double flush)
    flushDiagToEdge(buildDiagSummary({
      items_sorted: currentFolders,
      placeholders_after_real: placeholdersCount
    }));
    
    return items;
  }, [projects, expandedTile, filteredMediaItems, clearPlaceholders]);

  const gridItems = createGridItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Diagnostic Panel - Only show when debug=1 */}
      {showDevControls && (
        <motion.div data-dev-toolbar className="mb-6 space-y-3">
          {/* Tag Filter Row */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
              <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                {allTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev => 
                          isSelected 
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                      className={`
                        px-2 py-1 text-xs rounded-full transition-colors
                        ${isSelected 
                          ? 'bg-charcoal text-off-white' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      {tag}
                    </button>
                  );
                })}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Input
                type="text"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-40 h-8 text-xs"
              />
              {(selectedTags.length > 0 || searchText) && (
                <Badge variant="outline" className="text-xs">
                  {filteredMediaItems.length} of {autoMediaItems.length}
                </Badge>
              )}
            </div>
          )}
          
          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1 border rounded">
                      <Switch
                        id="clear-placeholders"
                        checked={clearPlaceholders}
                        onCheckedChange={handleClearPlaceholdersToggle}
                        className="scale-75"
                      />
                      <label htmlFor="clear-placeholders" className="text-xs cursor-pointer">
                        Clear placeholders
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hide placeholder projects so only real HiDrive folders are shown</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button 
                onClick={handleRefreshManifest} 
                variant="outline" 
                size="sm" 
                disabled={isRefreshing}
                className="text-xs"
              >
                {isRefreshing ? 'Checking...' : 'Check Folders'}
              </Button>
              <Button 
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                variant="outline" 
                size="sm"
                className="text-xs"
              >
                <Bug className="w-3 h-3 mr-1" />
                Diagnostics
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Placeholders: {clearPlaceholders ? 'OFF' : 'ON'}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {autoMediaItems.length > 0 ? (
                  `${autoMediaItems.length} auto-discovered media items`
                ) : (
                  'No media loaded'
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Show loading or error states */}
      {/* Flowing grid */}
      <div className="flowing-grid">
        {gridItems.map((item, idx) => {
          if (item.type === 'project') {
            return (
              <ProjectTile
                key={`project-${item.project.slug}-${item.index}`}
                project={item.project}
                index={item.index}
                onHover={handleTileHover}
                onClick={() => openLightbox(item.project, 0)}
              />
            );
          } else if (item.type === 'media') {
            return (
              <div key={`media-${item.media.folder}`} className="relative">
                <AutoMediaTile
                  media={item.media}
                  index={item.index}
                  onHover={() => {}}
                  onLeave={() => {}}
                  onClick={openMediaLightbox}
                />
                {/* Show metadata description if available */}
                {item.media.meta?.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
                    <p className="truncate" title={item.media.meta.description}>
                      {item.media.meta.description.length > 120 
                        ? item.media.meta.description.slice(0, 120) + '...'
                        : item.media.meta.description
                      }
                    </p>
                  </div>
                )}
              </div>
            );
          } else if (item.type === 'accordion') {
            return (
              <motion.div
                key={`accordion-${item.project.slug}-${item.imageIndex}-${idx}`}
                className="gallery-tile-wrapper accordion-tile"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, delay: item.imageIndex * 0.05 }}
              >
                <div 
                  className="gallery-tile accordion-preview cursor-pointer"
                  onClick={() => openLightbox(item.project, item.imageIndex)}
                >
                  <img
                    src={item.image}
                    alt={`${item.project.title} - Image ${item.imageIndex + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              </motion.div>
            );
          }
          return null;
        })}
      </div>

      {/* Back to top button */}
      {gridItems.length > 0 && (
        <div className="flex justify-center mt-16 mb-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex flex-col items-center gap-2 px-6 py-4 bg-muted hover:bg-accent rounded-lg transition-all duration-300 hover:scale-105"
            aria-label="Back to top"
          >
            <ArrowUp className="w-6 h-6 text-foreground animate-bounce" />
            <span className="text-sm font-inter text-foreground">Back to top</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        project={lightboxProject}
        media={lightboxMedia}
        imageIndex={lightboxImageIndex}
        onClose={closeLightbox}
        onNext={nextImage}
        onPrev={prevImage}
      />

      {/* Diagnostics Modal */}
      <DiagnosticsModal 
        open={showDiagnostics} 
        onOpenChange={setShowDiagnostics}
      />
    </motion.div>
  );
};

export default MasonryGrid;