// Media Manifest Generator for Frontend
export type MediaType = 'image' | 'video';

export interface MediaItem {
  orderKey: string;
  folder: string;
  title: string;
  previewUrl: string;
  previewType: MediaType;
  fullUrl: string;
  fullType: MediaType;
  thumbnailUrl?: string;
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive';
}

interface HiDriveFile {
  name: string;
  type: 'file' | 'dir';
  path: string;
  size?: number;
  href?: string;
}

class HiDriveClient {
  private baseUrl = 'https://webdav.hidrive.strato.com';

  async listDirectory(dirPath: string, username: string, password: string): Promise<HiDriveFile[]> {
    const url = `${this.baseUrl}${dirPath}`;
    console.log(`📂 Listing directory: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'Depth': '1',
          'Content-Type': 'application/xml',
          'User-Agent': 'Mozilla/5.0 (compatible; MediaManifestBuilder/1.0)'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:resourcetype/>
    <D:href/>
  </D:prop>
</D:propfind>`
      });

      if (!response.ok) {
        throw new Error(`HiDrive request failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      return this.parseWebDAVResponse(xmlText, dirPath);
    } catch (error) {
      console.error(`❌ Error listing directory ${dirPath}:`, error);
      throw error;
    }
  }

  private parseWebDAVResponse(xml: string, basePath: string): HiDriveFile[] {
    const files: HiDriveFile[] = [];
    const responsePattern = /<d:response[^>]*>(.*?)<\/d:response>/gis;
    let match;
    
    while ((match = responsePattern.exec(xml)) !== null) {
      const responseContent = match[1];
      
      // Extract href
      const hrefMatch = /<d:href[^>]*>([^<]+)<\/d:href>/i.exec(responseContent);
      if (!hrefMatch) continue;
      
      let href = decodeURIComponent(hrefMatch[1]);
      
      // Extract display name
      const nameMatch = /<d:displayname[^>]*>([^<]*)<\/d:displayname>/i.exec(responseContent);
      let name = nameMatch ? nameMatch[1].trim() : '';
      
      if (!name && href) {
        const parts = href.split('/');
        name = parts[parts.length - 1] || '';
      }
      
      if (!name) continue;
      
      // Determine type
      const isCollection = /<d:resourcetype[^>]*>.*?<d:collection/is.test(responseContent);
      const type: 'file' | 'dir' = isCollection ? 'dir' : 'file';
      
      // Extract size for files
      let size: number | undefined;
      if (type === 'file') {
        const sizeMatch = /<d:getcontentlength[^>]*>(\d+)<\/d:getcontentlength>/i.exec(responseContent);
        size = sizeMatch ? parseInt(sizeMatch[1]) : undefined;
      }
      
      // Skip self-reference
      if (href === basePath || href === basePath + '/') {
        continue;
      }
      
      files.push({
        name,
        type,
        path: href,
        size,
        href
      });
    }
    
    return files;
  }

  getPublicUrl(filePath: string): string {
    return `https://webdav.hidrive.strato.com${filePath}`;
  }
}

export class MediaManifestGenerator {
  private client = new HiDriveClient();
  
  async generateManifest(username: string, password: string): Promise<MediaManifest> {
    console.log('🚀 Starting HiDrive media manifest generation...');
    
    try {
      const mediaDir = '/users/juliecamus/public';
      console.log(`📂 Scanning ${mediaDir}`);
      
      const entries = await this.client.listDirectory(mediaDir, username, password);
      
      // Filter for numbered directories
      const numberDirs = entries
        .filter(entry => entry.type === 'dir')
        .filter(entry => /^\d+$/.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      console.log(`📁 Found numbered directories: ${numberDirs.map(d => d.name).join(', ')}`);
      
      const items: MediaItem[] = [];
      
      for (const dir of numberDirs) {
        console.log(`\n🔍 Processing folder: ${dir.name}`);
        
        try {
          const folderPath = `${mediaDir}/${dir.name}`;
          const files = await this.client.listDirectory(folderPath, username, password);
          
          const mediaFiles = files.filter(file => 
            file.type === 'file' && this.isMediaFile(file.name)
          );
          
          console.log(`  📄 Media files found: ${mediaFiles.map(f => f.name).join(', ')}`);
          
          if (mediaFiles.length === 0) {
            console.warn(`  ⚠️  No media files in folder ${dir.name}`);
            continue;
          }
          
          const preview = this.selectPreviewFile(mediaFiles);
          const full = this.selectFullFile(mediaFiles, dir.name);
          
          if (!preview) {
            console.warn(`  ⚠️  No suitable preview file for folder ${dir.name}`);
            continue;
          }
          
          const previewUrl = this.client.getPublicUrl(preview.path);
          const fullUrl = this.client.getPublicUrl((full || preview).path);
          
          console.log(`  ✅ Preview: ${preview.name} -> ${previewUrl}`);
          console.log(`  ✅ Full: ${(full || preview).name} -> ${fullUrl}`);
          
          items.push({
            orderKey: dir.name,
            folder: dir.name,
            title: `Portfolio ${dir.name}`,
            previewUrl,
            previewType: this.getMediaType(preview.name),
            fullUrl,
            fullType: this.getMediaType((full || preview).name)
          });
          
        } catch (error) {
          console.error(`❌ Error processing folder ${dir.name}:`, error);
        }
      }
      
      console.log(`\n🎉 Successfully processed ${items.length} media folders`);
      
      return {
        items,
        generatedAt: new Date().toISOString(),
        source: 'hidrive'
      };
      
    } catch (error) {
      console.error('❌ Failed to build media manifest:', error);
      throw error;
    }
  }

  private isMediaFile(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'].includes(ext || '');
  }

  private getMediaType(filename: string): MediaType {
    const ext = filename.toLowerCase().split('.').pop();
    return ['mp4', 'webm', 'mov'].includes(ext || '') ? 'video' : 'image';
  }

  private selectPreviewFile(files: HiDriveFile[]): HiDriveFile | null {
    // Priority 1: exact _preview.*
    let candidate = files.find(f => f.name.match(/^_preview\./i));
    if (candidate) return candidate;
    
    // Priority 2: contains _short
    candidate = files.find(f => f.name.toLowerCase().includes('_short'));
    if (candidate) return candidate;
    
    // Priority 3: contains _preview
    candidate = files.find(f => f.name.toLowerCase().includes('_preview'));
    if (candidate) return candidate;
    
    // Priority 4: first image file
    candidate = files.find(f => this.getMediaType(f.name) === 'image');
    if (candidate) return candidate;
    
    // Fallback: first file
    return files[0] || null;
  }

  private selectFullFile(files: HiDriveFile[], folderNumber: string): HiDriveFile | null {
    // Priority 1: exact _full.*
    let candidate = files.find(f => f.name.match(/^_full\./i));
    if (candidate) return candidate;
    
    // Priority 2: starts with folder number and has full in name
    candidate = files.find(f => 
      f.name.toLowerCase().startsWith(folderNumber.toLowerCase()) &&
      f.name.toLowerCase().includes('full')
    );
    if (candidate) return candidate;
    
    // Priority 3: starts with folder number (not short/preview)
    candidate = files.find(f => 
      f.name.toLowerCase().startsWith(folderNumber.toLowerCase()) &&
      !f.name.toLowerCase().includes('short') &&
      !f.name.toLowerCase().includes('preview')
    );
    if (candidate) return candidate;
    
    // Fallback: largest file
    return files.reduce((largest, current) => 
      (current.size || 0) > (largest?.size || 0) ? current : largest, 
      null as HiDriveFile | null
    );
  }
}