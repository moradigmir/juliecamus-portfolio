# Julie Camus - Portfolio Website

A responsive, visually striking portfolio website for French high-end makeup artist Julie Camus, featuring an immersive gallery homepage with dynamic masonry layout.

## Features

- **Masonry Gallery**: Dynamic grid layout with minimum 3 columns on all breakpoints
- **Interactive Previews**: Hover effects with video autoplay and side preview panels
- **Responsive Design**: Optimized for all screen sizes from 320px to desktop
- **Dark Elegant Theme**: Deep charcoal background with lavender accents (#E0B0FF)
- **Smooth Animations**: Framer Motion powered transitions and effects
- **Keyboard Accessible**: Full keyboard navigation support
- **Touch Optimized**: Mobile-friendly interactions and modal previews

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion
- **Routing**: React Router DOM
- **UI Components**: Radix UI + shadcn/ui

## Getting Started

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open browser**: Navigate to `http://localhost:8080`

### Build for Production

```bash
npm run build
```

## Adding Projects

Projects are managed in `src/data/projects.ts`. Add new projects to the array with cover images, videos, and galleries.

## Design System

- **Primary**: Lavender (#E0B0FF) accent color
- **Typography**: Playfair Display + Inter
- **Theme**: Dark elegant with semantic tokens

## Performance

- Lazy loading for all media
- Optimized animations with GPU acceleration
- Responsive image handling
- Mobile-first responsive design

## Supabase & HiDrive Audit (Migration Notes)

- **Generated Supabase client** – stores project URL/anon key and is the entry point for all remote proxy calls @src/integrations/supabase/client.ts#1-17.
- **Project health utilities & UI** – poll the Supabase edge function to detect pauses and show status badges @src/lib/projectHealth.ts#1-81, @src/components/ProjectStatusIndicator.tsx#1-155.
- **HiDrive proxy helpers** – normalise `hidrive://` URLs, perform PROPFIND listings, probe streams, and fetch manifests through Supabase edge functions @src/lib/hidrive.ts#1-362.
- **Media indexing hook** – loads `/media.manifest.json`, rewrites URLs to the proxy, detects Supabase outages, and applies manifest metadata @src/hooks/useMediaIndex.tsx#160-480.
- **UI tooling** – Masonry grid developer controls and HiDrive browser both call the proxy for listings, validation, and diagnostics @src/components/MasonryGrid.tsx#1-400, @src/components/HiDriveBrowser.tsx#50-185.
- **Build-time scripts** – the manifest builder script authenticates directly against HiDrive at build time @scripts/buildMediaManifest.ts#1-400.
- **Edge function** – Supabase function `hidrive-proxy` implements media streaming, PROPFIND, uploads, and diagnostics @supabase/functions/hidrive-proxy/index.ts#1-353.

## Local Media Mirror Plan

### Directory layout

- Mirror HiDrive’s `/public` folders inside the repo at `public/media/hidrive/public/<folder>/...` so existing manifest order keys still match (`01`, `02`, etc.).
- Store per-folder markdown (e.g., `MANIFEST.md`) alongside media for offline parsing.
- Keep thumbnails or derived assets under `public/media/hidrive/thumbnails/<folder>/` to avoid mixing generated files with originals.

Example:

```
public/
  media/
    hidrive/
      public/
        01/
          01_short.mp4
          01_full.mp4
          MANIFEST.md
        02/
          02_preview.jpg
          02_full.mp4
      thumbnails/
        01/
          01_short.jpg
```

### Sync workflow

1. Add a new script (`scripts/syncHidriveToLocal.ts`) that logs in with existing HiDrive credentials and downloads assets into `public/media/hidrive/...` (reuse authentication patterns from the manifest builder @scripts/buildMediaManifest.ts#40-338).
2. Read credentials from environment variables (e.g., `HIDRIVE_USERNAME`, `HIDRIVE_PASSWORD`) and keep them out of source control.
3. Run the sync script before builds to ensure the local mirror stays up to date; commit the resulting media files once verified.
4. Extend the manifest builder to operate on the local directory tree instead of remote PROPFIND so it reads metadata without network access.

### Manifest updates

- Update `public/media.manifest.json` to use local relative paths (e.g., `/media/hidrive/public/01/01_short.mp4`) instead of `hidrive://` URLs @public/media.manifest.json#1-44.
- Store the manifest’s `source` as `local` once the migration completes, signaling downstream code to stop proxy rewrites.
- Ensure the manifest generator emits thumbnails and metadata paths that align with the new folder layout.

## Browser Support

Modern browsers (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)