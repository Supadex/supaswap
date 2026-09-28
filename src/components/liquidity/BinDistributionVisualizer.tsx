import React, { useState } from 'react';
import { BarChart2, Activity } from 'lucide-react';
import { formatUSD } from '../../utils/formatters';

export type BinShape = 'spot' | 'curve' | 'bid_ask' | 'wide';

interface BinDistributionVisualizerProps {
  currentPrice: number;
  binStepBps: number;
  shape: BinShape;
  binCount?: number;
  onSelectShape: (shape: BinShape) => void;
  onSelectBinStep?: (bps: number) => void;
}

export const BinDistributionVisualizer: React.FC<BinDistributionVisualizerProps> = ({
  currentPrice,
  binStepBps,
  shape,
  binCount = 14,
  onSelectShape,
  onSelectBinStep,
}) => {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  // Generate bins data based on shape and step
  const bins = React.useMemo(() => {
    const half = Math.floor(binCount / 2);
    const stepRatio = binStepBps / 10000;

    return Array.from({ length: binCount }, (_, i) => {
      const offset = i - half;
      const binPrice = currentPrice * (1 + offset * stepRatio);
      let weight = 0;

      if (shape === 'spot') {
        // High concentration near center
        const dist = Math.abs(offset);
        weight = dist === 0 ? 100 : dist <= 2 ? 60 - dist * 20 : 10;
      } else if (shape === 'curve') {
        // Gaussian bell curve
        const sigma = half / 2;
        weight = Math.round(100 * Math.exp(-0.5 * Math.pow(offset / sigma, 2)));
      } else if (shape === 'bid_ask') {
        // Asymmetric bid-ask spread
        weight = offset < 0 ? 40 + Math.abs(offset) * 8 : 70 - offset * 8;
      } else {
        // Wide / Uniform
        weight = 75;
      }

      return {
        index: i,
        offset,
        price: binPrice,
        weight: Math.max(10, weight),
        isCurrent: offset === 0,
      };
    });
  }, [binCount, binStepBps, currentPrice, shape]);

  const activeBin = hoveredBin !== null ? bins[hoveredBin] : bins.find((b) => b.isCurrent);

  return (
    <div className="w-full rounded-2xl bg-neutral-100/80 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] p-4.5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Discretized Bins (0-Slippage)
            </span>
          </div>
        </div>

        {/* Bin Step Selector */}
        <div className="flex items-center gap-1 bg-white dark:bg-white/[0.05] p-0.5 rounded-lg border border-neutral-200 dark:border-white/[0.06]">
          {[10, 25, 50].map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => onSelectBinStep?.(bps)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-all ${
                binStepBps === bps
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {bps} bps
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Bin Depth Histogram */}
      <div className="space-y-2">
        <div className="h-28 flex items-end justify-between gap-1 pt-4 px-1 pb-1 rounded-xl bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/[0.05]">
          {bins.map((bin) => {
            const isHovered = hoveredBin === bin.index;
            return (
              <div
                key={bin.index}
                onMouseEnter={() => setHoveredBin(bin.index)}
                onMouseLeave={() => setHoveredBin(null)}
                className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
              >
                {/* Visual Bar */}
                <div
                  className={`w-full rounded-t-sm transition-all duration-200 ${
                    bin.isCurrent
                      ? 'bg-emerald-500 dark:bg-emerald-400'
                      : isHovered
                      ? 'bg-purple-500 dark:bg-purple-400'
                      : 'bg-neutral-300 dark:bg-neutral-700 group-hover:bg-purple-400/80'
                  }`}
                  style={{ height: `${bin.weight}%` }}
                />

                {/* Spot Dot */}
                {bin.isCurrent && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Dynamic Bin Information Tooltip Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-200/60 dark:bg-white/[0.04] text-xs font-mono">
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            <Activity className="w-3.5 h-3.5 text-neutral-400" />
            <span>Bin Price: {activeBin ? formatUSD(activeBin.price) : '-'}</span>
          </div>
          <div className="text-neutral-500 dark:text-neutral-400">
            {activeBin?.isCurrent ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ● Active Spot Bin
              </span>
            ) : (
              <span>Depth Weight: {activeBin?.weight}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Preset Shape Selectors */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { id: 'spot', label: 'Spot Focus' },
          { id: 'curve', label: 'Gaussian' },
          { id: 'bid_ask', label: 'Bid-Ask' },
          { id: 'wide', label: 'Uniform' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectShape(item.id as BinShape)}
            className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
              shape === item.id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                : 'bg-white dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
