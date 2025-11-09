#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  meta?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
  files?: ManifestFile[];
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive' | 'local';
}

interface HiDriveFile {
  name: string;
  type: 'file' | 'dir';
  path: string;
  size?: number;
  href?: string;
  modified?: string;
}

interface ManifestFile {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  contentType?: string;
}

class LocalMediaSource {
  private mediaRoot: string;

  constructor(mediaRoot: string) {
    this.mediaRoot = path.resolve(mediaRoot);
  }

  private normaliseRemotePath(p: string): string {
    if (!p) return '/';
    let out = p.replace(/\\/g, '/');
    if (!out.startsWith('/')) {
      out = '/' + out;
    }
    return out;
  }

  private relativeFromRemote(p: string): string {
    const normalised = this.normaliseRemotePath(p);
    const withoutLeading = normalised.replace(/^\/+/, '');
    return withoutLeading;
  }

  private toLocalPath(p: string): string {
    const relative = this.relativeFromRemote(p);
    return path.join(this.mediaRoot, relative);
  }

  async listDirectory(dirPath: string): Promise<HiDriveFile[]> {
    const normalised = this.normaliseRemotePath(dirPath);
    const localDir = this.toLocalPath(normalised);

    if (!fs.existsSync(localDir)) {
      console.warn(`⚠️  Local directory does not exist: ${localDir}`);
      return [];
    }

    const dirEntries = await fs.promises.readdir(localDir, { withFileTypes: true });
    const files: HiDriveFile[] = [];

    for (const entry of dirEntries) {
      const remotePath = `${normalised.replace(/\/$/, '')}/${entry.name}`;
      const base: HiDriveFile = {
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : 'file',
        path: remotePath,
      };

      if (!entry.isDirectory()) {
        try {
          const stats = await fs.promises.stat(path.join(localDir, entry.name));
          base.size = stats.size;
          base.modified = stats.mtime.toISOString();
        } catch (err) {
          console.warn(`⚠️  Could not read size for ${remotePath}`, err);
        }
      } else {
        try {
          const stats = await fs.promises.stat(path.join(localDir, entry.name));
          base.modified = stats.mtime.toISOString();
        } catch {}
      }

      files.push(base);
    }

    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  getPublicUrl(filePath: string): string {
    const relative = this.relativeFromRemote(filePath).split(path.sep).join('/');
    return `/media/hidrive/${relative}`;
  }

  async fetchManifestMarkdown(folderPath: string): Promise<{ content: string; matchedFilename: string } | null> {
    const manifestVariants = ['MANIFEST.md', 'Manifest.md', 'manifest.md', 'MANIFEST.txt', 'Manifest.txt', 'manifest.txt'];
    const localDir = this.toLocalPath(folderPath);

    for (const variant of manifestVariants) {
      const candidatePath = path.join(localDir, variant);
      if (fs.existsSync(candidatePath)) {
        try {
          const content = await fs.promises.readFile(candidatePath, 'utf-8');
          if (content.trim().length > 0) {
            console.log(`  📄 Found manifest: ${variant}`);
            return { content, matchedFilename: variant };
          }
        } catch (error) {
          console.warn(`  ⚠️  Failed to read manifest ${variant}:`, error);
        }
      }
    }

    return null;
  }

  parseManifestMarkdown(md: string): { title?: string; description?: string; tags?: string[] } {
    try {
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
                  result.tags = tagsStr.slice(1, -1).split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
                }
              }
            }
          }

          return result;
        }
      }

      const lines = md.split('\n').map(l => l.trim()).filter(l => l);
      const result: { title?: string; description?: string; tags?: string[] } = {};

      const h1Line = lines.find(line => line.startsWith('# '));
      if (h1Line) {
        result.title = h1Line.slice(2).trim();
      }

      const paragraph = lines.find(line => line && !line.startsWith('#') && line.length > 10);
      if (paragraph) {
        result.description = paragraph;
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to parse manifest markdown', error);
      return {};
    }
  }

  getAbsolutePath(filePath: string): string {
    return this.toLocalPath(filePath);
  }
}

class MediaManifestBuilder {
  private client: LocalMediaSource;
  private thumbnailsRoot: string;
  private publicDir: string;

  constructor(mediaRoot: string, publicDir: string, thumbnailsRoot: string) {
    this.client = new LocalMediaSource(mediaRoot);
    this.publicDir = path.resolve(publicDir);
    this.thumbnailsRoot = path.resolve(thumbnailsRoot);
  }

  private inferContentType(filename: string): string | undefined {
    const lower = filename.toLowerCase();
    const map: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.m4v': 'video/x-m4v',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
    };

    const ext = Object.keys(map).find((extension) => lower.endsWith(extension));
    return ext ? map[ext] : undefined;
  }

  async buildManifest(): Promise<MediaManifest> {
    console.log('🚀 Starting local media manifest generation...');
    
    try {
      // Scan root directory to find ALL numbered folders (01-50)
      const publicDir = '/';
      console.log(`📂 Scanning root for numbered folders`);
      
      const entries = await this.client.listDirectory(publicDir);
      
      // Filter for numbered directories (01, 02, ..., 50)
      const numberDirs = entries
        .filter(entry => entry.type === 'dir')
        .filter(entry => /^\d{2}$/.test(entry.name)) // Match exactly 2 digits: 01, 02, etc.
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      console.log(`📁 Found numbered directories: ${numberDirs.map(d => d.name).join(', ')}`);
      
      const items: MediaItem[] = [];
      let withMeta = 0;
      let withoutMeta = 0;
      
      for (const dir of numberDirs) {
        console.log(`\n🔍 Processing folder: ${dir.name}`);
        
        try {
          const folderPath = `${publicDir}/${dir.name}`;
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
          const previewAbsolutePath = this.client.getAbsolutePath(preview.path);

          // Generate thumbnail for videos
          let thumbnailUrl: string | undefined;
          if (this.getMediaType(preview.name) === 'video') {
            thumbnailUrl = await this.generateVideoThumbnail(previewAbsolutePath, dir.name);
          }

          // Fetch and parse MANIFEST.md for metadata
          const manifestResult = await this.client.fetchManifestMarkdown(folderPath);
          let meta: { title?: string; description?: string; tags?: string[] } | undefined;
          
          if (manifestResult) {
            meta = this.client.parseManifestMarkdown(manifestResult.content);
            console.log(`  📝 Manifest metadata: ${JSON.stringify(meta)}`);
            withMeta++;
          } else {
            console.log(`  📝 No MANIFEST.md found`);
            withoutMeta++;
          }
          
          console.log(`  ✅ Preview: ${preview.name} -> ${previewUrl}`);
          console.log(`  ✅ Full: ${(full || preview).name} -> ${fullUrl}`);
          if (thumbnailUrl) {
            console.log(`  🖼️  Thumbnail: ${thumbnailUrl}`);
          }

          const manifestFiles: ManifestFile[] = files.map((entry): ManifestFile => ({
            name: entry.name,
            type: entry.type === 'dir' ? 'directory' : 'file',
            size: entry.size,
            modified: entry.modified,
            contentType: entry.type === 'file' ? this.inferContentType(entry.name) : undefined,
          }));

          const item: MediaItem = {
            orderKey: dir.name,
            folder: dir.name,
            title: meta?.title || `Portfolio ${dir.name}`,
            previewUrl,
            previewType: this.getMediaType(preview.name),
            fullUrl,
            fullType: this.getMediaType((full || preview).name),
            thumbnailUrl,
            files: manifestFiles
          };
          
          // Only attach meta if it has content
          if (meta && (meta.title || meta.description || (meta.tags && meta.tags.length > 0))) {
            item.meta = meta;
          }
          
          items.push(item);
          
        } catch (error) {
          console.error(`❌ Error processing folder ${dir.name}:`, error);
        }
      }
      
      // Developer-facing build summary
      console.log("BUILD_MANIFEST_SUMMARY", { count: items.length, withMeta, withoutMeta });
      console.log(`\n🎉 Successfully processed ${items.length} media folders`);
      
      return {
        items,
        generatedAt: new Date().toISOString(),
        source: 'local'
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

  private async generateVideoThumbnail(sourcePath: string, folderName: string): Promise<string | undefined> {
    try {
      const folderThumbnailsDir = path.join(this.thumbnailsRoot, folderName);

      if (!fs.existsSync(folderThumbnailsDir)) {
        fs.mkdirSync(folderThumbnailsDir, { recursive: true });
      }
      
      const thumbnailPath = path.join(folderThumbnailsDir, `${folderName}_thumb.webp`);
      const relativeThumbnailPath = '/' + path.relative(this.publicDir, thumbnailPath).split(path.sep).join('/');
      
      // Check if thumbnail already exists
      if (fs.existsSync(thumbnailPath)) {
        console.log(`    ♻️  Using existing thumbnail: ${relativeThumbnailPath}`);
        return relativeThumbnailPath;
      }
      
      console.log(`    🎬 Generating thumbnail for video: ${sourcePath}`);
      
      // Use ffmpeg to extract first frame as WebP thumbnail (requires ffmpeg to be installed)
      try {
        execSync(`ffmpeg -i "${sourcePath}" -vf "scale=320:240:force_original_aspect_ratio=increase,crop=320:240" -frames:v 1 -f webp "${thumbnailPath}" -y`, {
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
  console.log('🎬 Local Media Manifest Builder\n');

  const projectRoot = path.resolve(__dirname, '..');
  const publicDir = path.join(projectRoot, 'public');
  const defaultMediaRoot = path.join(publicDir, 'media', 'hidrive');
  const mediaRoot = process.env.LOCAL_MEDIA_ROOT ? path.resolve(process.env.LOCAL_MEDIA_ROOT) : defaultMediaRoot;
  const thumbnailsRoot = path.join(publicDir, 'thumbnails');

  console.log(`📂 Media root : ${mediaRoot}`);
  console.log(`🖼️  Thumbnails: ${thumbnailsRoot}`);

  if (!fs.existsSync(mediaRoot)) {
    console.error('❌ Local media root not found. Run the HiDrive sync script first.');
    process.exit(1);
  }

  try {
    const builder = new MediaManifestBuilder(mediaRoot, publicDir, thumbnailsRoot);
    const manifest = await builder.buildManifest();

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const manifestPath = path.join(publicDir, 'media.manifest.json');
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
      console.log('\n⚠️  No media items found. Ensure the local mirror contains numbered folders with media.');
    }
  } catch (error) {
    console.error('\n❌ Failed to generate manifest:', error);
    process.exit(1);
  }
}

const isDirectExecution = (() => {
  if (typeof process === 'undefined' || !process.argv?.length) return true;
  const scriptPath = process.argv[1];
  if (!scriptPath) return true;
  try {
    const resolvedArg = path.resolve(scriptPath);
    const modulePath = path.resolve(__filename);
    return resolvedArg === modulePath;
  } catch {
    return true;
  }
})();

if (isDirectExecution) {
  void main();
}