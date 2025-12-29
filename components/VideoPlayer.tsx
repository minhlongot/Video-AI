import React from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className, autoPlay = false }) => {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-black ${className}`}>
      <video 
        src={src} 
        controls 
        className="w-full h-full object-contain"
        autoPlay={autoPlay}
      />
    </div>
  );
};