import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { promisify } from "util";

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

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => (stdout += data));
    child.stderr?.on("data", (data) => (stderr += data));

    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Command failed: ${cmd} ${args.join(" ")}\n${stderr}`));
    });

    child.on("error", reject);
  });
}

async function compressVideo(inputPath: string, outputPath: string, targetMB: number) {
  const targetBitrate = Math.floor((targetMB * 8 * 1024) / 60); // rough estimate for 1min video
  const args = [
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "24",
    "-maxrate", `${targetBitrate}k`,
    "-bufsize", `${targetBitrate * 2}k`,
    "-c:a", "aac",
    "-b:a", "128k",
    "-y",
    outputPath,
  ];
  await runCommand("ffmpeg", args);
}

async function compressImage(inputPath: string, outputPath: string, targetMB: number) {
  const quality = Math.max(75, Math.floor(100 - (targetMB / 100) * 25));
  const args = [
    inputPath,
    "-quality", quality.toString(),
    "-strip",
    outputPath,
  ];
  await runCommand("magick", args);
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
  for (const file of oversized) {
    console.log(`• ${file.relativePath} — ${formatSize(file.sizeBytes)}`);
  }

  console.log("\nStarting optimization...");
  let optimized = 0;
  let errors = 0;

  for (const file of oversized) {
    const ext = path.extname(file.fullPath).toLowerCase();
    const isVideo = [".mp4", ".mov", ".webm", ".avi"].includes(ext);
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext);

    if (!isVideo && !isImage) {
      console.log(`Skipping unsupported file: ${file.relativePath}`);
      continue;
    }

    const tempPath = `${file.fullPath}.tmp${ext}`;
    try {
      console.log(`Optimizing ${file.relativePath}...`);
      
      if (isVideo) {
        await compressVideo(file.fullPath, tempPath, maxMB);
      } else {
        await compressImage(file.fullPath, tempPath, maxMB);
      }

      // Verify the result is smaller
      const newStat = await fs.stat(tempPath);
      if (newStat.size < file.sizeBytes) {
        await fs.rename(tempPath, file.fullPath);
        console.log(`✓ Reduced from ${formatSize(file.sizeBytes)} to ${formatSize(newStat.size)}`);
        optimized++;
      } else {
        await fs.unlink(tempPath);
        console.log(`⚠ Could not reduce size further`);
      }
    } catch (error) {
      console.error(`✗ Failed to optimize ${file.relativePath}:`, error);
      try {
        await fs.unlink(tempPath);
      } catch {}
      errors++;
    }
  }

  console.log(`\nOptimization complete: ${optimized} optimized, ${errors} errors`);
  
  if (optimized > 0) {
    console.log("\nRebuilding media manifest...");
    await runCommand("npx", ["tsx", "scripts/buildMediaManifest.ts"]);
    console.log("✓ Manifest updated");
  }
}

main().catch((error) => {
  console.error("Optimization failed", error);
  process.exitCode = 1;
});
