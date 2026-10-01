import React, { useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { zeroAddress } from 'viem';
import { Card } from '../components/ui/Card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { TokenLogo } from '../components/ui/TokenLogo';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { Skeleton } from '../components/ui/Skeleton';
import { useTokenList } from '../hooks/useTokenList';
import { usePools } from '../hooks/usePools';
import { formatUSD, getExplorerAddressUrl } from '../utils/formatters';
import {
  TrendingUp,
  Search,
  Activity,
  BarChart2,
  ExternalLink,
} from 'lucide-react';

type ExploreTab = 'tokens' | 'pools';

function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000)
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function ChangeCell({ value }: { value?: number }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-neutral-400">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={`font-mono text-xs ${
        positive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-500 dark:text-red-400'
      }`}
    >
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

export const ExplorePage: React.FC = () => {
  const chainId = useChainId();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ExploreTab>('tokens');
  const { tokens, isLoadingList, isLoadingRemoteList, isLoadingMarket } =
    useTokenList();
  const {
    pools,
    isLoading: poolsLoading,
    totalTVL,
    activePoolsCount,
  } = usePools();

  const physicalTokens = useMemo(
    () => tokens.filter((t) => !t.isClaim),
    [tokens]
  );

  /** On-chain TVL attributed to each token (½ of each pool TVL). */
  const tvlByToken = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pools) {
      const half = (p.tvlUSD || 0) / 2;
      const a0 = p.token0.isNative
        ? zeroAddress
        : p.token0.address.toLowerCase();
      const a1 = p.token1.isNative
        ? zeroAddress
        : p.token1.address.toLowerCase();
      map.set(a0, (map.get(a0) || 0) + half);
      map.set(a1, (map.get(a1) || 0) + half);
    }
    return map;
  }, [pools]);

  const exploreTokens = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = physicalTokens
      .map((t) => {
        const key = t.isNative ? zeroAddress : t.address.toLowerCase();
        return {
          ...t,
          tvlUSD: tvlByToken.get(key) || 0,
        };
      })
      .filter(
        (t) =>
          !q ||
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const volDiff = (b.volume24hUSD || 0) - (a.volume24hUSD || 0);
        if (volDiff !== 0) return volDiff;
        const tvlDiff = b.tvlUSD - a.tvlUSD;
        if (tvlDiff !== 0) return tvlDiff;
        return (b.priceUSD || 0) - (a.priceUSD || 0);
      });
    return rows;
  }, [physicalTokens, search, tvlByToken]);

  const explorePools = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pools
      .filter(
        (p) =>
          !q ||
          p.pair.toLowerCase().includes(q) ||
          p.token0.symbol.toLowerCase().includes(q) ||
          p.token1.symbol.toLowerCase().includes(q) ||
          p.curve.toLowerCase().includes(q)
      )
      .sort((a, b) => b.tvlUSD - a.tvlUSD);
  }, [pools, search]);

  const marketVolume24h = useMemo(
    () =>
      physicalTokens.reduce((sum, t) => sum + (t.volume24hUSD || 0), 0),
    [physicalTokens]
  );

  const isTokensLoading = isLoadingList && physicalTokens.length <= 3;
  const isPoolsLoading = poolsLoading;

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Explore
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Top tokens and pools on the connected network — prices via DefiLlama,
            volume via CoinGecko, pools from on-chain SupaDex state.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              SupaDex TVL
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          {isPoolsLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {formatCompactUsd(totalTVL)}
              </div>
              <div className="text-xs text-neutral-400 mt-1 font-mono">
                {activePoolsCount} active pool{activePoolsCount === 1 ? '' : 's'}
              </div>
            </>
          )}
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Token Universe
            </span>
            <BarChart2 className="w-4 h-4 text-sky-500" />
          </div>
          {isLoadingRemoteList ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {physicalTokens.length}
              </div>
              <div className="text-xs text-neutral-400 mt-1 font-mono">
                Defaults + Uniswap list · prices via CoinGecko
              </div>
            </>
          )}
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Market 24h Volume
            </span>
            <TrendingUp className="w-4 h-4 text-neutral-500" />
          </div>
          {isLoadingMarket ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {formatCompactUsd(marketVolume24h)}
              </div>
              <div className="text-xs text-neutral-400 mt-1 font-mono">
                Global market volume (priority tokens)
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'tokens', label: 'Tokens' },
            { id: 'pools', label: 'Pools' },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as ExploreTab)}
          variant="underline"
          size="md"
        />
        <div className="w-full sm:w-80">
          <Input
            placeholder={
              tab === 'tokens'
                ? 'Search tokens by name or address…'
                : 'Search pools by pair or curve…'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="rounded-xl text-xs"
          />
        </div>
      </div>

      <Card
        variant="surface"
        className="overflow-hidden border-neutral-200/80 dark:border-white/[0.08]"
      >
        {tab === 'tokens' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Token</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">1D</TableHead>
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">Volume 24H</TableHead>
                <TableHead className="text-right">Contract</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTokensLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : exploreTokens.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-sm text-neutral-500"
                  >
                    No tokens found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                exploreTokens.slice(0, 250).map((t, idx) => {
                  const explorer = getExplorerAddressUrl(t.address, chainId);
                  return (
                    <TableRow key={`${t.address}-${t.symbol}`}>
                      <TableCell className="text-center font-mono text-xs text-neutral-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <TokenLogo
                            symbol={t.symbol}
                            address={t.address}
                            logoURI={t.logoURI}
                            size="md"
                          />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-white text-xs flex items-center gap-1.5">
                              {t.name}
                              {t.isNative && (
                                <Badge variant="success" size="sm">
                                  Native
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                              {t.symbol}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-neutral-900 dark:text-white font-medium">
                        {formatPrice(t.priceUSD)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChangeCell value={t.priceChange24h} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompactUsd(t.tvlUSD)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompactUsd(t.volume24hUSD || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-neutral-500">
                        {t.isNative || t.address === zeroAddress ? (
                          'Native'
                        ) : explorer ? (
                          <a
                            href={explorer}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition-colors"
                          >
                            {`${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          `${t.address.slice(0, 6)}…${t.address.slice(-4)}`
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Pool</TableHead>
                <TableHead className="text-right">Curve</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">LVR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPoolsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : explorePools.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-sm text-neutral-500"
                  >
                    No SupaDex pools initialized on this network yet.
                  </TableCell>
                </TableRow>
              ) : (
                explorePools.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-center font-mono text-xs text-neutral-400">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <TokenLogo
                            symbol={p.token0.symbol}
                            address={p.token0.address}
                            logoURI={p.token0.logoURI}
                            size="sm"
                          />
                          <TokenLogo
                            symbol={p.token1.symbol}
                            address={p.token1.address}
                            logoURI={p.token1.logoURI}
                            size="sm"
                          />
                        </div>
                        <span className="font-semibold text-xs text-neutral-900 dark:text-white">
                          {p.pair}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                        {p.curve}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.feeTier}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.tvlUSD > 0 ? formatUSD(p.tvlUSD) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={p.lvrProtection === 'Active' ? 'brand' : 'default'}
                        size="sm"
                        className="font-mono text-[10px]"
                      >
                        {p.lvrProtection === 'Active' ? 'Protected' : '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
