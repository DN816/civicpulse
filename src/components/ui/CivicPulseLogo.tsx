import React from 'react';

export const CIVICPULSE_LOGO_SRC = '/civicpulse-logo.png';

const SIZE_CLASSES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
} as const;

interface CivicPulseLogoProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  imageClassName?: string;
  showWordmark?: boolean;
  wordmark?: string;
  wordmarkClassName?: string;
}

export default function CivicPulseLogo({
  size = 'md',
  className = '',
  imageClassName = '',
  showWordmark = false,
  wordmark = 'CivicPulse',
  wordmarkClassName = '',
}: CivicPulseLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={CIVICPULSE_LOGO_SRC}
        alt="CivicPulse logo"
        className={`${SIZE_CLASSES[size]} shrink-0 object-contain ${imageClassName}`}
      />
      {showWordmark && (
        <span className={`font-display font-bold tracking-tight text-primary ${wordmarkClassName}`}>
          {wordmark}
        </span>
      )}
    </div>
  );
}
