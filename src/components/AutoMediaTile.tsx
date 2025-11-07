import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { MediaItem } from '../hooks/useMediaIndex';
import { useIsTabletOrMobile } from '../hooks/use-tablet-mobile';
import { useVideoSettings } from '../hooks/useVideoSettings';
import { toProxy, findPreviewForFolder } from '../lib/hidrive';
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
  const [useFullSource, setUseFullSource] = useState(media.previewType === 'video');
  const [videoReady, setVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsTabletOrMobile();
  const { autoplayEnabled, muteEnabled } = useVideoSettings();
  
  // Healed source when we auto-fix stale/broken URLs
  const [healedSrc, setHealedSrc] = useState<string | null>(null);
  const [healedType, setHealedType] = useState<'image' | 'video' | null>(null);
  const [healing, setHealing] = useState(false);

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
  
  // If we healed this tile, prefer healed source
  const basePreviewUrl = healedSrc ?? proxiedPreviewUrl;
  const baseFullUrl = healedSrc ?? proxiedFullUrl;

  // Effective media type if we healed to a different file kind
  const effectivePreviewType = (healedType ?? media.previewType);
  const effectiveFullType = (healedType ?? media.fullType);

  // Decide final rendering type (force video if full is video)
  const isVideo = (() => {
    if (effectiveFullType === 'video' || effectivePreviewType === 'video') return true;
    try {
      const url = healedSrc ?? media.fullUrl ?? media.previewUrl;
      const lower = url.toLowerCase();
      return /\.(mp4|mov|webm|m4v)(\?|$)/.test(lower);
    } catch { return false; }
  })();

  console.log('MEDIA_SRC_SET', { folder: media.folder, preview: basePreviewUrl });
  diag('NET', 'media_src_set', { folder: media.folder, preview: basePreviewUrl });
  
  const cacheBustedUrl = `${basePreviewUrl}${basePreviewUrl.includes('?') ? '&' : '?'}r=${reloadKey}`;
  const cacheBustedFullUrl = `${baseFullUrl}${baseFullUrl.includes('?') ? '&' : '?'}r=${reloadKey}`;
  const currentSrc = isVideo ? cacheBustedFullUrl : cacheBustedUrl;

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

  // Attempt to heal a broken/stale URL by listing folder and picking preview or first media
  const attemptHeal = useCallback(async () => {
    if (healing) return;
    setHealing(true);
    try {
      // Extract directory path from current preview URL
      const u = new URL(basePreviewUrl);
      const path = u.searchParams.get('path') || '';
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '/';
      const healed = await findPreviewForFolder(dir);
      if (healed && healed !== basePreviewUrl) {
        const lower = healed.toLowerCase();
        const newType: 'image' | 'video' = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(lower) ? 'video' : 'image';
        setHealedSrc(healed);
        setHealedType(newType);
        setHasError(false);
        setReloadKey((k) => k + 1);
        if (newType === 'video' && videoRef.current) {
          try { videoRef.current.load(); } catch {}
        }
        console.log('[HEAL] Healed media source', { folder: media.folder, healed, type: newType });
        diag('NET', 'media_healed', { folder: media.folder, healed, type: newType });
      }
    } catch (e) {
      console.warn('[HEAL] Failed to heal media', { folder: media.folder, err: String(e) });
    } finally {
      setHealing(false);
    }
  }, [basePreviewUrl, media.folder, healing]);

  // Video analysis removed - videos load directly without probing

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
    if (!isVideo || !videoRef.current || !tileRef.current || !autoplayEnabled) {
      return;
    }

    const video = videoRef.current;
    const tile = tileRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
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
      { threshold: [0, 0.2, 1] }
    );

    observer.observe(tile);

    return () => {
      observer.disconnect();
    };
  }, [isVideo, isPlaying, autoplayEnabled]);

  // For videos: mark loaded immediately so poster is always visible; no artificial error timers
  useEffect(() => {
    if (!isVideo) {
      setIsLoaded(true);
      return;
    }

    const initTimer = window.setTimeout(() => {
      setIsLoaded(true);
    }, 50);

    return () => {
      clearTimeout(initTimer);
    };
  }, [isVideo, media.folder]);

  // Reset error state when media changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setErrorAttempts(0);
    setUseFullSource(media.previewType === 'video');
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
      <div className="gallery-tile relative bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="relative w-full h-full">
        {/* Error overlay removed to prevent blocking tiles */}
          {isVideo ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted={muteEnabled}
              loop
              playsInline
              preload="auto"
              poster={media.thumbnailUrl || '/placeholder.svg'}
              onLoadedMetadata={() => { 
                console.log(`[AutoMediaTile] loadedMetadata: ${media.folder}, src: ${currentSrc}`); 
                setVideoReady(true);
              }}
              onCanPlay={() => { 
                console.log(`[AutoMediaTile] canPlay: ${media.folder}, src: ${currentSrc}`); 
                setVideoReady(true);
                setHasError(false); 
                setErrorAttempts(0); 
              }}
              onLoadedData={() => { 
                console.log(`[AutoMediaTile] loadedData: ${media.folder}, src: ${currentSrc}`); 
                setVideoReady(true);
                setHasError(false); 
                setErrorAttempts(0);
              }}
              onError={() => {
                setErrorAttempts((prev) => {
                  if (prev < 1) {
                    // One retry with cache bust, but no error overlay
                    setReloadKey((k) => k + 1);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                    console.warn('[AutoMediaTile] video error, retrying with cache bust', { folder: media.folder, src: currentSrc });
                    return prev + 1;
                  }
                  // Keep poster visible, no error overlay
                  console.warn('[AutoMediaTile] video error after retry', { folder: media.folder, src: currentSrc });
                  return prev + 1;
                });
              }}
              style={{ display: 'block' }}
              key={`${media.folder}-${useFullSource ? 'full' : 'preview'}-${reloadKey}`}
            >
              <source src={currentSrc} />
              Your browser does not support video playback.
            </video>
          ) : (
            <img
              src={basePreviewUrl}
              alt={media.title}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                console.warn('MEDIA_IMAGE_ERROR', { folder: media.folder, preview: basePreviewUrl });
                diag('NET', 'media_image_error', { folder: media.folder, preview: basePreviewUrl });
                try { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; } catch {}
                setHasError(false);
                setIsLoaded(true);
              }}
              style={{ display: 'block' }}
            />
          )}
          
          
          {/* Video Indicator */}
          {effectiveFullType === 'video' && (
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