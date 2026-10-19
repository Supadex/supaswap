import {
  formatUnits,
  parseAbiItem,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { SupaPoolManagerABI, SupaPositionManagerABI, ERC20ABI } from '../contracts/abis';
import { CurveType, type TokenMetadata } from '../contracts/types';
import { computePoolId } from '../contracts/utils';
import {
  formatCompactPrice,
  formatPositionPriceRange,
  getAmountsForLiquidity,
  isClammFullRangeTicks,
  sqrtPriceX96ToPrice,
  unpackSqrtPriceX96,
  unpackTick,
} from '../utils/poolMath';
import { formatUSD } from '../utils/formatters';
import { enrichTokenLogo } from '../utils/tokenLogo';
import type { PoolItem } from '../hooks/usePools';
import type { PositionDetail } from '../hooks/usePositions';

const CURVE_CANDIDATES = [CurveType.CLAMM, CurveType.BIN_AMM, CurveType.STABLE_AMM] as const;

const initializeEvent = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address plugin, uint160 sqrtPriceX96, int24 tick)'
);

const swapEvent = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
);

const modifyLiquidityEvent = parseAbiItem(
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)'
);

const positionMintedEvent = parseAbiItem(
  'event PositionMinted(uint256 indexed tokenId, address indexed owner, bytes32 indexed poolId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 amount0, uint256 amount1)'
);

const liquidityIncreasedEvent = parseAbiItem(
  'event LiquidityIncreased(uint256 indexed tokenId, uint128 liquidityAdded, uint256 amount0, uint256 amount1)'
);

const liquidityDecreasedEvent = parseAbiItem(
  'event LiquidityDecreased(uint256 indexed tokenId, uint128 liquidityRemoved, uint256 amount0, uint256 amount1)'
);

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed id)'
);

export type RecentTxType = 'swap' | 'add' | 'remove';

export interface RecentTx {
  id: string;
  type: RecentTxType;
  hash: Hex;
  timestamp: number;
  blockNumber: bigint;
  logIndex: number;
  summary: string;
}

async function resolveBlockTimestamps(
  publicClient: PublicClient,
  blockNumbers: bigint[]
): Promise<Map<string, number>> {
  const unique = [...new Set(blockNumbers.map((b) => b.toString()))];
  const map = new Map<string, number>();
  await Promise.all(
    unique.map(async (key) => {
      try {
        const block = await publicClient.getBlock({ blockNumber: BigInt(key) });
        map.set(key, Number(block.timestamp));
      } catch {
        map.set(key, 0);
      }
    })
  );
  return map;
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function swapNotionalUSD(
  amount0: bigint,
  amount1: bigint,
  token0: TokenMetadata,
  token1: TokenMetadata
): number {
  const usd0 =
    Number(formatUnits(absBigInt(amount0), token0.decimals)) * (token0.priceUSD || 0);
  const usd1 =
    Number(formatUnits(absBigInt(amount1), token1.decimals)) * (token1.priceUSD || 0);
  // Avoid double-counting both legs — use the larger notional
  return Math.max(usd0, usd1);
}

function formatTokenAmt(raw: bigint, decimals: number, symbol: string): string {
  const n = Number(formatUnits(absBigInt(raw), decimals));
  if (!Number.isFinite(n) || n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `<0.0001 ${symbol}`;
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return `${n.toFixed(digits)} ${symbol}`;
}

function formatApr(volume24hUSD: number, tvlUSD: number, feeNumber: number): string {
  if (tvlUSD <= 0 || volume24hUSD <= 0) return '0.00%';
  const feeRate = feeNumber / 1_000_000;
  const apr = (volume24hUSD * feeRate * 365) / tvlUSD * 100;
  if (!Number.isFinite(apr)) return '0.00%';
  if (apr >= 1000) return `${apr.toFixed(0)}%`;
  return `${apr.toFixed(2)}%`;
}

function curveLabel(curveType: CurveType): 'CLAMM' | 'BinAMM' | 'StableAMM' {
  if (curveType === CurveType.STABLE_AMM) return 'StableAMM';
  if (curveType === CurveType.BIN_AMM) return 'BinAMM';
  return 'CLAMM';
}

function resolveCurveType(
  poolId: Hex,
  currency0: Address,
  currency1: Address,
  fee: number,
  tickSpacing: number,
  plugin: Address
): CurveType {
  for (const curveType of CURVE_CANDIDATES) {
    const id = computePoolId({
      currency0,
      currency1,
      fee,
      tickSpacing,
      hooks: plugin,
      curveType,
    });
    if (id.toLowerCase() === poolId.toLowerCase()) return curveType;
  }
  return CurveType.CLAMM;
}

async function resolveTokenMeta(
  publicClient: PublicClient,
  address: Address,
  known: TokenMetadata[]
): Promise<TokenMetadata> {
  const lower = address.toLowerCase();
  if (lower === zeroAddress) {
    return enrichTokenLogo(
      known.find((t) => t.isNative || t.address.toLowerCase() === zeroAddress) || {
        address: zeroAddress,
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        priceUSD: 0,
        isNative: true,
      }
    );
  }
  const hit = known.find((t) => !t.isClaim && t.address.toLowerCase() === lower);
  if (hit) return enrichTokenLogo(hit);

  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({ address, abi: ERC20ABI, functionName: 'symbol' }) as Promise<string>,
      publicClient.readContract({ address, abi: ERC20ABI, functionName: 'name' }) as Promise<string>,
      publicClient.readContract({
        address,
        abi: ERC20ABI,
        functionName: 'decimals',
      }) as Promise<number>,
    ]);
    return enrichTokenLogo({
      address,
      symbol: symbol || `${address.slice(0, 6)}`,
      name: name || 'Unknown Token',
      decimals: Number(decimals) || 18,
      priceUSD: 0,
    });
  } catch {
    return {
      address,
      symbol: `${address.slice(0, 6)}…`,
      name: 'Unknown Token',
      decimals: 18,
      priceUSD: 0,
    };
  }
}

/** Load all initialized pools from PoolManager Initialize events (on-chain SSOT). */
export async function fetchOnchainPools(args: {
  publicClient: PublicClient;
  poolManager: Address;
  knownTokens: TokenMetadata[];
  lvrShieldPlugin?: Address;
  antiJITPlugin?: Address;
}): Promise<PoolItem[]> {
  const { publicClient, poolManager, knownTokens, lvrShieldPlugin, antiJITPlugin } = args;
  const lvrLc = (lvrShieldPlugin || zeroAddress).toLowerCase();
  const jitLc = (antiJITPlugin || zeroAddress).toLowerCase();
  if (!poolManager) return [];

  const [logs, swapLogs] = await Promise.all([
    publicClient.getLogs({
      address: poolManager,
      event: initializeEvent,
      fromBlock: 0n,
      toBlock: 'latest',
    }),
    publicClient.getLogs({
      address: poolManager,
      event: swapEvent,
      fromBlock: 0n,
      toBlock: 'latest',
    }),
  ]);

  const swapBlocks = swapLogs
    .map((l) => l.blockNumber)
    .filter((b): b is bigint => b !== null && b !== undefined);
  const tsMap = await resolveBlockTimestamps(publicClient, swapBlocks);
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  const swapsByPool = new Map<string, typeof swapLogs>();
  for (const log of swapLogs) {
    const id = (log.args.id as Hex | undefined)?.toLowerCase();
    if (!id) continue;
    const list = swapsByPool.get(id) || [];
    list.push(log);
    swapsByPool.set(id, list);
  }

  const pools: PoolItem[] = [];
  const seen = new Set<string>();

  for (const log of logs) {
    const id = log.args.id as Hex;
    if (!id || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());

    const currency0 = log.args.currency0 as Address;
    const currency1 = log.args.currency1 as Address;
    const fee = Number(log.args.fee);
    const tickSpacing = Number(log.args.tickSpacing);
    const plugin = (log.args.plugin as Address) || zeroAddress;
    const curveType = resolveCurveType(id, currency0, currency1, fee, tickSpacing, plugin);

    let activeLiquidity = 0n;
    let slot0Raw: Hex = '0x0';
    try {
      [slot0Raw, activeLiquidity] = await Promise.all([
        publicClient.readContract({
          address: poolManager,
          abi: SupaPoolManagerABI,
          functionName: 'getSlot0',
          args: [id],
        }) as Promise<Hex>,
        publicClient.readContract({
          address: poolManager,
          abi: SupaPoolManagerABI,
          functionName: 'getLiquidity',
          args: [id],
        }) as Promise<bigint>,
      ]);
    } catch {
      // skip enrichment failures
    }

    const [token0, token1] = await Promise.all([
      resolveTokenMeta(publicClient, currency0, knownTokens),
      resolveTokenMeta(publicClient, currency1, knownTokens),
    ]);

    // Rough TVL: convert active liquidity to token amounts at spot when possible
    let tvlUSD = 0;
    const sqrt = unpackSqrtPriceX96(slot0Raw);
    if (activeLiquidity > 0n && sqrt > 0n && curveType === CurveType.CLAMM) {
      const tick = unpackTick(slot0Raw);
      const { amount0, amount1 } = getAmountsForLiquidity(
        sqrt,
        tick - 60,
        tick + 60,
        activeLiquidity
      );
      tvlUSD =
        Number(formatUnits(amount0, token0.decimals)) * (token0.priceUSD || 0) +
        Number(formatUnits(amount1, token1.decimals)) * (token1.priceUSD || 0);
    } else if (activeLiquidity > 0n && curveType !== CurveType.CLAMM) {
      tvlUSD =
        Number(formatUnits(activeLiquidity, token0.decimals)) * (token0.priceUSD || 0) * 2;
    }

    let volume24hUSD = 0;
    const poolSwaps = swapsByPool.get(id.toLowerCase()) || [];
    for (const s of poolSwaps) {
      const bn = s.blockNumber;
      if (bn === null || bn === undefined) continue;
      const ts = tsMap.get(bn.toString()) || 0;
      if (ts < cutoff) continue;
      const a0 = (s.args.amount0 as bigint) ?? 0n;
      const a1 = (s.args.amount1 as bigint) ?? 0n;
      volume24hUSD += swapNotionalUSD(a0, a1, token0, token1);
    }

    const volTvl = tvlUSD > 0 ? volume24hUSD / tvlUSD : 0;
    const apr = formatApr(volume24hUSD, tvlUSD, fee);

    pools.push({
      id,
      pair: `${token0.symbol} / ${token1.symbol}`,
      token0,
      token1,
      curve: curveLabel(curveType),
      curveType,
      feeTier: `${(fee / 10000).toFixed(2)}%`,
      feeNumber: fee,
      tickSpacing,
      plugin,
      poolId: id,
      tvlUSD,
      volume24hUSD,
      volTvl,
      apr,
      lvrProtection: (() => {
        const p = plugin.toLowerCase();
        if (p === zeroAddress) return '—';
        if (lvrLc !== zeroAddress && p === lvrLc) return 'LVR';
        if (jitLc !== zeroAddress && p === jitLc) return 'Anti-JIT';
        return 'Plugin';
      })(),
      activeLiquidity,
    });
  }

  pools.sort((a, b) => b.tvlUSD - a.tvlUSD);
  return pools;
}

/** Latest pool activity (swaps + liquidity mods), newest first. */
export async function fetchPoolRecentTxs(args: {
  publicClient: PublicClient;
  poolManager: Address;
  poolId: Hex;
  token0: TokenMetadata;
  token1: TokenMetadata;
  limit?: number;
}): Promise<RecentTx[]> {
  const { publicClient, poolManager, poolId, token0, token1, limit = 10 } = args;
  if (!poolManager || !poolId) return [];

  const [swaps, mods] = await Promise.all([
    publicClient.getLogs({
      address: poolManager,
      event: swapEvent,
      args: { id: poolId },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
    publicClient.getLogs({
      address: poolManager,
      event: modifyLiquidityEvent,
      args: { id: poolId },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
  ]);

  type Draft = Omit<RecentTx, 'timestamp'> & { blockNumber: bigint };
  const drafts: Draft[] = [];

  for (const log of swaps) {
    if (log.blockNumber === null || log.transactionHash === null) continue;
    const a0 = (log.args.amount0 as bigint) ?? 0n;
    const a1 = (log.args.amount1 as bigint) ?? 0n;
    const zeroForOne = a0 > 0n || a1 < 0n;
    const summary = zeroForOne
      ? `${formatTokenAmt(a0, token0.decimals, token0.symbol)} → ${formatTokenAmt(a1, token1.decimals, token1.symbol)}`
      : `${formatTokenAmt(a1, token1.decimals, token1.symbol)} → ${formatTokenAmt(a0, token0.decimals, token0.symbol)}`;
    drafts.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      type: 'swap',
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      summary,
    });
  }

  for (const log of mods) {
    if (log.blockNumber === null || log.transactionHash === null) continue;
    const delta = (log.args.liquidityDelta as bigint) ?? 0n;
    if (delta === 0n) continue;
    const type: RecentTxType = delta > 0n ? 'add' : 'remove';
    drafts.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      type,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      summary: `${type === 'add' ? '+' : '−'}${formatTokenAmt(delta, token0.decimals, 'L')}`,
    });
  }

  drafts.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });

  const top = drafts.slice(0, limit);
  const tsMap = await resolveBlockTimestamps(
    publicClient,
    top.map((t) => t.blockNumber)
  );

  return top.map((t) => ({
    ...t,
    timestamp: tsMap.get(t.blockNumber.toString()) || 0,
  }));
}

/** Latest position activity from PositionManager events. */
export async function fetchPositionRecentTxs(args: {
  publicClient: PublicClient;
  positionManager: Address;
  tokenId: bigint;
  token0: TokenMetadata;
  token1: TokenMetadata;
  limit?: number;
}): Promise<RecentTx[]> {
  const { publicClient, positionManager, tokenId, token0, token1, limit = 10 } = args;
  if (!positionManager || tokenId <= 0n) return [];

  const [minted, increased, decreased] = await Promise.all([
    publicClient.getLogs({
      address: positionManager,
      event: positionMintedEvent,
      args: { tokenId },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
    publicClient.getLogs({
      address: positionManager,
      event: liquidityIncreasedEvent,
      args: { tokenId },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
    publicClient.getLogs({
      address: positionManager,
      event: liquidityDecreasedEvent,
      args: { tokenId },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
  ]);

  type Draft = Omit<RecentTx, 'timestamp'> & { blockNumber: bigint };
  const drafts: Draft[] = [];

  for (const log of minted) {
    if (log.blockNumber === null || log.transactionHash === null) continue;
    const a0 = (log.args.amount0 as bigint) ?? 0n;
    const a1 = (log.args.amount1 as bigint) ?? 0n;
    drafts.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      type: 'add',
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      summary: `Mint ${formatTokenAmt(a0, token0.decimals, token0.symbol)} + ${formatTokenAmt(a1, token1.decimals, token1.symbol)}`,
    });
  }

  for (const log of increased) {
    if (log.blockNumber === null || log.transactionHash === null) continue;
    const a0 = (log.args.amount0 as bigint) ?? 0n;
    const a1 = (log.args.amount1 as bigint) ?? 0n;
    drafts.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      type: 'add',
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      summary: `+ ${formatTokenAmt(a0, token0.decimals, token0.symbol)} + ${formatTokenAmt(a1, token1.decimals, token1.symbol)}`,
    });
  }

  for (const log of decreased) {
    if (log.blockNumber === null || log.transactionHash === null) continue;
    const a0 = (log.args.amount0 as bigint) ?? 0n;
    const a1 = (log.args.amount1 as bigint) ?? 0n;
    drafts.push({
      id: `${log.transactionHash}-${log.logIndex}`,
      type: 'remove',
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      summary: `− ${formatTokenAmt(a0, token0.decimals, token0.symbol)} − ${formatTokenAmt(a1, token1.decimals, token1.symbol)}`,
    });
  }

  drafts.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });

  const top = drafts.slice(0, limit);
  const tsMap = await resolveBlockTimestamps(
    publicClient,
    top.map((t) => t.blockNumber)
  );

  return top.map((t) => ({
    ...t,
    timestamp: tsMap.get(t.blockNumber.toString()) || 0,
  }));
}

/** Enumerate NFT tokenIds currently owned by `owner` via Transfer logs + ownerOf. */
export async function fetchOwnedTokenIds(
  publicClient: PublicClient,
  positionManager: Address,
  owner: Address
): Promise<bigint[]> {
  const [toLogs, fromLogs] = await Promise.all([
    publicClient.getLogs({
      address: positionManager,
      event: transferEvent,
      args: { to: owner },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
    publicClient.getLogs({
      address: positionManager,
      event: transferEvent,
      args: { from: owner },
      fromBlock: 0n,
      toBlock: 'latest',
    }),
  ]);

  const candidates = new Set<bigint>();
  for (const log of toLogs) {
    if (log.args.id !== undefined) candidates.add(log.args.id as bigint);
  }
  for (const log of fromLogs) {
    if (log.args.id !== undefined) candidates.add(log.args.id as bigint);
  }

  const owned: bigint[] = [];
  await Promise.all(
    [...candidates].map(async (tokenId) => {
      try {
        const current = (await publicClient.readContract({
          address: positionManager,
          abi: SupaPositionManagerABI,
          functionName: 'ownerOf',
          args: [tokenId],
        })) as Address;
        if (current.toLowerCase() === owner.toLowerCase()) owned.push(tokenId);
      } catch {
        // burned / nonexistent
      }
    })
  );

  return owned.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function formatFeeHuman(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toFixed(Math.min(6, decimals));
}

/** Hydrate a single position NFT from on-chain `positions(tokenId)` + pool slot0. */
export async function hydratePosition(args: {
  publicClient: PublicClient;
  positionManager: Address;
  poolManager: Address;
  tokenId: bigint;
  knownTokens: TokenMetadata[];
}): Promise<PositionDetail | null> {
  const { publicClient, positionManager, poolManager, tokenId, knownTokens } = args;

  try {
    const raw = await publicClient.readContract({
      address: positionManager,
      abi: SupaPositionManagerABI,
      functionName: 'positions',
      args: [tokenId],
    });

    const pos = (() => {
      if (Array.isArray(raw)) {
        const poolKey = raw[0] as {
          currency0: Address;
          currency1: Address;
          fee: number;
          tickSpacing: number;
          plugin: Address;
          curveType: number;
        };
        return {
          poolKey,
          tickLower: Number(raw[1]),
          tickUpper: Number(raw[2]),
          liquidity: raw[3] as bigint,
          tokensOwed0: raw[6] as bigint,
          tokensOwed1: raw[7] as bigint,
        };
      }
      const r = raw as {
        poolKey: {
          currency0: Address;
          currency1: Address;
          fee: number;
          tickSpacing: number;
          plugin: Address;
          curveType: number;
        };
        tickLower: number;
        tickUpper: number;
        liquidity: bigint;
        tokensOwed0: bigint;
        tokensOwed1: bigint;
      };
      return {
        poolKey: r.poolKey,
        tickLower: Number(r.tickLower),
        tickUpper: Number(r.tickUpper),
        liquidity: r.liquidity,
        tokensOwed0: r.tokensOwed0,
        tokensOwed1: r.tokensOwed1,
      };
    })();

    const curveType = Number(pos.poolKey.curveType) as CurveType;
    const fee = Number(pos.poolKey.fee);
    const tickSpacing = Number(pos.poolKey.tickSpacing);
    const plugin = (pos.poolKey.plugin || zeroAddress) as Address;

    const [token0, token1] = await Promise.all([
      resolveTokenMeta(publicClient, pos.poolKey.currency0, knownTokens),
      resolveTokenMeta(publicClient, pos.poolKey.currency1, knownTokens),
    ]);

    const poolId = computePoolId({
      currency0: pos.poolKey.currency0,
      currency1: pos.poolKey.currency1,
      fee,
      tickSpacing,
      hooks: plugin,
      curveType,
    });

    let slot0Raw: Hex = '0x0';
    let activeLiq = 0n;
    try {
      [slot0Raw, activeLiq] = await Promise.all([
        publicClient.readContract({
          address: poolManager,
          abi: SupaPoolManagerABI,
          functionName: 'getSlot0',
          args: [poolId],
        }) as Promise<Hex>,
        publicClient.readContract({
          address: poolManager,
          abi: SupaPoolManagerABI,
          functionName: 'getLiquidity',
          args: [poolId],
        }) as Promise<bigint>,
      ]);
    } catch {
      // keep defaults
    }

    const sqrt = unpackSqrtPriceX96(slot0Raw);
    const currentTick = unpackTick(slot0Raw);

    let amount0Wei = 0n;
    let amount1Wei = 0n;
    if (pos.liquidity > 0n) {
      if (curveType === CurveType.CLAMM && sqrt > 0n) {
        ({ amount0: amount0Wei, amount1: amount1Wei } = getAmountsForLiquidity(
          sqrt,
          pos.tickLower,
          pos.tickUpper,
          pos.liquidity
        ));
      } else {
        // Bin/Stable: liquidity ≈ currency0 deposit units
        amount0Wei = pos.liquidity;
        const spot = sqrt > 0n ? sqrtPriceX96ToPrice(sqrt, token0.decimals, token1.decimals) : 1;
        const a0 = Number(formatUnits(amount0Wei, token0.decimals));
        amount1Wei = BigInt(
          Math.max(0, Math.floor(a0 * spot * 10 ** token1.decimals))
        );
      }
    }

    const amount0Num = Number(formatUnits(amount0Wei, token0.decimals));
    const amount1Num = Number(formatUnits(amount1Wei, token1.decimals));
    const liquidityUSD =
      amount0Num * (token0.priceUSD || 0) + amount1Num * (token1.priceUSD || 0);

    const fee0 = formatFeeHuman(pos.tokensOwed0, token0.decimals);
    const fee1 = formatFeeHuman(pos.tokensOwed1, token1.decimals);
    const feesUSD =
      Number(formatUnits(pos.tokensOwed0, token0.decimals)) * (token0.priceUSD || 0) +
      Number(formatUnits(pos.tokensOwed1, token1.decimals)) * (token1.priceUSD || 0);

    let status: PositionDetail['status'] = pos.liquidity === 0n ? 'closed' : 'in-range';
    if (pos.liquidity > 0n) {
      const inRange =
        curveType !== CurveType.CLAMM ||
        isClammFullRangeTicks(pos.tickLower, pos.tickUpper) ||
        (currentTick >= pos.tickLower && currentTick < pos.tickUpper);
      if (!inRange || (curveType === CurveType.CLAMM && activeLiq === 0n && !inRange)) {
        status = 'out-of-range';
      } else if (!inRange) {
        status = 'out-of-range';
      }
    }

    const range = formatPositionPriceRange(curveType, pos.tickLower, pos.tickUpper, token1.symbol);

    return {
      id: `pos-${tokenId.toString()}`,
      tokenId,
      token0,
      token1,
      pair: `${token0.symbol} / ${token1.symbol}`,
      curve: curveLabel(curveType),
      curveType,
      feeTier: `${(fee / 10000).toFixed(2)}%`,
      feeNumber: fee,
      hooks: plugin,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      tickSpacing,
      ...range,
      status,
      liquidityUSD: formatUSD(liquidityUSD),
      liquidityRaw: pos.liquidity,
      amount0: formatCompactPrice(amount0Num, token0.decimals > 6 ? 6 : 4),
      amount1: formatCompactPrice(amount1Num, token1.decimals > 6 ? 6 : 4),
      uncollectedFee0: fee0,
      uncollectedFee1: fee1,
      uncollectedFeesUSD: formatUSD(feesUSD),
      apr: '—',
      depositedDate: '—',
    };
  } catch (err) {
    console.warn('hydratePosition failed', tokenId.toString(), err);
    return null;
  }
}
