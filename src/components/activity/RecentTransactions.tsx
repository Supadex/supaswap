import React, { useEffect, useState } from 'react';
import { useConnection, usePublicClient } from 'wagmi';
import { ArrowDownUp, ExternalLink, Minus, Plus } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { getAddressesForChain } from '../../contracts/addresses';
import type { TokenMetadata } from '../../contracts/types';
import {
  fetchPoolRecentTxs,
  fetchPositionRecentTxs,
  type RecentTx,
} from '../../services/onchainIndex';
import {
  formatTimeAgo,
  getExplorerTxUrl,
  shortenAddress,
} from '../../utils/formatters';

type Scope =
  | { kind: 'pool'; poolId: `0x${string}`; token0: TokenMetadata; token1: TokenMetadata }
  | { kind: 'position'; tokenId: bigint; token0: TokenMetadata; token1: TokenMetadata };

interface RecentTransactionsProps {
  scope: Scope;
  limit?: number;
  className?: string;
}

function typeLabel(type: RecentTx['type']): string {
  if (type === 'swap') return 'Swap';
  if (type === 'add') return 'Add';
  return 'Remove';
}

function TypeIcon({ type }: { type: RecentTx['type'] }) {
  if (type === 'swap') return <ArrowDownUp className="w-3 h-3" />;
  if (type === 'add') return <Plus className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  scope,
  limit = 10,
  className = '',
}) => {
  const { chainId } = useConnection();
  const publicClient = usePublicClient();
  const addresses = getAddressesForChain(chainId);
  const [txs, setTxs] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!publicClient) {
        setTxs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let next: RecentTx[] = [];
        if (scope.kind === 'pool' && addresses.poolManager) {
          next = await fetchPoolRecentTxs({
            publicClient,
            poolManager: addresses.poolManager,
            poolId: scope.poolId,
            token0: scope.token0,
            token1: scope.token1,
            limit,
          });
        } else if (scope.kind === 'position' && addresses.positionManager) {
          next = await fetchPositionRecentTxs({
            publicClient,
            positionManager: addresses.positionManager,
            tokenId: scope.tokenId,
            token0: scope.token0,
            token1: scope.token1,
            limit,
          });
        }
        if (!cancelled) setTxs(next);
      } catch (err) {
        console.warn('RecentTransactions fetch failed', err);
        if (!cancelled) setTxs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    publicClient,
    addresses.poolManager,
    addresses.positionManager,
    scope.kind,
    scope.kind === 'pool' ? scope.poolId : scope.tokenId.toString(),
    scope.token0.address,
    scope.token1.address,
    limit,
  ]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Transactions
        </h3>
        <span className="text-[10px] font-mono text-neutral-400">Latest {limit}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : txs.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-neutral-400 border border-dashed border-neutral-200 dark:border-white/[0.08] rounded-xl">
          No transactions yet
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200/70 dark:divide-white/[0.06] rounded-xl border border-neutral-200/80 dark:border-white/[0.08] overflow-hidden bg-neutral-50/40 dark:bg-white/[0.015]">
          {txs.map((tx) => {
            const href = getExplorerTxUrl(tx.hash, chainId);
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/60 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge
                    variant={
                      tx.type === 'swap' ? 'brand' : tx.type === 'add' ? 'success' : 'danger'
                    }
                    size="sm"
                    className="font-mono text-[10px] shrink-0 gap-1"
                  >
                    <TypeIcon type={tx.type} />
                    {typeLabel(tx.type)}
                  </Badge>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-neutral-800 dark:text-neutral-200 truncate">
                      {tx.summary}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                      {tx.timestamp > 0 ? formatTimeAgo(tx.timestamp) : '—'}
                    </div>
                  </div>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortenAddress(tx.hash, 3)}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                ) : (
                  <span className="font-mono text-[10px] text-neutral-400 shrink-0">
                    {shortenAddress(tx.hash, 3)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
