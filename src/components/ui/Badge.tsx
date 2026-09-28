import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'brand';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none';

  const variants = {
    default:
      'bg-neutral-200/80 text-neutral-800 dark:bg-white/10 dark:text-white/90 border border-neutral-300/80 dark:border-white/5',
    outline:
      'border border-neutral-300 text-neutral-700 dark:border-white/20 dark:text-white/80',
    success:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    danger:
      'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    info:
      'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
    purple:
      'bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20',
    brand:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
