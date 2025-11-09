const PUBLIC_ROOT = '/public';
const MEDIA_ROOT = '/media/hidrive';

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function normalizeMediaPath(input: string): string {
  let path = (input ?? '').trim();

  if (!path) return '';

  if (path.startsWith('hidrive://')) {
    path = path.replace(/^hidrive:\/\/[^/]+/i, '');
  }

  if (path.startsWith('http')) {
    try {
      const url = new URL(path);
      const paramPath = url.searchParams.get('path');
      path = paramPath ?? url.pathname;
    } catch {
      // fall back to raw path
    }
  }

  path = ensureLeadingSlash(path).replace(/\/{2,}/g, '/');

  if (path.startsWith(MEDIA_ROOT)) {
    return path;
  }

  if (path.startsWith(PUBLIC_ROOT)) {
    return `${MEDIA_ROOT}${path.slice(PUBLIC_ROOT.length)}`.replace(/\/{2,}/g, '/');
  }

  return `${MEDIA_ROOT}${path}`.replace(/\/{2,}/g, '/');
}

const MANIFEST_FILENAMES = [
  'MANIFEST.md', 'Manifest.md', 'manifest.md',
  'MANIFEST.txt', 'Manifest.txt', 'manifest.txt',
  'MANIFEST', 'Manifest', 'manifest',
  'README.md', 'INFO.md'
];

async function fetchLocalText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[fetchLocalText] ${url} returned ${res.status}`);
      return null;
    }
    
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.error(`[fetchLocalText] ${url} returned HTML instead of text! Content-Type: ${contentType}`);
      return null;
    }
    
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error(`[fetchLocalText] ${url} returned HTML document!`);
      return null;
    }
    
    return text.trim() ? text : null;
  } catch (error) {
    console.warn('⚠️ Failed to fetch local text', { url, error });
    return null;
  }
}

export async function findManifestMarkdown(folderPath: string): Promise<{ content: string; matchedFilename: string } | null> {
  const normalizedFolder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

  for (const candidate of MANIFEST_FILENAMES) {
    const publicCandidate = `${normalizedFolder}${candidate}`;
    const localUrl = normalizeMediaPath(publicCandidate);

    const content = await fetchLocalText(localUrl);
    if (content) {
      return { content, matchedFilename: candidate };
    }
  }

  return null;
}

export function parseManifestMarkdown(md: string): { title?: string; description?: string; tags?: string[] } {
  try {
    if (!md?.trim()) return {};

    if (md.startsWith('---')) {
      const endIndex = md.indexOf('---', 3);
      if (endIndex > 3) {
        const yamlContent = md.slice(3, endIndex).trim();

        const result: { title?: string; description?: string; tags?: string[] } = {};
        const lines = yamlContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('title:')) {
            result.title = trimmed.slice(6).trim().replace(/^['"]|['"]$/g, '');
          } else if (trimmed.startsWith('description:') || trimmed.startsWith('subtitle:')) {
            const key = trimmed.startsWith('description:') ? 'description:' : 'subtitle:';
            result.description = trimmed.slice(key.length).trim().replace(/^['"]|['"]$/g, '');
          } else if (trimmed.startsWith('tags:')) {
            const tagsStr = trimmed.slice(5).trim();
            if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
              try {
                result.tags = JSON.parse(tagsStr);
              } catch {
                result.tags = tagsStr
                  .slice(1, -1)
                  .split(',')
                  .map(tag => tag.trim().replace(/^['"]|['"]$/g, ''))
                  .filter(Boolean);
              }
            }
          }
        }

        return result;
      }
    }

    const lines = md
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return {};

    const result: { title?: string; description?: string; tags?: string[] } = {};
    let hasKeyValue = false;

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();

        if (key === 'title' && value) {
          result.title = value;
          hasKeyValue = true;
        } else if ((key === 'description' || key === 'subtitle') && value) {
          result.description = value;
          hasKeyValue = true;
        } else if (key === 'tags' && value) {
          try {
            if (value.startsWith('[')) {
              result.tags = JSON.parse(value);
            } else {
              result.tags = value
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
            }
          } catch {
            result.tags = value
              .split(',')
              .map(tag => tag.trim())
              .filter(Boolean);
          }
          hasKeyValue = true;
        }
      }
    }

    if (hasKeyValue) return result;

    const h1Line = lines.find(line => line.startsWith('# '));
    if (h1Line) {
      result.title = h1Line.slice(2).trim();
    } else if (lines[0]) {
      result.title = lines[0];
    }

    const paragraph = lines.find(line =>
      line &&
      !line.startsWith('#') &&
      !line.includes(':') &&
      line.length >= 10 &&
      line !== result.title
    );

    if (paragraph) {
      result.description = paragraph;
    } else if (lines.length > 1 && lines[1] && lines[1] !== result.title) {
      result.description = lines[1];
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to parse manifest', error);
    return {};
  }
}

export async function getFolderMetadata(folderPath: string): Promise<{ title?: string; description?: string; tags?: string[] }> {
  const manifestResult = await findManifestMarkdown(folderPath);

  if (!manifestResult) {
    return {};
  }

  try {
    return parseManifestMarkdown(manifestResult.content);
  } catch (error) {
    console.error('❌ Failed to parse manifest', error);
    return {};
  }
}

export function persistFolderMetaToCache(folder: string, meta: any) {
  try {
    const OWNER = 'juliecamus';
    const KEY = (o: string) => `manifestMetaCache:v2:${o}`;
    const raw = localStorage.getItem(KEY(OWNER));
    const old = raw ? JSON.parse(raw) : { owner: OWNER, updatedAt: 0, metaByFolder: {} };
    old.owner = OWNER;
    old.metaByFolder = old.metaByFolder || {};

    if (meta && meta.__absent) {
      old.metaByFolder[folder] = { __absent: true, source: 'absent', ts: Date.now() };
    } else {
      old.metaByFolder[folder] = {
        ...(old.metaByFolder[folder] ?? {}),
        ...(meta ?? {}),
        source: 'file',
        ts: Date.now()
      };
    }

    old.updatedAt = Date.now();
    localStorage.setItem(KEY(OWNER), JSON.stringify(old));
  } catch (error) {
    console.log('[HARD-DIAG:MANIFEST] persist_failed', { folder, err: String(error) });
  }
}
