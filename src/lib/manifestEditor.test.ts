import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatManifestContent,
  parseManifestContent,
  fetchManifestFile,
  type ManifestMetadata,
} from './manifestEditor';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('formatManifestContent', () => {
  it('serializes metadata into YAML front matter', () => {
    const meta: ManifestMetadata = {
      title: 'Gallery Piece',
      description: 'A "quoted" description',
      tags: ['tag-one', 'tag-two'],
    };

    const content = formatManifestContent(meta);

    expect(content).toContain('title: "Gallery Piece"');
    expect(content).toContain('description: "A \\"quoted\\" description"');
    expect(content).toContain('tags: ["tag-one", "tag-two"]');
  });

  it('omits optional fields when metadata empty', () => {
    expect(formatManifestContent({})).toBe('---\n\n');
  });
});

describe('parseManifestContent', () => {
  it('reads YAML values from front matter', () => {
    const content = `---\ntitle: "Piece"\ndescription: "Description"\ntags: ["tag"]\n---\nBody`;
    expect(parseManifestContent(content)).toEqual({
      title: 'Piece',
      description: 'Description',
      tags: ['tag'],
    });
  });

  it('returns empty metadata when front matter missing', () => {
    expect(parseManifestContent('No front matter here')).toEqual({});
  });
});

describe('fetchManifestFile', () => {
  const folder = '/public/gallery';
  const manifestUrl = '/media/hidrive/gallery/MANIFEST.txt';

  it('returns manifest content when found', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (url === manifestUrl) {
        return new Response('hello', { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchManifestFile(folder);
    expect(fetchMock).toHaveBeenCalledWith(manifestUrl, { cache: 'no-store' });
    expect(result).toEqual({ success: true, content: 'hello' });
  });

  it('returns empty content when manifest missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));

    const result = await fetchManifestFile(folder);
    expect(result).toEqual({ success: true, content: '' });
  });

  it('returns error payload when server responds with failure', async () => {
    const response = new Response('fail', { status: 500, statusText: 'Server Error' });
    vi.stubGlobal('fetch', vi.fn(async () => response));

    const result = await fetchManifestFile(folder);
    expect(result).toEqual({ success: false, error: 'HTTP 500: Server Error' });
  });
});
