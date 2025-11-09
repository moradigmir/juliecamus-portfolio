#!/usr/bin/env tsx

/**
 * Synchronise HiDrive media folders into the local repo for offline hosting.
 *
 * Usage:
 *   HIDRIVE_USERNAME="juliecamus" HIDRIVE_PASSWORD="..." tsx scripts/syncHidriveToLocal.ts [--force]
 *   # or
 *   npm run sync:hidrive
 *
 * Environment variables:
 *   HIDRIVE_USERNAME  (required) – HiDrive WebDAV username
 *   HIDRIVE_PASSWORD  (required) – HiDrive WebDAV password
 *   HIDRIVE_ROOT_PATH (optional) – Remote root path to mirror (default: /public)
 *   HIDRIVE_OUTPUT_DIR (optional) – Relative path under project root (default: public/media/hidrive)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface HiDriveEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
  size?: number;
}

const HIDRIVE_BASE_URL = 'https://webdav.hidrive.strato.com';

class HiDriveClient {
  constructor(private username: string, private password: string) {}

  private buildAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
  }

  private normalisePath(p: string): string {
    if (!p.startsWith('/')) {
      return '/' + p;
    }
    return p;
  }

  private ensureTrailingSlash(p: string): string {
    return p.endsWith('/') ? p : `${p}/`;
  }

  async listDirectory(remotePath: string): Promise<HiDriveEntry[]> {
    const normalised = this.ensureTrailingSlash(this.normalisePath(remotePath));
    const url = `${HIDRIVE_BASE_URL}${normalised}`;

    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: this.buildAuthHeader(),
        Depth: '1',
        'Content-Type': 'application/xml',
        'User-Agent': 'LocalHiDriveSync/1.0',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:resourcetype/>
    <D:href/>
  </D:prop>
</D:propfind>`
    });

    if (!response.ok) {
      throw new Error(`HiDrive PROPFIND failed (${response.status} ${response.statusText}) for ${remotePath}`);
    }

    const xml = await response.text();
    return this.parseWebDavResponse(xml, normalised);
  }

  private parseWebDavResponse(xml: string, basePath: string): HiDriveEntry[] {
    const entries: HiDriveEntry[] = [];
    const responsePattern = /<d:response[\s\S]*?<\/d:response>/gi;
    const hrefPattern = /<d:href[^>]*>(.*?)<\/d:href>/i;
    const displayNamePattern = /<d:displayname[^>]*>(.*?)<\/d:displayname>/i;
    const sizePattern = /<d:getcontentlength[^>]*>(\d+)<\/d:getcontentlength>/i;

    let match: RegExpExecArray | null;
    while ((match = responsePattern.exec(xml)) !== null) {
      const fragment = match[0];
      const hrefMatch = fragment.match(hrefPattern);
      if (!hrefMatch) continue;

      let href = decodeURIComponent(hrefMatch[1]);
      try {
        href = new URL(href, HIDRIVE_BASE_URL).pathname;
      } catch {
        // keep href as-is
      }

      const normalisedHref = href.endsWith('/') ? href : `${href}`;
      const cleanedHref = normalisedHref.replace(/\r|\n/g, '');

      // Skip the directory itself
      const baseNoSlash = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const candidateNoSlash = cleanedHref.endsWith('/') ? cleanedHref.slice(0, -1) : cleanedHref;
      if (candidateNoSlash === baseNoSlash) {
        continue;
      }

      const nameMatch = fragment.match(displayNamePattern);
      const name = nameMatch ? nameMatch[1].trim() : path.basename(candidateNoSlash);
      const isDirectory = /<d:collection\b/i.test(fragment);
      const sizeMatch = fragment.match(sizePattern);

      entries.push({
        name,
        type: isDirectory ? 'dir' : 'file',
        path: isDirectory ? this.ensureTrailingSlash(candidateNoSlash) : candidateNoSlash,
        size: sizeMatch ? Number(sizeMatch[1]) : undefined,
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async downloadFile(remotePath: string, destination: string): Promise<void> {
    const normalised = this.normalisePath(remotePath);
    const url = `${HIDRIVE_BASE_URL}${normalised}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: this.buildAuthHeader(),
        Accept: '*/*',
        'User-Agent': 'LocalHiDriveSync/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${remotePath} (${response.status} ${response.statusText})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, Buffer.from(arrayBuffer));
  }
}

interface SyncOptions {
  rootPath: string;
  outputDir: string;
  force: boolean;
}

async function syncHiDrive(client: HiDriveClient, options: SyncOptions) {
  const rootRemotePath = options.rootPath.endsWith('/') ? options.rootPath : `${options.rootPath}/`;
  const outputRoot = path.resolve(process.cwd(), '..', options.outputDir);

  await fs.promises.mkdir(outputRoot, { recursive: true });

  const visited = new Set<string>();
  let filesDownloaded = 0;
  let filesSkipped = 0;

  async function walk(remotePath: string) {
    const entries = await client.listDirectory(remotePath);
    for (const entry of entries) {
      if (visited.has(entry.path)) continue;
      visited.add(entry.path);

      const relativePath = entry.path.startsWith(rootRemotePath)
        ? entry.path.slice(rootRemotePath.length).replace(/^\/+/, '')
        : entry.path.replace(/^\/+/, '');
      const destination = path.join(outputRoot, relativePath);

      if (entry.type === 'dir') {
        await fs.promises.mkdir(destination, { recursive: true });
        await walk(entry.path);
      } else {
        const fileExists = fs.existsSync(destination);
        const fileSize = fileExists ? fs.statSync(destination).size : 0;
        const shouldDownload = options.force || !fileExists || (entry.size && entry.size !== fileSize);

        if (!shouldDownload) {
          filesSkipped += 1;
          continue;
        }

        process.stdout.write(`⬇️  Downloading ${entry.path} -> ${path.relative(path.resolve(process.cwd(), '..'), destination)}\n`);
        await client.downloadFile(entry.path, destination);
        filesDownloaded += 1;
      }
    }
  }

  await walk(rootRemotePath);

  return { filesDownloaded, filesSkipped, outputRoot };
}

async function main() {
  const username = process.env.HIDRIVE_USERNAME;
  const password = process.env.HIDRIVE_PASSWORD;

  if (!username || !password) {
    console.error('❌ HIDRIVE_USERNAME and HIDRIVE_PASSWORD must be set in the environment.');
    process.exit(1);
  }

  const rootPath = process.env.HIDRIVE_ROOT_PATH || '/public';
  const outputDir = process.env.HIDRIVE_OUTPUT_DIR || path.join('public', 'media', 'hidrive');
  const force = process.argv.includes('--force');

  console.log('🔄 Sync HiDrive media to local repository');
  console.log(`   Remote root : ${rootPath}`);
  console.log(`   Output dir  : ${outputDir}`);
  console.log(`   Mode        : ${force ? 'force download' : 'skip existing files (matching size)'}`);

  const client = new HiDriveClient(username, password);

  try {
    const { filesDownloaded, filesSkipped, outputRoot } = await syncHiDrive(client, {
      rootPath,
      outputDir,
      force,
    });

    console.log('\n✅ Sync complete');
    console.log(`   Downloaded : ${filesDownloaded}`);
    console.log(`   Skipped    : ${filesSkipped}`);
    console.log(`   Local root : ${outputRoot}`);
  } catch (error) {
    console.error('\n❌ Sync failed');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error('   An unknown error occurred.');
    }
    process.exit(1);
  }
}

const isDirectExecution = (() => {
  if (typeof process === 'undefined' || !process.argv?.length) return true;
  const scriptPath = process.argv[1];
  if (!scriptPath) return true;
  try {
    const resolvedArg = path.resolve(scriptPath);
    const modulePath = path.resolve(fileURLToPath(import.meta.url));
    return resolvedArg === modulePath;
  } catch {
    return true;
  }
})();

if (isDirectExecution) {
  void main();
}
