// Test what path normalizeMediaPath generates for MANIFEST.txt

const PUBLIC_ROOT = '/public';
const MEDIA_ROOT = '/media/hidrive';

function ensureLeadingSlash(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeMediaPath(input) {
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

// Test the path that would be generated
const folderPath = '/public/01/';
const candidate = `${folderPath}MANIFEST.txt`;
const localUrl = normalizeMediaPath(candidate);

console.log('folderPath:', folderPath);
console.log('candidate:', candidate);
console.log('localUrl:', localUrl);
console.log('Expected:', '/media/hidrive/01/MANIFEST.txt');
console.log('Match:', localUrl === '/media/hidrive/01/MANIFEST.txt');
