import fs from "fs/promises";
import path from "path";

// This script helps migrate media to external CDN
// Options: YouTube, Vimeo, Cloudflare R2, AWS S3, or GitHub raw files

interface MediaFile {
  relativePath: string;
  fullPath: string;
  sizeMB: number;
}

async function analyzeMedia() {
  const mediaRoot = path.resolve(process.cwd(), "public", "media", "hidrive");
  const files: MediaFile[] = [];
  
  async function walk(dir: string, base: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");
      
      if (entry.isDirectory()) {
        await walk(fullPath, base);
      } else {
        const stats = await fs.stat(fullPath);
        files.push({
          relativePath,
          fullPath,
          sizeMB: stats.size / 1024 / 1024
        });
      }
    }
  }
  
  await walk(mediaRoot, mediaRoot);
  
  // Sort by size
  files.sort((a, b) => b.sizeMB - a.sizeMB);
  
  console.log("Media Analysis for CDN Migration:\n");
  console.log(`Total files: ${files.length}`);
  console.log(`Total size: ${files.reduce((sum, f) => sum + f.sizeMB, 0).toFixed(2)} MB\n`);
  
  console.log("Top 20 largest files:");
  files.slice(0, 20).forEach((file, i) => {
    console.log(`${i + 1}. ${file.relativePath} — ${file.sizeMB.toFixed(2)} MB`);
  });
  
  console.log("\nMigration Options:");
  console.log("1. YouTube/Vimeo: For videos >10MB");
  console.log("2. Cloudflare R2: For all files (paid but cheap)");
  console.log("3. GitHub raw: For small files <25MB");
  console.log("4. GitHub LFS: For version control (paid)");
  
  console.log("\nRecommended approach:");
  console.log("- Move videos >10MB to YouTube (unlisted)");
  console.log("- Keep images <5MB in project");
  console.log("- Use Cloudflare R2 for remaining files");
  
  return files;
}

async function generateManifest(files: MediaFile[]) {
  const manifest = {
    version: Date.now(),
    cdn: {
      videos: "https://youtube.com/embed/", // To be filled
      images: "https://cdn.example.com/",   // To be filled
      fallback: "/media/hidrive/"
    },
    files: files.map(f => ({
      path: f.relativePath,
      size: f.sizeMB,
      strategy: f.sizeMB > 10 ? "cdn" : f.sizeMB > 5 ? "cdn" : "local"
    }))
  };
  
  await fs.writeFile(
    path.resolve(process.cwd(), "public", "media-cdn.json"),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log("\n✓ Generated media-cdn.json");
}

async function main() {
  const files = await analyzeMedia();
  await generateManifest(files);
  
  console.log("\nNext steps:");
  console.log("1. Choose CDN provider");
  console.log("2. Upload large files");
  console.log("3. Update media references in code");
  console.log("4. Test with CDN URLs");
  console.log("5. Remove local files from build");
}

main().catch(console.error);
