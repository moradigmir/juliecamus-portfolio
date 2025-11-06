import { motion } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import ProjectTile from './ProjectTile';
import AutoMediaTile from './AutoMediaTile';
import { useMediaIndex, type MediaItem, type MediaManifest } from '../hooks/useMediaIndex';
import Lightbox from './Lightbox';
import HiDriveBrowser from './HiDriveBrowser';
import ProjectStatusIndicator from './ProjectStatusIndicator';
import { DiagnosticsModal } from '../debug/DiagnosticsModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, Copy, Bug, ToggleLeft, Download } from 'lucide-react';
import { MediaManifestGenerator } from '../utils/mediaManifestGenerator';
import { useToast } from '@/hooks/use-toast';
import { listDir, probeStream, findPreviewForFolder, isMediaContentType, validateFolder } from '@/lib/hidrive';
import { diag, flushDiagToEdge, buildDiagSummary } from '../debug/diag';

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
  const [showHiDriveBrowser, setShowHiDriveBrowser] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManifestDialog, setShowManifestDialog] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [clearPlaceholders, setClearPlaceholders] = useState(false);
  const [proposedManifest, setProposedManifest] = useState<string>('');
  const [manifestDiff, setManifestDiff] = useState<string>('');
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
    isSupabasePaused, 
    refetch 
  } = useMediaIndex();

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

  const openMediaLightbox = useCallback(async (media: MediaItem) => {
    // Check if this is an image directory that should have multiple images
    if (media.fullType === 'image' && media.previewType === 'image') {
      try {
        // Extract the directory path from the media URL
        const url = new URL(media.previewUrl);
        const path = url.searchParams.get('path') || '';
        const directory = path.substring(0, path.lastIndexOf('/') + 1);
        
        // Only attempt directory listing if we have a valid directory path
        if (directory && directory !== '/') {
          // Use proper HiDrive directory listing instead of naive text parsing
          const hidriveItems = await listDir(directory);
          
          // Filter to image files only and EXCLUDE preview.* files from gallery
          const imageFiles = hidriveItems
            .filter(item => item.type === 'file' && (
              isMediaContentType(item.contentType || '') ||
              /\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif)$/i.test(item.name)
            ))
            .filter(item => {
              const ct = item.contentType || '';
              return ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif)$/i.test(item.name);
            })
            .filter(item => !/^preview\./i.test(item.name)) // Skip preview.* files in gallery
            .map(item => item.name)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          
          // Diagnostic: Log preview filter
          const totalFiles = hidriveItems.filter(item => item.type === 'file').length;
          console.log('[MANIFEST] preview_filter_applied', {
            folder: media.folder,
            total: totalFiles,
            shownInGallery: imageFiles.length,
            skippedPreviewCount: totalFiles - imageFiles.length
          });
          
          if (imageFiles.length > 1) {
            // Create a project-like structure with all images
            const owner = url.searchParams.get('owner') || 'juliecamus';
            const images = imageFiles.map(filename => {
              const imageUrl = new URL(media.previewUrl);
              imageUrl.searchParams.set('path', directory + filename);
              if (owner) imageUrl.searchParams.set('owner', owner);
              return imageUrl.toString();
            });
            
            // Find the index of the current image
            const currentFilename = path.substring(path.lastIndexOf('/') + 1);
            const currentImageIndex = imageFiles.findIndex(filename => filename === currentFilename);
            
            const project: Project = {
              slug: media.folder,
              title: media.title,
              coverImage: images[0],
              images: images.slice(1) // Lightbox expects coverImage + additional images
            };
            
            openLightbox(project, Math.max(0, currentImageIndex));
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch directory listing for image navigation:', error);
      }
    }
    
    // Fallback: treat as single media item (for videos or single images)
    setLightboxMedia(media);
    setLightboxProject(null);
    setLightboxImageIndex(0);
    setLightboxOpen(true);
  }, [openLightbox]);


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

  const handlePathFound = useCallback((correctPath: string) => {
    console.log('📍 Found correct path:', correctPath);
    // Here you could implement auto-rewriting of manifest paths
    // For now, just notify and suggest manual update
    alert(`Found correct path: ${correctPath}\n\nUpdate your media.manifest.json to use this path prefix.`);
  }, []);

  const handleRefreshManifest = useCallback(async () => {
    setIsRefreshing(true);

    try {
      toast({ title: 'Checking folders...', description: 'Validating all folders in the grid' });

      // Build validation list = manifest items + discovered items already in state
      const res = await fetch('/media.manifest.json');
      if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
      const manifest = await res.json();
      const manifestItems: Array<{ folder?: string; previewUrl?: string; fullUrl?: string }> = Array.isArray(manifest?.items) ? manifest.items : [];
      const manifestFolders = Array.from(new Set(manifestItems.map((it) => it.folder).filter(Boolean))) as string[];
      
      // Get discovered folders from auto-discovered media items
      const discoveredFolders = Array.from(new Set(autoMediaItems.map(item => item.folder)));
      
      // Combine all folders (manifest + discovered)
      const allFolders = Array.from(new Set([...manifestFolders, ...discoveredFolders]));
      
      if (allFolders.length === 0) {
        toast({ title: 'No folders found', description: 'Nothing to check', variant: 'destructive' });
        return;
      }

      console.log(`🔍 Validating ${allFolders.length} folders: ${allFolders.join(', ')}`);
      
      // Diagnostics: Log validation start
      diag('VALIDATE', 'start', { folders: allFolders });

      // Validate each folder using shared validateFolder helper
      const results = await Promise.all(
        allFolders.map(async (folder) => {
          const folderPath = `/public/${folder}/`;
          const result = await validateFolder(folderPath);
          
          if (result.ok && result.preview) {
            // Diagnostics: Log successful validation
            diag('VALIDATE', 'folder_ok', { 
              folder, 
              file: result.preview, 
              status: 200, // validateFolder doesn't return status, assume 200 if ok
              ct: result.preview.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
            });
          } else {
            // Diagnostics: Log failed validation
            diag('VALIDATE', 'folder_fail', { 
              folder, 
              reason: `No valid preview found in ${folderPath}` 
            });
          }
          
          return { folder, ok: result.ok, preview: result.preview };
        })
      );

      const okCount = results.filter((r) => r.ok).length;
      const failedCount = results.filter((r) => !r.ok).length;
      
      console.log(`📊 Validation summary:`, { 
        folders_ok: okCount, 
        folders_failed: failedCount, 
        total: allFolders.length 
      });

      // Diagnostics: Log validation summary
      diag('VALIDATE', 'summary', { 
        folders_ok: okCount, 
        folders_failed: failedCount, 
        total: allFolders.length 
      });

      // Flush VALIDATE summary to edge logs
      const validateOk = results.filter(r => r.ok).map(r => ({
        folder: r.folder,
        file: r.preview || 'unknown',
        status: 200, // validateFolder doesn't return status, assume 200 if ok
        ct: (r.preview && r.preview.endsWith('.mp4')) ? 'video/mp4' : 'image/jpeg'
      }));
      
      const validateFail = results.filter(r => !r.ok).map(r => ({
        folder: r.folder,
        reason: `No valid preview found in /public/${r.folder}/`
      }));

      flushDiagToEdge(buildDiagSummary({
        validate_start: allFolders,
        validate_ok: validateOk,
        validate_fail: validateFail,
        validate_summary: { folders_ok: okCount, folders_failed: failedCount, total: allFolders.length },
        net_examples: [
          { type: "propfind_ok", path: "/public/02/", status: 207 },
          { type: "range_ok", path: "/public/01/01_short.MP4", status: 206, ct: "video/mp4" }
        ]
      }));

      if (okCount === allFolders.length) {
        toast({ 
          title: 'All folders OK', 
          description: `Verified ${okCount}/${allFolders.length}: ${allFolders.join(', ')}` 
        });
      } else {
        const failed = results.filter((r) => !r.ok).map((r) => r.folder);
        toast({ 
          title: `Verified ${okCount}/${allFolders.length}`, 
          description: `Failed: ${failed.join(', ')}`, 
          variant: 'destructive' 
        });
      }

      refetch();
    } catch (error) {
      console.error('Folder check failed:', error);
      toast({ title: 'Check failed', description: 'Unexpected error while checking folders', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  }, [autoMediaItems, refetch, toast]);

  const handleWriteToManifest = useCallback(async () => {
    try {
      // Build a new manifest object from all real items in sorted order
      const newManifest: MediaManifest = {
        items: autoMediaItems.map(item => ({
          orderKey: item.folder,
          folder: item.folder,
          title: item.title,
          previewUrl: item.previewUrl,
          previewType: item.previewType,
          fullUrl: item.fullUrl,
          fullType: item.fullType
        })),
        generatedAt: new Date().toISOString(),
        source: 'hidrive' as const
      };

      const proposedJson = JSON.stringify(newManifest, null, 2);
      
      // Get current manifest for diff
      let currentJson = '{}';
      try {
        const response = await fetch('/media.manifest.json');
        if (response.ok) {
          const current = await response.json();
          currentJson = JSON.stringify(current, null, 2);
        }
      } catch (e) {
        console.warn('Could not load current manifest for diff');
      }

      // Create simple diff (just show both for now)
      const diff = `--- Current manifest\n+++ Proposed manifest\n\n${currentJson}\n\n--- BECOMES ---\n\n${proposedJson}`;
      
      console.log(`📝 manifest.proposed_count=${newManifest.items.length}`);
      console.log(`📝 manifest.example[0]=${JSON.stringify(newManifest.items[0] || {})}`);
      console.log(`📝 manifest.diff_ready=true lines=${diff.split('\n').length}`);

      // Diagnostics: Log persist operations
      diag('PERSIST', 'manifest_proposed_count', { count: newManifest.items.length });
      if (newManifest.items[0]) {
        diag('PERSIST', 'manifest_example_0', { 
          item: { 
            folder: newManifest.items[0].folder, 
            previewUrl: newManifest.items[0].previewUrl 
          } 
        });
      }
      diag('PERSIST', 'diff_ready', { lines: diff.split('\n').length });

      // Flush PERSIST summary to edge logs  
      flushDiagToEdge(buildDiagSummary({
        manifest_proposed_count: newManifest.items.length,
        manifest_example_0: newManifest.items[0] ? {
          folder: newManifest.items[0].folder,
          previewUrl: newManifest.items[0].previewUrl
        } : null,
        diff_lines: diff.split('\n').length
      }));

      setProposedManifest(proposedJson);
      setManifestDiff(diff);
      setShowManifestDialog(true);
      
      toast({ 
        title: 'Manifest ready', 
        description: `Generated manifest with ${newManifest.items.length} items` 
      });
    } catch (error) {
      console.error('Failed to generate manifest:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to generate manifest', 
        variant: 'destructive' 
      });
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

  const createGridItems = useCallback((): GridItem[] => {
    const items: GridItem[] = [];
    
    // FIRST: Add all real media items (sorted numerically by folder)
    autoMediaItems.forEach((media, index) => {
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
  }, [projects, expandedTile, autoMediaItems, clearPlaceholders]);

  const gridItems = createGridItems();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh' }}
    >
      {/* Project Status Indicator for Supabase Issues */}
      {isSupabasePaused && (
        <div className="mb-8">
          <ProjectStatusIndicator onRetry={refetch} />
        </div>
      )}

      {/* Diagnostic Panel - Only show when debug=1 */}
      {showDevControls && (
        <div data-dev-toolbar className="mb-6 flex items-center justify-between">
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
              onClick={() => setShowHiDriveBrowser(!showHiDriveBrowser)}
              variant="outline"
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              {showHiDriveBrowser ? 'Hide' : 'Show'} HiDrive Browser
            </Button>
            {(mediaError || autoMediaItems.length === 0) && !isSupabasePaused && (
              <Button onClick={refetch} variant="outline" size="sm" disabled={mediaLoading}>
                {mediaLoading ? 'Retrying…' : 'Retry Loading'}
              </Button>
            )}
            <Button 
              onClick={handleRefreshManifest} 
              variant="outline" 
              size="sm" 
              disabled={isRefreshing}
              className="text-xs"
            >
              {isRefreshing ? 'Checking...' : 'Check Folders'}
            </Button>
            {autoMediaItems.length > 0 && (
              <Dialog open={showManifestDialog} onOpenChange={setShowManifestDialog}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleWriteToManifest}
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Write to manifest
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Proposed Manifest Update</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => copyToClipboard(proposedManifest, 'JSON')}
                        variant="outline" 
                        size="sm"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy JSON
                      </Button>
                      <Button 
                        onClick={() => copyToClipboard(manifestDiff, 'Diff')}
                        variant="outline" 
                        size="sm"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Diff
                      </Button>
                      <Button 
                        onClick={() => downloadManifest(proposedManifest)}
                        variant="outline" 
                        size="sm"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download JSON
                      </Button>
                    </div>
                    <div className="overflow-auto max-h-[60vh]">
                      <pre className="text-xs bg-muted p-4 rounded whitespace-pre-wrap">
                        {manifestDiff}
                      </pre>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
              {isSupabasePaused ? (
                'Backend services unavailable'
              ) : autoMediaItems.length > 0 ? (
                `${autoMediaItems.length} auto-discovered media items`
              ) : (
                'No media loaded'
              )}
            </div>
          </div>
        </div>
      )}

      {/* HiDrive Browser Panel */}
      {showHiDriveBrowser && (
        <div className="mb-8">
          <HiDriveBrowser onPathFound={handlePathFound} />
        </div>
      )}

      {/* Show loading or error states */}
      {mediaLoading && !isSupabasePaused && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading media...</p>
        </div>
      )}
      
      {mediaError && !isSupabasePaused && (
        <div className="text-center py-8">
          <p className="text-destructive">Error loading media: {mediaError}</p>
          <p className="text-muted-foreground text-sm">Falling back to demo content...</p>
        </div>
      )}

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
        })}
      </div>

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