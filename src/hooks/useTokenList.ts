import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { isAddress, getAddress, zeroAddress } from 'viem';
import { useChainId, usePublicClient } from 'wagmi';
import { ERC20ABI } from '../contracts/abis';
import { getTokensForChain } from '../contracts/addresses';
import type { TokenMetadata } from '../contracts/types';
import {
  fetchRemoteTokensForChain,
  shouldFetchRemoteTokenList,
} from '../services/fetchTokenList';
import {
  applyMarketData,
  fetchTokenMarketData,
  shouldFetchMarketData,
} from '../services/fetchTokenMarketData';
import { enrichTokenLogo } from '../utils/tokenLogo';

const STORAGE_KEY = 'supadex_custom_tokens';

function tokenDedupeKey(t: TokenMetadata): string {
  return `${t.address.toLowerCase()}-${t.isClaim ? 'claim' : 'phys'}`;
}

/** Defaults first (ETH/USDC/USDT), then remote / custom. */
function mergePhysicalLists(
  defaults: TokenMetadata[],
  remote: TokenMetadata[],
  custom: TokenMetadata[]
): TokenMetadata[] {
  const unique = new Map<string, TokenMetadata>();

  const upsert = (t: TokenMetadata, preferIncomingLogo = false) => {
    if (t.isClaim) return;
    const key = tokenDedupeKey({ ...t, isClaim: false });
    const existing = unique.get(key);
    const next = enrichTokenLogo({ ...t, isClaim: false });
    if (!existing) {
      unique.set(key, next);
      return;
    }
    unique.set(key, {
      ...existing,
      ...next,
      // Keep default price until market enrichment runs
      priceUSD: next.priceUSD || existing.priceUSD,
      logoURI:
        preferIncomingLogo && next.logoURI
          ? next.logoURI
          : existing.logoURI || next.logoURI,
      priceChange24h: next.priceChange24h ?? existing.priceChange24h,
      volume24hUSD: next.volume24hUSD ?? existing.volume24hUSD,
    });
  };

  for (const t of defaults) upsert(t);
  for (const t of remote) upsert(t, true);
  for (const t of custom) upsert(t, true);

  return Array.from(unique.values());
}

function withClaimLedger(physical: TokenMetadata[]): TokenMetadata[] {
  const withClaims: TokenMetadata[] = [...physical];
  for (const t of physical) {
    withClaims.push(
      enrichTokenLogo({
        ...t,
        symbol: t.symbol.startsWith('c') ? t.symbol : `c${t.symbol}`,
        name: `Vault Claim ${t.symbol}`,
        isClaim: true,
        isNative: false,
      })
    );
  }
  return withClaims;
}

export function useTokenList() {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [customTokens, setCustomTokens] = useState<TokenMetadata[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [remoteTokens, setRemoteTokens] = useState<TokenMetadata[]>([]);
  const [marketTokens, setMarketTokens] = useState<TokenMetadata[] | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isLoadingRemoteList, setIsLoadingRemoteList] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTokens));
    } catch (e) {
      console.error('Failed to save custom tokens to storage', e);
    }
  }, [customTokens]);

  // Remote curated lists (Uniswap + CoinGecko) — skip Anvil
  useEffect(() => {
    if (!shouldFetchRemoteTokenList(chainId)) {
      setRemoteTokens([]);
      setIsLoadingRemoteList(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setIsLoadingRemoteList(true);
    setRemoteTokens([]);
    setMarketTokens(null);

    fetchRemoteTokensForChain(chainId, controller.signal)
      .then((tokens) => {
        if (!cancelled) setRemoteTokens(tokens);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) setRemoteTokens([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRemoteList(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chainId]);

  const chainTokens = useMemo(() => getTokensForChain(chainId), [chainId]);

  const physicalBase = useMemo(
    () => mergePhysicalLists(chainTokens, remoteTokens, customTokens),
    [chainTokens, remoteTokens, customTokens]
  );

  // CoinGecko market enrichment once physical list is ready
  useEffect(() => {
    if (!shouldFetchMarketData(chainId)) {
      setMarketTokens(null);
      setIsLoadingMarket(false);
      return;
    }

    // Wait until remote list settled (or failed) so we price the full set
    if (isLoadingRemoteList) return;

    const controller = new AbortController();
    let cancelled = false;
    setIsLoadingMarket(true);

    fetchTokenMarketData(chainId, physicalBase, controller.signal)
      .then((market) => {
        if (cancelled) return;
        setMarketTokens(applyMarketData(physicalBase, market));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) setMarketTokens(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMarket(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chainId, physicalBase, isLoadingRemoteList]);

  const allTokens = useMemo(() => {
    const physical = marketTokens ?? physicalBase;
    return withClaimLedger(physical);
  }, [marketTokens, physicalBase]);

  const fetchTokenByAddress = useCallback(
    async (rawAddress: string): Promise<TokenMetadata | null> => {
      if (!isAddress(rawAddress)) return null;
      const address = getAddress(rawAddress) as Address;

      const existing = allTokens.find(
        (t) => t.address.toLowerCase() === address.toLowerCase() && !t.isClaim
      );
      if (existing) return existing;

      if (!publicClient) return null;

      try {
        setIsLoadingToken(true);
        const client = publicClient;
        const [name, symbol, decimals] = await Promise.all([
          client
            .readContract({
              address,
              abi: ERC20ABI,
              functionName: 'name',
            })
            .catch(() => 'Custom Token'),
          client
            .readContract({
              address,
              abi: ERC20ABI,
              functionName: 'symbol',
            })
            .catch(() => 'CUSTOM'),
          client
            .readContract({
              address,
              abi: ERC20ABI,
              functionName: 'decimals',
            })
            .catch(() => 18),
        ]);

        return {
          address,
          name: String(name),
          symbol: String(symbol),
          decimals: Number(decimals),
          priceUSD: 0,
        };
      } catch (err) {
        console.error('Failed to fetch on-chain token metadata', err);
        return null;
      } finally {
        setIsLoadingToken(false);
      }
    },
    [allTokens, publicClient]
  );

  const importToken = useCallback((token: TokenMetadata) => {
    setCustomTokens((prev) => {
      if (
        prev.some(
          (t) =>
            t.address.toLowerCase() === token.address.toLowerCase() ||
            (token.address.toLowerCase() === zeroAddress && t.isNative)
        )
      ) {
        return prev;
      }
      return [token, ...prev];
    });
  }, []);

  const removeCustomToken = useCallback((addr: Address) => {
    setCustomTokens((prev) =>
      prev.filter((t) => t.address.toLowerCase() !== addr.toLowerCase())
    );
  }, []);

  return {
    tokens: allTokens,
    chainTokens,
    remoteTokens,
    customTokens,
    chainId,
    fetchTokenByAddress,
    importToken,
    removeCustomToken,
    isLoadingToken,
    isLoadingRemoteList,
    isLoadingMarket,
    isLoadingList: isLoadingRemoteList || isLoadingMarket,
  };
}
