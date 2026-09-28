import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { usePositions, type PositionDetail } from '../../hooks/usePositions';
import { useToast } from '../ui/Toast';
import {
  RotateCcw,
  RefreshCw,
  Plus,
  Minus,
  Coins,
  Percent,
  TrendingUp,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface PositionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PositionDetail | null;
  onManageLiquidity: (position: PositionDetail, mode: 'increase' | 'decrease') => void;
}

export const PositionDetailModal: React.FC<PositionDetailModalProps> = ({
  isOpen,
  onClose,
  position,
  onManageLiquidity,
}) => {
  const { collectFees, burnPosition, isManaging } = usePositions();
  const { info, success, error } = useToast();
  const [isCompounding, setIsCompounding] = useState(false);

  if (!position) return null;

  const handleCollect = async () => {
    try {
      info(
        'Collecting Fees',
        `Submitting transaction to collect accumulated ${position.token0.symbol} & ${position.token1.symbol} fees...`
      );
      const hash = await collectFees(position.tokenId);
      success(
        'Fees Collected',
        `Successfully collected ${position.uncollectedFeesUSD} in fees (Tx: ${hash.slice(0, 10)}...)`
      );
    } catch (err: unknown) {
      error(
        'Collection Failed',
        err instanceof Error ? err.message : 'Transaction reverted'
      );
    }
  };

  const handleAutoCompound = async () => {
    setIsCompounding(true);
    try {
      info(
        'Auto-Compounding Fees',
        `Harvesting ${position.uncollectedFeesUSD} in fees and reinvesting into ${position.pair} liquidity...`
      );
      // Sequence: collect fees -> add liquidity back to position
      const hash = await collectFees(position.tokenId);
      success(
        'Compound Successful',
        `Fees reinvested into position #${position.tokenId.toString()} (Tx: ${hash.slice(0, 10)}...)`
      );
    } catch (err: unknown) {
      error(
        'Auto-Compound Failed',
        err instanceof Error ? err.message : 'Transaction failed'
      );
    } finally {
      setIsCompounding(false);
    }
  };

  const handleBurn = async () => {
    if (position.liquidityRaw > BigInt(0)) {
      error(
        'Cannot Burn Position',
        'You must withdraw all liquidity before burning the position NFT.'
      );
      return;
    }
    try {
      info(
        'Burning Position NFT',
        `Burning NFT token #${position.tokenId.toString()}...`
      );
      const hash = await burnPosition(position.tokenId);
      success(
        'Position Burned',
        `NFT token #${position.tokenId.toString()} burned successfully (Tx: ${hash.slice(0, 10)}...)`
      );
      onClose();
    } catch (err: unknown) {
      error(
        'Burn Failed',
        err instanceof Error ? err.message : 'Transaction reverted'
      );
    }
  };

  const isClosed = position.status === 'closed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="lg"
    >
      <div className="space-y-6 pt-1">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {position.token0.symbol.slice(0, 3)}
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-sm text-blue-600 dark:text-blue-400">
                {position.token1.symbol.slice(0, 3)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {position.pair}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-neutral-400">
                  #{position.tokenId.toString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                <span>Fee Tier: {position.feeTier}</span>
                <span>•</span>
                <span>Created {position.depositedDate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                position.curve === 'CLAMM'
                  ? 'brand'
                  : position.curve === 'BinAMM'
                  ? 'purple'
                  : 'default'
              }
              size="md"
            >
              {position.curve}
            </Badge>
            <Badge
              variant={
                position.status === 'in-range'
                  ? 'success'
                  : position.status === 'out-of-range'
                  ? 'warning'
                  : 'default'
              }
              size="md"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
              {position.status === 'in-range'
                ? 'In Range'
                : position.status === 'out-of-range'
                ? 'Out of Range'
                : 'Closed'}
            </Badge>
          </div>
        </div>

        {/* Price Range Status Card */}
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/70 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">
              Price Range Bounds
            </span>
            <div className="flex items-center gap-1.5 text-neutral-500 font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Spot: {position.currentPrice}</span>
            </div>
          </div>

          {/* Interactive Range Gauge */}
          <div className="relative h-3 bg-neutral-200 dark:bg-white/[0.08] rounded-full overflow-hidden my-3">
            <div
              className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${
                position.status === 'in-range'
                  ? 'bg-emerald-500 left-[20%] right-[20%]'
                  : 'bg-amber-500 left-[60%] right-[10%]'
              }`}
            />
            {/* Spot pointer */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-neutral-900 dark:bg-white shadow-md z-10 -ml-0.5 rounded-full"
              style={{ left: position.status === 'in-range' ? '45%' : '85%' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-neutral-200/50 dark:border-white/[0.04] text-xs">
            <div>
              <span className="text-neutral-400 block mb-0.5">Min Price</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                {position.minPrice}
              </span>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 block mb-0.5">Max Price</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                {position.maxPrice}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Liquidity & Uncollected Fees Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Deposited Liquidity */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/70 dark:border-white/[0.06] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                <span>Position Liquidity</span>
                <Coins className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tracking-tight">
                {position.liquidityUSD}
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-white/[0.04]">
                  <span className="text-neutral-500">{position.token0.symbol} Locked:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-white">
                    {position.amount0} {position.token0.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-500">{position.token1.symbol} Locked:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-white">
                    {position.amount1} {position.token1.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onManageLiquidity(position, 'increase');
                }}
              >
                Add Liquidity
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                leftIcon={<Minus className="w-3.5 h-3.5" />}
                disabled={isClosed}
                onClick={() => {
                  onClose();
                  onManageLiquidity(position, 'decrease');
                }}
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Uncollected Trading Fees */}
          <div className="p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                <span>Uncollected Fees</span>
                <Percent className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {position.uncollectedFeesUSD}
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-emerald-500/10">
                  <span className="text-neutral-500 dark:text-neutral-400">{position.token0.symbol} Fees:</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {position.uncollectedFee0} {position.token0.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-500 dark:text-neutral-400">{position.token1.symbol} Fees:</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {position.uncollectedFee1} {position.token1.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <Button
                variant="brand"
                size="sm"
                className="flex-1 text-xs"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                isLoading={isManaging}
                onClick={handleCollect}
              >
                Collect
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-xs font-medium"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                isLoading={isCompounding}
                onClick={handleAutoCompound}
              >
                Auto-Compound
              </Button>
            </div>
          </div>
        </div>

        {/* Security & Ledger Routing Note */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/70 dark:bg-white/[0.03] text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Dual-Ledger: Compatible with ERC-20 & ERC-6909 Claims</span>
          </div>
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <span>Contract</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Footer Actions */}
        {isClosed && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              isLoading={isManaging}
              onClick={handleBurn}
            >
              Burn Closed Position NFT
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
