/**
 * Convert proxy URLs to local paths for local development.
 * Converts /public/XX/file to /media/hidrive/XX/file.
 */
export function toProxyStrict(input: string): string {
  // Convert proxy URLs to local paths
  if (input.includes('/hidrive-proxy?')) {
    try {
      const u = new URL(input);
      const p = u.searchParams.get('path') || '';
      // Convert /public/XX/file to /media/hidrive/XX/file
      const match = p.match(/\/public\/(\d+)\/(.*)/);
      if (match) {
        return `/media/hidrive/${match[1]}/${match[2]}`;
      }
      return p;
    } catch {
      return input;
    }
  }

  // Accept raw path, hidrive://, or full URL. We only keep the PATH part.
  let p = (input || '').trim();

  // If it's a full URL, keep only pathname starting at /public
  try {
    if (p.startsWith('http')) {
      const u = new URL(p);
      p = u.pathname; // keep path only
    }
  } catch {}

  // Convert hidrive:// -> /
  if (p.startsWith('hidrive://')) p = p.replace('hidrive://','/');

  // Ensure leading slash
  if (!p.startsWith('/')) p = '/' + p;

  // If it doesn't start with /public/, prefix it
  if (!/^\/public\//i.test(p)) p = '/public' + p;

  // Normalize multiple slashes
  p = p.replace(/\/{2,}/g,'/');

  // Convert /public/XX/file to /media/hidrive/XX/file
  const match = p.match(/\/public\/(\d+)\/(.*)/);
  if (match) {
    return `/media/hidrive/${match[1]}/${match[2]}`;
  }
  return p;
}

// Legacy alias for backward compatibility
export const toProxy = toProxyStrict;

// Type definitions
export interface HiDriveItem {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  contentType?: string;
}

export interface ProbeResult {
  ok: boolean;
  status: number;
  contentType: string;
}

// Check if content type is media (images or video)
export const isMediaContentType = (ct: string): boolean => 
  ct.startsWith('video/') || ct.startsWith('image/');

/**
 * List directory contents - returns empty array since we don't need listing for local files
 */
export const listDir = async (path: string): Promise<HiDriveItem[]> => {
  return [];
};

/**
 * Probe a file URL using GET+Range to check if it streams properly.
 * Returns ok if status is 200/206 and content-type is image/* or video/*.
 */
export async function probeStream(urlOrPath: string) {
  const u = toProxyStrict(urlOrPath);
  const res = await fetch(u, { headers: { Range: 'bytes=0-1' } });
  const result = { ok: res.ok || res.status === 206, status: res.status, ct: res.headers.get('content-type') || undefined, url: u };
  
  return result;
}

/**
 * Find a poster image for a folder (preview.webp, preview.jpg, preview.png).
 * Returns local URL if found, null otherwise.
 */
export const findPosterForFolder = async (path: string): Promise<string | null> => {
  try {
    // Convert /public/XX/ to /media/hidrive/XX/
    const pathMatch = path.match(/\/public\/(\d+)\/(.*)/);
    if (pathMatch) {
      const localPath = `/media/hidrive/${pathMatch[1]}/`;
      
      // Try common poster files
      const posterFiles = ['preview.webp', 'preview.jpg', 'preview.jpeg', 'preview.png'];
      
      for (const posterFile of posterFiles) {
        try {
          const response = await fetch(localPath + posterFile);
          if (response.ok) {
            return localPath + posterFile;
          }
        } catch {
          // Continue to next
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Find a preview file for a folder.
 * Prefers preview.* files, prioritizes video over images for preview.
 */
export const findPreviewForFolder = async (path: string): Promise<string | null> => {
  try {
    // Convert /public/XX/ to /media/hidrive/XX/
    const pathMatch = path.match(/\/public\/(\d+)\/(.*)/);
    if (pathMatch) {
      const localPath = `/media/hidrive/${pathMatch[1]}/`;
      
      // Try common preview files with various naming patterns
      const folderNum = pathMatch[1];
      const previewFiles = [
        'preview.mp4', 'preview.mov', 'preview.webm', 'preview.m4v', 'preview.jpg', 'preview.jpeg', 'preview.png', 'preview.webp',
        `${folderNum}_preview.mp4`, `${folderNum}_preview.mov`, `${folderNum}_preview.webm`, `${folderNum}_preview.m4v`,
        `${folderNum}_preview.jpg`, `${folderNum}_preview.jpeg`, `${folderNum}_preview.png`, `${folderNum}_preview.webp`,
        `${folderNum}.mp4`, `${folderNum}.mov`, `${folderNum}.webm`, `${folderNum}.m4v`,
        `${folderNum}.jpg`, `${folderNum}.jpeg`, `${folderNum}.png`, `${folderNum}.webp`
      ];
      
      for (const previewFile of previewFiles) {
        try {
          const response = await fetch(localPath + previewFile);
          if (response.ok) {
            return localPath + previewFile;
          }
        } catch {
          // Continue to next
        }
      }
      
      // Fallback: try to find any media file in the folder based on actual file patterns
      const fallbackFiles = [
        `${folderNum}_short.mp4`, `${folderNum}_short.mov`, `${folderNum}_short.webm`,
        `${folderNum}.mp4`, `${folderNum}.mov`, `${folderNum}.webm`,
        `${folderNum}.jpg`, `${folderNum}.jpeg`, `${folderNum}.png`,
        // Specific patterns found in the folders
        'Factice by Anton Zemlyanoy 01 copie.jpg',
        'Chanel Beauty by Anairam 13 copie.jpg',
        'PARURE_03_EDIT_CARRE_v4 ETALO.mp4',
        'DIOR LE BAUME by axel morin.mp4',
        'video.mp4', 'video.mov', 'video.webm',
        'image.jpg', 'image.png', 'image.jpeg'
      ];
      
      for (const fallbackFile of fallbackFiles) {
        try {
          const response = await fetch(localPath + fallbackFile);
          if (response.ok) {
            return localPath + fallbackFile;
          }
        } catch {
          // Continue to next
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Find the first video file in a folder.
 * Returns null if no video files are found.
 */
export const findFirstVideoForFolder = async (path: string): Promise<string | null> => {
  return null; // Not implemented for local files
};

/**
 * Fetch text content from a local path.
 */
export const fetchText = async (path: string, noStore = true): Promise<string | null> => {
  try {
    // Convert /public/XX/file to /media/hidrive/XX/file
    const pathMatch = path.match(/\/public\/(\d+)\/(.*)/);
    if (pathMatch) {
      const localPath = `/media/hidrive/${pathMatch[1]}/${pathMatch[2]}`;
      
      try {
        const response = await fetch(localPath);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim()) {
            // Only reject if it's actually HTML
            const trimmed = text.trim();
            if (trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE')) {
              return null;
            } else {
              return text;
            }
          }
        }
      } catch {
        return null;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Find and fetch MANIFEST file in a folder (case-insensitive, multiple formats).
 * Tries: MANIFEST.md, MANIFEST.txt, MANIFEST, README.md, INFO.md
 * Returns { content, matchedFilename } if found, null if not found.
 */
export const findManifestMarkdown = async (folderPath: string): Promise<{ content: string; matchedFilename: string } | null> => {
  try {
    // Ensure trailing slash
    const normalizedPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    
    // Convert /public/XX/ to folder number
    const folderMatch = normalizedPath.match(/\/public\/(\d+)\//);
    if (folderMatch) {
      const folder = folderMatch[1];
      
      // Use the local API endpoint to get fresh data from disk
      try {
        const response = await fetch(`/api/manifest/${folder}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.content && result.content.trim()) {
            return { content: result.content, matchedFilename: 'MANIFEST.txt' };
          }
        }
      } catch (error) {
        console.error(`Failed to fetch manifest for folder ${folder}:`, error);
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Parse manifest content from markdown or plain text.
 * Supports YAML front-matter and simple key-value formats.
 */
export const parseManifestMarkdown = (content: string, filename: string): { title?: string; description?: string; tags?: string[] } => {
  const result: { title?: string; description?: string; tags?: string[] } = {};
  
  // Filter out HTML lines (error pages)
  const lines = content.split('\n').filter(line => 
    !line.trim().startsWith('<') && 
    !line.includes('DOCTYPE') && 
    !line.includes('<html')
  );
  
  // Try YAML front-matter first
  if (content.startsWith('---')) {
    try {
      // Match YAML frontmatter with flexible line endings
      const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (frontMatterMatch) {
        const yamlContent = frontMatterMatch[1];
        console.log('[YAML Parser] Extracted YAML content:', yamlContent);
        
        // Simple YAML parser for our specific fields
        yamlContent.split(/\r?\n/).forEach(line => {
          const titleMatch = line.match(/^title:\s*(.+)$/);
          if (titleMatch) {
            result.title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
            console.log('[YAML Parser] Found title:', result.title);
          }
          
          const descMatch = line.match(/^description:\s*(.+)$/);
          if (descMatch) {
            result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
          }
          
          const tagsMatch = line.match(/^tags:\s*\[(.*?)\]$/);
          if (tagsMatch) {
            result.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
          }
        });
        
        console.log('[YAML Parser] Final result:', result);
        return result;
      } else {
        console.log('[YAML Parser] No frontmatter match found');
      }
    } catch (e) {
      console.error('[YAML Parser] Error:', e);
      // Fall through to plain text parsing
    }
  }
  
  // Plain text parsing - look for key: value pairs
  lines.forEach(line => {
    const keyValueMatch = line.match(/^(\w+):\s*(.+)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].toLowerCase();
      const value = keyValueMatch[2].trim().replace(/['"]/g, '');
      
      if (key === 'title') result.title = value;
      if (key === 'description') result.description = value;
      if (key === 'tags') {
        result.tags = value.split(',').map(t => t.trim()).filter(Boolean);
      }
    }
  });
  
  // If still no title, use first H1 or first non-empty line
  if (!result.title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      result.title = h1Match[1].trim();
    } else {
      const firstLine = lines.find(line => line.trim().length > 0);
      if (firstLine) {
        result.title = firstLine.trim();
      }
    }
  }
  
  // If still no description, use first paragraph
  if (!result.description) {
    const paragraphs = content.split('\n\n').filter(p => !p.startsWith('#') && p.trim().length > 0);
    if (paragraphs.length > 0) {
      result.description = paragraphs[0].trim().replace(/\n/g, ' ').substring(0, 200);
    }
  }
  
  return result;
};

/**
 * Get folder metadata by finding and parsing MANIFEST.md.
 */
export const getFolderMetadata = async (folderPath: string): Promise<{ title?: string; description?: string; tags?: string[] }> => {
  try {
    const manifestResult = await findManifestMarkdown(folderPath);
    if (!manifestResult) {
      return {};
    }
    
    return parseManifestMarkdown(manifestResult.content, manifestResult.matchedFilename);
  } catch (error) {
    return {};
  }
};

/**
 * Validate folder - always returns ok for local files
 */
export const validateFolder = async (folderPath: string): Promise<{ ok: boolean }> => {
  return { ok: true };
};

/**
 * Persist folder metadata to cache
 */
export const persistFolderMetaToCache = (folder: string, meta: any): void => {
  // No-op for local files
};
