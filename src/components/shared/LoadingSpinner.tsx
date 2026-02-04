"use client";

import * as stylex from '@stylexjs/stylex';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

const styles = stylex.create({
  spinner: {
    display: 'inline-block',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderTop: '2px solid var(--foreground)',
    borderRadius: '50%',
  },
});

export function LoadingSpinner({ size = 20, className }: LoadingSpinnerProps) {
  const combinedClassName = className 
    ? `spinner-animation ${className}` 
    : 'spinner-animation';
  
  return (
    <div
      {...stylex.props(styles.spinner)}
      className={combinedClassName}
      style={{ 
        width: size, 
        height: size,
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
