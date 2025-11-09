import fs from 'fs';
import path from 'path';

interface MediaItem {
  orderKey: string;
  folder: string;
  title: string;
  previewUrl: string;
  previewType: 'image' | 'video';
  fullUrl: string;
  fullType: 'image' | 'video';
  thumbnailUrl?: string;
}

interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'local';
}

function getMediaType(filename: string): 'image' | 'video' {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  const ext = path.extname(filename).toLowerCase();
  return videoExtensions.includes(ext) ? 'video' : 'image';
}

function selectPreviewFile(files: string[], folderPath: string): string | null {
  // Check if folder has videos - if yes, prefer video previews
  const hasVideo = files.some(f => getMediaType(f) === 'video');
  
  if (hasVideo) {
    // For video folders, prioritize video previews
    // Priority 1: contains _short
    let candidate = files.find(f => f.toLowerCase().includes('_short'));
    if (candidate) return candidate;
    
    // Priority 2: first video
    candidate = files.find(f => getMediaType(f) === 'video');
    if (candidate) return candidate;
  }
  
  // For image folders or fallback
  // Priority 3: preview.* (without underscore) - but check if it's not corrupted
  let candidate = files.find(f => /^preview\./i.test(f));
  if (candidate) {
    const fullPath = path.join(folderPath, candidate);
    const stats = fs.statSync(fullPath);
    // Skip if file is suspiciously small (< 1KB = likely corrupted)
    if (stats.size < 1024) {
      console.log(`  ⚠️  Skipping corrupted preview file: ${candidate} (${stats.size} bytes)`);
      candidate = null;
    } else {
      return candidate;
    }
  }
  
  // Priority 4: _preview.* (with underscore)
  let candidate2 = files.find(f => f.match(/^_preview\./i));
  if (candidate2) return candidate2;
  
  // Priority 5: contains _preview
  candidate = files.find(f => f.toLowerCase().includes('_preview'));
  if (candidate) return candidate;
  
  // Priority 6: first image
  candidate = files.find(f => getMediaType(f) === 'image');
  if (candidate) return candidate;
  
  // Priority 7: first video (fallback)
  candidate = files.find(f => getMediaType(f) === 'video');
  if (candidate) return candidate;
  
  return null;
}

function selectFullFile(files: string[], folderNumber: string): string | null {
  const nonPreviewFiles = files.filter(f => 
    !f.toLowerCase().includes('_short') && 
    !f.toLowerCase().includes('_preview') &&
    !f.toLowerCase().startsWith('_preview.') &&
    !f.toLowerCase().startsWith('preview.')
  );
  
  if (nonPreviewFiles.length === 0) return null;
  
  // Priority 1: video starting with folder number
  let candidate = nonPreviewFiles.find(f => 
    getMediaType(f) === 'video' && 
    f.toLowerCase().startsWith(folderNumber.toLowerCase())
  );
  if (candidate) return candidate;
  
  // Priority 2: first video
  candidate = nonPreviewFiles.find(f => getMediaType(f) === 'video');
  if (candidate) return candidate;
  
  // Priority 3: first image
  candidate = nonPreviewFiles.find(f => getMediaType(f) === 'image');
  if (candidate) return candidate;
  
  return null;
}

function readManifestTitle(folderPath: string): string | null {
  const manifestPath = path.join(folderPath, 'MANIFEST.txt');
  if (!fs.existsSync(manifestPath)) return null;
  
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('title:')) {
        const title = trimmed.slice(6).trim().replace(/^["']|["']$/g, '');
        return title || null;
      }
    }
  } catch (error) {
    console.warn(`  ⚠️  Could not read MANIFEST.txt in ${folderPath}`);
  }
  
  return null;
}

async function generateManifest(): Promise<MediaManifest> {
  console.log('🚀 Generating simple local manifest...');
  
  const publicDir = path.join(process.cwd(), 'public');
  const mediaDir = path.join(publicDir, 'media', 'hidrive');
  
  if (!fs.existsSync(mediaDir)) {
    throw new Error(`Media directory not found: ${mediaDir}`);
  }
  
  const folders = fs.readdirSync(mediaDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => /^\d+$/.test(dirent.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  
  console.log(`📁 Found ${folders.length} numbered folders`);
  
  const items: MediaItem[] = [];
  
  for (const folder of folders) {
    const folderPath = path.join(mediaDir, folder.name);
    const files = fs.readdirSync(folderPath)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mov', '.avi', '.mkv'];
        return mediaExtensions.includes(ext);
      });
    
    if (files.length === 0) {
      console.warn(`  ⚠️  No media files in folder ${folder.name}`);
      continue;
    }
    
    const previewFile = selectPreviewFile(files, folderPath);
    const fullFile = selectFullFile(files, folder.name);
    
    if (!previewFile) {
      console.warn(`  ⚠️  No suitable preview file for folder ${folder.name}`);
      continue;
    }
    
    const previewUrl = `/media/hidrive/${folder.name}/${previewFile}`;
    const fullUrl = `/media/hidrive/${folder.name}/${fullFile || previewFile}`;
    
    // Read title from MANIFEST.txt if available
    const manifestTitle = readManifestTitle(folderPath);
    const title = manifestTitle || `Portfolio ${folder.name}`;
    
    console.log(`  ✅ ${folder.name}: ${previewFile} -> ${previewUrl} (${title})`);
    
    items.push({
      orderKey: folder.name,
      folder: folder.name,
      title,
      previewUrl,
      previewType: getMediaType(previewFile),
      fullUrl,
      fullType: getMediaType(fullFile || previewFile)
    });
  }
  
  console.log(`\n🎉 Generated manifest with ${items.length} items`);
  
  return {
    items,
    generatedAt: new Date().toISOString(),
    source: 'local'
  };
}

// Generate and save manifest
generateManifest()
  .then(manifest => {
    const outputPath = path.join(process.cwd(), 'public', 'media.manifest.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest saved to: ${outputPath}`);
  })
  .catch(error => {
    console.error('❌ Failed to generate manifest:', error);
    process.exit(1);
  });
