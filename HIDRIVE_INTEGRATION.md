# HiDrive Media Integration

## Overview

This project automatically discovers and displays media files from IONOS HiDrive storage. Media files are organized in numbered folders (`/public/media/01/`, `/public/media/02/`, etc.) and automatically discovered using the HiDrive WebDAV API.

## Setup Instructions

### 1. HiDrive Configuration

1. **Login to your IONOS HiDrive account**
2. **Create folder structure:**
   ```
   /public/media/
   ├── 01/
   │   ├── _preview.jpg          # Priority 1: Exact preview file
   │   ├── 01_short.mp4         # Priority 2: Short/preview video 
   │   └── 01_full.mp4          # Full content video
   ├── 02/
   │   ├── 02_preview.jpg       # Priority 3: Contains "_preview"
   │   └── 02_video.mp4         # Full content
   └── 03/
       └── image.jpg            # Single file serves as both preview and full
   ```

3. **File Naming Rules:**
   - **Preview Priority:** `_preview.*` > `*_short*` > `*_preview*` > first image > first video
   - **Full Priority:** Non-preview video starting with folder number > first video > first image > fallback to preview

### 2. Environment Setup

1. **Set your HiDrive credentials:**
   ```bash
   export HIDRIVE_PASSWORD="your-password-here"
   # Username is hardcoded as 'juliecamus' in the script
   ```

2. **Install build dependencies:**
   ```bash
   npm install tsx --save-dev
   ```

### 3. Build Scripts

Run the media manifest generation:

```bash
# Generate media manifest from HiDrive
cd scripts
npm install
HIDRIVE_PASSWORD='your-password' npm run build-media

# Or run directly with tsx
HIDRIVE_PASSWORD='your-password' npx tsx scripts/buildMediaManifest.ts
```

The script will:
1. Connect to HiDrive via WebDAV API
2. Scan `/public/media/` for numbered folders
3. Apply selection logic for preview/full files
4. Generate `public/media.manifest.json`

### 4. Development Workflow

**Local Development:**
```bash
# Generate manifest and start dev server
HIDRIVE_PASSWORD='your-password' npm run dev
```

**Production Build:**
```bash
# Generate manifest and build
HIDRIVE_PASSWORD='your-password' npm run build
```

## File Selection Logic

### Preview File Selection (for grid tiles):
1. **Priority 1:** File named exactly `_preview.*` (any extension)
2. **Priority 2:** File containing `_short` in the name
3. **Priority 3:** File containing `_preview` in the name  
4. **Priority 4:** First image file found
5. **Priority 5:** First video file found

### Full File Selection (for lightbox):
1. **Priority 1:** Video file not marked as preview/short, starting with folder number (e.g., `01_full.mp4`)
2. **Priority 2:** First video file not marked as preview/short
3. **Priority 3:** First image file not marked as preview/short
4. **Fallback:** If only one file exists, use it for both preview and full

## Manifest Format

The generated `public/media.manifest.json` contains:

```typescript
interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive';
}

interface MediaItem {
  orderKey: string;      // "01", "02", etc.
  folder: string;        // "01", "02", etc. 
  title: string;         // "Media 01", "Media 02", etc.
  previewUrl: string;    // HiDrive public URL for grid tile
  previewType: 'image' | 'video';
  fullUrl: string;       // HiDrive public URL for lightbox
  fullType: 'image' | 'video';
}
```

## Frontend Integration

The frontend automatically:
1. **Loads manifest:** `useMediaIndex()` hook fetches `/media.manifest.json` 
2. **First tile:** Media from folder `01` always appears as the first tile
3. **Grid integration:** Media tiles are interspersed with project tiles
4. **Lightbox:** Clicking media tiles opens full content in lightbox
5. **Fallback:** If manifest fails to load, falls back to demo content

## Supported Media Formats

**Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`
**Videos:** `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`

## Troubleshooting

### Common Issues:

1. **"Failed to load media manifest"**
   - Check that `public/media.manifest.json` exists
   - Run the build script to generate it

2. **"HiDrive API error: 401"**
   - Verify HIDRIVE_PASSWORD environment variable
   - Check HiDrive credentials and permissions

3. **"No media files found"**
   - Ensure files are in `/public/media/01/`, `/public/media/02/`, etc.
   - Check file extensions are supported
   - Verify folder names are numeric (01, 02, 03...)

4. **CORS errors loading media**
   - Ensure HiDrive files are publicly accessible
   - Check HiDrive sharing settings for the `/public/` folder

### Debug Mode:

Enable detailed logging by running the script with debug output:

```bash
DEBUG=1 HIDRIVE_PASSWORD='your-password' npx tsx scripts/buildMediaManifest.ts
```

## Architecture Notes

- **Build-time generation:** Manifest is created during build, not runtime
- **No frontend secrets:** HiDrive credentials only used during build/CI
- **Fallback support:** Graceful degradation if HiDrive is unavailable
- **Performance:** Static manifest avoids API calls on each page load
- **Security:** Public manifest contains only public URLs, no credentials

## Next Steps

1. **CI/CD Integration:** Add manifest generation to your build pipeline
2. **Cache Invalidation:** Rebuild when media files change
3. **CDN:** Consider using IONOS Object Storage + CDN for better performance
4. **Optimization:** Add image/video optimization pipeline