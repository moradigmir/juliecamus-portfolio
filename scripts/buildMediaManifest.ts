#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Types for the manifest
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
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.baseUrl = 'https://webdav.hidrive.strato.com';
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  async listDirectory(dirPath: string): Promise<HiDriveFile[]> {
    const url = `${this.baseUrl}${dirPath}`;
    console.log(`📂 Listing directory: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.getAuthHeader(),
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
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HiDrive request failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      console.log(`📄 Response received (${xmlText.length} chars)`);
      
      return this.parseWebDAVResponse(xmlText, dirPath);
    } catch (error) {
      console.error(`❌ Error listing directory ${dirPath}:`, error);
      throw error;
    }
  }

  private parseWebDAVResponse(xml: string, basePath: string): HiDriveFile[] {
    console.log(`🔍 Parsing WebDAV response for ${basePath}`);
    const files: HiDriveFile[] = [];
    
    // Simple regex-based parsing for WebDAV multistatus response
    const responsePattern = /<d:response[^>]*>(.*?)<\/d:response>/gis;
    let match;
    
    while ((match = responsePattern.exec(xml)) !== null) {
      const responseContent = match[1];
      
      // Extract href
      const hrefMatch = responseContent.match(/<d:href[^>]*>(.*?)<\/d:href>/i);
      if (!hrefMatch) continue;
      
      const href = decodeURIComponent(hrefMatch[1]);
      
      // Skip the current directory itself
      if (href === basePath || href === basePath + '/') {
        continue;
      }
      
      // Extract display name
      const nameMatch = responseContent.match(/<d:displayname[^>]*>(.*?)<\/d:displayname>/i);
      const name = nameMatch ? nameMatch[1].trim() : path.basename(href);
      
      if (!name) continue;
      
      // Check if it's a directory
      const isCollection = responseContent.includes('<d:collection') || responseContent.includes('<d:collection/>');
      
      // Extract size
      const sizeMatch = responseContent.match(/<d:getcontentlength[^>]*>(\d+)<\/d:getcontentlength>/i);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : undefined;
      
      files.push({
        name,
        type: isCollection ? 'dir' : 'file',
        path: href,
        size,
        href
      });
      
      console.log(`  📄 Found: ${name} (${isCollection ? 'dir' : 'file'})`);
    }
    
    return files;
  }

  getPublicUrl(filePath: string): string {
    // For files in the public folder, we can create direct access URLs
    // HiDrive allows direct access to files in public shares
    const cleanPath = filePath.replace('/public/', '');
    return `https://my.hidrive.com/share/juliecamus${cleanPath}`;
  }
}

class MediaManifestBuilder {
  private client: HiDriveClient;
  
  constructor(username: string, password: string) {
    this.client = new HiDriveClient(username, password);
  }

  async buildManifest(): Promise<MediaManifest> {
    console.log('🚀 Starting HiDrive media manifest generation...');
    
    try {
      // List the /public/media directory
      const mediaDir = '/public/media';
      console.log(`📂 Scanning ${mediaDir}`);
      
      const entries = await this.client.listDirectory(mediaDir);
      
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
          const files = await this.client.listDirectory(folderPath);
          
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
          
          // Generate thumbnail for videos
          let thumbnailUrl: string | undefined;
          if (this.getMediaType(preview.name) === 'video') {
            thumbnailUrl = await this.generateVideoThumbnail(previewUrl, dir.name);
          }
          
          console.log(`  ✅ Preview: ${preview.name} -> ${previewUrl}`);
          console.log(`  ✅ Full: ${(full || preview).name} -> ${fullUrl}`);
          if (thumbnailUrl) {
            console.log(`  🖼️  Thumbnail: ${thumbnailUrl}`);
          }
          
          items.push({
            orderKey: dir.name,
            folder: dir.name,
            title: `Portfolio ${dir.name}`,
            previewUrl,
            previewType: this.getMediaType(preview.name),
            fullUrl,
            fullType: this.getMediaType((full || preview).name),
            thumbnailUrl
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

  private selectPreviewFile(files: HiDriveFile[]): HiDriveFile | null {
    console.log('    🔍 Selecting preview file...');
    
    // Priority 1: exact _preview.*
    let candidate = files.find(f => f.name.match(/^_preview\./i));
    if (candidate) {
      console.log(`    ✅ Found exact _preview file: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 2: contains _short
    candidate = files.find(f => f.name.toLowerCase().includes('_short'));
    if (candidate) {
      console.log(`    ✅ Found _short file: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 3: contains _preview
    candidate = files.find(f => f.name.toLowerCase().includes('_preview'));
    if (candidate) {
      console.log(`    ✅ Found _preview file: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 4: first image
    candidate = files.find(f => this.getMediaType(f.name) === 'image');
    if (candidate) {
      console.log(`    ✅ Using first image: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 5: first video
    candidate = files.find(f => this.getMediaType(f.name) === 'video');
    if (candidate) {
      console.log(`    ✅ Using first video: ${candidate.name}`);
      return candidate;
    }
    
    console.log('    ❌ No suitable preview file found');
    return null;
  }

  private selectFullFile(files: HiDriveFile[], folderNumber: string): HiDriveFile | null {
    console.log('    🔍 Selecting full file...');
    
    const nonPreviewFiles = files.filter(f => 
      !f.name.toLowerCase().includes('_short') && 
      !f.name.toLowerCase().includes('_preview') &&
      !f.name.toLowerCase().startsWith('_preview.')
    );
    
    if (nonPreviewFiles.length === 0) {
      console.log('    ℹ️  All files are preview files, will reuse preview as full');
      return null;
    }
    
    // Priority 1: video starting with folder number
    let candidate = nonPreviewFiles.find(f => 
      this.getMediaType(f.name) === 'video' && 
      f.name.toLowerCase().startsWith(folderNumber.toLowerCase())
    );
    if (candidate) {
      console.log(`    ✅ Found numbered video: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 2: first video (non-preview)
    candidate = nonPreviewFiles.find(f => this.getMediaType(f.name) === 'video');
    if (candidate) {
      console.log(`    ✅ Using first video: ${candidate.name}`);
      return candidate;
    }
    
    // Priority 3: first image (non-preview)  
    candidate = nonPreviewFiles.find(f => this.getMediaType(f.name) === 'image');
    if (candidate) {
      console.log(`    ✅ Using first image: ${candidate.name}`);
      return candidate;
    }
    
    console.log('    ℹ️  No suitable full file, will reuse preview');
    return null;
  }

  private isMediaFile(filename: string): boolean {
    const mediaExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif',
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

  private async generateVideoThumbnail(videoUrl: string, folderName: string): Promise<string | undefined> {
    try {
      // Create thumbnails directory if it doesn't exist
      const publicDir = path.join(process.cwd(), '..', 'public');
      const thumbnailsDir = path.join(publicDir, 'thumbnails');
      const folderThumbnailsDir = path.join(thumbnailsDir, folderName);
      
      if (!fs.existsSync(folderThumbnailsDir)) {
        fs.mkdirSync(folderThumbnailsDir, { recursive: true });
      }
      
      const thumbnailPath = path.join(folderThumbnailsDir, `${folderName}_thumb.webp`);
      const relativeThumbnailPath = `/thumbnails/${folderName}/${folderName}_thumb.webp`;
      
      // Check if thumbnail already exists
      if (fs.existsSync(thumbnailPath)) {
        console.log(`    ♻️  Using existing thumbnail: ${relativeThumbnailPath}`);
        return relativeThumbnailPath;
      }
      
      console.log(`    🎬 Generating thumbnail for video: ${videoUrl}`);
      
      // Use ffmpeg to extract first frame as WebP thumbnail (requires ffmpeg to be installed)
      try {
        execSync(`ffmpeg -i "${videoUrl}" -vf "scale=320:240:force_original_aspect_ratio=increase,crop=320:240" -frames:v 1 -f webp "${thumbnailPath}" -y`, {
          stdio: 'pipe',
          timeout: 30000 // 30 second timeout
        });
        
        if (fs.existsSync(thumbnailPath)) {
          console.log(`    ✅ Generated thumbnail: ${relativeThumbnailPath}`);
          return relativeThumbnailPath;
        }
      } catch (ffmpegError) {
        console.warn(`    ⚠️  FFmpeg failed, thumbnail generation skipped: ${ffmpegError}`);
      }
      
    } catch (error) {
      console.warn(`    ⚠️  Thumbnail generation failed: ${error}`);
    }
    
    return undefined;
  }
}

async function main() {
  console.log('🎬 HiDrive Media Manifest Builder\n');
  
  const username = 'juliecamus';
  const password = process.env.HIDRIVE_PASSWORD;
  
  if (!password) {
    console.error('❌ HIDRIVE_PASSWORD environment variable is required');
    console.error('   Set it with: export HIDRIVE_PASSWORD="your-password"');
    process.exit(1);
  }
  
  console.log(`🔐 Connecting to HiDrive as: ${username}`);
  
  try {
    const builder = new MediaManifestBuilder(username, password);
    const manifest = await builder.buildManifest();
    
    // Write to public directory
    const publicDir = path.join(process.cwd(), '..', 'public');
    const manifestPath = path.join(publicDir, 'media.manifest.json');
    
    // Ensure directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n🎉 Success!`);
    console.log(`📄 Manifest written to: ${manifestPath}`);
    console.log(`📊 Found ${manifest.items.length} media items:`);
    
    manifest.items.forEach((item, index) => {
      console.log(`   ${index + 1}. Folder ${item.folder}: ${item.title}`);
      console.log(`      Preview: ${item.previewType} (${item.previewUrl})`);
      console.log(`      Full: ${item.fullType} (${item.fullUrl})`);
    });
    
    if (manifest.items.length === 0) {
      console.log('\n⚠️  No media items found. Make sure you have:');
      console.log('   - Folders named with numbers (01, 02, etc.) in /public/media/');
      console.log('   - Media files (.jpg, .mp4, etc.) inside those folders');
    }
    
  } catch (error) {
    console.error('\n❌ Failed to generate manifest:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.error('🔑 Authentication failed. Check your HIDRIVE_PASSWORD.');
      } else if (error.message.includes('404')) {
        console.error('📁 Directory not found. Make sure /public/media/ exists in your HiDrive.');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        console.error('🌐 Network error. Check your internet connection.');
      }
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}