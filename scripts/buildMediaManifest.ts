#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

// Types for the manifest
export type MediaType = 'image' | 'video';

export interface MediaItem {
  orderKey: string;      // "01"
  folder: string;        // "01"  
  title: string;         // default = folder name
  previewUrl: string;
  previewType: MediaType;
  fullUrl: string;
  fullType: MediaType;
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive';
}

// HiDrive API configuration
interface HiDriveConfig {
  username: string;
  password: string;
  baseUrl: string;
  rootPath: string;
}

interface HiDriveFile {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  path: string;
}

class HiDriveClient {
  private config: HiDriveConfig;
  private accessToken: string | null = null;

  constructor(config: HiDriveConfig) {
    this.config = config;
  }

  async authenticate(): Promise<void> {
    // For now, we'll use basic auth with the HiDrive WebDAV interface
    // In production, you'd want to use OAuth2, but this requires client_id/secret setup
    console.log('Authenticating with HiDrive...');
    this.accessToken = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
  }

  async listFiles(dirPath: string): Promise<HiDriveFile[]> {
    const url = `https://webdav.hidrive.strato.com${this.config.rootPath}${dirPath}`;
    
    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${this.accessToken}`,
          'Depth': '1',
          'Content-Type': 'application/xml'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`
      });

      if (!response.ok) {
        throw new Error(`HiDrive API error: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      return this.parseWebDAVResponse(xmlText, dirPath);
    } catch (error) {
      console.error(`Error listing files in ${dirPath}:`, error);
      throw error;
    }
  }

  private parseWebDAVResponse(xml: string, basePath: string): HiDriveFile[] {
    // Simple XML parsing for WebDAV response
    const files: HiDriveFile[] = [];
    const responseRegex = /<D:response>(.*?)<\/D:response>/gs;
    
    let match;
    while ((match = responseRegex.exec(xml)) !== null) {
      const responseContent = match[1];
      
      const hrefMatch = responseContent.match(/<D:href>(.*?)<\/D:href>/);
      const displayNameMatch = responseContent.match(/<D:displayname>(.*?)<\/D:displayname>/);
      const isCollection = responseContent.includes('<D:collection/>');
      
      if (hrefMatch && displayNameMatch) {
        const href = hrefMatch[1];
        const name = displayNameMatch[1];
        
        // Skip the current directory entry
        if (href.endsWith(basePath) || href.endsWith(basePath + '/')) {
          continue;
        }
        
        files.push({
          name,
          type: isCollection ? 'dir' : 'file',
          path: href
        });
      }
    }
    
    return files;
  }

  getPublicUrl(filePath: string): string {
    // Generate public URL for HiDrive files
    // This assumes files in /public/ are accessible via direct URL
    return `https://my.hidrive.com/api/sharelink/create${filePath}`;
  }
}

class MediaManifestBuilder {
  private hidriveClient: HiDriveClient;
  
  constructor(hidriveConfig: HiDriveConfig) {
    this.hidriveClient = new HiDriveClient(hidriveConfig);
  }

  async buildManifest(): Promise<MediaManifest> {
    console.log('Building media manifest...');
    
    await this.hidriveClient.authenticate();
    
    // List media directories
    const mediaDirs = await this.listMediaDirectories();
    console.log(`Found ${mediaDirs.length} media directories:`, mediaDirs.map(d => d.name));
    
    const items: MediaItem[] = [];
    
    for (const dir of mediaDirs) {
      console.log(`Processing directory: ${dir.name}`);
      const mediaItem = await this.processDirectory(dir);
      if (mediaItem) {
        items.push(mediaItem);
      }
    }
    
    // Sort by orderKey numerically
    items.sort((a, b) => a.orderKey.localeCompare(b.orderKey, undefined, { numeric: true }));
    
    return {
      items,
      generatedAt: new Date().toISOString(),
      source: 'hidrive'
    };
  }

  private async listMediaDirectories(): Promise<HiDriveFile[]> {
    const files = await this.hidriveClient.listFiles('/media/');
    
    // Filter for numbered directories (01, 02, 03, etc.)
    return files
      .filter(file => file.type === 'dir')
      .filter(file => /^\d+$/.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  private async processDirectory(dir: HiDriveFile): Promise<MediaItem | null> {
    try {
      const files = await this.hidriveClient.listFiles(`/media/${dir.name}/`);
      const mediaFiles = files.filter(file => this.isMediaFile(file.name));
      
      if (mediaFiles.length === 0) {
        console.warn(`No media files found in directory: ${dir.name}`);
        return null;
      }

      const preview = this.selectPreviewFile(mediaFiles);
      const full = this.selectFullFile(mediaFiles, dir.name);
      
      if (!preview) {
        console.warn(`No preview file found for directory: ${dir.name}`);
        return null;
      }

      return {
        orderKey: dir.name,
        folder: dir.name,
        title: this.formatTitle(dir.name),
        previewUrl: this.hidriveClient.getPublicUrl(preview.path),
        previewType: this.getMediaType(preview.name),
        fullUrl: this.hidriveClient.getPublicUrl(full?.path || preview.path),
        fullType: this.getMediaType(full?.name || preview.name)
      };
    } catch (error) {
      console.error(`Error processing directory ${dir.name}:`, error);
      return null;
    }
  }

  private selectPreviewFile(files: HiDriveFile[]): HiDriveFile | null {
    // Priority 1: exact _preview.*
    let candidate = files.find(f => f.name.match(/^_preview\./));
    if (candidate) return candidate;
    
    // Priority 2: contains _short
    candidate = files.find(f => f.name.includes('_short'));
    if (candidate) return candidate;
    
    // Priority 3: contains _preview
    candidate = files.find(f => f.name.includes('_preview'));
    if (candidate) return candidate;
    
    // Priority 4: first image
    candidate = files.find(f => this.getMediaType(f.name) === 'image');
    if (candidate) return candidate;
    
    // Priority 5: first video
    candidate = files.find(f => this.getMediaType(f.name) === 'video');
    if (candidate) return candidate;
    
    return null;
  }

  private selectFullFile(files: HiDriveFile[], folderNumber: string): HiDriveFile | null {
    const nonPreviewFiles = files.filter(f => 
      !f.name.includes('_short') && 
      !f.name.includes('_preview') &&
      !f.name.startsWith('_preview.')
    );
    
    if (nonPreviewFiles.length === 0) {
      // Fallback to any file if only preview files exist
      return files[0] || null;
    }
    
    // Priority 1: video starting with folder number
    let candidate = nonPreviewFiles.find(f => 
      this.getMediaType(f.name) === 'video' && 
      f.name.startsWith(folderNumber)
    );
    if (candidate) return candidate;
    
    // Priority 2: first video (non-preview)
    candidate = nonPreviewFiles.find(f => this.getMediaType(f.name) === 'video');
    if (candidate) return candidate;
    
    // Priority 3: first image (non-preview)  
    candidate = nonPreviewFiles.find(f => this.getMediaType(f.name) === 'image');
    if (candidate) return candidate;
    
    // Fallback: first file
    return nonPreviewFiles[0] || files[0] || null;
  }

  private isMediaFile(filename: string): boolean {
    const mediaExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif',
      // Videos  
      '.mp4', '.webm', '.mov', '.avi', '.mkv'
    ];
    
    const ext = path.extname(filename).toLowerCase();
    return mediaExtensions.includes(ext);
  }

  private getMediaType(filename: string): MediaType {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const ext = path.extname(filename).toLowerCase();
    return videoExtensions.includes(ext) ? 'video' : 'image';
  }

  private formatTitle(folderName: string): string {
    // Convert folder number to a title (can be customized)
    return `Media ${folderName}`;
  }
}

async function main() {
  try {
    const config: HiDriveConfig = {
      username: process.env.HIDRIVE_USERNAME || 'juliecamus',
      password: process.env.HIDRIVE_PASSWORD || '',
      baseUrl: 'https://webdav.hidrive.strato.com',
      rootPath: '/public'  // Since everything is in the public folder
    };

    if (!config.password) {
      console.error('HIDRIVE_PASSWORD environment variable is required');
      process.exit(1);
    }

    const builder = new MediaManifestBuilder(config);
    const manifest = await builder.buildManifest();
    
    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Write manifest to public directory
    const manifestPath = path.join(publicDir, 'media.manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Media manifest generated successfully!`);
    console.log(`📄 Manifest written to: ${manifestPath}`);
    console.log(`📊 Found ${manifest.items.length} media items`);
    
    // Log summary
    manifest.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} (${item.folder}) - Preview: ${item.previewType}, Full: ${item.fullType}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to generate media manifest:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}