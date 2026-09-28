import React from 'react';
import { cn } from '../../utils/cn';
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'error' | 'success' | 'lvr';
  title?: string;
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'info',
  title,
  icon,
  children,
  ...props
}) => {
  const variants = {
    info: 'bg-sky-500/10 border-sky-500/20 text-sky-800 dark:text-sky-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300',
    error: 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-300',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300',
    lvr: 'bg-purple-500/10 border-purple-500/20 text-purple-800 dark:text-purple-300',
  };

  const defaultIcons = {
    info: <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    lvr: <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />,
  };

  return (
    <div
      className={cn('flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed', variants[variant], className)}
      {...props}
    >
      {icon || defaultIcons[variant]}
      <div className="flex-1">
        {title && <h5 className="font-semibold text-neutral-900 dark:text-white mb-0.5">{title}</h5>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
};
