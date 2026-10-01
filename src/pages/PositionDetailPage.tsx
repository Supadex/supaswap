import React, { useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import {
  ArrowLeft,
  Coins,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { TokenLogo } from '../components/ui/TokenLogo';
import { InteractiveLiquidityGraph } from '../components/liquidity/InteractiveLiquidityGraph';
import { ManageLiquidityModal } from '../components/liquidity/ManageLiquidityModal';
import { PositionNFTArt } from '../components/liquidity/PositionNFTArt';
import { RecentTransactions } from '../components/activity/RecentTransactions';
import { usePositions } from '../hooks/usePositions';
import { useToast } from '../components/ui/Toast';
import { getAddressesForChain } from '../contracts/addresses';
import { CurveType } from '../contracts/types';
import {
  isClammFullRangeTicks,
  int24ToBinId,
  isNativeAddress,
  tickToPrice,
} from '../utils/poolMath';
import {
  getExplorerAddressUrl,
  getExplorerNftUrl,
  shortenAddress,
} from '../utils/formatters';

interface PositionDetailPageProps {
  tokenId: bigint;
  onBack: () => void;
}

const ExplorerRow: React.FC<{
  label: string;
  address?: string;
  href?: string | null;
  subtitle?: string;
  onCopy: (value: string) => void;
}> = ({ label, address, href, subtitle, onCopy }) => {
  if (!address) return null;
  const display = shortenAddress(address, 4);

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] text-neutral-500">{label}</div>
        {subtitle && (
          <div className="text-[10px] text-neutral-400 font-mono truncate">{subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-neutral-800 dark:text-neutral-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            title={address}
          >
            {display}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        ) : (
          <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200" title={address}>
            {display}
          </span>
        )}
        <button
          type="button"
          onClick={() => onCopy(address)}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] cursor-pointer"
          aria-label={`Copy ${label}`}
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const PositionDetailPage: React.FC<PositionDetailPageProps> = ({ tokenId, onBack }) => {
  const { chainId } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const {
    getPositionByTokenId,
    refreshPosition,
    collectFees,
    syncFees,
    isManaging,
    isLoading,
    positions,
  } = usePositions();
  const { info, success, error } = useToast();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageMode, setManageMode] = useState<'increase' | 'decrease'>('increase');
  const [detailLoading, setDetailLoading] = useState(true);

  const position = useMemo(
    () => getPositionByTokenId(tokenId) ?? positions.find((p) => p.tokenId === tokenId) ?? null,
    [getPositionByTokenId, positions, tokenId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      if (tokenId > 0n) {
        await refreshPosition(tokenId);
      }
      if (!cancelled) setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, refreshPosition]);

  const graphRange = useMemo(() => {
    if (!position) {
      return {
        min: 0.5,
        max: 1.5,
        current: 1,
        isFullRange: true,
        selectedBinId: undefined as number | undefined,
      };
    }
    if (position.curveType === CurveType.BIN_AMM) {
      return {
        min: 0.95,
        max: 1.05,
        current: 1,
        isFullRange: false,
        selectedBinId: int24ToBinId(position.tickLower),
      };
    }
    if (position.curveType === CurveType.STABLE_AMM) {
      return { min: 0.98, max: 1.02, current: 1, isFullRange: false, selectedBinId: undefined };
    }
    const full = isClammFullRangeTicks(position.tickLower, position.tickUpper);
    const lo = tickToPrice(position.tickLower);
    const hi = tickToPrice(position.tickUpper);
    const mid =
      Number.isFinite(lo) && Number.isFinite(hi)
        ? Math.sqrt(Math.max(lo, 1e-18) * Math.max(hi, 1e-18))
        : 1;
    return {
      min: full ? mid * 0.5 : Math.max(1e-12, lo),
      max: full ? mid * 1.5 : Math.max(hi, lo * 1.01),
      current: Number.isFinite(mid) && mid > 0 ? mid : 1,
      isFullRange: full,
      selectedBinId: undefined,
    };
  }, [position]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      success('Copied', shortenAddress(value));
    } catch {
      error('Copy Failed', 'Could not copy to clipboard');
    }
  };

  const handleCollect = async () => {
    if (!position) return;
    try {
      info(
        'Collecting Fees',
        `Collecting ${position.token0.symbol} & ${position.token1.symbol} fees for #${position.tokenId.toString()}...`
      );
      const hash = await collectFees(position.tokenId);
      success('Fees Collected', `Tx ${hash.slice(0, 10)}…`);
    } catch (err: unknown) {
      error('Collection Failed', err instanceof Error ? err.message : 'Transaction reverted');
    }
  };

  const handleSyncFees = async () => {
    if (!position) return;
    try {
      info('Syncing Fees', `Updating unclaimed fees for #${position.tokenId.toString()}...`);
      const hash = await syncFees(position.tokenId);
      success('Fees Synced', `Tx ${hash.slice(0, 10)}…`);
    } catch (err: unknown) {
      error('Sync Failed', err instanceof Error ? err.message : 'Transaction reverted');
    }
  };

  if (detailLoading || (isLoading && !position)) {
    return (
      <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-5 animate-fade-in">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <Skeleton variant="circular" className="w-11 h-11" />
            <Skeleton variant="circular" className="w-11 h-11" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <Card variant="surface" className="p-5 min-h-[420px] space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </Card>
          <div className="space-y-4 flex flex-col">
            <Card variant="surface" className="p-2.5">
              <Skeleton className="aspect-square w-full rounded-xl" />
            </Card>
            <Card variant="surface" className="p-5 flex-1 space-y-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={onBack}
        >
          Back to Positions
        </Button>
        <Card variant="surface" className="p-12 text-center">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Position not found
          </h2>
          <p className="text-sm text-neutral-500">
            NFT #{tokenId.toString()} was not found on-chain for this wallet.
          </p>
        </Card>
      </div>
    );
  }

  const feeIsZero = position.uncollectedFeesUSD === '$0.00';
  const nftHref = getExplorerNftUrl(addresses.positionManager, position.tokenId, chainId);
  const token0Href = isNativeAddress(position.token0.address)
    ? null
    : getExplorerAddressUrl(position.token0.address, chainId);
  const token1Href = isNativeAddress(position.token1.address)
    ? null
    : getExplorerAddressUrl(position.token1.address, chainId);

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Your positions
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <TokenLogo
                symbol={position.token0.symbol}
                address={position.token0.address}
                logoURI={position.token0.logoURI}
                size="lg"
              />
              <TokenLogo
                symbol={position.token1.symbol}
                address={position.token1.address}
                logoURI={position.token1.logoURI}
                size="lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {position.token0.symbol} / {position.token1.symbol}
                </h1>
                <span className="font-mono text-sm text-neutral-400">
                  #{position.tokenId.toString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge
                  variant={
                    position.curve === 'CLAMM'
                      ? 'brand'
                      : position.curve === 'BinAMM'
                        ? 'purple'
                        : 'default'
                  }
                  size="sm"
                  className="font-mono"
                >
                  {position.curve}
                </Badge>
                <Badge variant="default" size="sm">
                  {position.feeTier}
                </Badge>
                <Badge
                  variant={
                    position.status === 'in-range'
                      ? 'success'
                      : position.status === 'closed'
                        ? 'default'
                        : 'danger'
                  }
                  size="sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                  {position.status === 'in-range'
                    ? 'In range'
                    : position.status === 'closed'
                      ? 'Closed'
                      : 'Out of range'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Balanced 50/50: graph | NFT + position panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* LEFT — range / liquidity graph */}
        <Card
          variant="surface"
          className="p-4 sm:p-5 border-neutral-200/80 dark:border-white/[0.08] min-h-[420px] h-full flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Price range</h2>
            <span className="text-[11px] font-mono text-neutral-500">{position.currentPrice}</span>
          </div>
          <InteractiveLiquidityGraph
            curveType={position.curveType}
            currentPrice={graphRange.current}
            minPrice={graphRange.min}
            maxPrice={graphRange.max}
            isFullRange={graphRange.isFullRange}
            binStepBps={position.tickSpacing && position.tickSpacing > 0 ? position.tickSpacing : 10}
            binShape="spot"
            ampFactor={100}
            token0Symbol={position.token0.symbol}
            token1Symbol={position.token1.symbol}
            token0Amount={position.amount0}
            token1Amount={position.amount1}
            tickLower={position.tickLower}
            tickUpper={position.tickUpper}
            selectedBinId={graphRange.selectedBinId}
            priceFromChain={false}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
              <div className="text-[11px] text-neutral-500 mb-0.5">Min price</div>
              <div className="text-neutral-900 dark:text-white font-semibold truncate">
                {position.minPrice}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
              <div className="text-[11px] text-neutral-500 mb-0.5">Max price</div>
              <div className="text-neutral-900 dark:text-white font-semibold truncate">
                {position.maxPrice}
              </div>
            </div>
          </div>

          <RecentTransactions
            scope={{
              kind: 'position',
              tokenId: position.tokenId,
              token0: position.token0,
              token1: position.token1,
            }}
            className="mt-5"
          />
        </Card>

        {/* RIGHT — NFT + liquidity / fees / actions / contracts */}
        <div className="space-y-4 flex flex-col h-full">
          <Card
            variant="surface"
            className="p-2.5 border-neutral-200/80 dark:border-white/[0.08] overflow-hidden"
          >
            <div className="flex items-center justify-between px-1.5 pt-1 pb-2">
              <span className="text-[11px] font-semibold text-neutral-500 tracking-wide uppercase">
                Position NFT
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Obsidian Lattice</span>
            </div>
            <div className="rounded-xl overflow-hidden bg-[#08090B] aspect-square border border-white/[0.06]">
              <PositionNFTArt
                tokenId={position.tokenId}
                symbol0={position.token0.symbol}
                symbol1={position.token1.symbol}
                curveType={position.curveType}
                feeTier={position.feeTier}
                tickLower={position.tickLower}
                tickUpper={position.tickUpper}
                currency0={position.token0.address}
                currency1={position.token1.address}
                className="w-full h-full"
              />
            </div>
          </Card>

          <Card
            variant="surface"
            className="p-5 border-neutral-200/80 dark:border-white/[0.08] space-y-5 flex-1"
          >
            <div>
              <div className="text-xs text-neutral-500 mb-1">Liquidity</div>
              <div className="text-3xl font-extrabold font-mono tracking-tight text-neutral-900 dark:text-white">
                {position.liquidityUSD}
              </div>
            </div>

            {position.status === 'out-of-range' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                This position is <span className="font-semibold">out of range</span> — the pool has no
                active liquidity for swaps. Remint with <span className="font-semibold">Full Range</span>{' '}
                (or a range around the current price) using amounts within your wallet balance.
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <TokenLogo
                    symbol={position.token0.symbol}
                    address={position.token0.address}
                    logoURI={position.token0.logoURI}
                    size="sm"
                  />
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {position.token0.symbol}
                  </span>
                </div>
                <span className="font-mono text-sm text-neutral-900 dark:text-white shrink-0">
                  {position.amount0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="flex items-center gap-2 min-w-0">
                  <TokenLogo
                    symbol={position.token1.symbol}
                    address={position.token1.address}
                    logoURI={position.token1.logoURI}
                    size="sm"
                  />
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {position.token1.symbol}
                  </span>
                </div>
                <span className="font-mono text-sm text-neutral-900 dark:text-white shrink-0">
                  {position.amount1}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-neutral-200/60 dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  Unclaimed fees
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    leftIcon={<RotateCcw className="w-3 h-3" />}
                    isLoading={isManaging}
                    onClick={handleSyncFees}
                  >
                    Sync
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    leftIcon={<Coins className="w-3 h-3" />}
                    isLoading={isManaging}
                    onClick={handleCollect}
                    disabled={feeIsZero}
                  >
                    Collect
                  </Button>
                </div>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {position.uncollectedFeesUSD}
              </div>
              <div className="space-y-1 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                <div className="flex justify-between">
                  <span>{position.token0.symbol}</span>
                  <span>{position.uncollectedFee0}</span>
                </div>
                <div className="flex justify-between">
                  <span>{position.token1.symbol}</span>
                  <span>{position.uncollectedFee1}</span>
                </div>
              </div>
              {feeIsZero && (
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  After swaps, tap Sync to credit accrued fees into this position, then Collect.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="brand"
                size="md"
                className="w-full"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setManageMode('increase');
                  setIsManageOpen(true);
                }}
              >
                Increase
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                leftIcon={<Minus className="w-4 h-4" />}
                onClick={() => {
                  setManageMode('decrease');
                  setIsManageOpen(true);
                }}
              >
                Remove
              </Button>
            </div>
          </Card>

          <Card
            variant="surface"
            className="p-4 border-neutral-200/80 dark:border-white/[0.08] space-y-1"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">
                Contracts
              </h3>
              {chainId === 31337 && (
                <span className="text-[10px] text-neutral-400">Local Anvil — copy only</span>
              )}
            </div>

            <ExplorerRow
              label={position.token0.symbol}
              address={position.token0.address}
              href={token0Href}
              subtitle="Token"
              onCopy={handleCopy}
            />
            <ExplorerRow
              label={position.token1.symbol}
              address={position.token1.address}
              href={token1Href}
              subtitle="Token"
              onCopy={handleCopy}
            />
            <div className="border-t border-neutral-200/50 dark:border-white/[0.05] my-1" />
            <ExplorerRow
              label="Position NFT"
              address={addresses.positionManager}
              href={nftHref ?? getExplorerAddressUrl(addresses.positionManager, chainId)}
              subtitle={`SupaPositionManager · #${position.tokenId.toString()}`}
              onCopy={handleCopy}
            />
            <ExplorerRow
              label="Pool Manager"
              address={addresses.poolManager}
              href={getExplorerAddressUrl(addresses.poolManager, chainId)}
              subtitle="SupaPoolManager"
              onCopy={handleCopy}
            />
            <ExplorerRow
              label="Vault"
              address={addresses.vault}
              href={getExplorerAddressUrl(addresses.vault, chainId)}
              subtitle="SupaVault"
              onCopy={handleCopy}
            />

            {position.curveType === CurveType.BIN_AMM ? (
              <div className="pt-2 mt-1 border-t border-neutral-200/50 dark:border-white/[0.05] flex justify-between text-[11px] font-mono text-neutral-500">
                <span>Bin ID</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {int24ToBinId(position.tickLower)}
                </span>
              </div>
            ) : (
              <div className="pt-2 mt-1 border-t border-neutral-200/50 dark:border-white/[0.05] space-y-1 text-[11px] font-mono text-neutral-500">
                <div className="flex justify-between">
                  <span>Tick lower</span>
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {position.tickLower}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tick upper</span>
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {position.tickUpper}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ManageLiquidityModal
        isOpen={isManageOpen}
        onClose={() => {
          setIsManageOpen(false);
          void refreshPosition(tokenId);
        }}
        position={position}
        initialMode={manageMode}
      />
    </div>
  );
};

export default PositionDetailPage;
