import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import type { TokenMetadata, CurveType } from '../contracts/types';

export interface PoolItem {
  id: string;
  pair: string;
  token0: TokenMetadata;
  token1: TokenMetadata;
  curve: 'CLAMM' | 'BinAMM' | 'StableAMM';
  curveType: CurveType;
  feeTier: string;
  feeNumber: number;
  tvlUSD: number;
  volume24hUSD: number;
  apr: string;
  lvrProtection: string;
}

const STORAGE_POOLS_KEY = 'supadex_initialized_pools';

export function usePools() {
  const { chainId } = useAccount();

  const [storedPools, setStoredPools] = useState<Record<number, PoolItem[]>>({});

  const currentChainId = chainId || 11155111;

  const pools: PoolItem[] = useMemo(() => {
    if (storedPools[currentChainId]) {
      return storedPools[currentChainId];
    }
    try {
      const saved = localStorage.getItem(`${STORAGE_POOLS_KEY}_${currentChainId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [currentChainId, storedPools]);

  const addPool = (newPool: PoolItem) => {
    const updated = [newPool, ...pools];
    setStoredPools((prev) => ({
      ...prev,
      [currentChainId]: updated,
    }));
    try {
      localStorage.setItem(`${STORAGE_POOLS_KEY}_${currentChainId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save pool to storage', e);
    }
  };

  // Aggregate stats from actual pools
  const totalTVL = pools.reduce((acc, p) => acc + (p.tvlUSD || 0), 0);
  const totalVolume24h = pools.reduce((acc, p) => acc + (p.volume24hUSD || 0), 0);
  const totalFees24h = pools.reduce((acc, p) => acc + (p.volume24hUSD * (p.feeNumber / 1000000) || 0), 0);

  return {
    pools,
    addPool,
    totalTVL,
    totalVolume24h,
    totalFees24h,
    activePoolsCount: pools.length,
  };
}
