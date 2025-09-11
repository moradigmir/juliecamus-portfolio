import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { MediaItem } from '../hooks/useMediaIndex';

interface AutoMediaTileProps {
  media: MediaItem;
  index: number;
  onHover?: (index: number) => void;
  onLeave?: () => void;
  onClick?: (media: MediaItem) => void;
}

const AutoMediaTile = ({ media, index, onHover, onLeave, onClick }: AutoMediaTileProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [codecHint, setCodecHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleClick = () => {
    if (hasError) return;
    onClick?.(media);
  };

  const handleMouseEnter = () => {
    onHover?.(index);
    
    // Auto-play video on hover for video previews
    if (media.previewType === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  };

  const handleMouseLeave = () => {
    onLeave?.();
    
    // Reset and pause video on leave
    if (media.previewType === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const mimeType = (() => {
    try {
      const u = new URL(media.previewUrl, window.location.origin);
      const p = u.searchParams.get('path') || '';
      const lower = p.toLowerCase();
      if (lower.endsWith('.mp4')) return 'video/mp4';
      if (lower.endsWith('.mov')) return 'video/quicktime';
      if (lower.endsWith('.webm')) return 'video/webm';
      if (lower.endsWith('.m4v')) return 'video/x-m4v';
      return 'video/mp4';
    } catch {
      return 'video/mp4';
    }
  })();

  const cacheBustedUrl = `${media.previewUrl}${media.previewUrl.includes('?') ? '&' : '?'}r=${reloadKey}`;

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
        if (!(res.ok || res.status === 206)) return;
        const buf = new Uint8Array(await res.arrayBuffer());
        const ascii = new TextDecoder('ascii').decode(buf);
        let hint: string | null = null;
        if (ascii.includes('hvc1') || ascii.includes('hev1')) hint = 'HEVC (hvc1/hev1)';
        else if (ascii.includes('av01')) hint = 'AV1 (av01)';
        else if (ascii.includes('vp09')) hint = 'VP9 (vp09)';
        else if (ascii.includes('avc1') || ascii.includes('isom') || ascii.includes('mp41') || ascii.includes('mp42')) hint = 'H.264/AVC (avc1)';
        setCodecHint(hint);
      } catch (_) {
        // ignore
      }
    })();
    return () => controller.abort();
  }, [cacheBustedUrl, media.previewType]);

  return (
    <motion.div
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
              <p className="text-sm font-medium">Failed to load</p>
              {codecHint && (
                <p className="text-xs opacity-80 mt-1">Detected codec: {codecHint}</p>
              )}
              <p className="text-xs opacity-70 mt-1">If your browser doesn’t support this codec, try Safari or download the file.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setHasError(false);
                  setIsLoaded(false);
                  setReloadKey((k) => k + 1);
                }}
              >
                Retry
              </button>
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
              poster="/placeholder.svg"
              onLoadedData={() => setIsLoaded(true)}
              onError={(e) => {
                setHasError(true);
                const v = e.currentTarget;
                console.error('Video failed to load', {
                  src: v.currentSrc,
                  networkState: v.networkState,
                  readyState: v.readyState,
                  error: (v as any).error || null,
                });
              }}
              style={{ display: hasError ? 'none' : 'block' }}
            >
              <source src={cacheBustedUrl} type={mimeType} />
              Your browser does not support video playback.
            </video>
          ) : (
            <img
              src={media.previewUrl}
              alt={media.title}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              style={{ display: hasError ? 'none' : 'block' }}
            />
          )}
          
          {/* Video Indicator */}
          {media.fullType === 'video' && (
            <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
              <Play className="w-3 h-3 text-foreground" />
            </div>
          )}
          
          {/* Order Badge */}
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
            {media.orderKey}
          </div>
          
          {/* Overlay with Title */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="font-medium text-foreground text-sm mb-1">{media.title}</h3>
              <p className="text-xs text-muted-foreground">
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