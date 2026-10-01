import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { TokenLogo } from '../components/ui/TokenLogo';
import { usePools, type PoolItem } from '../hooks/usePools';
import type { CurveType, TokenMetadata } from '../contracts/types';
import {
  Search,
  Plus,
  Activity,
  Percent,
  Coins,
  Lock,
} from 'lucide-react';

interface PoolsPageProps {
  onNavigateNewPosition?: (
    token0?: TokenMetadata,
    token1?: TokenMetadata,
    curveType?: CurveType,
    fee?: number,
    plugin?: `0x${string}`,
    tickSpacing?: number
  ) => void;
  onNavigatePoolDetail?: (poolId: string) => void;
}

function formatVolTvl(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0.00';
  if (ratio >= 100) return ratio.toFixed(0);
  if (ratio >= 10) return ratio.toFixed(1);
  return ratio.toFixed(2);
}

function PoolsTableSkeleton({ rows = 5 }: { rows?: number }) {
  const headers = ['Pool Pair', 'Curve Engine', 'Fee Tier', 'TVL', '24h Volume', 'Vol/TVL', 'Pool APR'];
  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111317] overflow-hidden shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
            {headers.map((label) => (
              <TableHead
                key={label}
                className={`py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 ${
                  ['TVL', '24h Volume', 'Vol/TVL', 'Pool APR'].includes(label) ? 'text-right' : ''
                }`}
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow
              key={i}
              className="border-b border-neutral-200/60 dark:border-white/[0.04]"
            >
              <TableCell className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1.5">
                    <Skeleton variant="circular" className="w-5 h-5" />
                    <Skeleton variant="circular" className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-5 w-14" />
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-3.5 w-10" />
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-3.5 w-16 ml-auto" />
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-3.5 w-14 ml-auto" />
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-3.5 w-10 ml-auto" />
              </TableCell>
              <TableCell className="py-4 px-4">
                <Skeleton className="h-3.5 w-12 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const PoolsPage: React.FC<PoolsPageProps> = ({
  onNavigateNewPosition,
  onNavigatePoolDetail,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCurve, setSelectedCurve] = useState<string>('ALL');
  const { pools, totalTVL, totalVolume24h, totalFees24h, isLoading, refreshPools } = usePools();

  const filteredPools = pools.filter((p) => {
    const matchesSearch = p.pair.toLowerCase().includes(search.toLowerCase());
    const matchesCurve = selectedCurve === 'ALL' || p.curve === selectedCurve;
    return matchesSearch && matchesCurve;
  });

  const handleCreate = () => {
    onNavigateNewPosition?.();
  };

  const handleRowClick = (pool: PoolItem) => {
    const id = pool.poolId || pool.id;
    if (id) onNavigatePoolDetail?.(id);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Liquidity Pools
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Provide multi-curve liquidity across Concentrated, Discretized Bins, or StableSwap engines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<Activity className="w-4 h-4" />}
            isLoading={isLoading}
            onClick={() => void refreshPools()}
          >
            Refresh
          </Button>
          <Button
            variant="brand"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleCreate}
          >
            Create Pool & Position
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Total Value Locked
            </span>
            <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/[0.05] flex items-center justify-center text-neutral-600 dark:text-neutral-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-28 mb-1.5" />
              <Skeleton className="h-2.5 w-24" />
            </>
          ) : (
            <>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                ${totalTVL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-mono text-neutral-400 mt-1">
                Across {pools.length} active pools
              </div>
            </>
          )}
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              24h Total Volume
            </span>
            <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/[0.05] flex items-center justify-center text-neutral-600 dark:text-neutral-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-28 mb-1.5" />
              <Skeleton className="h-2.5 w-24" />
            </>
          ) : (
            <>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                ${totalVolume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-mono text-neutral-400 mt-1">
                Settled in SupaVault
              </div>
            </>
          )}
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              24h Protocol Fees
            </span>
            <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/[0.05] flex items-center justify-center text-neutral-600 dark:text-neutral-400">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-24 mb-1.5" />
              <Skeleton className="h-2.5 w-28" />
            </>
          ) : (
            <>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                ${totalFees24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                Distributed to LPs
              </div>
            </>
          )}
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Dynamic LVR Shield
            </span>
            <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/[0.05] flex items-center justify-center text-neutral-600 dark:text-neutral-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            Active
          </div>
          <div className="text-[11px] font-mono text-neutral-400 mt-1">
            Anti-toxic arbitrage enabled
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by token or pair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9.5 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.06] self-start sm:self-auto overflow-x-auto">
          {['ALL', 'CLAMM', 'BinAMM', 'StableAMM'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCurve(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCurve === tab
                  ? 'bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Curves' : tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PoolsTableSkeleton />
      ) : pools.length === 0 ? (
        <Card variant="surface" className="p-16 text-center border-neutral-200/80 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            No Pools Initialized Yet
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
            There are currently no active liquidity pools on this network. Initialize a new pool and provide concentrated or bin liquidity to start earning trading fees.
          </p>
          <Button
            variant="brand"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleCreate}
          >
            Create First Pool & Position
          </Button>
        </Card>
      ) : (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111317] overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400">
                  Pool Pair
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400">
                  Curve Engine
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400">
                  Fee Tier
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 text-right">
                  TVL
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 text-right">
                  24h Volume
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 text-right">
                  Vol/TVL
                </TableHead>
                <TableHead className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 text-right">
                  Pool APR
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-neutral-400 text-xs font-mono">
                    No pools found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPools.map((pool) => (
                  <TableRow
                    key={pool.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(pool)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(pool);
                      }
                    }}
                    className="border-b border-neutral-200/60 dark:border-white/[0.04] hover:bg-neutral-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <TableCell className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-1.5">
                          <TokenLogo
                            symbol={pool.token0.symbol}
                            address={pool.token0.address}
                            logoURI={pool.token0.logoURI}
                            size="sm"
                          />
                          <TokenLogo
                            symbol={pool.token1.symbol}
                            address={pool.token1.address}
                            logoURI={pool.token1.logoURI}
                            size="sm"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-neutral-900 dark:text-white">
                            {pool.pair}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                            {pool.lvrProtection === 'Active' ? 'LVR Active' : 'No plugin'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Badge
                        variant={
                          pool.curve === 'CLAMM'
                            ? 'brand'
                            : pool.curve === 'BinAMM'
                            ? 'purple'
                            : 'default'
                        }
                        size="sm"
                        className="font-mono text-[10px]"
                      >
                        {pool.curve}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-4 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                      {pool.feeTier}
                    </TableCell>
                    <TableCell className="py-4 px-4 font-mono text-xs font-medium text-right text-neutral-900 dark:text-white">
                      ${pool.tvlUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-4 px-4 font-mono text-xs text-right text-neutral-700 dark:text-neutral-300">
                      ${pool.volume24hUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-4 px-4 font-mono text-xs text-right text-neutral-700 dark:text-neutral-300">
                      {formatVolTvl(pool.volTvl ?? 0)}
                    </TableCell>
                    <TableCell className="py-4 px-4 font-mono text-xs font-semibold text-right text-emerald-600 dark:text-emerald-400">
                      {pool.apr}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
