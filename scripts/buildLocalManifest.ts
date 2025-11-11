#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

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
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'local';
}

/**
 * Parse MANIFEST.txt file with YAML front-matter
 */
function parseManifest(content: string): { title?: string; description?: string; tags?: string[] } {
  const meta: { title?: string; description?: string; tags?: string[] } = {};
  
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
 * Find preview file in a folder (prioritize _short, then preview.*, then first video/image)
 */
function findPreviewFile(folderPath: string, files: string[]): { file: string; type: MediaType } | null {
  // Priority 1: _short files
  const shortFile = files.find(f => f.includes('_short'));
  if (shortFile) {
    const isVideo = /\.(mp4|webm|mov)$/i.test(shortFile);
    return { file: shortFile, type: isVideo ? 'video' : 'image' };
  }
  
  // Priority 2: preview.* files
  const previewFile = files.find(f => f.toLowerCase().startsWith('preview.'));
  if (previewFile) {
    const isVideo = /\.(mp4|webm|mov)$/i.test(previewFile);
    return { file: previewFile, type: isVideo ? 'video' : 'image' };
  }
  
  // Priority 3: First video file
  const videoFile = files.find(f => /\.(mp4|webm|mov)$/i.test(f));
  if (videoFile) {
    return { file: videoFile, type: 'video' };
  }
  
  // Priority 4: First image file
  const imageFile = files.find(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  if (imageFile) {
    return { file: imageFile, type: 'image' };
  }
  
  return null;
}

/**
 * Find full resolution file (prioritize _long, then first video/image)
 */
function findFullFile(folderPath: string, files: string[]): { file: string; type: MediaType } | null {
  // Priority 1: _long files
  const longFile = files.find(f => f.includes('_long'));
  if (longFile) {
    const isVideo = /\.(mp4|webm|mov)$/i.test(longFile);
    return { file: longFile, type: isVideo ? 'video' : 'image' };
  }
  
  // Priority 2: First video file (excluding _short)
  const videoFile = files.find(f => /\.(mp4|webm|mov)$/i.test(f) && !f.includes('_short'));
  if (videoFile) {
    return { file: videoFile, type: 'video' };
  }
  
  // Priority 3: First image file (excluding preview)
  const imageFile = files.find(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f) && !f.toLowerCase().startsWith('preview.'));
  if (imageFile) {
    return { file: imageFile, type: 'image' };
  }
  
  return null;
}

/**
 * Find thumbnail/poster image
 */
function findThumbnail(files: string[]): string | undefined {
  const thumbnail = files.find(f => 
    f.toLowerCase().includes('poster') || 
    f.toLowerCase().includes('thumb') ||
    /\.(jpg|jpeg|png)$/i.test(f)
  );
  return thumbnail;
}

/**
 * Build manifest from local files
 */
async function buildManifest(): Promise<MediaManifest> {
  const mediaDir = path.join(process.cwd(), 'public', 'media', 'hidrive');
  console.log(`📂 Scanning ${mediaDir}...`);
  
  if (!fs.existsSync(mediaDir)) {
    console.error(`❌ Media directory not found: ${mediaDir}`);
    process.exit(1);
  }
  
  const folders = fs.readdirSync(mediaDir)
    .filter(name => {
      const fullPath = path.join(mediaDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));
  
  console.log(`📁 Found ${folders.length} folders`);
  
  const items: MediaItem[] = [];
  
  for (const folder of folders) {
    const folderPath = path.join(mediaDir, folder);
    const files = fs.readdirSync(folderPath);
    
    // Find preview and full files
    const preview = findPreviewFile(folderPath, files);
    const full = findFullFile(folderPath, files);
    
    if (!preview || !full) {
      console.log(`⚠️  Skipping folder ${folder}: no media files found`);
      continue;
    }
    
    // Read MANIFEST.txt if it exists
    const manifestPath = path.join(folderPath, 'MANIFEST.txt');
    let meta: { title?: string; description?: string; tags?: string[] } = {};
    let title = `Portfolio ${folder}`;
    
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        meta = parseManifest(content);
        if (meta.title) {
          title = meta.title;
        }
        console.log(`✅ Folder ${folder}: ${title}`);
      } catch (error) {
        console.error(`❌ Error reading manifest for folder ${folder}:`, error);
      }
    } else {
      console.log(`📝 Folder ${folder}: ${title} (no MANIFEST.txt)`);
    }
    
    // Find thumbnail
    const thumbnail = findThumbnail(files);
    
    // Collect all images for gallery folders (multiple images)
    const allImages = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f) && !f.toLowerCase().startsWith('preview.') && f !== 'MANIFEST.txt')
      .map(f => `/media/hidrive/${folder}/${f}`)
      .sort();
    
    const item: MediaItem = {
      orderKey: folder,
      folder,
      title,
      previewUrl: `/media/hidrive/${folder}/${preview.file}`,
      previewType: preview.type,
      fullUrl: `/media/hidrive/${folder}/${full.file}`,
      fullType: full.type,
      thumbnailUrl: thumbnail ? `/media/hidrive/${folder}/${thumbnail}` : undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      ...(allImages.length > 1 && { allImages }), // Add allImages if multiple images exist
    };
    
    items.push(item);
  }
  
  const manifest: MediaManifest = {
    items,
    generatedAt: new Date().toISOString(),
    source: 'local',
  };
  
  return manifest;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Building media manifest from local files...\n');
    
    const manifest = await buildManifest();
    
    const outputPath = path.join(process.cwd(), 'public', 'media.manifest.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n✅ Manifest saved to: ${outputPath}`);
    console.log(`📊 Total items: ${manifest.items.length}`);
    
    // Show summary
    const withMeta = manifest.items.filter(item => item.meta && item.meta.title).length;
    console.log(`📝 Items with metadata: ${withMeta}/${manifest.items.length}`);
    
  } catch (error) {
    console.error('❌ Error building manifest:', error);
    process.exit(1);
  }
}

main();
