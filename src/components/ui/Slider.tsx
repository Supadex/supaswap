import React from 'react';
import { cn } from '../../utils/cn';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  valueDisplay?: string | React.ReactNode;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  valueDisplay,
  className,
  disabled = false,
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={cn('w-full space-y-2', className)}>
      {(label || valueDisplay) && (
        <div className="flex items-center justify-between text-xs font-medium">
          {label && <span className="text-neutral-500 dark:text-neutral-400">{label}</span>}
          {valueDisplay && <span className="text-neutral-900 dark:text-white font-mono">{valueDisplay}</span>}
        </div>
      )}
      <div className="relative flex items-center h-5">
        {/* Track Background */}
        <div className="absolute w-full h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-75" style={{ width: `${percentage}%` }} />
        </div>
        {/* HTML Input Range */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />
        {/* Apple-style Handle */}
        <div
          className="absolute w-4 h-4 bg-white border border-neutral-300 dark:border-none rounded-full shadow-md pointer-events-none transform -translate-x-1/2 transition-transform active:scale-110"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
