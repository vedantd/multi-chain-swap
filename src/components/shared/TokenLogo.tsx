"use client";

import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { getTokenLogoUrl, getGenericTokenIcon } from '@/lib/utils/tokenLogo';

interface TokenLogoProps {
  tokenAddress: string;
  chainId?: number;
  tokenSymbol?: string;
  size?: number;
  alt?: string;
  className?: string;
}

const styles = stylex.create({
  container: {
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: '50%',
    objectFit: 'cover',
  },
  fallback: {
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted-foreground)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
});

export function TokenLogo({ 
  tokenAddress, 
  chainId,
  tokenSymbol,
  size = 24, 
  alt = 'Token logo',
}: TokenLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Extract clean symbol from tokenSymbol (handle cases like "USDC • Ethereum")
  const cleanSymbol =
    typeof tokenSymbol === "string" && tokenSymbol.length > 0
      ? (tokenSymbol.split("•")[0]?.trim() ?? tokenSymbol.trim()).toUpperCase()
      : null;

  const logoUrl = getTokenLogoUrl(tokenAddress, chainId, cleanSymbol || undefined);
  
  // Debug: Log when USDC logo is requested
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    if (cleanSymbol === 'USDC' || tokenAddress.toLowerCase().includes('usdc') || tokenAddress.toLowerCase().includes('a0b86991')) {
      console.log('[TokenLogo] USDC logo request', { tokenAddress, chainId, tokenSymbol, cleanSymbol, logoUrl });
    }
  }
  
  const displayUrl = imgError || !logoUrl ? getGenericTokenIcon() : logoUrl;

  const handleImageError = () => {
    if (retryCount < 3 && logoUrl) {
      // Try different URL formats
      setRetryCount((prev) => prev + 1);
    } else {
      setImgError(true);
    }
  };

  // Try different URL formats on retry
  let imageUrl = displayUrl;
  if (retryCount === 1 && logoUrl && !logoUrl.includes('data:')) {
    // Try capitalized filename (e.g., "Usd-coin" or "USD-Coin")
    imageUrl = logoUrl.replace(/\/small\/([^/]+)\.png$/, (match, name) => {
      // Capitalize first letter of each word (e.g., "usd-coin" -> "Usd-Coin")
      const capitalized = name.split('-').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('-');
      return `/small/${capitalized}.png`;
    });
  } else if (retryCount === 2 && logoUrl && !logoUrl.includes('data:')) {
    // Try 'thumb' size instead of 'small'
    imageUrl = logoUrl.replace('/small/', '/thumb/');
  } else if (retryCount === 3 && logoUrl && !logoUrl.includes('data:')) {
    // Try alternative CDN domain
    imageUrl = logoUrl.replace('assets.coingecko.com', 'coin-images.coingecko.com');
  }

  return (
    <div 
    {...stylex.props(styles.container)}

      style={{ width: size, height: size }}
    >
      {imageUrl.startsWith('data:image/svg+xml') ? (
        // Generic SVG fallback
        <div
          {...stylex.props(styles.fallback)}
          style={{ width: size, height: size }}
          dangerouslySetInnerHTML={{
            __html: decodeURIComponent(imageUrl.split(",")[1] ?? "")
          }}
          
          
          aria-label={alt}
        />
      ) : (
        <img
          src={imageUrl}
          alt={alt}
          width={size}
          height={size}
          {...stylex.props(styles.image)}
          onError={() => {
            handleImageError();
            if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
              console.warn('[TokenLogo] Image failed to load', { imageUrl, tokenAddress, tokenSymbol, cleanSymbol, retryCount });
            }
          }}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
          loading="lazy"
        />
      )}
    </div>
  );
}
