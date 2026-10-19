import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useConnection, usePublicClient } from 'wagmi';
import type { CurveType, TokenMetadata } from '../contracts/types';
import { getAddressesForChain } from '../contracts/addresses';
import { fetchOnchainPools } from '../services/onchainIndex';
import { useTokenList } from './useTokenList';

export interface PoolItem {
  id: string;
  pair: string;
  token0: TokenMetadata;
  token1: TokenMetadata;
  curve: 'CLAMM' | 'BinAMM' | 'StableAMM';
  curveType: CurveType;
  feeTier: string;
  feeNumber: number;
  tickSpacing?: number;
  plugin?: string;
  poolId?: string;
  tvlUSD: number;
  volume24hUSD: number;
  /** 24h volume / TVL (Uniswap-style ratio). */
  volTvl: number;
  apr: string;
  lvrProtection: string;
  activeLiquidity?: bigint;
}

/**
 * On-chain pool registry — Initialize events are the single source of truth.
 * No localStorage.
 */
export function usePools() {
  const { chainId } = useConnection();
  const publicClient = usePublicClient();
  const addresses = getAddressesForChain(chainId);
  const { tokens, isLoadingList } = useTokenList();

  const knownTokens = useMemo(
    () => tokens.filter((t) => !t.isClaim),
    [tokens]
  );

  const [pools, setPools] = useState<PoolItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPools = useCallback(async () => {
    if (!publicClient || !addresses.poolManager) {
      setPools([]);
      setIsLoading(false);
      return;
    }
    if (isLoadingList && knownTokens.length < 3) {
      setIsLoading(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchOnchainPools({
        publicClient,
        poolManager: addresses.poolManager,
        knownTokens,
        lvrShieldPlugin: addresses.lvrShieldPlugin,
        antiJITPlugin: addresses.antiJITPlugin,
      });
      setPools(next);
    } catch (err) {
      console.warn('refreshPools failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load pools');
      setPools([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    publicClient,
    addresses.poolManager,
    addresses.lvrShieldPlugin,
    addresses.antiJITPlugin,
    knownTokens,
    isLoadingList,
  ]);

  useLayoutEffect(() => {
    if (publicClient && addresses.poolManager) {
      setIsLoading(true);
    }
  }, [publicClient, addresses.poolManager]);

  useEffect(() => {
    void refreshPools();
  }, [refreshPools]);

  const totalTVL = pools.reduce((acc, p) => acc + (p.tvlUSD || 0), 0);
  const totalVolume24h = pools.reduce((acc, p) => acc + (p.volume24hUSD || 0), 0);
  const totalFees24h = pools.reduce(
    (acc, p) => acc + (p.volume24hUSD * (p.feeNumber / 1_000_000) || 0),
    0
  );

  return {
    pools,
    refreshPools,
    isLoading,
    error,
    totalTVL,
    totalVolume24h,
    totalFees24h,
    activePoolsCount: pools.length,
  };
}
