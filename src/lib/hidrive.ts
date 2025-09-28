import { supabase } from '@/integrations/supabase/client';

// Type definitions matching HiDriveBrowser
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

// Detect if Supabase services are paused (similar to HiDriveBrowser logic)
const detectSupabaseIssueFromResponse = (status: number, contentType: string): boolean => {
  if (status === 503) return true;
  if (status >= 500 && status < 600) return true;
  if (contentType.includes('text/html') && status !== 200) return true;
  return false;
};

// Check if content type is media (images or video)
export const isMediaContentType = (ct: string): boolean => 
  ct.startsWith('video/') || ct.startsWith('image/');

/**
 * List directory contents using PROPFIND via the HiDrive proxy.
 * Accepts 207 status codes (WebDAV Multi-Status) as successful.
 */
export const listDir = async (path: string): Promise<HiDriveItem[]> => {
  const normalized = path.endsWith('/') ? path : path + '/';
  
  const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
  url.searchParams.set('path', normalized);
  url.searchParams.set('list', '1');
  
  const res = await fetch(url.toString(), { method: 'GET' });
  const ct = res.headers.get('content-type') || '';
  
  console.log('📂 hidrive listDir', { path: normalized, status: res.status, ct });
  
  // Diagnostics: Log successful PROPFIND operations
  if (res.status === 207) {
    const { diag } = await import('../debug/diag');
    diag('NET', 'propfind_ok', { path: normalized, status: 207 });
  }
  
  if (detectSupabaseIssueFromResponse(res.status, ct)) {
    throw new Error(`Supabase paused (${res.status})`);
  }
  
  // Accept both 200 and 207 (WebDAV Multi-Status) as successful
  if (!(res.ok || res.status === 207)) {
    throw new Error(`HTTP ${res.status}: ${ct}`);
  }
  
  const xml = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));

  const items: HiDriveItem[] = [];
  for (const r of responses) {
    const hrefEl = r.getElementsByTagNameNS('*', 'href')[0];
    if (!hrefEl) continue;
    
    let href = hrefEl.textContent || '';
    try { href = decodeURIComponent(href); } catch { }
    
    // Get path part (strip domain if present)
    const pathOnly = href.replace(/^https?:\/\/[^/]+/, '');
    if (!pathOnly) continue;
    
    // Skip the directory itself
    const normNoSlash = normalized.replace(/\/$/, '');
    const pathNoSlash = pathOnly.replace(/\/$/, '');
    if (pathNoSlash === normNoSlash) continue;

    const segments = pathOnly.split('/').filter(Boolean);
    const name = segments.pop() || '';

    const isDir = r.getElementsByTagNameNS('*', 'collection').length > 0;
    const typeEl = r.getElementsByTagNameNS('*', 'getcontenttype')[0];
    const sizeEl = r.getElementsByTagNameNS('*', 'getcontentlength')[0];
    const modEl = r.getElementsByTagNameNS('*', 'getlastmodified')[0];
    const contentType = (typeEl?.textContent || '').toLowerCase();
    const size = sizeEl ? parseInt(sizeEl.textContent || '0', 10) : undefined;
    const modified = modEl?.textContent || undefined;

    if (isDir) {
      items.push({ name, type: 'directory' });
    } else {
      // If content-type missing, keep it; otherwise filter to media
      if (!contentType || isMediaContentType(contentType)) {
        items.push({ name, type: 'file', size, modified, contentType });
      }
    }
  }
  
  // De-dupe & sort
  const unique = new Map<string, HiDriveItem>();
  for (const it of items) unique.set(it.name.toLowerCase(), it);
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Probe a file URL using GET+Range (not HEAD) to check if it streams properly.
 * Returns ok if status is 200/206 and content-type is image/* or video/*.
 */
export const probeStream = async (url: string): Promise<ProbeResult> => {
  try {
    const res = await fetch(url, { 
      method: 'GET', 
      headers: { Range: 'bytes=0-0' } 
    });
    
    const contentType = res.headers.get('content-type') || '';
    const status = res.status;
    const ok = (res.ok || status === 206) && isMediaContentType(contentType);
    
    console.log('🔍 hidrive probe', { url, status, contentType, ok });
    
    // Diagnostics: Log successful range requests
    if (status === 206 && isMediaContentType(contentType)) {
      const { diag } = await import('../debug/diag');
      // Extract path from proxy URL for logging
      const pathMatch = url.match(/path=([^&]+)/);
      const path = pathMatch ? decodeURIComponent(pathMatch[1]) : url;
      diag('NET', 'range_ok', { path, status: 206, ct: contentType });
    }
    
    return { ok, status, contentType };
  } catch (error) {
    console.log('🔍 hidrive probe failed', { url, error: error instanceof Error ? error.message : 'Unknown error' });
    return { ok: false, status: 0, contentType: '' };
  }
};

/**
 * Find a preview file for a folder using directory listing.
 * Prefers preview.* files (case-insensitive), falls back to first media file by lexicographic order.
 */
export const findPreviewForFolder = async (path: string): Promise<string | null> => {
  try {
    const items = await listDir(path);
    const mediaFiles = items.filter(item => 
      item.type === 'file' && 
      item.contentType && 
      isMediaContentType(item.contentType)
    );
    
    if (mediaFiles.length === 0) {
      console.log('📁 No media files found in folder', path);
      return null;
    }
    
    // Look for preview.* files (case-insensitive)
    const previewExtensions = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'];
    const previewFile = mediaFiles.find(file => {
      const nameLower = file.name.toLowerCase(); 
      return previewExtensions.some(ext => 
        nameLower === `preview.${ext}` || nameLower.startsWith('preview.')
      );
    });
    
    if (previewFile) {
      const previewUrl = `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path + previewFile.name)}`;
      console.log('🎯 Found preview file', { folder: path, file: previewFile.name, url: previewUrl });
      return previewUrl;
    }
    
    // Fallback to first media file by lexicographic order
    const firstFile = mediaFiles.sort((a, b) => a.name.localeCompare(b.name))[0];
    const firstUrl = `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=${encodeURIComponent(path + firstFile.name)}`;
    console.log('📄 Using first media file as preview', { folder: path, file: firstFile.name, url: firstUrl });
    return firstUrl;
    
  } catch (error) {
    console.error('❌ Failed to find preview for folder', path, error);
    return null;
  }
};

export interface ValidateResult {
  ok: boolean;
  preview?: string;
}

/**
 * Validate a folder by finding its preview and testing if it streams properly.
 * Returns {ok:true, preview:file} if valid, {ok:false} otherwise.
 */
/**
 * List directory contents without media filtering (for manifest search).
 */
const listDirAll = async (path: string): Promise<HiDriveItem[]> => {
  const normalized = path.endsWith('/') ? path : path + '/';
  
  const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
  url.searchParams.set('path', normalized);
  url.searchParams.set('list', '1');
  
  const res = await fetch(url.toString(), { method: 'GET' });
  const ct = res.headers.get('content-type') || '';
  
  if (detectSupabaseIssueFromResponse(res.status, ct)) {
    throw new Error(`Supabase paused (${res.status})`);
  }
  
  if (!(res.ok || res.status === 207)) {
    throw new Error(`HTTP ${res.status}: ${ct}`);
  }
  
  const xml = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));

  const items: HiDriveItem[] = [];
  for (const r of responses) {
    const hrefEl = r.getElementsByTagNameNS('*', 'href')[0];
    if (!hrefEl) continue;
    
    let href = hrefEl.textContent || '';
    try { href = decodeURIComponent(href); } catch { }
    
    const pathOnly = href.replace(/^https?:\/\/[^/]+/, '');
    if (!pathOnly) continue;
    
    const normNoSlash = normalized.replace(/\/$/, '');
    const pathNoSlash = pathOnly.replace(/\/$/, '');
    if (pathNoSlash === normNoSlash) continue;

    const segments = pathOnly.split('/').filter(Boolean);
    const name = segments.pop() || '';

    const isDir = r.getElementsByTagNameNS('*', 'collection').length > 0;
    const typeEl = r.getElementsByTagNameNS('*', 'getcontenttype')[0];
    const sizeEl = r.getElementsByTagNameNS('*', 'getcontentlength')[0];
    const modEl = r.getElementsByTagNameNS('*', 'getlastmodified')[0];
    const contentType = (typeEl?.textContent || '').toLowerCase();
    const size = sizeEl ? parseInt(sizeEl.textContent || '0', 10) : undefined;
    const modified = modEl?.textContent || undefined;

    if (isDir) {
      items.push({ name, type: 'directory' });
    } else {
      // Include ALL files, not just media
      items.push({ name, type: 'file', size, modified, contentType });
    }
  }
  
  const unique = new Map<string, HiDriveItem>();
  for (const it of items) unique.set(it.name.toLowerCase(), it);
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Fetch text content from a path using the HiDrive proxy with cache-busting.
 */
export const fetchText = async (path: string, noStore = true): Promise<string | null> => {
  try {
    const url = new URL('https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy');
    url.searchParams.set('path', path);
    if (noStore) {
      url.searchParams.set('cb', Date.now().toString());
    }
    
    const res = await fetch(url.toString(), { 
      method: 'GET',
      cache: noStore ? 'no-store' : 'default'
    });
    
    if (!res.ok) {
      return null;
    }
    
    const text = await res.text();
    return text;
  } catch (error) {
    console.error('❌ Failed to fetch text', { path, error });
    return null;
  }
};

/**
 * Find and fetch MANIFEST.md file in a folder (case-insensitive).
 * Returns { content, matchedFilename } if found, null if not found.
 */
export const findManifestMarkdown = async (folderPath: string): Promise<{ content: string; matchedFilename: string } | null> => {
  try {
    // Ensure trailing slash
    const normalizedPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    const manifestVariants = ['MANIFEST.md', 'Manifest.md', 'manifest.md'];
    
    // First try: listing-based search (case-insensitive, no media filter)
    try {
      const items = await listDirAll(normalizedPath);
      const manifestFile = items.find(item => 
        item.type === 'file' && 
        manifestVariants.some(variant => item.name.toLowerCase() === variant.toLowerCase())
      );
      
      if (manifestFile) {
        const manifestPath = normalizedPath + manifestFile.name;
        const content = await fetchText(manifestPath);
        if (content) {
          return { content, matchedFilename: manifestFile.name };
        }
      }
    } catch (listError) {
      console.log('❌ Listing failed, trying direct GET', { folderPath: normalizedPath, listError });
    }
    
    // Second try: direct GET fallback for all variants
    for (const variant of manifestVariants) {
      const manifestPath = normalizedPath + variant;
      const content = await fetchText(manifestPath);
      if (content) {
        return { content, matchedFilename: variant };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to find manifest markdown', { folderPath, error });
    return null;
  }
};

/**
 * Parse MANIFEST.md content for metadata.
 * Supports YAML front-matter or plain markdown.
 */
export const parseManifestMarkdown = (md: string): { title?: string; description?: string; tags?: string[] } => {
  try {
    // Check for YAML front-matter
    if (md.startsWith('---')) {
      const endIndex = md.indexOf('---', 3);
      if (endIndex > 3) {
        const yamlContent = md.slice(3, endIndex).trim();
        const restContent = md.slice(endIndex + 3).trim();
        
        // Simple YAML parsing for our supported fields
        const result: { title?: string; description?: string; tags?: string[] } = {};
        
        const lines = yamlContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('title:')) {
            result.title = trimmed.slice(6).trim().replace(/^["']|["']$/g, '');
          } else if (trimmed.startsWith('description:') || trimmed.startsWith('subtitle:')) {
            const key = trimmed.startsWith('description:') ? 'description:' : 'subtitle:';
            result.description = trimmed.slice(key.length).trim().replace(/^["']|["']$/g, '');
          } else if (trimmed.startsWith('tags:')) {
            const tagsStr = trimmed.slice(5).trim();
            if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
              try {
                result.tags = JSON.parse(tagsStr);
              } catch {
                // Fallback: split by comma
                result.tags = tagsStr.slice(1, -1).split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
              }
            }
          }
        }
        
        return result;
      }
    }
    
    // Plain markdown fallback
    const lines = md.split('\n').map(l => l.trim()).filter(l => l);
    const result: { title?: string; description?: string; tags?: string[] } = {};
    
    // Find first H1
    const h1Line = lines.find(line => line.startsWith('# '));
    if (h1Line) {
      result.title = h1Line.slice(2).trim();
    }
    
    // Find first non-empty paragraph (not starting with #)
    const paragraph = lines.find(line => line && !line.startsWith('#') && line.length > 10);
    if (paragraph) {
      result.description = paragraph;
    }
    
    return result;
  } catch (error) {
    console.error('❌ Failed to parse manifest markdown', error);
    return {};
  }
};

/**
 * Get folder metadata by finding and parsing MANIFEST.md.
 */
export const getFolderMetadata = async (folderPath: string): Promise<{ title?: string; description?: string; tags?: string[] }> => {
  try {
    const manifestResult = await findManifestMarkdown(folderPath);
    if (!manifestResult) {
      // Emit diagnostics for missing manifest
      const { diag } = await import('../debug/diag');
      const folderNum = folderPath.replace(/.*\/public\/(\d+).*/, '$1');
      diag('MANIFEST', 'manifest_md_missing', { folder: folderNum });
      return {};
    }
    
    const { content, matchedFilename } = manifestResult;
    
    try {
      const metadata = parseManifestMarkdown(content);
      
      // Always emit diagnostics for successful parsing (regardless of content)
      const { diag, flushDiagToEdge, buildDiagSummary } = await import('../debug/diag');
      const folderNum = folderPath.replace(/.*\/public\/(\d+).*/, '$1');
      
      diag('MANIFEST', 'manifest_md_ok', { 
        folder: folderNum, 
        file: matchedFilename,
        title: metadata.title || '',
        descriptionLen: metadata.description?.length || 0
      });
      
      // Always flush to edge for each successful parse
      flushDiagToEdge(buildDiagSummary({ 
        manifest_example_0: { folder: folderNum, title: metadata.title || '' }
      }));
      
      return metadata;
    } catch (parseError) {
      // Emit diagnostics for parse errors
      const { diag } = await import('../debug/diag');
      const folderNum = folderPath.replace(/.*\/public\/(\d+).*/, '$1');
      diag('MANIFEST', 'manifest_md_error', { 
        folder: folderNum, 
        reason: parseError instanceof Error ? parseError.message : 'Parse error'
      });
      return {};
    }
  } catch (error) {
    // Emit diagnostics for general errors
    const { diag } = await import('../debug/diag');
    const folderNum = folderPath.replace(/.*\/public\/(\d+).*/, '$1');
    diag('MANIFEST', 'manifest_md_error', { 
      folder: folderNum, 
      reason: error instanceof Error ? error.message : 'Unknown error'
    });
    return {};
  }
};

export const validateFolder = async (folderPath: string): Promise<ValidateResult> => {
  try {
    const previewUrl = await findPreviewForFolder(folderPath);
    if (!previewUrl) {
      console.log('❌ Folder FAIL', { folder: folderPath, reason: 'No preview found' });
      return { ok: false };
    }

    const probeResult = await probeStream(previewUrl);
    if (probeResult.ok) {
      // Extract filename from URL for logging
      const match = previewUrl.match(/path=([^&]+)/);
      const filename = match ? decodeURIComponent(match[1]).split('/').pop() : 'unknown';
      console.log('✅ Folder OK', { folder: folderPath, file: filename });
      return { ok: true, preview: filename };
    } else {
      console.log('❌ Folder FAIL', { folder: folderPath, reason: `Probe failed: ${probeResult.status}` });
      return { ok: false };
    }
  } catch (error) {
    console.log('❌ Folder FAIL', { folder: folderPath, reason: error instanceof Error ? error.message : 'Unknown error' });
    return { ok: false };
  }
};
