import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MediaItem } from '../lib/mediaConfig';

interface MediaTileProps {
  media: MediaItem;
  index: number;
  onHover?: (index: number) => void;
  onLeave?: () => void;
  onClick?: (media: MediaItem) => void;
}

const MediaTile = ({ media, index, onHover, onLeave, onClick }: MediaTileProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.(media);
  };

  const handleMouseEnter = () => {
    onHover?.(index);
  };

  const handleMouseLeave = () => {
    onLeave?.();
  };

  return (
    <motion.div
      className="gallery-tile group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="relative overflow-hidden bg-muted rounded-lg aspect-[3/4]">
        {/* Loading state */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-muted-foreground text-sm">Unable to load media</p>
          </div>
        )}

        {/* Media content */}
        {media.type === 'video' ? (
          <iframe
            src={media.previewUrl}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        ) : (
          <img
            src={media.previewUrl}
            alt={media.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <h3 className="font-playfair text-white text-lg font-semibold">
            {media.title}
          </h3>
          {media.category && (
            <p className="font-inter text-white/80 text-sm mt-1">
              {media.category}
            </p>
          )}
        </div>

        {/* Video indicator */}
        {media.type === 'video' && (
          <div className="absolute top-4 right-4">
            <div className="bg-black/60 rounded-full p-2">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MediaTile;