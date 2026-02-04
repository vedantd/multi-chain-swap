"use client";

import * as stylex from '@stylexjs/stylex';

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

/**
 * Get a generic token icon as SVG data URL.
 */
function getGenericTokenIcon(): string {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E";
}

export function TokenLogo({ 
  tokenAddress, 
  chainId,
  tokenSymbol,
  size = 24, 
  alt = 'Token logo',
  className 
}: TokenLogoProps) {
  // Extract clean symbol from tokenSymbol (handle cases like "USDC • Ethereum")
  const cleanSymbol = tokenSymbol 
    ? tokenSymbol.split('•')[0].trim().toUpperCase()
    : null;
  
  // Extract token symbol from address for fallback display
  const fallbackText = cleanSymbol?.slice(0, 2) || tokenAddress.slice(0, 2).toUpperCase();
  const imageUrl = getGenericTokenIcon();

  return (
    <div 
      {...stylex.props(styles.container, className)} 
      style={{ width: size, height: size }}
    >
      <div
        {...stylex.props(styles.fallback)}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: decodeURIComponent(imageUrl.split(',')[1]) }}
        aria-label={alt}
      />
    </div>
  );
}
