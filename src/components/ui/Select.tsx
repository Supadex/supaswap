import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  label,
  error,
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className={cn('relative w-full space-y-1.5', className)}>
      {label && (
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
      )}

      {/* Select Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between bg-neutral-100 dark:bg-[#181A20] text-neutral-900 dark:text-white text-sm rounded-xl px-3.5 py-2.5 border border-neutral-200 dark:border-white/[0.08] transition-all duration-150 outline-none hover:border-neutral-300 dark:hover:border-white/20 focus:border-neutral-400 dark:focus:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          isOpen && 'border-neutral-400 dark:border-white/30 ring-1 ring-neutral-300 dark:ring-white/20',
          error && 'border-red-500/50'
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-medium">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-neutral-400 dark:text-neutral-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-neutral-400 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#14161B] border border-neutral-200 dark:border-white/[0.1] rounded-xl shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white font-medium'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.05] hover:text-neutral-900 dark:hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <div>
                    <div>{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-neutral-400 dark:text-neutral-500">{option.description}</div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-neutral-900 dark:text-white shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
};
