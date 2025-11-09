// Manifest file editor utilities
import { normalizeMediaPath } from './hidrive';

export interface ManifestMetadata {
  title?: string;
  description?: string;
  tags?: string[];
}

/**
 * Format metadata object as YAML front-matter for MANIFEST.txt
 */
export function formatManifestContent(meta: ManifestMetadata): string {
  const lines = ['---'];

  if (meta.title) {
    lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`);
  }

  if (meta.description) {
    lines.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
  }

  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }

  if (lines.length === 1) {
    return '---\n\n';
  }

  lines.push('---');
  lines.push(''); // Empty line after front-matter

  return lines.join('\n');
}

/**
 * Parse YAML front-matter from MANIFEST.txt content
 */
export function parseManifestContent(content: string): ManifestMetadata {
  const meta: ManifestMetadata = {};
  
  // Extract YAML front-matter between --- markers
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return meta;
  
  const frontMatter = frontMatterMatch[1];
  
  // Parse title
  const titleMatch = frontMatter.match(/title:\s*"([^"]*)"/);
  if (titleMatch) meta.title = titleMatch[1];
  
  // Parse description
  const descMatch = frontMatter.match(/description:\s*"([^"]*)"/);
  if (descMatch) meta.description = descMatch[1];
  
  // Parse tags
  const tagsMatch = frontMatter.match(/tags:\s*\[(.*?)\]/);
  if (tagsMatch) {
    meta.tags = tagsMatch[1]
      .split(',')
      .map(t => t.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  }
  
  return meta;
}

/**
 * Save MANIFEST.txt file to HiDrive via hidrive-proxy
 */
export async function saveManifestFile(
  folderPath: string,
  content: string,
  owner: string = 'juliecamus'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Saving is only supported in the browser' };
    }

    const folderSlug = folderPath.replace(/^\/*/, '').split('/').filter(Boolean).pop() || 'manifest';
    const filename = `${folderSlug}-MANIFEST.txt`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Failed to save manifest file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch existing MANIFEST.txt content from HiDrive
 */
export async function fetchManifestFile(
  folderPath: string,
  owner: string = 'juliecamus'
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const normalizedFolder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    const candidates = ['MANIFEST.txt', 'MANIFEST.md', 'MANIFEST'];

    for (const candidate of candidates) {
      const manifestUrl = normalizeMediaPath(`${normalizedFolder}${candidate}`);
      const response = await fetch(manifestUrl, { cache: 'no-store' });

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const content = await response.text();
      if (content.trim().length === 0) {
        continue;
      }

      return { success: true, content };
    }

    // No manifest found, return empty content
    return { success: true, content: '' };
  } catch (error) {
    console.error('Failed to fetch manifest file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
