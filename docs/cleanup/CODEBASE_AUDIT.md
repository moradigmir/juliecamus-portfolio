# Codebase Audit - Obsolete Code & Dead Dependencies

**Date:** 2025-11-10  
**Status:** Post-HiDrive/Supabase Removal

## 🗑️ Files to DELETE (Dead Code)

### 1. **Backup Files**
- `src/lib/hidrive.ts.backup` - Old backup, no longer needed

### 2. **Obsolete Scripts in `src/scripts/`**
- `src/scripts/buildMediaManifest.ts` - **DEAD** - Old HiDrive WebDAV manifest builder (replaced by `scripts/buildLocalManifest.ts`)
- `src/scripts/generateSimpleManifest.ts` - **UNUSED** - Referenced in docs but not in package.json
- `src/scripts/processLogos.ts` - **SINGLE-USE** - Logo processing script (keep if logos need reprocessing, otherwise delete)

### 3. **Supabase Edge Function**
- `supabase/functions/hidrive-proxy/index.ts` - **DEAD** - Entire Supabase proxy (352 lines)
- `supabase/config.toml` - Supabase configuration

---

## ⚠️ Files with DEAD CODE (Need Cleanup)

### 1. **`src/components/HiDriveBrowser.tsx`** (506 lines)
**Status:** Only used in diagnostics mode (`?diagnostics=1`)  
**Dead Code:**
- Entire component makes Supabase proxy calls
- WebDAV PROPFIND operations
- HiDrive path probing

**Action:** 
- ✅ **KEEP** - Useful for debugging/diagnostics
- ❌ **OR DELETE** - If you never use diagnostics mode

---

### 2. **`src/components/ProjectStatusIndicator.tsx`** (157 lines)
**Status:** Only shown when Supabase is detected as paused  
**Dead Code:**
- Supabase health checks
- "Resume Project" button linking to Supabase dashboard

**Action:**
- ❌ **DELETE** - No longer needed with local-only operation
- Used by: `HiDriveBrowser.tsx`, `MasonryGrid.tsx`

---

### 3. **`src/lib/projectHealth.ts`** (81 lines)
**Status:** Checks Supabase proxy health  
**Dead Code:**
- `checkProjectHealth()` - Tests Supabase edge function
- `detectSupabaseIssueFromResponse()` - Detects Supabase pause

**Action:**
- ❌ **DELETE** - No longer needed
- Used by: `ProjectStatusIndicator.tsx`, `HiDriveBrowser.tsx`, `useMediaIndex.tsx`

---

### 4. **`src/hooks/useMediaIndex.tsx`** (764 lines - MASSIVE)
**Status:** Core hook but contains tons of dead code  
**Dead Code:**
- Lines 208-230: `mapHiDriveUrlToProxy()` - Converts HiDrive URLs to proxy URLs
- Lines 271-286: Proxy URL detection and probing
- Lines 294-308: `headRangePath()` - Probes HiDrive via proxy
- Lines 310-328: `probePublicFirstMedia()` - Discovers media via proxy
- Lines 330-493: **ENTIRE DISCOVERY SYSTEM** (164 lines commented out but still there!)
- Diagnostic logging throughout (emit, __safeDiag, __onceEdgeFlush)

**Action:**
- 🧹 **CLEANUP** - Remove all proxy-related code
- 🧹 **CLEANUP** - Remove commented discovery code (lines 370-493)
- 🧹 **CLEANUP** - Simplify diagnostic logging

---

### 5. **`src/lib/hidrive.ts`** (389 lines)
**Status:** Contains proxy conversion functions that are now no-ops  
**Dead Code:**
- Lines 208-end: All HiDrive WebDAV functions (listDir, findPreviewForFolder, etc.)
- These functions still make Supabase proxy calls but are never used in local mode

**Action:**
- 🧹 **CLEANUP** - Remove all WebDAV/proxy functions
- ✅ **KEEP** - `toProxyStrict()` (harmless path converter)

---

### 6. **`src/components/MasonryGrid.tsx`** (1085 lines)
**Status:** Main grid component  
**Dead Code:**
- HiDriveBrowser integration (only shown with diagnostics button)
- ProjectStatusIndicator usage

**Action:**
- 🧹 **CLEANUP** - Remove HiDriveBrowser if diagnostics mode not needed
- 🧹 **CLEANUP** - Remove ProjectStatusIndicator

---

## 📋 Documentation Files (Outdated)

### Files Referencing Obsolete Systems:
- `HIDRIVE_INTEGRATION.md` - **OUTDATED** - Documents HiDrive WebDAV setup
- `GOOGLE_DRIVE_SETUP.md` - **OUTDATED** - Google Drive integration (never used?)
- `PREVIEW_SELECTION_VALIDATION.md` - References `generateSimpleManifest.ts`

**Action:**
- 🧹 **UPDATE** or **DELETE** these docs

---

## 📊 Summary Statistics

### Dead Code by File Size:
1. `useMediaIndex.tsx` - ~200 lines of dead code
2. `hidrive.ts` - ~180 lines of dead code  
3. `HiDriveBrowser.tsx` - 506 lines (entire file)
4. `supabase/functions/hidrive-proxy/index.ts` - 352 lines (entire file)
5. `ProjectStatusIndicator.tsx` - 157 lines (entire file)
6. `projectHealth.ts` - 81 lines (entire file)
7. `src/scripts/buildMediaManifest.ts` - 455 lines (entire file)

**Total Dead Code:** ~1,931 lines

---

## 🎯 Recommended Actions

### Phase 1: Safe Deletions (No Dependencies)
```bash
# Delete backup files
rm src/lib/hidrive.ts.backup

# Delete obsolete scripts
rm src/scripts/buildMediaManifest.ts
rm src/scripts/generateSimpleManifest.ts

# Delete Supabase edge function
rm -rf supabase/

# Delete outdated docs
rm HIDRIVE_INTEGRATION.md
rm GOOGLE_DRIVE_SETUP.md
```

### Phase 2: Component Cleanup
```bash
# Delete unused components
rm src/components/HiDriveBrowser.tsx
rm src/components/ProjectStatusIndicator.tsx
rm src/lib/projectHealth.ts
```

### Phase 3: Code Cleanup (Manual)
1. **`useMediaIndex.tsx`**:
   - Remove `mapHiDriveUrlToProxy()`
   - Remove proxy detection code
   - Remove commented discovery code (lines 370-493)
   - Simplify diagnostic logging

2. **`hidrive.ts`**:
   - Remove all WebDAV functions (keep only `toProxyStrict`)

3. **`MasonryGrid.tsx`**:
   - Remove HiDriveBrowser import and usage
   - Remove ProjectStatusIndicator import and usage

### Phase 4: Update Documentation
- Update `PREVIEW_SELECTION_VALIDATION.md` to reference `buildLocalManifest.ts`
- Create `LOCAL_DEVELOPMENT.md` explaining local-only architecture

---

## 📦 Unused Dependencies

### NPM Packages to Consider Removing:

1. **`@supabase/supabase-js`** (2.57.4)
   - **Status:** ❌ UNUSED - No Supabase calls in local-only mode
   - **Size:** ~50KB
   - **Action:** DELETE if fully committed to local-only

2. **`fluent-ffmpeg`** (devDependency)
   - **Status:** ⚠️ CHECK - Used in `scripts/compressWithFFmpeg.js`
   - **Action:** Keep if you compress videos, otherwise delete

3. **`sharp`** (devDependency)
   - **Status:** ✅ USED - Image compression in `scripts/compressImages.ts`
   - **Action:** KEEP

### Potentially Unused Radix UI Components:
Many Radix UI components imported but may not all be used:
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-slider`
- `@radix-ui/react-progress`

**Action:** Run `npx depcheck` to find truly unused dependencies

---

## ✅ What to KEEP

### Active Local-Only Code:
- ✅ `scripts/buildLocalManifest.ts` - Local manifest builder
- ✅ `vite-plugin-manifest-api.ts` - Local API endpoints
- ✅ `src/components/ManifestEditor.tsx` - Manifest editor
- ✅ `src/lib/metaCache.ts` - Local caching
- ✅ All Cypress tests

### Harmless Code (Can Keep):
- ✅ `toProxyStrict()` - Just converts paths, no remote calls
- ✅ Diagnostic logging (if you want it)

---

## 🚨 Breaking Changes

If you delete the recommended files, these features will be lost:
- ❌ HiDrive browser (diagnostics tool)
- ❌ Supabase health checks
- ❌ Remote manifest discovery
- ❌ WebDAV directory listing

**Impact:** None for normal users (local-only operation works perfectly)
