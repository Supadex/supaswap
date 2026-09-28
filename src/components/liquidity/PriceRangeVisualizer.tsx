import React from 'react';
import { Percent, TrendingUp } from 'lucide-react';
import { formatUSD } from '../../utils/formatters';


interface PriceRangeVisualizerProps {
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  isFullRange: boolean;
  token0Symbol: string;
  token1Symbol: string;
  onSetMinPrice?: (price: number) => void;
  onSetMaxPrice?: (price: number) => void;
  onToggleFullRange?: (full: boolean) => void;
}

export const PriceRangeVisualizer: React.FC<PriceRangeVisualizerProps> = ({
  currentPrice,
  minPrice,
  maxPrice,
  isFullRange,
  token0Symbol,
  token1Symbol,
  onSetMinPrice,
  onSetMaxPrice,
  onToggleFullRange,
}) => {
  // Compute price bounds & capital efficiency
  const inRange = !isFullRange && currentPrice >= minPrice && currentPrice <= maxPrice;
  const rangeWidth = maxPrice > minPrice ? (maxPrice - minPrice) / currentPrice : 1;
  const capitalEfficiency = isFullRange
    ? 1
    : Math.min(100, Math.max(1.5, Math.round((1 / (rangeWidth || 0.1)) * 4.2 * 10) / 10));

  // Visual position of current price within min/max bar
  const relativePercent = isFullRange
    ? 50
    : Math.max(5, Math.min(95, ((currentPrice - minPrice) / (maxPrice - minPrice || 1)) * 100));

  return (
    <div className="w-full rounded-2xl bg-neutral-100/80 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] p-4.5 space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-neutral-200 dark:bg-white/[0.08] flex items-center justify-center text-neutral-700 dark:text-neutral-300">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Concentrated Range
            </span>
          </div>
        </div>

        {/* Capital efficiency multiplier badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold">
          <Percent className="w-3 h-3" />
          <span>{capitalEfficiency}x Capital Efficiency</span>
        </div>
      </div>

      {/* Spot Price Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/[0.05]">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Current Spot Price:</span>
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-900 dark:text-white">
          <span>{formatUSD(currentPrice)}</span>
          <span className="text-neutral-400 font-normal">
            {token1Symbol} per {token0Symbol}
          </span>
        </div>
      </div>

      {/* Interactive Range Depth Bar */}
      <div className="relative pt-2 pb-1">
        <div className="h-3 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative">
          {/* Active Liquidity Region */}
          {isFullRange ? (
            <div className="absolute inset-0 bg-neutral-400/40 dark:bg-emerald-500/30" />
          ) : (
            <div
              className={`absolute top-0 bottom-0 ${
                inRange ? 'bg-emerald-500/40 dark:bg-emerald-500/50' : 'bg-amber-500/40 dark:bg-amber-500/50'
              } rounded-full`}
              style={{
                left: '10%',
                right: '10%',
              }}
            />
          )}

          {/* Spot price indicator line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-neutral-900 dark:bg-white shadow-md z-10 -ml-0.5 transition-all duration-300"
            style={{ left: `${relativePercent}%` }}
          />
        </div>

        {/* Labels below bar */}
        <div className="flex justify-between items-center mt-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          <span>{isFullRange ? '0' : formatUSD(minPrice)}</span>
          <span className={`font-semibold ${inRange ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
            {isFullRange ? 'Full Range Active' : inRange ? '● In Range' : '○ Out of Range'}
          </span>
          <span>{isFullRange ? '∞' : formatUSD(maxPrice)}</span>
        </div>
      </div>

      {/* Preset Quick Range Selectors */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {[
          { label: '±5%', pct: 0.05 },
          { label: '±15%', pct: 0.15 },
          { label: '±30%', pct: 0.3 },
          { label: 'Full', pct: 0, isFull: true },
        ].map((preset) => {
          const isActive = preset.isFull
            ? isFullRange
            : !isFullRange &&
              Math.abs(minPrice - currentPrice * (1 - preset.pct)) < currentPrice * 0.02;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                if (preset.isFull) {
                  onToggleFullRange?.(true);
                } else {
                  onToggleFullRange?.(false);
                  onSetMinPrice?.(Math.max(0.0001, currentPrice * (1 - preset.pct)));
                  onSetMaxPrice?.(currentPrice * (1 + preset.pct));
                }
              }}
              className={`py-1.5 px-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border ${
                isActive
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
