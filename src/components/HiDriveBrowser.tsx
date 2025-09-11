import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Folder, File, RefreshCw, AlertCircle } from 'lucide-react';

interface HiDriveItem {
  name: string;
  type: 'directory' | 'file';
  size?: number;
  modified?: string;
  contentType?: string;
}

interface HiDriveBrowserProps {
  onPathFound?: (correctPath: string) => void;
}

const HiDriveBrowser = ({ onPathFound }: HiDriveBrowserProps) => {
  const [currentPath, setCurrentPath] = useState('/Common/public');
  const [items, setItems] = useState<HiDriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingFile, setTestingFile] = useState<string | null>(null);

  const parseWebDAVResponse = (xmlText: string): HiDriveItem[] => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const responses = doc.getElementsByTagName('d:response');
      const items: HiDriveItem[] = [];

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const href = response.getElementsByTagName('d:href')[0]?.textContent || '';
        const displayName = response.getElementsByTagName('d:displayname')[0]?.textContent || '';
        const resourceType = response.getElementsByTagName('d:resourcetype')[0];
        const contentLength = response.getElementsByTagName('d:getcontentlength')[0]?.textContent;
        const lastModified = response.getElementsByTagName('d:getlastmodified')[0]?.textContent;
        const contentType = response.getElementsByTagName('d:getcontenttype')[0]?.textContent;

        // Skip the current directory entry
        if (href.endsWith(currentPath + '/') || href.endsWith(currentPath)) continue;

        const isDirectory = resourceType?.getElementsByTagName('d:collection').length > 0;
        const name = displayName || decodeURIComponent(href.split('/').pop() || '');

        if (name && name !== '.') {
          items.push({
            name,
            type: isDirectory ? 'directory' : 'file',
            size: contentLength ? parseInt(contentLength) : undefined,
            modified: lastModified || undefined,
            contentType: contentType || undefined,
          });
        }
      }

      return items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (e) {
      console.error('Failed to parse WebDAV response:', e);
      return [];
    }
  };

  const listDirectory = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
      url.searchParams.set('path', path);
      url.searchParams.set('owner', 'juliecamus');
      url.searchParams.set('list', '1');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsedItems = parseWebDAVResponse(xmlText);
      
      setItems(parsedItems);
      setCurrentPath(path);
      console.log(`📁 Listed ${parsedItems.length} items in ${path}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Directory listing failed:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    listDirectory(newPath);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) || '/' : '/';
    listDirectory(parentPath);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  };

  const testFileStream = async (fileName: string) => {
    setTestingFile(fileName);
    try {
      const fullPath = `${currentPath}/${fileName}`;
      const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
      url.searchParams.set('path', fullPath);
      url.searchParams.set('owner', 'juliecamus');

      const response = await fetch(url.toString(), { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok && (contentType.startsWith('video/') || contentType.startsWith('image/'))) {
        alert(`✅ File streams successfully!\nPath: ${fullPath}\nStatus: ${response.status}\nContent-Type: ${contentType}`);
      } else {
        alert(`❌ File test failed\nPath: ${fullPath}\nStatus: ${response.status}\nContent-Type: ${contentType}`);
      }
    } catch (err) {
      alert(`❌ Test error: ${err}`);
    } finally {
      setTestingFile(null);
    }
  };

  const getFileIcon = (item: HiDriveItem) => {
    if (item.type === 'directory') return <Folder className="w-4 h-4 text-blue-500" />;
    
    const ext = item.name.toLowerCase();
    if (ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm')) {
      return <File className="w-4 h-4 text-purple-500" />;
    }
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.gif')) {
      return <File className="w-4 h-4 text-green-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="w-5 h-5" />
          HiDrive Browser
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && listDirectory(currentPath)}
            placeholder="/Common/public"
            className="flex-1"
          />
          <Button onClick={() => listDirectory(currentPath)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          {currentPath !== '/' && (
            <div
              className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
              onClick={navigateUp}
            >
              <Folder className="w-4 h-4 text-blue-500" />
              <span className="font-medium">..</span>
              <span className="text-sm text-muted-foreground ml-auto">Parent directory</span>
            </div>
          )}

          {items.map((item, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 p-2 hover:bg-muted rounded-md ${
                item.type === 'directory' ? 'cursor-pointer' : ''
              }`}
              onClick={() => item.type === 'directory' && navigateToFolder(item.name)}
            >
              {getFileIcon(item)}
              <span className="font-medium">{item.name}</span>
              <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                {item.size && <span>{formatFileSize(item.size)}</span>}
                {item.contentType && <span>{item.contentType}</span>}
                {item.type === 'file' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        testFileStream(item.name);
                      }}
                      disabled={testingFile === item.name}
                    >
                      {testingFile === item.name ? 'Testing...' : 'Test Stream'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullPath = `${currentPath}/${item.name}`;
                        onPathFound?.(fullPath);
                      }}
                    >
                      Use This Path
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!isLoading && items.length === 0 && !error && (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Directory is empty or click refresh to load</p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading directory...</p>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Current path:</strong> {currentPath}
            <br />
            <strong>Items found:</strong> {items.length}
            <br />
            <strong>Tip:</strong> Navigate to find your media files. Use "Test Stream" to verify files work, then "Use This Path" to fix manifest paths.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default HiDriveBrowser;