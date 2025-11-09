import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

interface ImageFile {
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
}

const MB = 1024 * 1024;
const TARGET_MB = 45;
const TARGET_BYTES = TARGET_MB * MB;

function formatSize(bytes: number): string {
  return `${(bytes / MB).toFixed(2)} MB`;
}

async function compressImage(inputPath: string, outputPath: string, targetMB: number): Promise<boolean> {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Start with quality 85, adjust if still too large
    let quality = 85;
    let buffer: Buffer;
    
    do {
      buffer = await image
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
      
      quality -= 5;
    } while (buffer.length > TARGET_BYTES && quality > 50);
    
    await fs.writeFile(outputPath, buffer);
    
    const originalSize = (await fs.stat(inputPath)).size;
    const newSize = buffer.length;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    console.log(`✓ ${path.basename(inputPath)}: ${formatSize(originalSize)} → ${formatSize(newSize)} (${reduction}% reduction)`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to compress ${inputPath}:`, error);
    return false;
  }
}

async function main() {
  const mediaRoot = path.resolve(process.cwd(), "public", "media", "hidrive");
  const filesToCompress = [
    "58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg",
    "58/preview"
  ];
  
  console.log("Compressing large images...\n");
  
  for (const relativePath of filesToCompress) {
    const fullPath = path.join(mediaRoot, relativePath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      if (stats.size < TARGET_BYTES) {
        console.log(`✓ ${relativePath}: Already under target (${formatSize(stats.size)})`);
        continue;
      }
      
      const ext = path.extname(fullPath).toLowerCase();
      const outputPath = ext ? fullPath.replace(ext, `.tmp${ext}`) : `${fullPath}.tmp`;
      
      console.log(`Compressing ${relativePath}...`);
      
      if (ext === '.jpg' || ext === '.jpeg') {
        const success = await compressImage(fullPath, outputPath, TARGET_MB);
        
        if (success) {
          // Replace original
          await fs.unlink(fullPath);
          await fs.rename(outputPath, fullPath);
          console.log(`✓ Replaced original file\n`);
        } else {
          // Clean up temp file
          try {
            await fs.unlink(outputPath);
          } catch {}
        }
      } else {
        console.log(`⚠ Skipping unsupported file: ${relativePath} (ext: ${ext || 'none'})`);
        console.log(`   Try using ImageMagick or an online tool\n`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${relativePath}:`, error);
    }
  }
  
  console.log("Image compression complete!");
  console.log("Run: npm run report:large-media to verify");
  console.log("Then: npm run build:manifest to update paths");
}

main().catch((error) => {
  console.error("Compression failed", error);
  process.exitCode = 1;
});
