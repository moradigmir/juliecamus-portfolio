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
