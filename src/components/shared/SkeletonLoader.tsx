"use client";

import * as stylex from '@stylexjs/stylex';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
}

const styles = stylex.create({
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
  },
  rounded: {
    borderRadius: '50%',
  },
});

export function SkeletonLoader({ 
  width = '100%', 
  height = '1rem', 
  className,
  rounded = false 
}: SkeletonLoaderProps) {
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const combinedClassName = className 
    ? `skeleton-animation ${className}` 
    : 'skeleton-animation';
  
  return (
    <div
      {...stylex.props(
        styles.skeleton,
        rounded && styles.rounded
      )}
      className={combinedClassName}
      style={{ 
        width: widthValue, 
        height: heightValue,
      }}
      aria-label="Loading"
    />
  );
}
