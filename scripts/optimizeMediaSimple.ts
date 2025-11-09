import path from "path";
import fs from "fs/promises";

const MB = 1024 * 1024;
const DEFAULT_MAX_MB = Number(process.env.MEDIA_MAX_MB ?? 50);

interface MediaFile {
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
}

function formatSize(bytes: number): string {
  return `${(bytes / MB).toFixed(2)} MB`;
}

async function walk(dir: string, base: string, found: MediaFile[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      await walk(fullPath, base, found);
      continue;
    }

    const stat = await fs.stat(fullPath);
    found.push({ relativePath, fullPath, sizeBytes: stat.size });
  }
}

async function main() {
  const mediaRoot = path.resolve(process.cwd(), "public", "media", "hidrive");
  const maxMB = DEFAULT_MAX_MB;
  const maxBytes = maxMB * MB;

  console.log(`Scanning for media files > ${maxMB} MB...`);
  
  const files: MediaFile[] = [];
  await walk(mediaRoot, mediaRoot, files);

  const oversized = files.filter((f) => f.sizeBytes > maxBytes);
  if (!oversized.length) {
    console.log("No files need optimization.");
    return;
  }

  console.log(`Found ${oversized.length} files to optimize:`);
  
  const videos: MediaFile[] = [];
  const images: MediaFile[] = [];
  const others: MediaFile[] = [];

  for (const file of oversized) {
    const ext = path.extname(file.fullPath).toLowerCase();
    if ([".mp4", ".mov", ".webm", ".avi"].includes(ext)) {
      videos.push(file);
    } else if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) {
      images.push(file);
    } else {
      others.push(file);
    }
  }

  if (videos.length) {
    console.log("\n🎥 VIDEOS (need manual compression with ffmpeg):");
    for (const video of videos) {
      const targetBitrate = Math.floor((maxMB * 8 * 1024) / 60); // rough estimate
      console.log(`  ${video.relativePath} — ${formatSize(video.sizeBytes)}`);
      console.log(`    ffmpeg -i "${video.fullPath}" -c:v libx264 -preset slow -crf 24 -maxrate ${targetBitrate}k -bufsize ${targetBitrate * 2}k -c:a aac -b:a 128k -y "${video.fullPath}.tmp.mp4"`);
      console.log(`    Then rename .tmp.mp4 to original`);
    }
  }

  if (images.length) {
    console.log("\n🖼️  IMAGES (can be compressed with ImageMagick or online tools):");
    for (const image of images) {
      console.log(`  ${image.relativePath} — ${formatSize(image.sizeBytes)}`);
      console.log(`    magick "${image.fullPath}" -quality 85 -strip "${image.fullPath}.tmp.jpg"`);
      console.log(`    Then rename .tmp.jpg to original`);
    }
  }

  if (others.length) {
    console.log("\n❓ OTHER FILES:");
    for (const file of others) {
      console.log(`  ${file.relativePath} — ${formatSize(file.sizeBytes)}`);
    }
  }

  console.log(`\n📝 After compressing files, run: npm run build:manifest`);
  console.log(`💡 Tip: For deployment, consider hosting large videos on a CDN (YouTube, Vimeo) or using Git LFS`);
}

main().catch((error) => {
  console.error("Scan failed", error);
  process.exitCode = 1;
});
