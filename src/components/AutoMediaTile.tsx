import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { MediaItem } from '../hooks/useMediaIndex';
import { useIsTabletOrMobile } from '../hooks/use-tablet-mobile';
import { useVideoSettings } from '../hooks/useVideoSettings';
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
  const [errorAttempts, setErrorAttempts] = useState(0);
  const [useFullSource, setUseFullSource] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsTabletOrMobile();
  const { autoplayEnabled, muteEnabled } = useVideoSettings();

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
  const cacheBustedFullUrl = `${proxiedFullUrl}${proxiedFullUrl.includes('?') ? '&' : '?'}r=${reloadKey}`;
  const currentSrc = useFullSource ? cacheBustedFullUrl : cacheBustedUrl;

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
    if (media.previewType !== 'video' || !videoRef.current || !tileRef.current || !autoplayEnabled) {
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
  }, [media.previewType, isPlaying, autoplayEnabled]);

  // For videos: mark loaded immediately so poster is always visible
  // Timeout flow runs in parallel: 5s -> try full source, +3s -> show error overlay
  useEffect(() => {
    if (media.previewType === 'image') {
      setIsLoaded(true);
      return;
    }

    // Videos: show poster immediately (don't wait for canplay events)
    const initTimer = window.setTimeout(() => {
      setIsLoaded(true);
    }, 50);

    const timers: number[] = [initTimer];

    const startSecondStage = () => {
      const t2 = window.setTimeout(() => {
        if (!hasError && !videoReady) {
          console.log(`[AutoMediaTile] ${media.folder}: +3s timeout, show error overlay (video not ready)`);
          setHasError(true);
        } else if (videoReady) {
          console.log(`[AutoMediaTile] ${media.folder}: Video ready, skipping error`);
        }
      }, 3000);
      timers.push(t2);
    };

    if (!useFullSource) {
      const t1 = window.setTimeout(() => {
        if (!hasError && !videoReady) {
          console.log(`[AutoMediaTile] ${media.folder}: 5s timeout, swapping to full source`);
          setUseFullSource(true);
          setReloadKey((k) => k + 1);
          if (videoRef.current) {
            videoRef.current.load();
          }
          startSecondStage();
        } else if (videoReady) {
          console.log(`[AutoMediaTile] ${media.folder}: Video ready before 5s, skipping swap`);
        }
      }, 5000);
      timers.push(t1);
    } else if (!videoReady) {
      // Already on full source, start the 3s error timer only if video not ready
      startSecondStage();
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [media.previewType, media.folder, useFullSource, hasError, videoReady]);

  // Reset error state when media changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setErrorAttempts(0);
    setUseFullSource(false);
    setSupabasePaused(false);
    setProxyMisrouted(false);
    setHttpStatus(null);
    setVideoReady(false);
  }, [media.previewUrl, media.fullUrl, media.folder]);
  
  return (
    <motion.div
      ref={tileRef}
      className="gallery-tile-wrapper video-tile cursor-pointer focus-ring group"
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
        {/* Loading State - Only for images without poster */}
        {!isLoaded && !hasError && media.previewType === 'image' && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <div className="w-8 h-8 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
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
                  <p className="text-sm font-medium">Unable to play video</p>
                  {httpStatus !== null && httpStatus >= 400 && (
                    <p className="text-xs opacity-70 mt-1">HTTP {httpStatus}</p>
                  )}
                  {codecHint && (codecHint.includes('HEVC') || codecHint.includes('AV1')) && (
                    <>
                      <p className="text-xs opacity-80 mt-1">Codec: {codecHint}</p>
                      <p className="text-xs opacity-70 mt-1">Not supported in this browser. Try Safari or download.</p>
                    </>
                  )}
                  {(!httpStatus || (httpStatus >= 200 && httpStatus < 300)) && (!codecHint || (!codecHint.includes('HEVC') && !codecHint.includes('AV1'))) && (
                    <p className="text-xs opacity-70 mt-1">Video format may not be compatible with your browser.</p>
                  )}
                  {httpStatus && httpStatus >= 400 && (
                    <p className="text-xs opacity-70 mt-1">Unable to download video from server.</p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {supabasePaused ? (
                <a
                  href="https://supabase.com/dashboard/project/fvrgjyyflojdiklqepqt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs rounded-md bg-charcoal text-off-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  Resume Project
                </a>
              ) : (
                <button
                  className="px-3 py-1 text-xs rounded-md bg-charcoal text-off-white"
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
                href={currentSrc}
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
              muted={muteEnabled}
              loop
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              poster={media.thumbnailUrl || '/placeholder.svg'}
              onLoadedMetadata={() => { 
                console.log(`[AutoMediaTile] loadedMetadata: ${media.folder}`); 
                setVideoReady(true);
              }}
              onCanPlay={() => { 
                console.log(`[AutoMediaTile] canPlay: ${media.folder}`); 
                setVideoReady(true);
                setHasError(false); 
                setErrorAttempts(0); 
              }}
              onLoadedData={() => { 
                console.log(`[AutoMediaTile] loadedData: ${media.folder}`); 
                setVideoReady(true);
                setHasError(false); 
                setErrorAttempts(0); 
              }}
              onError={() => {
                setErrorAttempts((prev) => {
                  if (prev < 1) {
                    setUseFullSource(true);
                    setHasError(false);
                    setSupabasePaused(false);
                    setProxyMisrouted(false);
                    setHttpStatus(null);
                    setReloadKey((k) => k + 1);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                    console.warn('MEDIA_RETRY_WITH_FULL_SOURCE', { folder: media.folder, preview: proxiedPreviewUrl, full: proxiedFullUrl });
                    diag('NET', 'media_retry_full', { folder: media.folder, preview: proxiedPreviewUrl, full: proxiedFullUrl });
                    return prev + 1;
                  }
                  console.warn('MEDIA_ERROR', { folder: media.folder, src: currentSrc });
                  diag('NET', 'media_error', { folder: media.folder, src: currentSrc });
                  setHasError(true);
                  return prev + 1;
                });
              }}
              style={{ display: 'block' }}
              key={`${media.folder}-${useFullSource ? 'full' : 'preview'}-${reloadKey}`}
            >
              <source src={currentSrc} type={mimeType} />
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
          
          
          {/* Video Indicator */}
          {media.fullType === 'video' && (
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
              <Play className={`w-3 h-3 text-foreground ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
          )}
          
          {/* MANIFEST indicator - show only if metadata comes from MANIFEST file */}
          {media.meta?.title && media.meta?.source === 'file' && (
            <div className="absolute top-2 left-2 bg-charcoal/90 text-off-white text-xs font-medium px-2 py-0.5 rounded-full border border-off-white/20">
              ✓ Meta
            </div>
          )}
          
          {/* Order Badge - Only show in debug mode */}
          {isDebugMode && (
            <div className="absolute top-2 right-2 bg-charcoal text-off-white text-xs font-medium px-2 py-1 rounded-full">
              {media.orderKey}
            </div>
          )}
          
          {/* Title overlay - hover on desktop, always visible on mobile/tablet */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-2 sm:p-3 transition-opacity duration-300 pointer-events-none ${
              isMobile 
                ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-100' 
                : 'bg-gradient-to-t from-white/95 via-white/80 to-transparent opacity-0 group-hover:opacity-100'
            }`}
          >
            <h3 className={`text-xs sm:text-sm font-semibold line-clamp-2 drop-shadow-lg ${
              isMobile ? 'text-white' : 'text-charcoal'
            }`}>
              {media.title ?? media.meta?.title ?? media.folder}
            </h3>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AutoMediaTile;