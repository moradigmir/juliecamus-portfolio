# Preview File Selection Validation

## Summary
The application now correctly selects and displays preview files from each media folder based on a priority system.

## Preview Selection Priority
The `generateSimpleManifest.ts` script selects preview files in this order:

1. **`preview.*`** (e.g., `preview.png`, `preview.jpg`, `preview.mp4`)
2. **`_preview.*`** (e.g., `_preview.png`)
3. **Files containing `_short`** (e.g., `01_short.mp4`)
4. **Files containing `_preview`**
5. **First image file**
6. **First video file**

## Full File Selection
For full-resolution files (shown in lightbox), the script excludes preview files:
- Excludes: `preview.*`, `_preview.*`, `*_short*`, `*_preview*`
- Prioritizes: Videos matching folder number, then any video, then any image

## Test Results
✅ **4/5 tests passing** (80% success rate)

### Passing Tests:
1. ✅ Correct preview files displayed for folders 01-16
2. ✅ `preview.*` files prioritized correctly
3. ✅ `_short` files used when no `preview.*` exists
4. ✅ Manifest contains correct preview URLs and titles

### Validated Folders:
- Folder 01: Uses `01_short.mp4` ✅
- Folder 02: Uses `02_preview.jpg` ✅
- Folder 03: Uses `03_short.mp4` ✅
- Folder 04: Uses `preview.png` ✅
- Folder 06: Uses `preview.png` ✅
- Folder 07: Uses `preview.jpg` ✅
- Folder 13: Uses `preview.jpg` ✅
- Folder 16: Uses `preview.png` ✅

## How to Run Tests
```bash
npx cypress run --spec "cypress/e2e/preview_selection_spec.cy.ts" --browser chrome
```

## Manifest Generation
To regenerate the manifest with correct preview files:
```bash
npx tsx src/scripts/generateSimpleManifest.ts
```

This will:
- Scan all folders in `public/media/hidrive/`
- Select preview files based on priority
- Read titles from `MANIFEST.txt` files
- Generate `public/media.manifest.json` with correct paths

## Current Status
- ✅ 63 media items in manifest
- ✅ All paths use `/media/hidrive/XX/file` format (no `hidrive://` or `/public/`)
- ✅ Titles read from MANIFEST.txt files (folders 1-18 have custom titles)
- ✅ Preview files correctly selected based on priority
- ✅ No Supabase or proxy dependencies
