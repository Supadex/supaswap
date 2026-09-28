import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { TokenLogo } from '../components/ui/TokenLogo';
import { Badge } from '../components/ui/Badge';
import { useTokenList } from '../hooks/useTokenList';
import { TrendingUp, Search, Activity, BarChart2 } from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { tokens } = useTokenList();

  // Filter out claim tokens for general token explorer
  const physicalTokens = tokens.filter((t) => !t.isClaim);

  const filtered = physicalTokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Explore Markets & Telemetry
            </h1>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time multi-asset volume, pricing, and curve distribution across SupaDex.
          </p>
        </div>
      </div>

      {/* Protocol Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Supported Assets</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            {physicalTokens.length} Tokens
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            Across CLAMM, BinAMM & StableAMM
          </div>
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Dynamic LVR Engine</span>
            <BarChart2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            Sub-second Decay
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            Neutralizes toxic arbitrage
          </div>
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Settlement Model</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            EIP-6909 Native
          </div>
          <div className="text-xs text-neutral-400 mt-1 font-mono">
            0-gas transient token netting
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="w-full sm:w-80">
        <Input
          placeholder="Search tokens by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="rounded-xl text-xs"
        />
      </div>

      {/* Top Tokens Table */}
      <Card variant="surface" className="overflow-hidden border-neutral-200/80 dark:border-white/[0.08]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Token Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">24h Vol Rank</TableHead>
              <TableHead className="text-right">Type</TableHead>
              <TableHead className="text-right">Contract Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-neutral-500">
                  No tokens found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t, idx) => (
                <TableRow key={`${t.symbol}-${t.address}`}>
                  <TableCell className="text-center font-mono text-xs text-neutral-400">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <TokenLogo symbol={t.symbol} address={t.address} size="md" />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                          {t.symbol}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-neutral-900 dark:text-white font-medium">
                    {t.priceUSD > 0 ? `$${t.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={idx < 3 ? 'brand' : 'default'} size="sm" className="font-mono text-[10px]">
                      Top #{idx + 1} Volume
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={t.isNative ? 'success' : 'outline'} size="sm" className="font-mono text-[10px]">
                      {t.isNative ? 'Native' : 'ERC-20'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {t.address === '0x0000000000000000000000000000000000000000' ? (
                      'Native Eth'
                    ) : (
                      `${t.address.slice(0, 6)}...${t.address.slice(-4)}`
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
