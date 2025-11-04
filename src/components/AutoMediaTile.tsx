import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { MediaItem } from '../hooks/useMediaIndex';
import { useIsMobile } from '../hooks/use-mobile';
import { toProxy } from '../lib/hidrive';
import { diag } from '../debug/diag';

interface AutoMediaTileProps {
  media: MediaItem;
  index: number;
  onHover?: (index: number) => void;
  onLeave?: () => void;
  onClick?: (media: MediaItem) => void;
}

const AutoMediaTile = ({ media, index, onHover, onLeave, onClick }: AutoMediaTileProps) => {
  // Check if in diagnostics mode (explicit only)
  const isDebugMode = new URLSearchParams(window.location.search).get('diagnostics') === '1';
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [codecHint, setCodecHint] = useState<string | null>(null);
  const [proxyMisrouted, setProxyMisrouted] = useState(false);
  const [supabasePaused, setSupabasePaused] = useState(false);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlayTimeout, setAutoPlayTimeout] = useState<NodeJS.Timeout | null>(null);
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const handleClick = () => {
    if (hasError) return;
    onClick?.(media);
  };

  const handleMouseEnter = useCallback(() => {
    onHover?.(index);
  }, [index, onHover]);

  const handleMouseLeave = useCallback(() => {
    onLeave?.();
  }, [onLeave]);

  const mimeType = (() => {
    try {
      const u = new URL(media.previewUrl, window.location.origin);
      const p = u.searchParams.get('path') || '';
      const lower = p.toLowerCase();
      if (lower.endsWith('.mp4')) return 'video/mp4';
      if (lower.endsWith('.mov')) return 'video/quicktime';
      if (lower.endsWith('.webm')) return 'video/webm';
      if (lower.endsWith('.m4v')) return 'video/x-m4v';
      // Fallback: if path looks like an image
      if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image/*';
      return 'video/mp4';
    } catch {
      return 'video/mp4';
    }
  })();

  // Force proxy mapping with toProxyStrict for consistent /public/ prefix
  const proxiedPreviewUrl = toProxy(media.previewUrl);
  const proxiedFullUrl = toProxy(media.fullUrl);
  console.log('MEDIA_SRC_SET', { folder: media.folder, preview: proxiedPreviewUrl });
  diag('NET', 'media_src_set', { folder: media.folder, preview: proxiedPreviewUrl });
  
  const cacheBustedUrl = `${proxiedPreviewUrl}${proxiedPreviewUrl.includes('?') ? '&' : '?'}r=${reloadKey}`;

  const listUrl = (() => {
    try {
      const u = new URL(proxiedPreviewUrl);
      const owner = u.searchParams.get('owner') || '';
      const path = u.searchParams.get('path') || '';
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '/';
      const list = new URL(u.origin + u.pathname);
      list.searchParams.set('path', dir);
      if (owner) list.searchParams.set('owner', owner);
      list.searchParams.set('list', '1');
      return list.toString();
    } catch {
      return '';
    }
  })();

  // Video analysis effect
  useEffect(() => {
    if (media.previewType !== 'video') return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(cacheBustedUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-2047' },
          signal: controller.signal,
        });
        setHttpStatus(res.status);
        
        const contentType = res.headers.get('content-type') || '';
        
        // Check if Supabase project is paused (404 + HTML response)
        if (res.status === 404 && contentType.includes('text/html')) {
          setSupabasePaused(true);
          return;
        }
        
        // Check if proxy returned HTML (misrouted)
        if (contentType.includes('text/html')) {
          setProxyMisrouted(true);
          return;
        }
        
        if (!(res.ok || res.status === 206)) return;
        const buf = new Uint8Array(await res.arrayBuffer());
        const ascii = new TextDecoder('ascii').decode(buf);
        
        // Check if it starts with HTML
        if (ascii.trim().startsWith('<!DOCTYPE html') || ascii.trim().startsWith('<html')) {
          setProxyMisrouted(true);
          return;
        }
        
        let hint: string | null = null;
        if (ascii.includes('hvc1') || ascii.includes('hev1')) hint = 'HEVC (hvc1/hev1)';
        else if (ascii.includes('av01')) hint = 'AV1 (av01)';
        else if (ascii.includes('vp09')) hint = 'VP9 (vp09)';
        else if (ascii.includes('avc1') || ascii.includes('isom') || ascii.includes('mp41') || ascii.includes('mp42')) hint = 'H.264/AVC (avc1)';
        setCodecHint(hint);
        setHttpStatus(res.status);
      } catch (_) {
        // ignore
      }
    })();
    return () => controller.abort();
  }, [cacheBustedUrl, media.previewType]);

  // Generate thumbnail dynamically if not provided and it's a video
  const generateThumbnailFromVideo = useCallback((video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      return canvas.toDataURL('image/webp', 0.8);
    } catch (error) {
      console.warn('Failed to generate video thumbnail:', error);
      return null;
    }
  }, []);

  // Viewport-based autoplay (same behavior on mobile and desktop)
  useEffect(() => {
    if (media.previewType !== 'video' || !videoRef.current || !tileRef.current) {
      return;
    }

    const video = videoRef.current;
    const tile = tileRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!isPlaying) {
              video.currentTime = 0;
              video.play().then(() => {
                setIsPlaying(true);
              }).catch(() => {
                // Ignore autoplay errors
              });
            }
          } else {
            if (isPlaying) {
              video.pause();
              video.currentTime = 0;
              setIsPlaying(false);
            }
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(tile);

    return () => {
      observer.disconnect();
    };
  }, [media.previewType, isPlaying]);

  // Ensure poster is visible immediately if provided (avoid blocking overlay)
  useEffect(() => {
    if (media.previewType === 'video' && media.thumbnailUrl) {
      setIsLoaded(true);
    }
  }, [media.previewType, media.thumbnailUrl]);

  return (
    <motion.div
      ref={tileRef}
      className="gallery-tile-wrapper video-tile cursor-pointer focus-ring"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.3,
        delay: index * 0.1,
        ease: "easeOut" 
      }}
      tabIndex={0}
      role="button"
      aria-label={`View ${media.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="gallery-tile bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Loading State */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted text-muted-foreground p-4 text-center">
            <div>
              <div className="w-12 h-12 mx-auto mb-2 opacity-50">⚠️</div>
              {supabasePaused ? (
                <>
                  <p className="text-sm font-medium text-destructive">Supabase Project Paused</p>
                  <p className="text-xs opacity-70 mt-1">Backend services are unavailable. The project may be paused.</p>
                  <p className="text-xs opacity-80 mt-1">Go to Supabase dashboard to resume the project.</p>
                </>
              ) : proxyMisrouted ? (
                <>
                  <p className="text-sm font-medium">Proxy misrouted</p>
                  <p className="text-xs opacity-70 mt-1">The proxy returned HTML instead of media. Check function deployment.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Failed to load</p>
                  {httpStatus !== null && (
                    <p className="text-xs opacity-70 mt-1">HTTP {httpStatus}</p>
                  )}
                  {codecHint && (
                    <p className="text-xs opacity-80 mt-1">Detected codec: {codecHint}</p>
                  )}
                  <p className="text-xs opacity-70 mt-1">If your browser doesn't support this codec, try Safari or download the file.</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {supabasePaused ? (
                <a
                  href="https://supabase.com/dashboard/project/fvrgjyyflojdiklqepqt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  Resume Project
                </a>
              ) : (
                <button
                  className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHasError(false);
                    setIsLoaded(false);
                    setHttpStatus(null);
                    setSupabasePaused(false);
                    setProxyMisrouted(false);
                    setReloadKey((k) => k + 1);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                >
                  Retry
                </button>
              )}
              <a
                href={cacheBustedUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="px-3 py-1 text-xs rounded-md bg-secondary text-secondary-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Media Content */}
        <div className="relative w-full h-full">
          {media.previewType === 'video' ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              poster={media.thumbnailUrl || '/placeholder.svg'}
              onLoadedMetadata={() => setIsLoaded(true)}
              onLoadedData={() => setIsLoaded(true)}
              onError={() => {
                setHasError(true);
                console.warn('MEDIA_ERROR', { folder: media.folder, preview: proxiedPreviewUrl });
                diag('NET', 'media_error', { folder: media.folder, preview: proxiedPreviewUrl });
              }}
              style={{ display: hasError ? 'none' : 'block' }}
            >
              <source src={cacheBustedUrl} type={mimeType} />
              Your browser does not support video playback.
            </video>
          ) : (
            <img
              src={proxiedPreviewUrl}
              alt={media.title}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setHasError(true);
                console.warn('MEDIA_ERROR', { folder: media.folder, preview: proxiedPreviewUrl });
                diag('NET', 'media_error', { folder: media.folder, preview: proxiedPreviewUrl });
              }}
              style={{ display: hasError ? 'none' : 'block' }}
            />
          )}
          
          {/* Loading State - Show while video loads */}
          {!isLoaded && !hasError && !media.thumbnailUrl && (
            <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
          {/* Video Indicator */}
          {media.fullType === 'video' && (
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
              <Play className={`w-3 h-3 text-foreground ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
          )}
          
          {/* Order Badge - Only show in debug mode */}
          {isDebugMode && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
              {media.orderKey}
            </div>
          )}
          
          {/* Overlay with Title */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="font-medium text-foreground text-sm mb-1">
                {media.title ?? media.meta?.title ?? media.folder}
              </h3>
              <p className="text-xs text-muted-foreground">
                {(media.description ?? media.meta?.description ?? '') && (
                  <span className="block mb-1 opacity-90">
                    {(media.description ?? media.meta?.description ?? '').length > 60 
                      ? (media.description ?? media.meta?.description ?? '').slice(0, 60) + '...'
                      : (media.description ?? media.meta?.description ?? '')
                    }
                  </span>
                )}
                {media.previewType === 'video' ? 'Video Preview' : 'Image'} • 
                {media.fullType === 'video' ? ' Video Content' : ' Image Content'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AutoMediaTile;