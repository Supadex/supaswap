import React from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

export interface TokenAmountInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  tokenSymbol?: string;
  tokenIcon?: React.ReactNode;
  usdValue?: string;
  balance?: string;
  onSelectToken?: () => void;
  onMaxClick?: () => void;
  onHalfClick?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  isVaultClaim?: boolean;
}

export const TokenAmountInput: React.FC<TokenAmountInputProps> = ({
  label,
  value,
  onChange,
  tokenSymbol = 'ETH',
  tokenIcon,
  usdValue,
  balance,
  onSelectToken,
  onMaxClick,
  onHalfClick,
  disabled = false,
  readOnly = false,
  className,
  isVaultClaim = false,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/,/g, '.');
    // Allow empty string or valid decimal numbers
    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div
      className={cn(
        'w-full bg-neutral-100 dark:bg-[#181A20] rounded-2xl p-4 border border-neutral-200 dark:border-white/[0.08] transition-all duration-150 focus-within:border-neutral-400 dark:focus-within:border-white/20',
        className
      )}
    >
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
        <span className="font-medium">{label || 'You pay'}</span>
        {balance && (
          <div className="flex items-center gap-1.5">
            <span>Balance: {balance}</span>
            {isVaultClaim && (
              <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-md font-mono">
                ERC-6909
              </span>
            )}
            {onHalfClick && (
              <button
                type="button"
                onClick={onHalfClick}
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-80 px-1 py-0.5 rounded cursor-pointer transition-opacity"
              >
                Half
              </button>
            )}
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-80 px-1 py-0.5 rounded cursor-pointer transition-opacity"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          pattern="^[0-9]*[.,]?[0-9]*$"
          placeholder="0"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          readOnly={readOnly}
          className="w-full bg-transparent text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none"
        />

        <button
          type="button"
          onClick={onSelectToken}
          disabled={disabled || !onSelectToken}
          className={cn(
            'flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-full font-medium text-sm transition-all',
            'bg-white dark:bg-[#111317] border border-neutral-200 dark:border-white/[0.1] hover:bg-neutral-50 dark:hover:bg-white/[0.06] text-neutral-900 dark:text-white shadow-sm cursor-pointer'
          )}
        >
          {tokenIcon ? (
            <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center shrink-0">
              {tokenIcon}
            </span>
          ) : (
            <span className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 text-[10px] flex items-center justify-center font-bold text-neutral-700 dark:text-neutral-300 shrink-0">
              {tokenSymbol.slice(0, 2)}
            </span>
          )}
          <span className="font-semibold">{tokenSymbol}</span>
          {onSelectToken && <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 mt-2">
        <span>{usdValue ? `~$${usdValue}` : '$0.00'}</span>
      </div>
    </div>
  );
};
