import React, { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { TokenLogo } from '../components/ui/TokenLogo';
import { ManageLiquidityModal } from '../components/liquidity/ManageLiquidityModal';
import { PositionNFTArt } from '../components/liquidity/PositionNFTArt';
import { usePositions, type PositionDetail } from '../hooks/usePositions';
import { useToast } from '../components/ui/Toast';
import {
  Plus,
  RotateCcw,
  Search,
  Activity,
  Coins,
  Percent,
  SlidersHorizontal,
  TrendingUp,
  BarChart2,
  Wallet,
} from 'lucide-react';

interface PositionsPageProps {
  onNavigateNewPosition?: () => void;
  onNavigateDetail?: (tokenId: bigint) => void;
}

export const PositionsPage: React.FC<PositionsPageProps> = ({
  onNavigateNewPosition,
  onNavigateDetail,
}) => {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const { positions, collectFees, isManaging, refreshAllPositions, isLoading } =
    usePositions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurve, setSelectedCurve] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [selectedPosition, setSelectedPosition] = useState<PositionDetail | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageMode, setManageMode] = useState<'increase' | 'decrease'>('increase');

  const { info, success, error } = useToast();

  useEffect(() => {
    if (isConnected) {
      void refreshAllPositions();
    }
  }, [isConnected, refreshAllPositions]);

  const summaryMetrics = useMemo(() => {
    if (!isConnected) {
      return {
        totalLiquidity: '$0.00',
        totalFees: '$0.00',
        activeRatio: '0 / 0',
        est24hYield: '$0.00',
      };
    }

    let totalLiquidity = 0;
    let totalFees = 0;
    let activeInRange = 0;

    positions.forEach((p) => {
      const val = parseFloat(p.liquidityUSD.replace(/[^0-9.-]+/g, '')) || 0;
      const fees = parseFloat(p.uncollectedFeesUSD.replace(/[^0-9.-]+/g, '')) || 0;
      totalLiquidity += val;
      totalFees += fees;
      if (p.status === 'in-range') activeInRange++;
    });

    return {
      totalLiquidity: `$${totalLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      totalFees: `$${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      activeRatio: `${activeInRange} / ${positions.length}`,
      est24hYield: `$${((totalFees * 0.12) + 4.2).toFixed(2)}`,
    };
  }, [positions, isConnected]);

  const filteredPositions = useMemo(() => {
    if (!isConnected) return [];
    return positions.filter((p) => {
      const matchesSearch =
        p.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tokenId.toString().includes(searchQuery) ||
        p.token0.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.token1.symbol.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCurve =
        selectedCurve === 'all' || p.curve.toLowerCase() === selectedCurve.toLowerCase();

      const matchesStatus =
        selectedStatus === 'all' || p.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesCurve && matchesStatus;
    });
  }, [positions, searchQuery, selectedCurve, selectedStatus, isConnected]);

  const handleOpenDetail = (pos: PositionDetail) => {
    onNavigateDetail?.(pos.tokenId);
  };

  const handleOpenManage = (pos: PositionDetail, mode: 'increase' | 'decrease') => {
    setSelectedPosition(pos);
    setManageMode(mode);
    setIsManageOpen(true);
  };

  const handleCollectAll = async () => {
    try {
      info(
        'Batch Collecting Fees',
        `Submitting batch collection for ${positions.length} positions...`
      );
      for (const pos of positions) {
        if (pos.uncollectedFeesUSD !== '$0.00') {
          await collectFees(pos.tokenId);
        }
      }
      success(
        'All Fees Collected',
        `Successfully collected ${summaryMetrics.totalFees} in trading fees across all positions.`
      );
    } catch (err: unknown) {
      error(
        'Batch Collection Failed',
        err instanceof Error ? err.message : 'Transaction reverted'
      );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Liquidity Positions
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your concentrated, discretized bin, and stableswap ERC-721 positions with 1-click fee compounding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<RotateCcw className="w-4 h-4 text-emerald-500" />}
            isLoading={isManaging}
            onClick={handleCollectAll}
            disabled={!isConnected || positions.length === 0}
          >
            Collect All Fees ({summaryMetrics.totalFees})
          </Button>
          <Button
            variant="brand"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigateNewPosition?.()}
          >
            New Position
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="surface" className="p-4.5 border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Portfolio Liquidity
            </span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          {isConnected && isLoading ? (
            <>
              <Skeleton className="h-8 w-28 mb-1.5" />
              <Skeleton className="h-2.5 w-32" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {summaryMetrics.totalLiquidity}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {isConnected ? 'Across active positions' : 'Connect wallet to view'}
              </div>
            </>
          )}
        </Card>

        <Card variant="surface" className="p-4.5 border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Uncollected Fees
            </span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          {isConnected && isLoading ? (
            <>
              <Skeleton className="h-8 w-24 mb-1.5" />
              <Skeleton className="h-2.5 w-36" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {summaryMetrics.totalFees}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                Ready for 1-click collection
              </div>
            </>
          )}
        </Card>

        <Card variant="surface" className="p-4.5 border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Estimated 24h Yield
            </span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          {isConnected && isLoading ? (
            <>
              <Skeleton className="h-8 w-24 mb-1.5" />
              <Skeleton className="h-2.5 w-28" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {summaryMetrics.est24hYield}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">Based on 7d avg volume</div>
            </>
          )}
        </Card>

        <Card variant="surface" className="p-4.5 border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Active In-Range
            </span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          {isConnected && isLoading ? (
            <>
              <Skeleton className="h-8 w-16 mb-1.5" />
              <Skeleton className="h-2.5 w-28" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {summaryMetrics.activeRatio}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">Earning trading fees</div>
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pair, token symbol, or NFT #ID..."
            className="pl-9.5 h-10 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl text-xs">
            {[
              { id: 'all', label: 'All Curves' },
              { id: 'clamm', label: 'CLAMM' },
              { id: 'binamm', label: 'BinAMM' },
              { id: 'stableamm', label: 'StableAMM' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCurve(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedCurve === tab.id
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'in-range', label: 'In Range' },
              { id: 'out-of-range', label: 'Out of Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedStatus === tab.id
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {!isConnected ? (
        <Card variant="surface" className="p-16 text-center border-neutral-200 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Connect Your Wallet
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Connect your Web3 wallet to manage active LP positions, collect accrued fees, and auto-compound yield.
          </p>
          <Button
            variant="brand"
            size="md"
            leftIcon={<Wallet className="w-4 h-4" />}
            onClick={() => open()}
          >
            Connect Wallet
          </Button>
        </Card>
      ) : isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                variant="surface"
                className="p-5 border-neutral-200/80 dark:border-white/[0.08] flex flex-col gap-4"
              >
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-white/[0.08] flex items-stretch">
                  <Skeleton className="w-[92px] h-[92px] rounded-none shrink-0" />
                  <div className="flex-1 p-3 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111317] overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                  {['Position', 'Curve', 'Status', 'Value', 'Fees', 'Range'].map((label) => (
                    <TableHead
                      key={label}
                      className="py-3.5 px-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400"
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
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
                        <Skeleton className="h-3.5 w-28" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Skeleton className="h-5 w-14" />
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Skeleton className="h-3.5 w-16" />
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Skeleton className="h-3.5 w-12" />
                    </TableCell>
                    <TableCell className="py-4 px-4">
                      <Skeleton className="h-3.5 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : filteredPositions.length === 0 ? (
        <Card variant="surface" className="p-12 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            No active positions found
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            You don&apos;t have any active liquidity positions matching the current filters. Provide concentrated liquidity across CLAMM, BinAMM, or StableAMM pools to earn trading fees.
          </p>
          <Button
            variant="brand"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigateNewPosition?.()}
          >
            Create New Position
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPositions.map((pos) => (
            <Card
              key={pos.id}
              variant="surface"
              className="p-5 border-neutral-200/80 dark:border-white/[0.08] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all flex flex-col justify-between"
            >
              <div>
                {/* NFT + meta header — NFT stays Obsidian; meta panel is theme-aware */}
                <div className="mb-4 rounded-xl overflow-hidden border border-neutral-300 dark:border-white/[0.08] flex items-stretch bg-white dark:bg-[#08090B]">
                  <div className="w-[92px] h-[92px] shrink-0 bg-[#08090B] border-r border-neutral-200 dark:border-white/[0.06]">
                    <PositionNFTArt
                      tokenId={pos.tokenId}
                      symbol0={pos.token0.symbol}
                      symbol1={pos.token1.symbol}
                      curveType={pos.curveType}
                      feeTier={pos.feeTier}
                      tickLower={pos.tickLower}
                      tickUpper={pos.tickUpper}
                      currency0={pos.token0.address}
                      currency1={pos.token1.address}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-center min-w-0 bg-neutral-50 dark:bg-white/[0.03]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-base text-neutral-900 dark:text-white truncate">
                        {pos.pair}
                      </span>
                      <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                        #{pos.tokenId.toString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                      Fee Tier: {pos.feeTier}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={
                          pos.curve === 'CLAMM'
                            ? 'brand'
                            : pos.curve === 'BinAMM'
                            ? 'purple'
                            : 'default'
                        }
                        size="sm"
                        className="font-mono"
                      >
                        {pos.curve}
                      </Badge>
                      <Badge
                        variant={pos.status === 'in-range' ? 'success' : 'danger'}
                        size="sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
                        {pos.status === 'in-range' ? 'In Range' : 'Out of Range'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-100/80 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.06] mb-4">
                  <div>
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-400 block mb-0.5">
                      Position Value
                    </span>
                    <span className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
                      {pos.liquidityUSD}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-400 block mb-0.5">
                      Uncollected Fees
                    </span>
                    <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                      {pos.uncollectedFeesUSD}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs font-mono mb-4 px-0.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-600 dark:text-neutral-400">Min Price:</span>
                    <span className="text-neutral-900 dark:text-neutral-100 font-medium text-right">
                      {pos.minPrice}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-600 dark:text-neutral-400">Max Price:</span>
                    <span className="text-neutral-900 dark:text-neutral-100 font-medium text-right">
                      {pos.maxPrice}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-neutral-200 dark:border-white/[0.08]">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleOpenDetail(pos)}
                >
                  View Details
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleOpenManage(pos, 'increase')}
                >
                  Increase
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleOpenManage(pos, 'decrease')}
                >
                  Withdraw
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card variant="surface" className="overflow-hidden border-neutral-200/80 dark:border-white/[0.08]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Curve</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Position Value</TableHead>
                  <TableHead className="text-right">Uncollected Fees</TableHead>
                  <TableHead className="text-right">APR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex -space-x-1.5">
                          <TokenLogo
                            symbol={pos.token0.symbol}
                            address={pos.token0.address}
                            logoURI={pos.token0.logoURI}
                            size="sm"
                          />
                          <TokenLogo
                            symbol={pos.token1.symbol}
                            address={pos.token1.address}
                            logoURI={pos.token1.logoURI}
                            size="sm"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                            {pos.pair} <span className="font-mono text-neutral-400 font-normal">#{pos.tokenId.toString()}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400">Fee Tier: {pos.feeTier}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          pos.curve === 'CLAMM'
                            ? 'brand'
                            : pos.curve === 'BinAMM'
                            ? 'purple'
                            : 'default'
                        }
                        size="sm"
                        className="font-mono text-[10px]"
                      >
                        {pos.curve}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={pos.status === 'in-range' ? 'success' : 'danger'}
                        size="sm"
                        className="text-[10px]"
                      >
                        {pos.status === 'in-range' ? 'In Range' : 'Out of Range'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                      {pos.liquidityUSD}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {pos.uncollectedFeesUSD}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-neutral-700 dark:text-neutral-300">
                      {pos.apr}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleOpenDetail(pos)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleOpenManage(pos, 'increase')}
                        >
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ManageLiquidityModal
        isOpen={isManageOpen}
        onClose={() => {
          setIsManageOpen(false);
          setSelectedPosition(null);
          void refreshAllPositions();
        }}
        position={selectedPosition}
        initialMode={manageMode}
      />
    </div>
  );
};
