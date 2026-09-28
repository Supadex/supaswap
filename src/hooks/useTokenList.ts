import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Address } from 'viem';
import { isAddress, getAddress } from 'viem';
import { useConnection, usePublicClient } from 'wagmi';
import { ERC20ABI } from '../contracts/abis';
import { getTokensForChain } from '../contracts/addresses';
import type { TokenMetadata } from '../contracts/types';

const STORAGE_KEY = 'supadex_custom_tokens';

export function useTokenList() {
  const { chainId } = useConnection();
  const publicClient = usePublicClient();

  // Custom tokens saved in localStorage per chain
  const [customTokens, setCustomTokens] = useState<TokenMetadata[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Sync custom tokens to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTokens));
    } catch (e) {
      console.error('Failed to save custom tokens to storage', e);
    }
  }, [customTokens]);

  // EVM Chain-scoped token list (Uniswap architecture)
  const chainTokens = useMemo(() => {
    return getTokensForChain(chainId);
  }, [chainId]);

  // Combine chain-specific default tokens + custom user imported tokens
  const allTokens = useMemo(() => {
    const combined = [...customTokens, ...chainTokens];
    const unique = new Map<string, TokenMetadata>();
    for (const t of combined) {
      const key = `${t.symbol.toUpperCase()}-${t.address.toLowerCase()}-${t.isClaim ? 'claim' : 'phys'}`;
      if (!unique.has(key)) {
        unique.set(key, t);
      }
    }
    return Array.from(unique.values());
  }, [customTokens, chainTokens]);

  // Lookup or fetch on-chain token metadata if contract address is pasted
  const fetchTokenByAddress = useCallback(
    async (rawAddress: string): Promise<TokenMetadata | null> => {
      if (!isAddress(rawAddress)) return null;
      const address = getAddress(rawAddress) as Address;

      // Check existing in list
      const existing = allTokens.find(
        (t) => t.address.toLowerCase() === address.toLowerCase()
      );
      if (existing) return existing;

      if (!publicClient) return null;

      try {
        setIsLoadingToken(true);
        const client = publicClient as any;
        const [name, symbol, decimals] = await Promise.all([
          client.readContract({
            address,
            abi: ERC20ABI,
            functionName: 'name',
          }).catch(() => 'Custom Token'),
          client.readContract({
            address,
            abi: ERC20ABI,
            functionName: 'symbol',
          }).catch(() => 'CUSTOM'),
          client.readContract({
            address,
            abi: ERC20ABI,
            functionName: 'decimals',
          }).catch(() => 18),
        ]);

        const newToken: TokenMetadata = {
          address,
          name: String(name),
          symbol: String(symbol),
          decimals: Number(decimals),
          priceUSD: 0,
        };

        return newToken;
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
      if (prev.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) {
        return prev;
      }
      return [token, ...prev];
    });
  }, []);

  const removeCustomToken = useCallback((address: Address) => {
    setCustomTokens((prev) =>
      prev.filter((t) => t.address.toLowerCase() !== address.toLowerCase())
    );
  }, []);

  return {
    tokens: allTokens,
    chainTokens,
    customTokens,
    fetchTokenByAddress,
    importToken,
    removeCustomToken,
    isLoadingToken,
  };
}
