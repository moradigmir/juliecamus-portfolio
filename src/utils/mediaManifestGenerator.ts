// Media Manifest Generator - Simplified version for frontend
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
}

export interface MediaManifest {
  items: MediaItem[];
  generatedAt: string;
  source: 'hidrive';
}

export class MediaManifestGenerator {
  
  async generateManifest(): Promise<MediaManifest> {
    // This is a simplified version that explains the limitation
    throw new Error(`
Frontend manifest generation is not supported due to CORS restrictions.

To refresh your media manifest:
1. Add your new folders (like "02") to your HiDrive /public/ directory
2. Run the backend script: cd scripts && HIDRIVE_PASSWORD='your-password' npm run build-media
3. Reload this page to see the new folders

The "Failed to fetch" error occurs because browsers cannot make direct WebDAV requests to HiDrive.
Use the HiDrive Browser below to verify your folder structure.
    `.trim());
  }
}