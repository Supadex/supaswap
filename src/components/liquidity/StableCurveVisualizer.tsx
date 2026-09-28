import React from 'react';
import { SlidersHorizontal, Coins } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

interface StableCurveVisualizerProps {
  ampFactor: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Amount: string;
  token1Amount: string;
  onSelectAmp?: (amp: number) => void;
}

export const StableCurveVisualizer: React.FC<StableCurveVisualizerProps> = ({
  ampFactor = 100,
  token0Symbol,
  token1Symbol,
  token0Amount,
  token1Amount,
  onSelectAmp,
}) => {
  const num0 = parseFloat(token0Amount) || 0;
  const num1 = parseFloat(token1Amount) || 0;
  const total = num0 + num1;
  const ratio0 = total > 0 ? (num0 / total) * 100 : 50;
  const ratio1 = total > 0 ? (num1 / total) * 100 : 50;

  return (
    <div className="w-full rounded-2xl bg-neutral-100/80 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] p-4.5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Coins className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              StableSwap Invariant Matrix
            </span>
          </div>
        </div>

        {/* Amplification Factor Picker */}
        <div className="flex items-center gap-1 bg-white dark:bg-white/[0.05] p-0.5 rounded-lg border border-neutral-200 dark:border-white/[0.06]">
          {[50, 100, 500].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onSelectAmp?.(a)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-all ${
                ampFactor === a
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              A={a}
            </button>
          ))}
        </div>
      </div>

      {/* Deposit Peg Balance Ratio Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-neutral-600 dark:text-neutral-300">
            {token0Symbol}: {formatPercent(ratio0, 1)}
          </span>
          <span className="text-neutral-600 dark:text-neutral-300">
            {token1Symbol}: {formatPercent(ratio1, 1)}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex">
          <div
            className="bg-blue-500 dark:bg-blue-400 transition-all duration-300"
            style={{ width: `${ratio0}%` }}
          />
          <div
            className="bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
            style={{ width: `${ratio1}%` }}
          />
        </div>
      </div>

      {/* Zero Slippage Band Summary */}
      <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/[0.05] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Virtual Price Peg:</span>
        </div>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          1.0000 ± 0.0001 (0.01% Flat Fee)
        </span>
      </div>
    </div>
  );
};
