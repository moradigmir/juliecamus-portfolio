# Google Drive Media Setup Instructions

## Current Status
Your Google Drive media system is now implemented! The first tile in your grid will be your Google Drive video.

## How to Add Your Actual Google Drive Videos

### Step 1: Get Google Drive File IDs
1. Open your Google Drive folder: https://drive.google.com/drive/folders/1sZlgcqemeZl_Mzp05vVgN3F7-sd9jLIH
2. Right-click on each video file → "Get link" → "Copy link"
3. Extract the FILE_ID from URLs like this:
   ```
   https://drive.google.com/file/d/FILE_ID_HERE/view?usp=sharing
   ```

### Step 2: Update Configuration
Edit `src/lib/mediaConfig.ts` and replace the placeholder IDs:

```typescript
export const googleDriveFiles = {
  '01': {
    preview: {
      fileId: 'YOUR_ACTUAL_PREVIEW_VIDEO_ID', // Replace this
      type: 'video' as const
    },
    full: {
      fileId: 'YOUR_ACTUAL_FULL_VIDEO_ID', // Replace this  
      type: 'video' as const
    }
  }
};
```

### Step 3: Test the Setup
1. Save the file
2. Check the preview - your video should appear as the first tile
3. Click the tile to open the full video in the lightbox

## Adding More Videos/Folders
To add more content, extend the configuration:

```typescript
export const googleDriveFiles = {
  '01': { /* existing */ },
  '02': {
    preview: { fileId: 'ANOTHER_PREVIEW_ID', type: 'video' as const },
    full: { fileId: 'ANOTHER_FULL_ID', type: 'video' as const }
  }
};

// Then add to mediaItems array:
export const mediaItems: MediaItem[] = [
  { /* existing 01 */ },
  {
    id: '02',
    title: 'Another Video',
    folder: '02',
    previewUrl: getGoogleDriveUrl(googleDriveFiles['02'].preview.fileId, 'video'),
    fullUrl: getGoogleDriveUrl(googleDriveFiles['02'].full.fileId, 'video'),
    type: 'video',
    // ... other metadata
  }
];
```

## Current Implementation Features
✅ Google Drive video preview tiles  
✅ Full-screen video lightbox  
✅ Loading states and error handling  
✅ Mixed content (your videos + existing projects)  
✅ Maintains all existing functionality  

## Need Help?
Just provide the actual Google Drive file IDs and I'll update the configuration for you!
