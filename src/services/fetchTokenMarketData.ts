import { zeroAddress } from 'viem';
import type { TokenMetadata } from '../contracts/types';
import { LOCAL_CHAIN_IDS } from './fetchTokenList';

/** DefiLlama / CoinGecko platform prefixes for contract lookups. */
export const LLAMA_PREFIX_BY_CHAIN: Partial<Record<number, string>> = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum',
};

export const NATIVE_COINGECKO_ID_BY_CHAIN: Partial<Record<number, string>> = {
  1: 'ethereum',
  8453: 'ethereum',
  42161: 'ethereum',
  11155111: 'ethereum',
};

export const WETH_BY_CHAIN: Partial<Record<number, string>> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
};

/** Free CoinGecko still used for 24h volume on a small priority set. */
export const COINGECKO_PLATFORM_BY_CHAIN: Partial<Record<number, string>> = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum-one',
};

export interface TokenMarketSnapshot {
  priceUSD: number;
  priceChange24h: number;
  volume24hUSD: number;
}

type MarketMap = Map<string, TokenMarketSnapshot>;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_VERSION = 3; // bump when pricing strategy changes
const LLAMA_CHUNK = 50;
const LLAMA_CHUNK_DELAY_MS = 120;
const CG_VOLUME_CAP = 20;
const CG_RETRY_MS = 2500;

interface CacheBlob {
  updatedAt: number;
  entries: [string, TokenMarketSnapshot][];
}

function cacheKey(chainId: number): string {
  return `supadex_market_v${CACHE_VERSION}_${chainId}`;
}

function readCache(chainId: number): MarketMap | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(chainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheBlob;
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > CACHE_TTL_MS) return null;
    return new Map(parsed.entries);
  } catch {
    return null;
  }
}

function writeCache(chainId: number, map: MarketMap): void {
  try {
    const blob: CacheBlob = {
      updatedAt: Date.now(),
      entries: Array.from(map.entries()),
    };
    sessionStorage.setItem(cacheKey(chainId), JSON.stringify(blob));
  } catch {
    // quota / private mode
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
  retries = 2
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: HeadersInit = {};
      const cgKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
      if (cgKey && url.includes('coingecko.com')) {
        headers['x-cg-demo-api-key'] = cgKey;
      }

      const res = await fetch(url, { signal, headers });
      if (res.status === 429) {
        if (attempt === retries) return null;
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : CG_RETRY_MS * (attempt + 1);
        await sleep(wait, signal);
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (attempt === retries) return null;
      await sleep(CG_RETRY_MS, signal);
    }
  }
  return null;
}

/** When contract lookup misses, fall back to CoinGecko asset ids (DefiLlama `coingecko:` keys). */
const COINGECKO_ID_BY_SYMBOL: Record<string, string> = {
  CAKE: 'pancakeswap-token',
  BUSD: 'binance-usd',
  BNB: 'binancecoin',
  UNI: 'uniswap',
  LINK: 'chainlink',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  RETH: 'rocket-pool-eth',
  STETH: 'staked-ether',
  WSTETH: 'wrapped-steth',
  CBETH: 'coinbase-wrapped-staked-eth',
  DAI: 'dai',
  FRAX: 'frax',
  GRT: 'the-graph',
  ENS: 'ethereum-name-service',
  COMP: 'compound-governance-token',
  SNX: 'havven',
  SUSHI: 'sushi',
  '1INCH': '1inch',
};
function volumePriorityTokens(tokens: TokenMetadata[]): TokenMetadata[] {
  const majors = new Set([
    'USDC',
    'USDT',
    'DAI',
    'WETH',
    'WBTC',
    'ETH',
    'UNI',
    'LINK',
    'AAVE',
    'ARB',
    'CAKE',
    'BUSD',
    'BNB',
  ]);
  const seen = new Set<string>();
  const out: TokenMetadata[] = [];

  const push = (t: TokenMetadata) => {
    const key = t.isNative ? zeroAddress : t.address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  for (const t of tokens) {
    if (t.isNative || majors.has(t.symbol.toUpperCase())) push(t);
  }
  for (const t of tokens) {
    if (out.length >= CG_VOLUME_CAP) break;
    push(t);
  }
  return out.slice(0, CG_VOLUME_CAP);
}

interface LlamaPriceCoin {
  price?: number;
  symbol?: string;
  timestamp?: number;
  confidence?: number;
}

interface LlamaPricesResponse {
  coins?: Record<string, LlamaPriceCoin>;
}

/**
 * Fetch USD price + 24h change via DefiLlama (primary — generous CORS / rate limits).
 * Soft-enrich 24h volume via CoinGecko for a small priority set (rate-limited + cached).
 */
export async function fetchTokenMarketData(
  chainId: number,
  tokens: TokenMetadata[],
  signal?: AbortSignal
): Promise<MarketMap> {
  const cached = readCache(chainId);
  if (cached && cached.size > 0) return cached;

  const map: MarketMap = new Map();
  if (LOCAL_CHAIN_IDS.has(chainId) || tokens.length === 0) return map;

  const prefix = LLAMA_PREFIX_BY_CHAIN[chainId];
  const nativeId = NATIVE_COINGECKO_ID_BY_CHAIN[chainId];
  const physical = tokens.filter((t) => !t.isClaim);
  const volumePriority = volumePriorityTokens(physical);

  // Build DefiLlama coin keys for the FULL list (chunked — no 60-token price cap)
  const llamaKeys: string[] = [];
  if (nativeId) llamaKeys.push(`coingecko:${nativeId}`);

  const weth = WETH_BY_CHAIN[chainId]?.toLowerCase();
  if (prefix) {
    for (const t of physical) {
      if (t.isNative || t.address.toLowerCase() === zeroAddress) continue;
      llamaKeys.push(`${prefix}:${t.address.toLowerCase()}`);
    }
    if (weth) llamaKeys.push(`${prefix}:${weth}`);
  }

  const uniqueKeys = [...new Set(llamaKeys)];

  // Prices
  const priceGroups = chunkArray(uniqueKeys, LLAMA_CHUNK);
  for (let i = 0; i < priceGroups.length; i++) {
    const group = priceGroups[i];
    const url = `https://coins.llama.fi/prices/current/${group.join(',')}`;
    const data = await fetchJson<LlamaPricesResponse>(url, signal);
    if (data?.coins) {
      for (const [key, row] of Object.entries(data.coins)) {
        if (row?.price == null) continue;
        if (key.startsWith('coingecko:')) {
          map.set(zeroAddress, {
            priceUSD: row.price,
            priceChange24h: map.get(zeroAddress)?.priceChange24h ?? 0,
            volume24hUSD: map.get(zeroAddress)?.volume24hUSD ?? 0,
          });
          continue;
        }
        const addr = key.split(':')[1]?.toLowerCase();
        if (!addr) continue;
        map.set(addr, {
          priceUSD: row.price,
          priceChange24h: map.get(addr)?.priceChange24h ?? 0,
          volume24hUSD: map.get(addr)?.volume24hUSD ?? 0,
        });
      }
    }
    if (i < priceGroups.length - 1) {
      await sleep(LLAMA_CHUNK_DELAY_MS, signal).catch(() => undefined);
    }
  }

  // 24h % change for tokens we successfully priced (+ native)
  const pricedKeys = uniqueKeys.filter((key) => {
    if (key.startsWith('coingecko:')) return map.has(zeroAddress);
    const addr = key.split(':')[1]?.toLowerCase();
    return Boolean(addr && map.has(addr));
  });

  if (pricedKeys.length > 0) {
    const pctGroups = chunkArray(pricedKeys, LLAMA_CHUNK);
    for (let i = 0; i < pctGroups.length; i++) {
      const group = pctGroups[i];
      const url = `https://coins.llama.fi/percentage/${group.join(',')}?period=24h`;
      const data = await fetchJson<{ coins?: Record<string, number> } | Record<string, number>>(
        url,
        signal
      );
      const pctMap =
        data && typeof data === 'object' && 'coins' in data && data.coins
          ? data.coins
          : (data as Record<string, number> | null);
      if (pctMap) {
        for (const [key, pct] of Object.entries(pctMap)) {
          if (typeof pct !== 'number' || !Number.isFinite(pct)) continue;
          if (key.startsWith('coingecko:')) {
            const prev = map.get(zeroAddress);
            if (prev) map.set(zeroAddress, { ...prev, priceChange24h: pct });
            continue;
          }
          const addr = key.split(':')[1]?.toLowerCase();
          if (!addr) continue;
          const prev = map.get(addr);
          if (prev) map.set(addr, { ...prev, priceChange24h: pct });
        }
      }
      if (i < pctGroups.length - 1) {
        await sleep(LLAMA_CHUNK_DELAY_MS, signal).catch(() => undefined);
      }
    }
  }

  if (weth && !map.has(zeroAddress) && map.has(weth)) {
    map.set(zeroAddress, { ...map.get(weth)! });
  }

  // Symbol → CoinGecko id fallback for tokens DefiLlama misses by contract (e.g. CAKE on ETH)
  const missing = physical.filter((t) => {
    if (t.isNative || t.address.toLowerCase() === zeroAddress) return false;
    return !map.has(t.address.toLowerCase());
  });
  const fallbackKeys: string[] = [];
  const fallbackAddrsByKey = new Map<string, string[]>();
  for (const t of missing) {
    const id = COINGECKO_ID_BY_SYMBOL[t.symbol.toUpperCase()];
    if (!id) continue;
    const key = `coingecko:${id}`;
    fallbackKeys.push(key);
    const list = fallbackAddrsByKey.get(key) ?? [];
    list.push(t.address.toLowerCase());
    fallbackAddrsByKey.set(key, list);
  }
  const uniqueFallback = [...new Set(fallbackKeys)];
  if (uniqueFallback.length > 0) {
    for (const group of chunkArray(uniqueFallback, LLAMA_CHUNK)) {
      const [priceData, pctData] = await Promise.all([
        fetchJson<LlamaPricesResponse>(
          `https://coins.llama.fi/prices/current/${group.join(',')}`,
          signal
        ),
        fetchJson<{ coins?: Record<string, number> }>(
          `https://coins.llama.fi/percentage/${group.join(',')}?period=24h`,
          signal
        ),
      ]);
      for (const key of group) {
        const row = priceData?.coins?.[key];
        if (row?.price == null) continue;
        const pct = pctData?.coins?.[key];
        const snap: TokenMarketSnapshot = {
          priceUSD: row.price,
          priceChange24h: typeof pct === 'number' ? pct : 0,
          volume24hUSD: 0,
        };
        for (const addr of fallbackAddrsByKey.get(key) ?? []) {
          map.set(addr, snap);
        }
      }
    }
  }

  // Soft CoinGecko volume for a tiny priority set (majors incl. CAKE/BUSD)
  const cgPlatform = COINGECKO_PLATFORM_BY_CHAIN[chainId];
  if (cgPlatform) {
    const volumeTargets = volumePriority
      .filter((t) => !t.isNative && t.address.toLowerCase() !== zeroAddress)
      .map((t) => t.address.toLowerCase());

    if (nativeId) {
      const nativeUrl =
        `https://api.coingecko.com/api/v3/simple/price` +
        `?ids=${encodeURIComponent(nativeId)}` +
        `&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
      const nativeData = await fetchJson<
        Record<string, { usd?: number; usd_24h_vol?: number; usd_24h_change?: number }>
      >(nativeUrl, signal, 1);
      const row = nativeData?.[nativeId];
      if (row) {
        const prev = map.get(zeroAddress) ?? {
          priceUSD: row.usd ?? 0,
          priceChange24h: 0,
          volume24hUSD: 0,
        };
        map.set(zeroAddress, {
          priceUSD: row.usd ?? prev.priceUSD,
          priceChange24h: row.usd_24h_change ?? prev.priceChange24h,
          volume24hUSD: row.usd_24h_vol ?? prev.volume24hUSD,
        });
      }
    }

    if (volumeTargets.length > 0) {
      await sleep(800, signal).catch(() => undefined);
      const url =
        `https://api.coingecko.com/api/v3/simple/token_price/${cgPlatform}` +
        `?contract_addresses=${volumeTargets.join(',')}` +
        `&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
      const data = await fetchJson<
        Record<string, { usd?: number; usd_24h_vol?: number; usd_24h_change?: number }>
      >(url, signal, 1);
      if (data) {
        for (const [addr, row] of Object.entries(data)) {
          const key = addr.toLowerCase();
          const prev = map.get(key) ?? {
            priceUSD: row.usd ?? 0,
            priceChange24h: 0,
            volume24hUSD: 0,
          };
          map.set(key, {
            priceUSD: row.usd ?? prev.priceUSD,
            priceChange24h: row.usd_24h_change ?? prev.priceChange24h,
            volume24hUSD: row.usd_24h_vol ?? prev.volume24hUSD,
          });
        }
      }
    }
  }

  if (map.size > 0) writeCache(chainId, map);
  return map;
}

export function applyMarketData(
  tokens: TokenMetadata[],
  market: MarketMap
): TokenMetadata[] {
  if (market.size === 0) return tokens;
  return tokens.map((t) => {
    const key = t.isNative ? zeroAddress : t.address.toLowerCase();
    const snap = market.get(key);
    if (!snap) return t;
    return {
      ...t,
      priceUSD: snap.priceUSD || t.priceUSD,
      priceChange24h: snap.priceChange24h,
      volume24hUSD: snap.volume24hUSD,
    };
  });
}

export function shouldFetchMarketData(chainId?: number): chainId is number {
  return (
    typeof chainId === 'number' &&
    !LOCAL_CHAIN_IDS.has(chainId) &&
    (Boolean(LLAMA_PREFIX_BY_CHAIN[chainId]) ||
      Boolean(NATIVE_COINGECKO_ID_BY_CHAIN[chainId]))
  );
}
