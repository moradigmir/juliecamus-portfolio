// Media Configuration
// Legacy Google Drive interface (for backward compatibility)
export interface LegacyMediaItem {
  id: string;
  title: string;
  folder: string;
  previewUrl: string;  // For grid tiles
  fullUrl: string;     // For lightbox
  type: 'video' | 'image';
  description?: string;
  year?: string;
  client?: string;
  category?: string;
}

// New auto-discovered media interface (from HiDrive manifest)
export type MediaType = 'image' | 'video';

export interface MediaItem {
  orderKey: string;      // "01"
  folder: string;        // "01"  
  title: string;         // default = folder name
  previewUrl: string;
  previewType: MediaType;
  fullUrl: string;
  fullType: MediaType;
  thumbnailUrl?: string; // WebP thumbnail for video previews
}

// Google Drive file configuration
// To get file IDs from Google Drive sharing URLs:
// https://drive.google.com/file/d/FILE_ID/view -> use FILE_ID
export const googleDriveFiles = {
  // Folder 01 - Replace these with actual file IDs from your Google Drive
  '01': {
    preview: {
      fileId: 'YOUR_PREVIEW_VIDEO_FILE_ID', // Replace with actual file ID
      type: 'video' as const
    },
    full: {
      fileId: 'YOUR_FULL_VIDEO_FILE_ID', // Replace with actual file ID  
      type: 'video' as const
    }
  }
  // Add more folders here as needed
};

// Convert Google Drive file ID to direct access URL
export const getGoogleDriveUrl = (fileId: string, type: 'video' | 'image' = 'video') => {
  if (type === 'video') {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

// Legacy media items configuration (for fallback/development)
export const legacyMediaItems: LegacyMediaItem[] = [
  {
    id: '01',
    title: 'Behind the Scenes',
    folder: '01',
    previewUrl: getGoogleDriveUrl(googleDriveFiles['01'].preview.fileId, 'video'),
    fullUrl: getGoogleDriveUrl(googleDriveFiles['01'].full.fileId, 'video'),
    type: 'video',
    description: 'Exclusive behind-the-scenes footage from recent editorial shoot.',
    year: '2024',
    client: 'Studio Session',
    category: 'Behind the Scenes'
  }
];

// Convert legacy media item to new format for compatibility
export const convertLegacyToNew = (legacy: LegacyMediaItem): MediaItem => ({
  orderKey: legacy.folder,
  folder: legacy.folder,
  title: legacy.title,
  previewUrl: legacy.previewUrl,
  previewType: legacy.type,
  fullUrl: legacy.fullUrl,
  fullType: legacy.type
});