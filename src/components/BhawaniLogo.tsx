import React, { useState } from 'react';

interface BhawaniLogoProps {
  variant?: 'horizontal' | 'stacked' | 'mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark';
  className?: string;
  showSubtitle?: boolean;
  useImage?: boolean;
}

export const BhawaniLogo: React.FC<BhawaniLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme = 'light',
  className = '',
  showSubtitle = true,
  useImage = true,
}) => {
  const [imgError, setImgError] = useState(false);

  // Height mappings for image & container
  const imgHeightClass = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-20',
  }[size];

  const stackedHeightClass = {
    xs: 'h-10',
    sm: 'h-14',
    md: 'h-20',
    lg: 'h-28',
    xl: 'h-36',
  }[size];

  const markPixelSize = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  }[size];

  // Render from uploaded PNG assets if enabled and error-free
  if (useImage && !imgError) {
    if (variant === 'mark') {
      return (
        <img
          src="/bhawani-emblem.png"
          alt="Bhawani Logo Emblem"
          width={markPixelSize}
          height={markPixelSize}
          className={`object-contain shrink-0 ${className}`}
          onError={() => setImgError(true)}
        />
      );
    }

    if (variant === 'stacked') {
      return (
        <div className={`flex flex-col items-center text-center ${className}`}>
          <img
            src="/bhawani-logo.png"
            alt="Bhawani Marketing Pvt Ltd"
            className={`object-contain ${stackedHeightClass}`}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    // Default: 'horizontal'
    return (
      <div className={`inline-flex items-center ${className}`}>
        <img
          src="/bhawani-logo-horizontal.png"
          alt="Bhawani Marketing Pvt Ltd"
          className={`object-contain ${imgHeightClass} w-auto`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Dimension mappings for fallback SVG
  const markSize = markPixelSize;

  // SVG Emblem Mark (The official Bhawani faceted starburst/crystal emblem)
  const renderEmblem = (s: number = markSize) => (
    <svg
      viewBox="0 0 320 320"
      width={s}
      height={s}
      className="shrink-0 drop-shadow-xs"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ aspectRatio: '1 / 1' }}
      aria-label="Bhawani Marketing Pvt Ltd Logo Emblem"
    >
      <g transform="translate(160, 160) scale(0.95)">
        {/* Blue Sector (Lower & Right Facets) */}
        <path d="M 32 -38 L 85 -22 L 115 -20 L 78 5 L 28 -8 Z" fill="#0ea5e9" />
        <path d="M 78 5 L 122 -18 L 138 -6 L 95 24 L 28 -8 Z" fill="#0284c7" />
        <path d="M 28 -8 L 95 24 L 110 38 L 72 52 L 20 12 Z" fill="#0066ff" />
        <path d="M 20 12 L 72 52 L 94 72 L 55 82 L 10 32 Z" fill="#0284c7" />
        <path d="M 10 32 L 55 82 L 68 112 L 32 108 L 2 48 Z" fill="#0ea5e9" />
        <path d="M 2 48 L 32 108 L 28 128 L 5 125 L -8 56 Z" fill="#0052cc" />

        {/* Bottom Center Blue */}
        <path d="M -8 56 L 5 125 L -5 132 L -18 130 L -22 62 Z" fill="#1d4ed8" />
        <path d="M -22 62 L -18 130 L -38 126 L -36 62 Z" fill="#2563eb" />
        <path d="M -36 62 L -38 126 L -58 118 L -48 58 Z" fill="#0284c7" />
        <path d="M -48 58 L -58 118 L -72 102 L -58 48 Z" fill="#0ea5e9" />
        <path d="M -58 48 L -72 102 L -88 82 L -66 36 Z" fill="#0066ff" />

        {/* Blue Mid Facets & Highlights */}
        <path d="M 5 -12 L 48 18 L 38 48 L -2 22 Z" fill="#38bdf8" opacity="0.95" />
        <path d="M 12 18 L 48 42 L 32 78 L -2 46 Z" fill="#0052cc" />
        <path d="M -15 28 L 15 58 L -2 92 L -28 52 Z" fill="#1d4ed8" />
        <path d="M 22 -6 L 68 -2 L 52 28 L 12 18 Z" fill="#0284c7" />
        <path d="M 38 -25 L 82 -12 L 62 15 L 25 -5 Z" fill="#38bdf8" />
        <path d="M -28 35 L -10 75 L -35 105 L -52 52 Z" fill="#0066ff" />

        {/* Transition Corner Facets */}
        <path d="M -35 -25 L -20 18 L -55 32 L -65 -15 Z" fill="#0284c7" />
        <path d="M 18 -42 L 52 -32 L 35 -15 L 8 -22 Z" fill="#00a884" />
        <path d="M -15 -48 L 15 -42 L -5 -25 L -28 -32 Z" fill="#10b981" />

        {/* Green Sector (Upper & Left Facets) */}
        <path d="M -66 36 L -88 82 L -105 68 L -76 22 Z" fill="#16a34a" />
        <path d="M -76 22 L -105 68 L -122 45 L -84 8 Z" fill="#22c55e" />
        <path d="M -84 8 L -122 45 L -130 22 L -88 -6 Z" fill="#15803d" />
        <path d="M -88 -6 L -130 22 L -135 -5 L -86 -22 Z" fill="#4ade80" />
        <path d="M -86 -22 L -135 -5 L -128 -32 L -78 -36 Z" fill="#16a34a" />

        {/* Upper Left Green */}
        <path d="M -78 -36 L -128 -32 L -115 -58 L -64 -48 Z" fill="#22c55e" />
        <path d="M -64 -48 L -115 -58 L -95 -85 L -48 -58 Z" fill="#4ade80" />
        <path d="M -48 -58 L -95 -85 L -72 -108 L -32 -65 Z" fill="#15803d" />
        <path d="M -32 -65 L -72 -108 L -45 -122 L -16 -68 Z" fill="#22c55e" />
        <path d="M -16 -68 L -45 -122 L -20 -130 L -2 -70 Z" fill="#16a34a" />

        {/* Top Green Facets */}
        <path d="M -2 -70 L -20 -130 L 8 -128 L 12 -65 Z" fill="#4ade80" />
        <path d="M 12 -65 L 8 -128 L 32 -118 L 25 -58 Z" fill="#86efac" />
        <path d="M 25 -58 L 32 -118 L 55 -102 L 36 -48 Z" fill="#22c55e" />
        <path d="M 36 -48 L 55 -102 L 75 -78 L 45 -36 Z" fill="#16a34a" />
        <path d="M 45 -36 L 75 -78 L 95 -55 L 48 -22 Z" fill="#4ade80" />

        {/* Green Mid Facets & Highlights */}
        <path d="M -45 -15 L -25 -45 L 8 -35 L -12 -12 Z" fill="#4ade80" />
        <path d="M -58 2 L -35 -28 L -15 -8 L -42 18 Z" fill="#22c55e" />
        <path d="M -65 22 L -45 -8 L -25 15 L -52 38 Z" fill="#16a34a" />
        <path d="M -35 -48 L -8 -38 L 15 -55 L -15 -62 Z" fill="#86efac" />
        <path d="M -52 -32 L -25 -55 L -38 -75 L -68 -48 Z" fill="#15803d" />

        {/* Inner Central Diamond Negative Space */}
        <polygon points="-28,-18 12,-38 38,15 -2,35" fill="#ffffff" />
      </g>
    </svg>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderEmblem()}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {renderEmblem(size === 'xl' ? 96 : size === 'lg' ? 72 : 52)}
        <div className="mt-3">
          <span
            className={`block font-black tracking-wider leading-none ${
              theme === 'dark' ? 'text-blue-400' : 'text-[#0055ff]'
            } ${
              size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-base'
            }`}
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            BHAWANI
          </span>
          {showSubtitle && (
            <span
              className={`block mt-1 uppercase font-bold tracking-[0.2em] leading-none ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              } ${size === 'xl' ? 'text-xs' : size === 'lg' ? 'text-[11px]' : 'text-[9px]'}`}
            >
              MARKETING PVT LTD
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: 'horizontal'
  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      {renderEmblem(markSize)}
      <div className="flex flex-col justify-center leading-none">
        <span
          className={`font-black tracking-wide leading-none ${
            theme === 'dark' ? 'text-white' : 'text-[#0055ff]'
          } ${size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'}`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          BHAWANI
        </span>
        {showSubtitle && (
          <span
            className={`uppercase font-bold tracking-[0.16em] leading-tight mt-0.5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            } ${size === 'xs' ? 'text-[7px]' : size === 'sm' ? 'text-[8px]' : 'text-[9px]'}`}
          >
            MARKETING PVT LTD
          </span>
        )}
      </div>
    </div>
  );
};
