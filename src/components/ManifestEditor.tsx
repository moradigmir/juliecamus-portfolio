import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Search, CheckCircle2, AlertCircle, Eye, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  formatManifestContent, 
  parseManifestContent, 
  saveManifestFile, 
  fetchManifestFile,
  type ManifestMetadata 
} from '@/lib/manifestEditor';
import { clearMetaCache } from '@/lib/metaCache';
import type { MediaItem } from '@/hooks/useMediaIndex';

interface ManifestEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaItems: MediaItem[];
  onSave: () => void;
}

interface FolderEdit {
  folder: string;
  title: string;
  description: string;
  tags: string;
  original: ManifestMetadata;
  status: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  error?: string;
  isDirty: boolean;
}

export default function ManifestEditor({ open, onOpenChange, mediaItems, onSave }: ManifestEditorProps) {
  const [folders, setFolders] = useState<FolderEdit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [previewFolderIndex, setPreviewFolderIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  // Extract unique folders from media items
  useEffect(() => {
    if (!open) return;

    const uniqueFolders = Array.from(
      new Set(mediaItems.map(item => item.folder))
    ).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });

    const folderEdits: FolderEdit[] = uniqueFolders.map(folder => {
      const item = mediaItems.find(m => m.folder === folder);
      return {
        folder,
        title: item?.title || `Folder ${folder}`,
        description: item?.description || '',
        tags: item?.tags?.join(', ') || '',
        original: {
          title: item?.title,
          description: item?.description,
          tags: item?.tags,
        },
        status: 'idle',
        isDirty: false,
      };
    });

    setFolders(folderEdits);
  }, [open, mediaItems]);

  const updateFolder = (index: number, updates: Partial<FolderEdit>) => {
    setFolders(prev => {
      const newFolders = [...prev];
      const folder = { ...newFolders[index], ...updates };
      
      // Check if dirty
      folder.isDirty = 
        folder.title !== folder.original.title ||
        folder.description !== (folder.original.description || '') ||
        folder.tags !== (folder.original.tags?.join(', ') || '');
      
      newFolders[index] = folder;
      return newFolders;
    });
  };

  const saveSingleFolder = async (index: number): Promise<boolean> => {
    const folder = folders[index];
    updateFolder(index, { status: 'saving' });

    const meta: ManifestMetadata = {
      title: folder.title.trim(),
      description: folder.description.trim() || undefined,
      tags: folder.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
    };

    const content = formatManifestContent(meta);
    const folderPath = `/public/${folder.folder}`;
    
    const result = await saveManifestFile(folderPath, content);

    if (result.success) {
      updateFolder(index, { 
        status: 'saved', 
        isDirty: false,
        original: meta 
      });
      setTimeout(() => {
        updateFolder(index, { status: 'idle' });
      }, 2000);
      return true;
    } else {
      updateFolder(index, { 
        status: 'error', 
        error: result.error 
      });
      toast({
        title: 'Save Failed',
        description: `Folder ${folder.folder}: ${result.error}`,
        variant: 'destructive',
      });
      return false;
    }
  };

  const saveAllFolders = async () => {
    setIsLoadingAll(true);
    const dirtyFolders = folders.filter(f => f.isDirty);
    
    if (dirtyFolders.length === 0) {
      toast({
        title: 'No Changes',
        description: 'No folders have been modified.',
      });
      setIsLoadingAll(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < folders.length; i++) {
      if (folders[i].isDirty) {
        const ok = await saveSingleFolder(i);
        if (ok) successCount++;
        else errorCount++;
      }
    }

    setIsLoadingAll(false);

    if (errorCount === 0) {
      toast({
        title: 'All Saved',
        description: `Successfully saved ${successCount} folder(s).`,
      });
      
      // Clear cache and trigger refresh
      clearMetaCache('juliecamus');
      onSave();
    } else {
      toast({
        title: 'Partial Success',
        description: `Saved ${successCount} folder(s), ${errorCount} failed.`,
        variant: 'destructive',
      });
    }
  };

  const refreshFromHiDrive = async () => {
    setIsLoadingAll(true);
    
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      updateFolder(i, { status: 'loading' });
      
      const folderPath = `/public/${folder.folder}`;
      const result = await fetchManifestFile(folderPath);
      
      if (result.success && result.content) {
        const meta = parseManifestContent(result.content);
        updateFolder(i, {
          title: meta.title || `Folder ${folder.folder}`,
          description: meta.description || '',
          tags: meta.tags?.join(', ') || '',
          original: meta,
          status: 'idle',
          isDirty: false,
        });
      } else {
        updateFolder(i, { status: 'idle' });
      }
    }
    
    setIsLoadingAll(false);
    toast({
      title: 'Refreshed',
      description: 'Loaded latest metadata from HiDrive.',
    });
  };

  const filteredFolders = folders.filter(f => 
    f.folder.includes(searchQuery.toLowerCase()) ||
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dirtyCount = folders.filter(f => f.isDirty).length;

  // Get preview media item
  const previewFolder = previewFolderIndex !== null ? folders[previewFolderIndex] : null;
  const previewMediaItem = previewFolder 
    ? mediaItems.find(m => m.folder === previewFolder.folder)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[85vh] flex flex-col p-0">
        <div className="flex h-full">
          {/* Left Panel - Editor */}
          <div className="flex-1 flex flex-col border-r">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="flex items-center justify-between">
                <span>Manifest Editor</span>
                <div className="flex items-center gap-2">
                  {dirtyCount > 0 && (
                    <span className="text-sm font-normal text-amber-500">
                      {dirtyCount} unsaved change{dirtyCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshFromHiDrive}
                    disabled={isLoadingAll}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveAllFolders}
                    disabled={isLoadingAll || dirtyCount === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save All ({dirtyCount})
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 px-6 py-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>

            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                {filteredFolders.map((folder, index) => {
                  const actualIndex = folders.indexOf(folder);
                  const isPreviewActive = previewFolderIndex === actualIndex;
                  return (
                    <div
                      key={folder.folder}
                      className={`p-4 rounded-lg border transition-all ${
                        isPreviewActive 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : folder.isDirty 
                            ? 'border-amber-500 bg-amber-500/5' 
                            : 'border-border'
                      } ${folder.status === 'error' ? 'border-destructive' : ''}`}
                      onMouseEnter={() => setPreviewFolderIndex(actualIndex)}
                      onMouseLeave={() => setPreviewFolderIndex(null)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {isPreviewActive && (
                            <Eye className="w-4 h-4 text-primary" />
                          )}
                          <div>
                            <h3 className="font-semibold text-sm text-muted-foreground">
                              Folder {folder.folder}
                            </h3>
                            {folder.status === 'saved' && (
                              <div className="flex items-center gap-1 text-xs text-green-500 mt-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Saved</span>
                              </div>
                            )}
                            {folder.status === 'error' && (
                              <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>{folder.error || 'Save failed'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveSingleFolder(actualIndex)}
                          disabled={!folder.isDirty || folder.status === 'saving'}
                        >
                          {folder.status === 'saving' ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Title *
                          </label>
                          <Input
                            value={folder.title}
                            onChange={(e) => updateFolder(actualIndex, { title: e.target.value })}
                            placeholder="Enter title..."
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Description
                          </label>
                          <Textarea
                            value={folder.description}
                            onChange={(e) => updateFolder(actualIndex, { description: e.target.value })}
                            placeholder="Enter description..."
                            className="mt-1 min-h-[60px]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Tags (comma-separated)
                          </label>
                          <Input
                            value={folder.tags}
                            onChange={(e) => updateFolder(actualIndex, { tags: e.target.value })}
                            placeholder="tag1, tag2, tag3..."
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="w-96 flex flex-col bg-muted/30">
            <div className="p-6 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Hover over a folder to see how the tile will look
              </p>
            </div>

            <div className="flex-1 flex items-center justify-center p-6">
              {previewFolder && previewMediaItem ? (
                <div className="w-full max-w-[280px]">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-card border border-border shadow-lg group">
                    {/* Media Content */}
                    {previewMediaItem.previewType === 'video' ? (
                      <video
                        src={previewMediaItem.previewUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={previewMediaItem.thumbnailUrl || '/placeholder.svg'}
                      />
                    ) : (
                      <img
                        src={previewMediaItem.previewUrl}
                        alt={previewFolder.title}
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Preview Overlay - Always visible to show the effect */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <h3 className="text-sm font-semibold text-white truncate drop-shadow-lg">
                        {previewFolder.title || `Folder ${previewFolder.folder}`}
                      </h3>
                    </div>

                    {/* Preview Badge */}
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                      Preview
                    </div>

                    {/* Fullscreen Button */}
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="View fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Metadata Info */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">Title:</span>
                      <p className="text-foreground mt-0.5">{previewFolder.title || 'No title'}</p>
                    </div>
                    {previewFolder.description && (
                      <div>
                        <span className="font-medium text-muted-foreground">Description:</span>
                        <p className="text-foreground mt-0.5 line-clamp-3">{previewFolder.description}</p>
                      </div>
                    )}
                    {previewFolder.tags && (
                      <div>
                        <span className="font-medium text-muted-foreground">Tags:</span>
                        <p className="text-foreground mt-0.5">{previewFolder.tags}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground space-y-2">
                  <Eye className="w-12 h-12 mx-auto opacity-20" />
                  <p className="text-sm">Hover over a folder to preview</p>
                  <p className="text-xs opacity-70">
                    See how your changes will look before saving
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Fullscreen Preview Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center justify-between">
              <div>
                <span className="text-lg">
                  {previewFolder?.title || `Folder ${previewFolder?.folder}`}
                </span>
                <span className="text-sm font-normal text-muted-foreground ml-3">
                  Folder {previewFolder?.folder}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex items-center justify-center bg-black/5 p-6">
            {previewFolder && previewMediaItem ? (
              <div className="w-full h-full flex items-center justify-center">
                {previewMediaItem.previewType === 'video' ? (
                  <video
                    src={previewMediaItem.fullUrl || previewMediaItem.previewUrl}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    poster={previewMediaItem.thumbnailUrl || '/placeholder.svg'}
                  />
                ) : (
                  <img
                    src={previewMediaItem.fullUrl || previewMediaItem.previewUrl}
                    alt={previewFolder.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                )}
              </div>
            ) : null}
          </div>

          {/* Metadata Info */}
          {previewFolder && (
            <div className="px-6 py-4 border-t bg-background space-y-2">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Title</span>
                  <p className="text-sm mt-0.5">{previewFolder.title || 'No title'}</p>
                </div>
                {previewFolder.description && (
                  <div className="col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <p className="text-sm mt-0.5 line-clamp-2">{previewFolder.description}</p>
                  </div>
                )}
                {previewFolder.tags && (
                  <div className={previewFolder.description ? 'col-span-3' : 'col-span-2'}>
                    <span className="text-xs font-medium text-muted-foreground">Tags</span>
                    <p className="text-sm mt-0.5">{previewFolder.tags}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
