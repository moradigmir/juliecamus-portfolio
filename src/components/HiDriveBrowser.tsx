import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Folder, File, RefreshCw, AlertCircle } from 'lucide-react';
import ProjectStatusIndicator from './ProjectStatusIndicator';
import { detectSupabaseIssueFromResponse } from '@/lib/projectHealth';

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
  const [currentPath, setCurrentPath] = useState('/public');
  const [items, setItems] = useState<HiDriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupabasePaused, setIsSupabasePaused] = useState(false);
  const [testingFile, setTestingFile] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);

  const resolveOwnerFromManifest = async (): Promise<string | null> => {
    try {
      const res = await fetch('/media.manifest.json');
      if (!res.ok) return null;
      const manifest = await res.json();
      const first = manifest?.items?.[0];
      const anyUrl: string | undefined = first?.previewUrl || first?.fullUrl;
      if (typeof anyUrl === 'string') {
        const m1 = anyUrl.match(/webdav\.hidrive\.strato\.com\/users\/([^/]+)/);
        if (m1) return m1[1];
        const m2 = anyUrl.match(/[?&]owner=([^&]+)/);
        if (m2) return decodeURIComponent(m2[1]);
      }
      return 'juliecamus';
    } catch {
      return null;
    }
  };

  const parseWebDAVResponse = (xmlText: string): HiDriveItem[] => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      // Prefer namespace-aware lookup
      const ns = 'DAV:';
      const responses = Array.from(doc.getElementsByTagNameNS(ns, 'response')).length
        ? Array.from(doc.getElementsByTagNameNS(ns, 'response'))
        : Array.from(doc.getElementsByTagName('response'));

      const toText = (el: Element | null | undefined): string => (el?.textContent || '').trim();
      const items: HiDriveItem[] = [];

      for (const response of responses) {
        const hrefEl = (response.getElementsByTagNameNS(ns, 'href')[0] || response.getElementsByTagName('href')[0]) as Element | undefined;
        const href = toText(hrefEl);
        const dispEl = (response.getElementsByTagNameNS(ns, 'displayname')[0] || response.getElementsByTagName('displayname')[0]) as Element | undefined;
        const displayName = toText(dispEl);
        const rtEl = (response.getElementsByTagNameNS(ns, 'resourcetype')[0] || response.getElementsByTagName('resourcetype')[0]) as Element | undefined;
        const isDir = !!rtEl && ((rtEl.getElementsByTagNameNS(ns, 'collection')[0] || rtEl.getElementsByTagName('collection')[0]));
        const lenEl = (response.getElementsByTagNameNS(ns, 'getcontentlength')[0] || response.getElementsByTagName('getcontentlength')[0]) as Element | undefined;
        const modEl = (response.getElementsByTagNameNS(ns, 'getlastmodified')[0] || response.getElementsByTagName('getlastmodified')[0]) as Element | undefined;
        const typeEl = (response.getElementsByTagNameNS(ns, 'getcontenttype')[0] || response.getElementsByTagName('getcontenttype')[0]) as Element | undefined;

        // Normalize href to path
        let decodedHref = '';
        try {
          decodedHref = decodeURIComponent(href);
        } catch {
          decodedHref = href;
        }

        // Skip the current directory entry
        const normalizedCurrent = currentPath.endsWith('/') ? currentPath : currentPath + '/';
        if (decodedHref.endsWith(normalizedCurrent)) continue;

        const name = displayName || decodedHref.split('/').filter(Boolean).pop() || '';
        if (!name || name === '.') continue;

        items.push({
          name,
          type: isDir ? 'directory' : 'file',
          size: lenEl ? parseInt(toText(lenEl)) : undefined,
          modified: toText(modEl) || undefined,
          contentType: toText(typeEl) || undefined,
        });
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

  const listDirectory = async (path: string, ownerOverride?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
      url.searchParams.set('path', path);
      url.searchParams.set('list', '1');
      const o = ownerOverride ?? owner;
      if (o) url.searchParams.set('owner', o);

      const response = await fetch(url.toString());
      const contentType = response.headers.get('content-type') || '';
      
      // Check for Supabase project pause
      if (detectSupabaseIssueFromResponse(response.status, contentType)) {
        setIsSupabasePaused(true);
        throw new Error('Supabase project appears to be paused');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Expect XML for directory listing
      if (!contentType.includes('xml') && !contentType.includes('text/')) {
        throw new Error(`Expected XML response, got ${contentType}`);
      }

      const xmlText = await response.text();
      const parsedItems = parseWebDAVResponse(xmlText);
      
      setItems(parsedItems);
      setCurrentPath(path);
      setIsSupabasePaused(false); // Reset on success
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
    // Clamp to the workspace root (e.g., /Common/public or /public)
    const lower = currentPath.toLowerCase();
    const root = lower.startsWith('/common/public')
      ? '/Common/public'
      : lower.startsWith('/public')
      ? '/public'
      : lower.startsWith('/personal')
      ? '/Personal'
      : lower.startsWith('/shared')
      ? '/Shared'
      : '/public';

    if (currentPath === root) return;
    const parentPath = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) || root : root;
    if (parentPath.length < root.length) {
      listDirectory(root);
    } else {
      listDirectory(parentPath);
    }
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
      if (owner) url.searchParams.set('owner', owner);

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

  useEffect(() => {
    // Auto-load on mount with owner resolution
    (async () => {
      const o = await resolveOwnerFromManifest();
      if (o) setOwner(o);
      await listDirectory(currentPath, o || undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            placeholder="/public"
            className="flex-1"
          />
          <Button onClick={() => listDirectory(currentPath)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Project Status Indicator */}
        {isSupabasePaused && (
          <div className="mb-4">
            <ProjectStatusIndicator onRetry={() => listDirectory(currentPath)} />
          </div>
        )}

        {error && !isSupabasePaused && (
          <div className="flex items-center gap-2 p-4 mb-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-semibold">❌ Directory Access Failed</div>
              <div className="text-sm mt-1">Error: {error}</div>
              <div className="text-xs mt-2 text-red-600">
                💡 Try navigating to /public instead, or check if path exists in HiDrive web interface
              </div>
            </div>
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