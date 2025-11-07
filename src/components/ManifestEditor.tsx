import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Search, CheckCircle2, AlertCircle } from 'lucide-react';
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

  const saveSingleFolder = async (index: number) => {
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
        await saveSingleFolder(i);
        if (folders[i].status === 'saved') successCount++;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
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

        <div className="flex items-center gap-2 px-1">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {filteredFolders.map((folder, index) => {
              const actualIndex = folders.indexOf(folder);
              return (
                <div
                  key={folder.folder}
                  className={`p-4 rounded-lg border ${
                    folder.isDirty ? 'border-amber-500 bg-amber-500/5' : 'border-border'
                  } ${folder.status === 'error' ? 'border-destructive' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
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
      </DialogContent>
    </Dialog>
  );
}
