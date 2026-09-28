import React from 'react';
import { cn } from '../../utils/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}) => {
  const switchSizes = {
    sm: 'w-8 h-4.5',
    md: 'w-11 h-6',
  };

  const thumbSizes = {
    sm: 'w-3.5 h-3.5 translate-x-0.5',
    md: 'w-5 h-5 translate-x-0.5',
  };

  const thumbTranslate = {
    sm: 'translate-x-4',
    md: 'translate-x-5.5',
  };

  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>}
          {description && <span className="text-xs text-neutral-500 dark:text-neutral-400">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 cursor-pointer',
          switchSizes[size],
          checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-white/10'
        )}
      >
        <span
          className={cn(
            'inline-block rounded-full shadow transform transition-transform duration-200 bg-white',
            thumbSizes[size],
            checked ? thumbTranslate[size] : ''
          )}
        />
      </button>
    </label>
  );
};
