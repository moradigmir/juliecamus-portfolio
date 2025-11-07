import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { MediaItem } from '../hooks/useMediaIndex';
import { useIsTabletOrMobile } from '../hooks/use-tablet-mobile';
import { useVideoSettings } from '../hooks/useVideoSettings';
import { toProxy, findPreviewForFolder, findPosterForFolder, probeStream } from '../lib/hidrive';
import { diag } from '../debug/diag';

interface AutoMediaTileProps {
  media: MediaItem;
  index: number;
  onHover?: (index: number) => void;
  onLeave?: () => void;
  onClick?: (media: MediaItem) => void;
}

const AutoMediaTile = ({ media, index, onHover, onLeave, onClick }: AutoMediaTileProps) => {
  const isDebugMode = new URLSearchParams(window.location.search).get('diagnostics') === '1';
  const [isLoaded, setIsLoaded] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [posterSrc, setPosterSrc] = useState<string>(media.thumbnailUrl || '/placeholder.svg');
  const [validated, setValidated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsTabletOrMobile();
  const { autoplayEnabled, muteEnabled } = useVideoSettings();

  const handleClick = () => onClick?.(media);
  const handleMouseEnter = useCallback(() => onHover?.(index), [index, onHover]);
  const handleMouseLeave = useCallback(() => onLeave?.(), [onLeave]);

  // Determine if this is a video based on URL/type
  const isVideo = (() => {
    if (media.fullType === 'video' || media.previewType === 'video') return true;
    const url = media.fullUrl || media.previewUrl;
    return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url.toLowerCase());
  })();

  // Extract folder directory for poster/preview discovery
  const getFolderDir = useCallback((url: string): string => {
    try {
      const u = new URL(url, window.location.origin);
      const path = u.searchParams.get('path') || url;
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '/';
      return dir;
    } catch {
      return '/';
    }
  }, []);

  // Try case variants of a URL (uppercase/lowercase extension)
  const tryCaseVariants = useCallback(async (url: string): Promise<string | null> => {
    try {
      const u = new URL(url);
      const path = u.searchParams.get('path') || '';
      const ext = path.split('.').pop() || '';
      
      const variants = [
        path.replace(new RegExp(`\\.${ext}$`, 'i'), `.${ext.toUpperCase()}`),
        path.replace(new RegExp(`\\.${ext}$`, 'i'), `.${ext.toLowerCase()}`)
      ];
      
      for (const variant of variants) {
        if (variant === path) continue;
        u.searchParams.set('path', variant);
        const testUrl = u.toString();
        console.log('[PROBE] Trying case variant', { folder: media.folder, variant });
        const probe = await probeStream(testUrl);
        if (probe.ok) {
          console.log('[PROBE] Case variant success', { folder: media.folder, variant, status: probe.status });
          diag('TILE', 'probe_ok_variant', { folder: media.folder, url: testUrl, status: probe.status });
          return testUrl;
        }
      }
    } catch (e) {
      console.warn('[PROBE] Case variant error', { folder: media.folder, err: String(e) });
    }
    return null;
  }, [media.folder]);

  // Main validation and probing logic
  const validateAndResolve = useCallback(async () => {
    console.log('[TILE] Starting validation', { folder: media.folder, isVideo });
    
    const candidateFull = toProxy(media.fullUrl);
    const candidatePreview = toProxy(media.previewUrl);
    
    // For videos: probe → case variants → preview fallback → heal
    if (isVideo) {
      // Step 1: Probe full URL
      console.log('[PROBE] Probing full URL', { folder: media.folder, url: candidateFull });
      let probe = await probeStream(candidateFull);
      
      if (probe.ok) {
        console.log('[PROBE] Full URL ok', { folder: media.folder, status: probe.status, ct: probe.ct });
        diag('TILE', 'probe_ok_full', { folder: media.folder, url: candidateFull, status: probe.status });
        setResolvedSrc(candidateFull);
        setValidated(true);
        return;
      }
      
      console.log('[PROBE] Full URL failed', { folder: media.folder, status: probe.status });
      diag('TILE', 'probe_fail_full', { folder: media.folder, url: candidateFull, status: probe.status });
      
      // Step 2: Try case variants
      const variantUrl = await tryCaseVariants(candidateFull);
      if (variantUrl) {
        setResolvedSrc(variantUrl);
        setValidated(true);
        return;
      }
      
      // Step 3: Try preview URL if video
      if (media.previewType === 'video' && candidatePreview !== candidateFull) {
        console.log('[PROBE] Trying preview URL', { folder: media.folder, url: candidatePreview });
        probe = await probeStream(candidatePreview);
        if (probe.ok) {
          console.log('[PROBE] Preview URL ok', { folder: media.folder, status: probe.status });
          diag('TILE', 'probe_ok_preview', { folder: media.folder, url: candidatePreview, status: probe.status });
          setResolvedSrc(candidatePreview);
          setValidated(true);
          return;
        }
      }
      
      // Step 4: Attempt heal (find new preview in folder)
      console.log('[HEAL] Attempting heal', { folder: media.folder });
      const dir = getFolderDir(candidateFull);
      const healed = await findPreviewForFolder(dir);
      if (healed) {
        console.log('[HEAL] Found healed URL', { folder: media.folder, healed });
        probe = await probeStream(healed);
        if (probe.ok) {
          console.log('[HEAL] Healed URL ok', { folder: media.folder, status: probe.status });
          diag('TILE', 'using_healed', { folder: media.folder, url: healed, status: probe.status });
          setResolvedSrc(healed);
          setValidated(true);
          return;
        }
      }
      
      // Fallback: use original full URL anyway (poster will show)
      console.warn('[TILE] All probes failed, using original', { folder: media.folder });
      diag('TILE', 'probe_fail_all', { folder: media.folder });
      setResolvedSrc(candidateFull);
      setValidated(true);
    } else {
      // For images: just use preview URL directly
      setResolvedSrc(candidatePreview);
      setValidated(true);
    }
  }, [media.folder, media.fullUrl, media.previewUrl, media.previewType, isVideo, getFolderDir, tryCaseVariants]);

  // Discover poster image
  const discoverPoster = useCallback(async () => {
    if (!isVideo) return;
    
    const dir = getFolderDir(media.fullUrl);
    console.log('[POSTER] Looking for poster', { folder: media.folder, dir });
    const poster = await findPosterForFolder(dir);
    if (poster) {
      console.log('[POSTER] Found poster', { folder: media.folder, poster });
      diag('TILE', 'poster_found', { folder: media.folder, url: poster });
      setPosterSrc(poster);
    } else {
      console.log('[POSTER] No poster found, using thumbnail', { folder: media.folder });
      setPosterSrc(media.thumbnailUrl || '/placeholder.svg');
    }
  }, [isVideo, media.folder, media.fullUrl, media.thumbnailUrl, getFolderDir]);

  // Run validation and poster discovery on mount/media change
  useEffect(() => {
    setValidated(false);
    setVideoReady(false);
    setIsLoaded(false);
    
    validateAndResolve();
    discoverPoster();
  }, [media.folder, media.fullUrl, media.previewUrl, validateAndResolve, discoverPoster]);

  // Reload video when src changes
  useEffect(() => {
    if (isVideo && videoRef.current && resolvedSrc && validated) {
      console.log('[TILE] Loading video with resolved src', { folder: media.folder, src: resolvedSrc });
      videoRef.current.load();
    }
  }, [isVideo, resolvedSrc, validated, media.folder]);

  // Viewport-based autoplay (only after validated)
  useEffect(() => {
    if (!isVideo || !videoRef.current || !tileRef.current || !autoplayEnabled || !validated) {
      return;
    }

    const video = videoRef.current;
    const tile = tileRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
            if (!isPlaying && videoReady) {
              video.currentTime = 0;
              video.play().then(() => {
                console.log('[TILE] Play started', { folder: media.folder, ratio: entry.intersectionRatio });
                diag('TILE', 'play_start', { folder: media.folder, ratio: entry.intersectionRatio });
                setIsPlaying(true);
              }).catch((err) => {
                console.warn('[TILE] Play failed', { folder: media.folder, err: String(err) });
              });
            }
          } else {
            if (isPlaying) {
              video.pause();
              video.currentTime = 0;
              console.log('[TILE] Play stopped', { folder: media.folder });
              diag('TILE', 'play_stop', { folder: media.folder });
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
  }, [isVideo, isPlaying, videoReady, autoplayEnabled, validated, media.folder]);
  
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
          {isVideo ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src={resolvedSrc}
              crossOrigin="anonymous"
              preload="metadata"
              poster={posterSrc}
              muted={muteEnabled}
              loop
              playsInline
              onLoadedMetadata={() => { 
                console.log('[TILE] loadedMetadata', { folder: media.folder, src: resolvedSrc }); 
                setVideoReady(true);
                setIsLoaded(true);
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
              onCanPlay={() => { 
                console.log('[TILE] canPlay', { folder: media.folder }); 
                setVideoReady(true);
                setIsLoaded(true);
              }}
              onError={(e) => {
                console.error('[TILE] video error', { 
                  folder: media.folder, 
                  src: resolvedSrc,
                  error: e.currentTarget.error?.message 
                });
                diag('TILE', 'video_error', { 
                  folder: media.folder, 
                  src: resolvedSrc,
                  code: e.currentTarget.error?.code 
                });
                // Keep poster visible, don't block tile
                setIsLoaded(true);
              }}
              style={{ display: 'block' }}
            />
          ) : (
            <img
              src={resolvedSrc}
              alt={media.title}
              className="w-full h-full object-cover"
              onLoad={() => {
                console.log('[TILE] image loaded', { folder: media.folder });
                setIsLoaded(true);
              }}
              onError={(e) => {
                console.warn('[TILE] image error', { folder: media.folder, src: resolvedSrc });
                diag('TILE', 'image_error', { folder: media.folder, src: resolvedSrc });
                (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                setIsLoaded(true);
              }}
              style={{ display: 'block' }}
            />
          )}
          
          {/* Video Indicator */}
          {isVideo && (
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
            <div className="absolute bottom-2 right-2 bg-charcoal text-off-white text-xs font-medium px-2 py-1 rounded-full">
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