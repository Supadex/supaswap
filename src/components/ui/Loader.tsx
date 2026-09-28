import React from 'react';
import { cn } from '../../utils/cn';

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'bar';
}

export const Loader: React.FC<LoaderProps> = ({
  className,
  size = 'md',
  variant = 'spinner',
  ...props
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (variant === 'spinner') {
    return (
      <div className={cn('flex items-center justify-center', className)} {...props}>
        <svg
          className={cn('animate-spin text-neutral-900 dark:text-white', sizes[size])}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={cn('w-full bg-neutral-200 dark:bg-white/10 h-1 overflow-hidden rounded-full', className)} {...props}>
        <div className="bg-neutral-900 dark:bg-white h-full w-1/3 animate-pulse rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-1.5 text-neutral-900 dark:text-white', className)} {...props}>
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
    </div>
  );
};
