import path from "path";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";

const DEFAULT_THRESHOLD_MB = Number(process.env.MEDIA_MAX_MB ?? 50);

interface MediaStat {
  relativePath: string;
  sizeBytes: number;
}

async function walk(dir: string, base: string, found: MediaStat[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");

    if (entry.isSymbolicLink()) {
      // Skip broken symlinks
      try {
        await fs.access(fullPath, fsConstants.F_OK);
      } catch {
        continue;
      }
    }

    if (entry.isDirectory()) {
      await walk(fullPath, base, found);
      continue;
    }

    const stat = await fs.stat(fullPath);
    found.push({ relativePath, sizeBytes: stat.size });
  }
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const mediaRoot = path.resolve(process.cwd(), "public", "media", "hidrive");
  const thresholdMb = DEFAULT_THRESHOLD_MB;
  const thresholdBytes = thresholdMb * 1024 * 1024;

  const files: MediaStat[] = [];
  await walk(mediaRoot, mediaRoot, files);

  const overThreshold = files
    .filter((item) => item.sizeBytes >= thresholdBytes)
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  if (!overThreshold.length) {
    console.log(`No media files >= ${thresholdMb} MB found.`);
    console.log("Top 10 largest files:");
    const top = files.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 10);
    for (const item of top) {
      console.log(`• ${item.relativePath} — ${formatSize(item.sizeBytes)}`);
    }
    return;
  }

  console.log(`Media files >= ${thresholdMb} MB (${overThreshold.length} total):`);
  for (const item of overThreshold) {
    console.log(`• ${item.relativePath} — ${formatSize(item.sizeBytes)}`);
  }
}

main().catch((error) => {
  console.error("Failed to scan media files", error);
  process.exitCode = 1;
});
