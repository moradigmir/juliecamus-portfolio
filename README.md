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

## Browser Support

Modern browsers (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)