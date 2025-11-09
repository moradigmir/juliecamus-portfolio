import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeMediaPath, parseManifestMarkdown, findManifestMarkdown, getFolderMetadata } from './hidrive';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeMediaPath', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeMediaPath('')).toBe('');
    expect(normalizeMediaPath(undefined as unknown as string)).toBe('');
  });

  it('keeps /media/hidrive paths unchanged', () => {
    expect(normalizeMediaPath('/media/hidrive/gallery/image.jpg')).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('maps /public paths into /media/hidrive', () => {
    expect(normalizeMediaPath('/public/gallery/image.jpg')).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('adds leading slash for bare public paths', () => {
    expect(normalizeMediaPath('public/gallery/image.jpg')).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('prefixes arbitrary relative paths with media root', () => {
    expect(normalizeMediaPath('gallery/image.jpg')).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('normalizes hidrive protocol URLs', () => {
    expect(normalizeMediaPath('hidrive://juliecamus/public/gallery/image.jpg')).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('extracts path from legacy proxy URLs', () => {
    const legacyUrl = 'https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=%2Fpublic%2Fgallery%2Fimage.jpg&owner=juliecamus';
    expect(normalizeMediaPath(legacyUrl)).toBe('/media/hidrive/gallery/image.jpg');
  });

  it('falls back to pathname when proxy path param missing', () => {
    const cdnUrl = 'https://example.com/public/gallery/image.jpg';
    expect(normalizeMediaPath(cdnUrl)).toBe('/media/hidrive/gallery/image.jpg');
  });
});

describe('parseManifestMarkdown', () => {
  it('extracts YAML front matter fields', () => {
    const md = `---\ntitle: "Sample Title"\ndescription: "Short description"\ntags: ["tag1", "tag2"]\n---\nContent body`;
    expect(parseManifestMarkdown(md)).toEqual({
      title: 'Sample Title',
      description: 'Short description',
      tags: ['tag1', 'tag2'],
    });
  });

  it('falls back to markdown headings and paragraphs', () => {
    const md = `# Gallery Piece\nA wonderful piece showcasing light.`;
    expect(parseManifestMarkdown(md)).toEqual({
      title: 'Gallery Piece',
      description: 'A wonderful piece showcasing light.',
    });
  });

  it('returns empty object for empty content', () => {
    expect(parseManifestMarkdown('')).toEqual({});
  });
});

describe('findManifestMarkdown', () => {
  it('returns manifest content when a candidate file exists', async () => {
    const manifestUrl = '/media/hidrive/gallery/MANIFEST.md';
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (url === manifestUrl) {
        return new Response('Hello world', { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await findManifestMarkdown('/public/gallery');
    expect(fetchMock).toHaveBeenCalledWith(manifestUrl, { cache: 'no-store' });
    expect(result).toEqual({ content: 'Hello world', matchedFilename: 'MANIFEST.md' });
  });

  it('returns null when no manifest files resolve', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findManifestMarkdown('/public/missing');
    expect(result).toBeNull();
    // ensure at least first candidate tried
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('getFolderMetadata', () => {
  it('parses manifest markdown into metadata', async () => {
    const manifestUrl = '/media/hidrive/100/MANIFEST.md';
    const md = `---\ntitle: "Piece"\ndescription: "Details"\ntags: ["tag"]\n---`;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (url === manifestUrl) {
        return new Response(md, { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const meta = await getFolderMetadata('/public/100');
    expect(meta).toEqual({ title: 'Piece', description: 'Details', tags: ['tag'] });
  });

  it('returns empty metadata when manifest missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));

    const meta = await getFolderMetadata('/public/200');
    expect(meta).toEqual({});
  });
});
