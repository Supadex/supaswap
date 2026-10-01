import { getAddress, isAddress, type Address } from 'viem';
import type { TokenMetadata } from '../contracts/types';

/** Uniswap Default Token List (Token Lists schema) — primary catalog for prod nets. */
export const UNISWAP_TOKEN_LIST_URL = 'https://tokens.uniswap.org';

/**
 * Optional extended lists (Token Lists schema). Kept small / curated.
 * CoinGecko "all.json" catalogs are intentionally avoided (multi‑MB).
 */
export const EXTENDED_TOKEN_LIST_URLS: Partial<Record<number, string[]>> = {
  // Superchain / L2 community lists can be added here as needed
};

/** Cap remote lists so the selector stays usable. */
export const REMOTE_TOKEN_CAP = 300;

/** Local Anvil — never fetch remote popular lists. */
export const LOCAL_CHAIN_IDS = new Set([31337]);

interface TokenListEntry {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface TokenListJson {
  tokens?: TokenListEntry[];
  name?: string;
}

async function fetchTokenListJson(
  url: string,
  signal?: AbortSignal
): Promise<TokenListEntry[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as TokenListJson;
  return Array.isArray(data.tokens) ? data.tokens : [];
}

function mapEntry(t: TokenListEntry, chainId: number): TokenMetadata | null {
  if (t.chainId !== chainId) return null;
  if (!isAddress(t.address)) return null;
  if (!t.symbol || !t.name) return null;

  return {
    address: getAddress(t.address) as Address,
    symbol: t.symbol,
    name: t.name,
    decimals: Number(t.decimals) || 18,
    logoURI: t.logoURI,
    priceUSD: 0,
  };
}

/**
 * Fetch curated remote token lists for `chainId` (Uniswap default + optional extended).
 * Prices come separately from CoinGecko (`fetchTokenMarketData`).
 */
export async function fetchRemoteTokensForChain(
  chainId: number,
  signal?: AbortSignal
): Promise<TokenMetadata[]> {
  if (LOCAL_CHAIN_IDS.has(chainId)) return [];

  const urls = [UNISWAP_TOKEN_LIST_URL, ...(EXTENDED_TOKEN_LIST_URLS[chainId] ?? [])];

  try {
    const batches = await Promise.all(
      urls.map((url) =>
        fetchTokenListJson(url, signal).catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          console.warn('Token list fetch failed', url, err);
          return [] as TokenListEntry[];
        })
      )
    );

    const unique = new Map<string, TokenMetadata>();
    for (const entries of batches) {
      for (const entry of entries) {
        const mapped = mapEntry(entry, chainId);
        if (!mapped) continue;
        const key = mapped.address.toLowerCase();
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, mapped);
        } else if (!existing.logoURI && mapped.logoURI) {
          unique.set(key, { ...existing, logoURI: mapped.logoURI });
        }
      }
    }

    return Array.from(unique.values()).slice(0, REMOTE_TOKEN_CAP);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    console.warn('Failed to fetch remote token lists', err);
    return [];
  }
}

export function shouldFetchRemoteTokenList(chainId?: number): chainId is number {
  return typeof chainId === 'number' && !LOCAL_CHAIN_IDS.has(chainId);
}
