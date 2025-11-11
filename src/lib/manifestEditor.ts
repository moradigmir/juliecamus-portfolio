// Manifest file editor utilities

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
 * Save MANIFEST.txt file via local API
 */
export async function saveManifestFile(
  folderPath: string,
  content: string,
  owner: string = 'juliecamus'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract folder number from path like /public/26
    const folderMatch = folderPath.match(/\/(\d+)$/);
    if (!folderMatch) {
      return { success: false, error: 'Invalid folder path format' };
    }
    
    const folder = folderMatch[1];
    const response = await fetch(`/api/manifest/${folder}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: content,
    });

    if (!response.ok) {
      const result = await response.json();
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}` 
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to save manifest file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Fetch existing MANIFEST.txt content via local API
 */
export async function fetchManifestFile(
  folderPath: string,
  owner: string = 'juliecamus'
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // Extract folder number from path like /public/26
    const folderMatch = folderPath.match(/\/(\d+)$/);
    if (!folderMatch) {
      return { success: false, error: 'Invalid folder path format' };
    }
    
    const folder = folderMatch[1];
    const response = await fetch(`/api/manifest/${folder}`);

    if (!response.ok) {
      const result = await response.json();
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}` 
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to fetch manifest file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete MANIFEST.txt file via local API
 */
export async function deleteManifestFile(
  folderPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract folder number from path like /public/26
    const folderMatch = folderPath.match(/\/(\d+)$/);
    if (!folderMatch) {
      return { success: false, error: 'Invalid folder path format' };
    }
    
    const folder = folderMatch[1];
    const response = await fetch(`/api/manifest/${folder}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const result = await response.json();
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}` 
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to delete manifest file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
