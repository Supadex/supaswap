import React, { useState, useMemo } from 'react';
import { CurveType } from '../../contracts/types';
import { formatUSD, formatPercent } from '../../utils/formatters';
import { Activity, Percent, TrendingUp, BarChart2, Coins, Lock, SlidersHorizontal } from 'lucide-react';
import type { BinShape } from './BinDistributionVisualizer';

interface InteractiveLiquidityGraphProps {
  curveType: CurveType;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  isFullRange: boolean;
  binStepBps: number;
  binShape: BinShape;
  ampFactor: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Amount: string;
  token1Amount: string;
  /** CLAMM ticks that will be sent on-chain */
  tickLower?: number;
  tickUpper?: number;
  /** BinAMM bin id that will be sent as tickLower */
  selectedBinId?: number;
  /** Whether spot price came from on-chain slot0 */
  priceFromChain?: boolean;
  onSetMinPrice?: (p: number) => void;
  onSetMaxPrice?: (p: number) => void;
  onToggleFullRange?: (f: boolean) => void;
  onSelectBinShape?: (s: BinShape) => void;
  onSelectBinStep?: (bps: number) => void;
  onSelectAmp?: (a: number) => void;
}

export const InteractiveLiquidityGraph: React.FC<InteractiveLiquidityGraphProps> = ({
  curveType,
  currentPrice,
  minPrice,
  maxPrice,
  isFullRange,
  binStepBps,
  binShape,
  ampFactor,
  token0Symbol,
  token1Symbol,
  token0Amount,
  token1Amount,
  tickLower,
  tickUpper,
  selectedBinId,
  priceFromChain = false,
  onSetMinPrice,
  onSetMaxPrice,
  onToggleFullRange,
  onSelectBinShape,
  onSelectBinStep,
  onSelectAmp,
}) => {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  // Capital Efficiency for CLAMM
  const rangeWidth = maxPrice > minPrice ? (maxPrice - minPrice) / currentPrice : 1;
  const capitalEfficiency = isFullRange
    ? 1
    : Math.min(100, Math.max(1.5, Math.round((1 / (rangeWidth || 0.1)) * 4.2 * 10) / 10));

  const inRange = !isFullRange && currentPrice >= minPrice && currentPrice <= maxPrice;

  // BinAMM Data Generator
  const binCount = 18;
  const bins = useMemo(() => {
    const half = Math.floor(binCount / 2);
    const stepRatio = binStepBps / 10000;

    return Array.from({ length: binCount }, (_, i) => {
      const offset = i - half;
      const binPrice = currentPrice * (1 + offset * stepRatio);
      let weight = 0;

      if (binShape === 'spot') {
        const dist = Math.abs(offset);
        weight = dist === 0 ? 100 : dist <= 2 ? 70 - dist * 25 : 12;
      } else if (binShape === 'curve') {
        const sigma = half / 2.2;
        weight = Math.round(100 * Math.exp(-0.5 * Math.pow(offset / sigma, 2)));
      } else if (binShape === 'bid_ask') {
        weight = offset < 0 ? 35 + Math.abs(offset) * 10 : 80 - offset * 10;
      } else {
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
  }, [binCount, binStepBps, currentPrice, binShape]);

  const activeBin = hoveredBin !== null ? bins[hoveredBin] : bins.find((b) => b.isCurrent);

  // StableAMM Ratios
  const num0 = parseFloat(token0Amount) || 0;
  const num1 = parseFloat(token1Amount) || 0;
  const total = num0 + num1;
  const ratio0 = total > 0 ? (num0 / total) * 100 : 50;
  const ratio1 = total > 0 ? (num1 / total) * 100 : 50;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-6">
      {/* Top Header of Visualizer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/[0.06] flex items-center justify-center text-neutral-800 dark:text-neutral-200">
            {curveType === CurveType.CLAMM ? (
              <TrendingUp className="w-4 h-4" />
            ) : curveType === CurveType.BIN_AMM ? (
              <BarChart2 className="w-4 h-4" />
            ) : (
              <Coins className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              {curveType === CurveType.CLAMM
                ? 'Concentrated Liquidity Graph'
                : curveType === CurveType.BIN_AMM
                ? 'Discretized Bin Distribution'
                : 'StableSwap Invariant Curve'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Interactive market depth & price space
            </p>
          </div>
        </div>

        {/* Status / Multiplier Badge */}
        {curveType === CurveType.CLAMM && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold">
            <Percent className="w-3.5 h-3.5" />
            <span>{capitalEfficiency}x Capital Efficiency</span>
          </div>
        )}

        {curveType === CurveType.BIN_AMM && (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/[0.05] p-0.5 rounded-xl border border-neutral-200 dark:border-white/[0.06]">
            {[10, 25, 50].map((bps) => (
              <button
                key={bps}
                type="button"
                onClick={() => onSelectBinStep?.(bps)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg cursor-pointer transition-all ${
                  binStepBps === bps
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-bold shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {bps} bps
              </button>
            ))}
          </div>
        )}

        {curveType === CurveType.STABLE_AMM && (
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/[0.05] p-0.5 rounded-xl border border-neutral-200 dark:border-white/[0.06]">
            {[50, 100, 500].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onSelectAmp?.(a)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg cursor-pointer transition-all ${
                  ampFactor === a
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-bold shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                A={a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spot Price Reference Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>{priceFromChain ? 'On-chain slot0 price:' : 'Market reference price:'}</span>
        </div>
        <div className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
          {formatUSD(currentPrice)} {token1Symbol} per {token0Symbol}
        </div>
      </div>

      {curveType === CurveType.CLAMM && tickLower !== undefined && tickUpper !== undefined && (
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          <span>tickLower: {tickLower}</span>
          <span>tickUpper: {tickUpper}</span>
        </div>
      )}

      {curveType === CurveType.BIN_AMM && selectedBinId !== undefined && (
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          <span>Active bin id (tickLower): {selectedBinId}</span>
          <span>step: {binStepBps} bps</span>
        </div>
      )}

      {/* Main Graph Area */}
      <div className="flex-1 min-h-[260px] flex flex-col justify-center">
        {/* 1. CLAMM GRAPH */}
        {curveType === CurveType.CLAMM && (
          <div className="space-y-6">
            {/* SVG Concentration Curve Visualization */}
            <div className="relative h-48 w-full bg-neutral-50 dark:bg-black/30 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-4 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="clammGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="120" x2="400" y2="120" stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="400" y2="60" stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" strokeWidth="1" strokeDasharray="4 4" />

                {/* Concentrated Depth Bell Curve */}
                {isFullRange ? (
                  <rect x="20" y="50" width="360" height="70" fill="url(#clammGrad)" rx="6" />
                ) : (
                  <path
                    d="M 40 120 C 120 120, 160 30, 200 30 C 240 30, 280 120, 360 120 Z"
                    fill="url(#clammGrad)"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                )}

                {/* Current Price Vertical Cursor */}
                <line x1="200" y1="10" x2="200" y2="135" stroke="currentColor" className="text-neutral-900 dark:text-white" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="200" cy="30" r="4" fill="#22c55e" stroke="white" strokeWidth="2" />
              </svg>

              {/* Float Tag for Spot */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black font-mono text-[10px] font-bold shadow-sm">
                Spot: {formatUSD(currentPrice)}
              </div>
            </div>

            {/* Range Presets */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '±5% Safe', pct: 0.05 },
                { label: '±15% Common', pct: 0.15 },
                { label: '±30% Wide', pct: 0.3 },
                { label: 'Full Range', pct: 0, isFull: true },
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
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border text-center ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                        : 'bg-neutral-50 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. BIN AMM GRAPH */}
        {curveType === CurveType.BIN_AMM && (
          <div className="space-y-5">
            {/* Interactive Histogram */}
            <div className="h-48 flex items-end justify-between gap-1 p-4 rounded-2xl bg-neutral-50 dark:bg-black/30 border border-neutral-200 dark:border-white/[0.06]">
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

                    {/* Spot Marker */}
                    {bin.isCurrent && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hover Tooltip Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/[0.04] text-xs font-mono">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <BarChart2 className="w-3.5 h-3.5 text-purple-500" />
                <span>Bin Price: {activeBin ? formatUSD(activeBin.price) : '-'}</span>
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">
                {activeBin?.isCurrent ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    ● Active Spot Bin
                  </span>
                ) : (
                  <span>Allocated Depth: {activeBin?.weight}%</span>
                )}
              </div>
            </div>

            {/* Shape Presets */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'spot', label: 'Spot Focus' },
                { id: 'curve', label: 'Gaussian' },
                { id: 'bid_ask', label: 'Bid-Ask' },
                { id: 'wide', label: 'Uniform' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectBinShape?.(item.id as BinShape)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer border text-center ${
                    binShape === item.id
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                      : 'bg-neutral-50 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. STABLE AMM GRAPH */}
        {curveType === CurveType.STABLE_AMM && (
          <div className="space-y-6">
            <div className="relative h-48 w-full bg-neutral-50 dark:bg-black/30 rounded-2xl border border-neutral-200 dark:border-white/[0.06] p-4 flex flex-col justify-center space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-neutral-700 dark:text-neutral-300 font-bold">
                  {token0Symbol}: {formatPercent(ratio0, 1)}
                </span>
                <span className="text-neutral-700 dark:text-neutral-300 font-bold">
                  {token1Symbol}: {formatPercent(ratio1, 1)}
                </span>
              </div>

              {/* Peg Ratio Bar */}
              <div className="h-4 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex shadow-inner">
                <div
                  className="bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                  style={{ width: `${ratio0}%` }}
                />
                <div
                  className="bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
                  style={{ width: `${ratio1}%` }}
                />
              </div>

              <div className="text-[11px] text-neutral-500 text-center font-mono">
                Preview A={ampFactor} (on-chain initialize uses default A=100)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-neutral-500">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Virtual Peg Rate:</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                1.0000 {token0Symbol} ≈ 1.0000 {token1Symbol}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-white/[0.06]">
        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Position Status</div>
          <div className="text-xs font-bold font-mono mt-0.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {curveType === CurveType.CLAMM
              ? isFullRange
                ? 'Full Range Active'
                : inRange
                ? 'In Range (Earning Fees)'
                : 'Out of Range'
              : 'Active Invariant'}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Dynamic LVR Defense</div>
          <div className="text-xs font-bold font-mono mt-0.5 text-neutral-900 dark:text-white flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-500" />
            Anti-JIT Spread Active
          </div>
        </div>
      </div>
    </div>
  );
};
