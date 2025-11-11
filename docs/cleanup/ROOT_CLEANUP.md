# Root Directory Cleanup - Unnecessary Files

**Date:** 2025-11-11

## 🗑️ Files to DELETE (Junk/Temporary)

### Debug/Test Files (One-Time Use)
- `debug-tiles.html` - Debug page for testing tiles
- `temp_page.html` - Temporary test page
- `test-browser-fetch.html` - Browser fetch test
- `test-manifest-path.js` - Manifest path test
- `decode-filenames.ps1` - PowerShell script for filename decoding

**Action:** ❌ DELETE all (debugging artifacts)

---

### Helper Text Files (Can be in docs/)
- `compress-image-help.txt` - Help text for image compression
- `logos-prio.mdr.txt` - Logo priority notes

**Action:** 🗂️ MOVE to `docs/` or DELETE if not needed

---

### Build/Check Scripts (Redundant or Unused)
- `check-compressed.cjs` - Check if files are compressed
- `check-manifests.cjs` - Check manifest files
- `compress-for-deploy.cjs` - Compress files before deploy
- `deploy.cjs` - Custom deploy script

**Status:** ⚠️ CHECK if used in package.json scripts

---

### Batch Files (Windows-Specific)
- `compress-image.bat` - Windows batch for image compression
- `compress-videos.bat` - Windows batch for video compression

**Action:** 
- ✅ KEEP if you use them regularly
- 🗂️ OR MOVE to `scripts/` directory
- ❌ OR DELETE if you use npm scripts instead

---

### Lock Files (Choose One)
- `bun.lockb` (198 KB) - Bun lock file
- `package-lock.json` (380 KB) - npm lock file

**Action:** ⚠️ KEEP ONLY ONE
- If using npm: DELETE `bun.lockb`
- If using bun: DELETE `package-lock.json`

---

### Empty/Build Directories
- `.netlify/` - Netlify build cache (empty)
- `.vercel/` - Vercel build cache (empty)
- `.wrangler/` - Cloudflare Wrangler cache (empty)
- `dist/` - Build output (empty)

**Action:** ✅ KEEP (gitignored, auto-generated)

---

### Documentation Files (Organize)
Current root docs:
- `CLEANUP_COMPLETED.md` - Cleanup summary
- `CODEBASE_AUDIT.md` - Code audit
- `MEDIA_OPTIMIZATION.md` - Media optimization guide
- `PREVIEW_SELECTION_VALIDATION.md` - Preview selection docs
- `README.md` - Main readme

**Action:** 🗂️ MOVE to `docs/` directory:
```
docs/
  ├── README.md (keep at root as symlink)
  ├── cleanup/
  │   ├── CLEANUP_COMPLETED.md
  │   └── CODEBASE_AUDIT.md
  └── guides/
      ├── MEDIA_OPTIMIZATION.md
      └── PREVIEW_SELECTION_VALIDATION.md
```

---

## 📋 Recommended Actions

### Phase 1: Delete Obvious Junk
```bash
# Delete debug/test files
rm debug-tiles.html temp_page.html test-browser-fetch.html test-manifest-path.js decode-filenames.ps1

# Delete helper text files (if not needed)
rm compress-image-help.txt logos-prio.mdr.txt
```

### Phase 2: Check Script Usage
```bash
# Check if these are used in package.json
grep -E "check-compressed|check-manifests|compress-for-deploy|deploy\.cjs" package.json
```

If not used, delete them:
```bash
rm check-compressed.cjs check-manifests.cjs compress-for-deploy.cjs deploy.cjs
```

### Phase 3: Organize Batch Files
```bash
# Move to scripts/ directory
mv compress-image.bat scripts/
mv compress-videos.bat scripts/
```

### Phase 4: Choose Lock File
```bash
# If using npm (recommended for compatibility)
rm bun.lockb

# OR if using bun
rm package-lock.json
```

### Phase 5: Organize Documentation
```bash
# Create docs directory structure
mkdir -p docs/cleanup docs/guides

# Move documentation
mv CLEANUP_COMPLETED.md docs/cleanup/
mv CODEBASE_AUDIT.md docs/cleanup/
mv MEDIA_OPTIMIZATION.md docs/guides/
mv PREVIEW_SELECTION_VALIDATION.md docs/guides/

# Keep README.md at root
```

---

## 📊 Impact

### Files to Remove:
- **Debug/Test:** 5 files
- **Helper Text:** 2 files
- **Unused Scripts:** 0-4 files (check first)
- **Lock Files:** 1 file (choose npm or bun)
- **Batch Files:** 0 files (move to scripts/)

**Total:** 8-14 files can be removed/moved

### Space Saved:
- Lock file: ~200-380 KB
- Other files: ~20 KB
- **Total:** ~220-400 KB

### Benefits:
- ✅ Cleaner root directory
- ✅ Better organization
- ✅ Easier to find important files
- ✅ Less clutter in IDE file explorer

---

## ✅ Keep These (Essential)

### Configuration Files:
- `.env` - Environment variables
- `.gitignore` - Git ignore rules
- `components.json` - shadcn/ui config
- `cypress.config.ts` - Cypress test config
- `eslint.config.js` - ESLint config
- `index.html` - Main HTML entry
- `netlify.toml` - Netlify deploy config
- `package.json` - Dependencies
- `postcss.config.js` - PostCSS config
- `tailwind.config.ts` - Tailwind config
- `tsconfig.*.json` - TypeScript configs
- `vercel.json` - Vercel deploy config
- `vite.config.ts` - Vite config
- `vite-plugin-manifest-api.ts` - Custom Vite plugin

### Directories:
- `.github/` - GitHub Actions
- `.vscode/` - VS Code settings
- `.windsurf/` - Windsurf IDE settings
- `cypress/` - Tests
- `node_modules/` - Dependencies
- `public/` - Static assets
- `scripts/` - Build scripts
- `src/` - Source code
- `tests/` - Additional tests
