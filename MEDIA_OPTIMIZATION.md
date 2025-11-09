# Media Optimization for Free Hosting

This guide helps optimize media files to stay under the 50MB limit for free hosting tiers (Vercel, Netlify, Cloudflare Pages).

## Quick Start

1. **Check large files:**
   ```bash
   npm run report:large-media
   ```

2. **Get optimization commands:**
   ```bash
   npm run optimize:media
   ```

3. **Run the generated ffmpeg/magick commands** (requires ffmpeg and ImageMagick installed)

4. **Rebuild manifest after optimization:**
   ```bash
   npm run build:manifest
   ```

## Manual Optimization Steps

### Videos (ffmpeg required)
For each video listed, run:
```bash
ffmpeg -i "path/to/video.mp4" -c:v libx264 -preset slow -crf 24 -maxrate 6826k -bufsize 13652k -c:a aac -b:a 128k -y "path/to/video.tmp.mp4"
# Then replace original with .tmp file
```

### Images (ImageMagick required)
```bash
magick "path/to/image.jpg" -quality 85 -strip "path/to/image.tmp.jpg"
# Then replace original with .tmp file
```

### Alternative: Online Tools
- **Videos:** Use [CloudConvert](https://cloudconvert.com/) or [Online Video Converter](https://www.onlinevideoconverter.com/)
- **Images:** Use [Squoosh](https://squoosh.app/) or [TinyPNG](https://tinypng.com/)

## Deployment Options After Optimization

1. **Vercel/Netlify/Cloudflare Pages** (if all files < 50MB)
2. **External CDN for large videos:**
   - Upload to YouTube/Vimeo and embed
   - Use Cloudflare R2 or AWS S3 + CDN
3. **Git LFS** (for private repos)

## Automated Workflow

Add to your `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run optimize:media && npm run build:manifest"
  }
}
```

This ensures media is checked before every deployment.
