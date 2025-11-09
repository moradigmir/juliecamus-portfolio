import { useEffect, useMemo, useState } from 'react';
import { Folder, File, Loader2, RefreshCw, ImageIcon, Video, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { normalizeMediaPath } from '@/lib/hidrive';
import type { ManifestFileMeta, MediaItem } from '@/hooks/useMediaIndex';

interface ManifestFolder {
  folder: string;
  title: string;
  files: ManifestFileMeta[];
  previewType: MediaItem['previewType'];
  previewUrl: string;
  fullType: MediaItem['fullType'];
  fullUrl: string;
  thumbnailUrl?: string;
}

interface HiDriveBrowserProps {
  onPathFound?: (path: string) => void;
}

const LOCAL_MEDIA_ROOT = '/media/hidrive';

const HiDriveBrowser = ({ onPathFound }: HiDriveBrowserProps) => {
  const [folders, setFolders] = useState<ManifestFolder[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<ManifestFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<ManifestFolder | null>(null);
  const [selectedFile, setSelectedFile] = useState<ManifestFileMeta | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadManifest = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/media.manifest.json');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const manifest = await res.json();
        const items: MediaItem[] = Array.isArray(manifest?.items) ? manifest.items : [];

        const mapped: ManifestFolder[] = items.map((item) => ({
          folder: item.folder,
          title: item.title,
          files: item.files ?? [],
          previewType: item.previewType,
          previewUrl: item.previewUrl,
          fullType: item.fullType,
          fullUrl: item.fullUrl,
          thumbnailUrl: item.thumbnailUrl,
        }));

        setFolders(mapped);
        setFilteredFolders(mapped);
        setSelectedFolder(mapped[0] ?? null);
        setSelectedFile(mapped[0]?.files?.[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load manifest');
      } finally {
        setIsLoading(false);
      }
    };

    loadManifest();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredFolders(folders);
      return;
    }

    const query = search.toLowerCase();
    setFilteredFolders(
      folders.filter((folder) => {
        const inFolder = folder.folder.toLowerCase().includes(query) || folder.title.toLowerCase().includes(query);
        if (inFolder) return true;
        return folder.files.some((file) => file.name.toLowerCase().includes(query));
      })
    );
  }, [search, folders]);

  const handleSelectFolder = (folder: ManifestFolder) => {
    setSelectedFolder(folder);
    setSelectedFile(folder.files[0] ?? null);
  };

  const handleSelectFile = (file: ManifestFileMeta) => {
    setSelectedFile(file);
  };

  const localPathForFile = (folder: string, file: ManifestFileMeta) => `${LOCAL_MEDIA_ROOT}/${folder}/${file.name}`;

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (err) {
      console.error('Failed to copy path', err);
    }
  };

  const fileKind = useMemo(() => {
    if (!selectedFile) return 'unknown';
    if (selectedFile.contentType?.startsWith('video/')) return 'video';
    if (selectedFile.contentType?.startsWith('image/')) return 'image';
    if (/\.(mp4|mov|m4v|webm)$/i.test(selectedFile.name)) return 'video';
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(selectedFile.name)) return 'image';
    return 'file';
  }, [selectedFile]);

  const selectedFileUrl = selectedFolder && selectedFile
    ? normalizeMediaPath(`/public/${selectedFolder.folder}/${selectedFile.name}`)
    : null;

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Local Media Browser
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedFolder(folders[0] ?? null);
              setSelectedFile(folders[0]?.files?.[0] ?? null);
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Reset</span>
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders or filenames..."
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load manifest: {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2">Loading manifest...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row">
            <Card className="md:w-64">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Folders ({folders.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  <div className="flex flex-col">
                    {filteredFolders.map((folder) => {
                      const isActive = selectedFolder?.folder === folder.folder;
                      return (
                        <button
                          key={folder.folder}
                          onClick={() => handleSelectFolder(folder)}
                          className={`flex items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors ${
                            isActive ? 'bg-muted/80 font-medium' : 'hover:bg-muted'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            {folder.folder}
                          </span>
                          <span className="text-xs text-muted-foreground">{folder.files.length}</span>
                        </button>
                      );
                    })}
                    {!filteredFolders.length && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No folders match “{search}”.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {selectedFolder ? `Files in /${selectedFolder.folder}/` : 'Select a folder'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  <div className="divide-y">
                    {selectedFolder?.files.length ? (
                      selectedFolder.files.map((file) => {
                        const isActive = selectedFile?.name === file.name;
                        const localPath = localPathForFile(selectedFolder.folder, file);
                        return (
                          <div
                            key={file.name}
                            className={`flex items-center gap-3 px-4 py-2 text-sm ${
                              isActive ? 'bg-muted/70' : 'hover:bg-muted'
                            }`}
                          >
                            <button
                              onClick={() => handleSelectFile(file)}
                              className="flex flex-1 flex-col items-start"
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <File className="h-4 w-4 text-muted-foreground" />
                                {file.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {file.contentType || 'unknown'}
                                {file.size ? ` • ${(file.size / 1024).toFixed(1)} KB` : ''}
                              </span>
                            </button>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => copyPath(localPath)}
                                title="Copy local path"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onPathFound?.(localPath)}
                              >
                                Use Path
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        {selectedFolder ? 'This folder has no files listed in the manifest.' : 'Select a folder to view its files.'}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedFolder && selectedFile ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedFile.contentType || 'unknown type'}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {fileKind === 'video' ? <Video className="h-4 w-4" /> : null}
                    {fileKind === 'image' ? <ImageIcon className="h-4 w-4" /> : null}
                    <span>{localPathForFile(selectedFolder.folder, selectedFile)}</span>
                  </div>
                </div>
                <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {selectedFileUrl ? (
                    fileKind === 'video' ? (
                      <video
                        key={selectedFileUrl}
                        src={selectedFileUrl}
                        controls
                        className="max-h-[280px] w-full rounded-md object-contain"
                      />
                    ) : fileKind === 'image' ? (
                      <img
                        src={selectedFileUrl}
                        alt={selectedFile.name}
                        className="max-h-[280px] w-full rounded-md object-contain"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Preview not available.
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-muted-foreground">No file selected.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Select a folder and file to preview its local asset.
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default HiDriveBrowser;