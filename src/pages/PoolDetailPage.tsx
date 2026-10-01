import React, { useEffect, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { ArrowLeft, Copy, ExternalLink, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { TokenLogo } from '../components/ui/TokenLogo';
import { InteractiveLiquidityGraph } from '../components/liquidity/InteractiveLiquidityGraph';
import { RecentTransactions } from '../components/activity/RecentTransactions';
import { usePools } from '../hooks/usePools';
import { usePoolManager } from '../hooks/usePoolManager';
import { useToast } from '../components/ui/Toast';
import { getAddressesForChain } from '../contracts/addresses';
import { CurveType, type TokenMetadata } from '../contracts/types';
import {
  int24ToBinId,
  isNativeAddress,
  sqrtPriceX96ToPrice,
} from '../utils/poolMath';
import {
  formatUSD,
  getExplorerAddressUrl,
  shortenAddress,
} from '../utils/formatters';

interface PoolDetailPageProps {
  poolId: `0x${string}`;
  onBack: () => void;
  onAddLiquidity: (
    token0?: TokenMetadata,
    token1?: TokenMetadata,
    curveType?: CurveType,
    fee?: number,
    plugin?: `0x${string}`,
    tickSpacing?: number
  ) => void;
}

function formatVolTvl(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0.00';
  if (ratio >= 100) return ratio.toFixed(0);
  if (ratio >= 10) return ratio.toFixed(1);
  return ratio.toFixed(2);
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

export const PoolDetailPage: React.FC<PoolDetailPageProps> = ({
  poolId,
  onBack,
  onAddLiquidity,
}) => {
  const { chainId } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const { pools, isLoading, refreshPools } = usePools();
  const { readSlot0 } = usePoolManager();
  const { success, error } = useToast();
  const [spotPrice, setSpotPrice] = useState(1);
  const [activeTick, setActiveTick] = useState(0);
  const [slotLoading, setSlotLoading] = useState(true);

  const pool = useMemo(
    () => pools.find((p) => (p.poolId || p.id).toLowerCase() === poolId.toLowerCase()) ?? null,
    [pools, poolId]
  );

  useEffect(() => {
    void refreshPools();
  }, [refreshPools]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pool) {
        setSlotLoading(false);
        return;
      }
      setSlotLoading(true);
      try {
        const slot = await readSlot0(poolId);
        if (cancelled || !slot || !slot.isInitialized) return;
        const price = sqrtPriceX96ToPrice(
          slot.sqrtPriceX96,
          pool.token0.decimals,
          pool.token1.decimals
        );
        if (!cancelled) {
          setSpotPrice(Number.isFinite(price) && price > 0 ? price : 1);
          setActiveTick(slot.tick);
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setSlotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pool, poolId, readSlot0]);

  const graphRange = useMemo(() => {
    if (!pool) {
      return {
        min: 0.5,
        max: 1.5,
        current: 1,
        isFullRange: true,
        selectedBinId: undefined as number | undefined,
      };
    }
    if (pool.curveType === CurveType.BIN_AMM) {
      return {
        min: spotPrice * 0.95,
        max: spotPrice * 1.05,
        current: spotPrice,
        isFullRange: false,
        selectedBinId: int24ToBinId(activeTick) || undefined,
      };
    }
    if (pool.curveType === CurveType.STABLE_AMM) {
      return {
        min: spotPrice * 0.98,
        max: spotPrice * 1.02,
        current: spotPrice,
        isFullRange: false,
        selectedBinId: undefined,
      };
    }
    return {
      min: spotPrice * 0.5,
      max: spotPrice * 1.5,
      current: spotPrice,
      isFullRange: true,
      selectedBinId: undefined,
    };
  }, [pool, spotPrice, activeTick]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      success('Copied', shortenAddress(value));
    } catch {
      error('Copy Failed', 'Could not copy to clipboard');
    }
  };

  if ((isLoading && !pool) || (slotLoading && !pool)) {
    return (
      <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-5 animate-fade-in">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-4 animate-fade-in">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Pools
        </button>
        <Card variant="surface" className="p-12 text-center border-neutral-200/80 dark:border-white/[0.08]">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Pool not found
          </h2>
          <p className="text-xs text-neutral-500 mb-4 font-mono truncate">{poolId}</p>
          <Button variant="secondary" onClick={onBack}>
            Back to pools
          </Button>
        </Card>
      </div>
    );
  }

  const token0Href = isNativeAddress(pool.token0.address)
    ? null
    : getExplorerAddressUrl(pool.token0.address, chainId);
  const token1Href = isNativeAddress(pool.token1.address)
    ? null
    : getExplorerAddressUrl(pool.token1.address, chainId);

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Pools
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <TokenLogo
                symbol={pool.token0.symbol}
                address={pool.token0.address}
                logoURI={pool.token0.logoURI}
                size="lg"
              />
              <TokenLogo
                symbol={pool.token1.symbol}
                address={pool.token1.address}
                logoURI={pool.token1.logoURI}
                size="lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {pool.token0.symbol} / {pool.token1.symbol}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge
                  variant={
                    pool.curve === 'CLAMM'
                      ? 'brand'
                      : pool.curve === 'BinAMM'
                        ? 'purple'
                        : 'default'
                  }
                  size="sm"
                  className="font-mono"
                >
                  {pool.curve}
                </Badge>
                <Badge variant="default" size="sm">
                  {pool.feeTier}
                </Badge>
                <Badge variant="success" size="sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                  Active
                </Badge>
                {pool.lvrProtection === 'Active' && (
                  <Badge variant="default" size="sm" className="font-mono text-[10px]">
                    LVR
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="brand"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() =>
              onAddLiquidity(
                pool.token0,
                pool.token1,
                pool.curveType,
                pool.feeNumber,
                (pool.plugin as `0x${string}`) || undefined,
                pool.tickSpacing
              )
            }
          >
            Add liquidity
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-4">
          <Card
            variant="surface"
            className="p-4 sm:p-5 border-neutral-200/80 dark:border-white/[0.08] min-h-[380px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Liquidity depth
              </h2>
              <span className="text-[11px] font-mono text-neutral-500">
                {formatUSD(spotPrice)} {pool.token1.symbol}/{pool.token0.symbol}
              </span>
            </div>
            <InteractiveLiquidityGraph
              curveType={pool.curveType}
              currentPrice={graphRange.current}
              minPrice={graphRange.min}
              maxPrice={graphRange.max}
              isFullRange={graphRange.isFullRange}
              binStepBps={pool.tickSpacing && pool.tickSpacing > 0 ? pool.tickSpacing : 10}
              binShape="spot"
              ampFactor={100}
              token0Symbol={pool.token0.symbol}
              token1Symbol={pool.token1.symbol}
              token0Amount="0"
              token1Amount="0"
              selectedBinId={graphRange.selectedBinId}
              priceFromChain
            />
          </Card>

          <Card
            variant="surface"
            className="p-4 sm:p-5 border-neutral-200/80 dark:border-white/[0.08]"
          >
            <RecentTransactions
              scope={{
                kind: 'pool',
                poolId,
                token0: pool.token0,
                token1: pool.token1,
              }}
              className="mt-0"
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            variant="surface"
            className="p-5 border-neutral-200/80 dark:border-white/[0.08] space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[11px] text-neutral-500 mb-0.5">TVL</div>
                <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
                  {formatUSD(pool.tvlUSD)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[11px] text-neutral-500 mb-0.5">24h Volume</div>
                <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
                  {formatUSD(pool.volume24hUSD)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[11px] text-neutral-500 mb-0.5">Vol/TVL</div>
                <div className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
                  {formatVolTvl(pool.volTvl ?? 0)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[11px] text-neutral-500 mb-0.5">Pool APR</div>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {pool.apr}
                </div>
              </div>
            </div>

            <Button
              variant="brand"
              size="md"
              className="w-full"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() =>
                onAddLiquidity(
                  pool.token0,
                  pool.token1,
                  pool.curveType,
                  pool.feeNumber,
                  (pool.plugin as `0x${string}`) || undefined,
                  pool.tickSpacing
                )
              }
            >
              Add liquidity
            </Button>
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
              label={pool.token0.symbol}
              address={pool.token0.address}
              href={token0Href}
              subtitle="Token"
              onCopy={handleCopy}
            />
            <ExplorerRow
              label={pool.token1.symbol}
              address={pool.token1.address}
              href={token1Href}
              subtitle="Token"
              onCopy={handleCopy}
            />
            <div className="border-t border-neutral-200/50 dark:border-white/[0.05] my-1" />
            <ExplorerRow
              label="Pool Manager"
              address={addresses.poolManager}
              href={getExplorerAddressUrl(addresses.poolManager, chainId)}
              subtitle="SupaPoolManager"
              onCopy={handleCopy}
            />
            <ExplorerRow
              label="Position Manager"
              address={addresses.positionManager}
              href={getExplorerAddressUrl(addresses.positionManager, chainId)}
              subtitle="SupaPositionManager"
              onCopy={handleCopy}
            />
            <ExplorerRow
              label="Vault"
              address={addresses.vault}
              href={getExplorerAddressUrl(addresses.vault, chainId)}
              subtitle="SupaVault"
              onCopy={handleCopy}
            />
            {pool.plugin && pool.plugin !== '0x0000000000000000000000000000000000000000' && (
              <ExplorerRow
                label="Plugin"
                address={pool.plugin}
                href={getExplorerAddressUrl(pool.plugin, chainId)}
                subtitle="Hook"
                onCopy={handleCopy}
              />
            )}
            <div className="pt-2 mt-1 border-t border-neutral-200/50 dark:border-white/[0.05] flex justify-between text-[11px] font-mono text-neutral-500">
              <span>Pool ID</span>
              <button
                type="button"
                className="text-neutral-800 dark:text-neutral-200 hover:text-emerald-600 cursor-pointer truncate max-w-[60%]"
                title={poolId}
                onClick={() => handleCopy(poolId)}
              >
                {shortenAddress(poolId, 6)}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
