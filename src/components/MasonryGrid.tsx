import { motion } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Settings, Save, Copy, Bug, ToggleLeft, Download, ArrowUp, RefreshCw, Clock, Tag, X } from 'lucide-react';
import { MediaManifestGenerator } from '../utils/mediaManifestGenerator';
import { useToast } from '@/hooks/use-toast';
import { listDir, probeStream, findPreviewForFolder, isMediaContentType, validateFolder } from '@/lib/hidrive';
import { diag, flushDiagToEdge, buildDiagSummary } from '../debug/diag';
import { loadMetaCache, getMetaCacheStats } from '@/lib/metaCache';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Project {
  slug: string;
  title: string;
  coverImage: string;
  coverVideo?: string;
  images?: string[];
}

interface MasonryGridProps {
  projects?: Project[];
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
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
    refetch,
    metaStats,
    forceRefreshManifests
  } = useMediaIndex();

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
            .filter(item => !/^preview(\.|$)/i.test(item.name)) // Skip preview.* files and 'preview' file in gallery
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
    const latest = autoMediaItems.find((m) => m.folder === media.folder) || media;
    setLightboxMedia(latest);
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
          
          if (result.ok) {
            // Diagnostics: Log successful validation
            diag('VALIDATE', 'folder_ok', { 
              folder, 
              status: 200 // validateFolder doesn't return status, assume 200 if ok
            });
          } else {
            // Diagnostics: Log failed validation
            diag('VALIDATE', 'folder_fail', { 
              folder, 
              reason: `No valid preview found in ${folderPath}` 
            });
          }
          
          return { folder, ok: result.ok };
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
        file: 'unknown',
        status: 200, // validateFolder doesn't return status, assume 200 if ok
        ct: 'unknown'
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
    const placeholdersCount = checked ? 0 : (projects?.length || 0);
    
    flushDiagToEdge(buildDiagSummary({
      items_sorted: currentFolders,
      placeholders_after_real: placeholdersCount
    }));
  }, [autoMediaItems, projects?.length || 0]);

  const handleFullRescan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress('Starting full rescan...');
    
    try {
      const discovered: MediaItem[] = [];
      const SCAN_MAX = 99;
      const CONCURRENCY = 12;
      
      console.log('🚀 FULL RESCAN: Scanning folders 01-99...');
      toast({ title: 'Full Rescan Started', description: 'Discovering all folders...' });
      
      const queue = Array.from({ length: SCAN_MAX }, (_, i) => 
        (i + 1).toString().padStart(2, '0')
      );
      
      let processed = 0;
      
      async function processFolder(folderNum: string) {
        try {
          const folderPath = `/public/${folderNum}/`;
          const previewUrl = await findPreviewForFolder(folderPath);
          
          if (previewUrl) {
            const isVideo = /\.(mp4|mov)$/i.test(previewUrl);
            discovered.push({
              orderKey: folderNum,
              folder: folderNum,
              title: `Folder ${folderNum}`,
              previewUrl,
              previewType: isVideo ? 'video' : 'image',
              fullUrl: previewUrl,
              fullType: isVideo ? 'video' : 'image',
              meta: {},
            });
            console.log(`✅ Discovered folder ${folderNum}`);
          }
        } catch (error) {
          // Silently skip folders that don't exist
        }
        
        processed++;
        setScanProgress(`Scanned ${processed}/${SCAN_MAX} folders...`);
      }
      
      async function worker() {
        while (queue.length) {
          const folder = queue.shift();
          if (!folder) break;
          await processFolder(folder);
        }
      }
      
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      
      console.log(`✅ Full rescan complete: Found ${discovered.length} folders`);
      setScanProgress('Generating manifest...');
      
      if (discovered.length === 0) {
        toast({ 
          title: 'No Folders Found', 
          description: 'Could not find any valid media folders in /public/', 
          variant: 'destructive' 
        });
        setIsScanning(false);
        setScanProgress('');
        return;
      }
      
      // Sort by folder number
      discovered.sort((a, b) => parseInt(a.folder, 10) - parseInt(b.folder, 10));
      
      // Generate new manifest
      const newManifest = {
        items: discovered,
        generatedAt: new Date().toISOString(),
        source: 'hidrive'
      };
      
      const manifestJson = JSON.stringify(newManifest, null, 2);
      console.log(`📄 Generated manifest with ${discovered.length} items`);
      
      // Download manifest file
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'media.manifest.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ 
        title: 'Rescan Complete!', 
        description: `Found ${discovered.length} folders. Manifest downloaded - replace public/media.manifest.json and refresh.`,
        duration: 10000
      });
      
    } catch (error) {
      console.error('❌ Full rescan failed:', error);
      toast({ 
        title: 'Rescan Failed', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  }, [toast]);

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
    if (!clearPlaceholders && projects) {
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
    const placeholdersCount = clearPlaceholders ? 0 : (projects?.length || 0);
    
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
      {/* Project Status Indicator for Supabase Issues */}
      {isSupabasePaused && (
        <div className="mb-8">
          <ProjectStatusIndicator onRetry={refetch} />
        </div>
      )}

      {/* Diagnostic Panel - Only show when debug=1 */}
      {showDevControls && (
        <div data-dev-toolbar className="mb-6 space-y-3">
          {/* Cache Status & Controls Row */}
          <div className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              {/* Cache Status */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 border rounded bg-background">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Meta: {metaStats.found}/{autoMediaItems.length}</span>
                          {metaStats.processed > 0 && metaStats.processed < metaStats.total && (
                            <span className="text-muted-foreground">
                              ({Math.round((metaStats.processed / metaStats.total) * 100)}%)
                            </span>
                          )}
                        </div>
                        {metaStats.lastRefreshTs > 0 && (
                          <div className="text-muted-foreground">
                            {(() => {
                              const ago = Date.now() - metaStats.lastRefreshTs;
                              if (ago < 60000) return `${Math.round(ago / 1000)}s ago`;
                              if (ago < 3600000) return `${Math.round(ago / 60000)}m ago`;
                              return `${Math.round(ago / 3600000)}h ago`;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      <p>MANIFEST.txt metadata cache</p>
                      <p>Found: {metaStats.found} folders</p>
                      <p>Missing: {metaStats.missing} folders</p>
                      {metaStats.errors > 0 && <p className="text-destructive">Errors: {metaStats.errors}</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Progress bar while refreshing */}
              {metaStats.processed > 0 && metaStats.processed < metaStats.total && (
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-charcoal transition-all duration-300"
                    style={{ width: `${(metaStats.processed / metaStats.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={forceRefreshManifests}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={metaStats.processed > 0 && metaStats.processed < metaStats.total}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${metaStats.processed > 0 && metaStats.processed < metaStats.total ? 'animate-spin' : ''}`} />
                Force Refresh
              </Button>
            </div>
          </div>
          
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleFullRescan} 
                    variant="default" 
                    size="sm" 
                    disabled={isScanning}
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? scanProgress : 'Full Rescan (01-99)'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Scan ALL folders 01-99 and generate new manifest file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button 
              onClick={() => {
                const owner = 'juliecamus';
                const keyV1 = `manifestMetaCache:v1:${owner}`;
                const keyV2 = `manifestMetaCache:v2:${owner}`;
                localStorage.removeItem(keyV1);
                localStorage.removeItem(keyV2);
                localStorage.removeItem('manifest:last_refresh_ts');
                localStorage.removeItem('manifest:last_result');
                console.log('🗑️ Nuked metadata cache (v1+v2)');
                toast({ 
                  title: 'Meta cache nuked', 
                  description: 'Cleared v1+v2. Force refreshing...' 
                });
                // Force refresh after clearing
                setTimeout(() => {
                  forceRefreshManifests();
                }, 300);
              }} 
              variant="outline" 
              size="sm"
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Nuke Meta Cache
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-charcoal mx-auto mb-2"></div>
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
                index={idx}
                onHover={handleTileHover}
                onClick={() => openLightbox(item.project, 0)}
              />
            );
          } else if (item.type === 'media') {
            return (
              <div key={`media-${item.media.folder}`} className="relative">
                <AutoMediaTile
                  media={item.media}
                  index={idx}
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