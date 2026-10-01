import {
  concatHex,
  encodePacked,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { CurveType, type PoolKey } from '../contracts/types';
import { SupaPoolManagerABI, SupaQuoterABI } from '../contracts/abis';
import { sortTokens, computePoolId } from '../contracts/utils';
import { getTickSpacingForFee, unpackSqrtPriceX96 } from './poolMath';

const FEE_CANDIDATES = [100, 500, 3000, 10000] as const;
const CURVE_CANDIDATES = [CurveType.CLAMM, CurveType.BIN_AMM, CurveType.STABLE_AMM] as const;
/** Cap pools quoted per hop so multi-hop fan-out stays bounded. */
const MAX_POOLS_PER_LEG = 4;

export interface SwapHop {
  tokenIn: Address;
  tokenOut: Address;
  poolKey: PoolKey;
}

export interface LivePool {
  key: PoolKey;
  liquidity: bigint;
  slot0Raw: Hex;
}

/** Best executable route after quoting all live curve/fee candidates. */
export interface RankedRoute {
  kind: 'single' | 'multi';
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  tickAfter: number;
  poolKey: PoolKey | null;
  zeroForOne: boolean;
  path?: Hex;
  hops?: SwapHop[];
  routeLabel: string;
  /** Per-hop curve labels for UI */
  hopCurveLabels: string[];
  recommendedCurve: CurveType;
  slot0Raw?: Hex;
}

export type RouteLookupResult =
  | { route: RankedRoute; emptyLiquidityPools: LivePool[] }
  | { route: null; emptyLiquidityPools: LivePool[] };

export function curveTypeLabel(curve: CurveType): string {
  if (curve === CurveType.STABLE_AMM) return 'StableAMM';
  if (curve === CurveType.BIN_AMM) return 'BinAMM';
  return 'CLAMM';
}

/** Encode a single hop: tokenIn|fee|tickSpacing|plugin|curveType|tokenOut */
export function encodeHop(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  tickSpacing: number,
  plugin: Address,
  curveType: CurveType
): Hex {
  return encodePacked(
    ['address', 'uint24', 'int24', 'address', 'uint8', 'address'],
    [tokenIn, fee, tickSpacing, plugin, curveType, tokenOut]
  );
}

/** Encode 2-hop path matching PathKeyLib / SupaRouter.exactInput */
export function encodeTwoHopPath(hop1: SwapHop, hop2: SwapHop): Hex {
  const first = encodeHop(
    hop1.tokenIn,
    hop1.tokenOut,
    hop1.poolKey.fee,
    hop1.poolKey.tickSpacing,
    hop1.poolKey.hooks,
    hop1.poolKey.curveType
  );
  const secondTail = encodePacked(
    ['uint24', 'int24', 'address', 'uint8', 'address'],
    [
      hop2.poolKey.fee,
      hop2.poolKey.tickSpacing,
      hop2.poolKey.hooks,
      hop2.poolKey.curveType,
      hop2.tokenOut,
    ]
  );
  return concatHex([first, secondTail]);
}

export function buildPoolKeyCandidates(
  currency0: Address,
  currency1: Address,
  preferred?: {
    fee: number;
    curveType: CurveType;
    plugin?: Address;
    tickSpacing?: number;
  }[]
): PoolKey[] {
  const keys: PoolKey[] = [];
  const seen = new Set<string>();

  const push = (
    fee: number,
    curveType: CurveType,
    hooks: Address = zeroAddress,
    tickSpacing?: number
  ) => {
    const key: PoolKey = {
      currency0,
      currency1,
      fee,
      tickSpacing: tickSpacing ?? getTickSpacingForFee(fee, curveType),
      curveType,
      hooks,
    };
    const id = computePoolId(key);
    if (seen.has(id)) return;
    seen.add(id);
    keys.push(key);
  };

  for (const pref of preferred ?? []) {
    push(
      pref.fee,
      pref.curveType,
      (pref.plugin as Address) || zeroAddress,
      pref.tickSpacing
    );
  }
  for (const curveType of CURVE_CANDIDATES) {
    for (const fee of FEE_CANDIDATES) {
      push(fee, curveType, zeroAddress);
    }
  }
  return keys;
}

/** All initialized pools for a pair (sorted high liquidity → low). Includes zero-liquidity pools. */
export async function findAllLivePools(
  publicClient: PublicClient,
  poolManager: Address,
  tokenA: Address,
  tokenB: Address,
  preferred?: {
    fee: number;
    curveType: CurveType;
    plugin?: Address;
    tickSpacing?: number;
  }[]
): Promise<LivePool[]> {
  const { currency0, currency1 } = sortTokens(tokenA, tokenB);
  const candidates = buildPoolKeyCandidates(currency0, currency1, preferred);
  const live: LivePool[] = [];

  await Promise.all(
    candidates.map(async (key) => {
      try {
        const poolId = computePoolId(key);
        const slot0Raw = (await publicClient.readContract({
          address: poolManager,
          abi: SupaPoolManagerABI,
          functionName: 'getSlot0',
          args: [poolId],
        })) as Hex;

        if (unpackSqrtPriceX96(slot0Raw) === 0n) return;

        let liquidity = 0n;
        try {
          liquidity = (await publicClient.readContract({
            address: poolManager,
            abi: SupaPoolManagerABI,
            functionName: 'getLiquidity',
            args: [poolId],
          })) as bigint;
        } catch {
          liquidity = 0n;
        }

        live.push({ key, liquidity, slot0Raw });
      } catch {
        // skip
      }
    })
  );

  live.sort((a, b) => (a.liquidity === b.liquidity ? 0 : a.liquidity > b.liquidity ? -1 : 1));
  return live;
}

/**
 * Find an initialized on-chain pool for a token pair (any fee/curve).
 * Prefers pools with liquidity > 0.
 */
export async function findLivePool(
  publicClient: PublicClient,
  poolManager: Address,
  tokenA: Address,
  tokenB: Address,
  preferred?: {
    fee: number;
    curveType: CurveType;
    plugin?: Address;
    tickSpacing?: number;
  }[]
): Promise<LivePool | null> {
  const all = await findAllLivePools(publicClient, poolManager, tokenA, tokenB, preferred);
  return all.find((p) => p.liquidity > 0n) ?? all[0] ?? null;
}

async function quoteSingle(
  publicClient: PublicClient,
  quoter: Address,
  key: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint
): Promise<{ amountOut: bigint; sqrtPriceX96After: bigint; tickAfter: number } | null> {
  try {
    const result = (await publicClient.readContract({
      address: quoter,
      abi: SupaQuoterABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          poolKey: {
            currency0: key.currency0,
            currency1: key.currency1,
            fee: key.fee,
            tickSpacing: key.tickSpacing,
            plugin: key.hooks,
            curveType: key.curveType,
          },
          zeroForOne,
          amountIn,
          sqrtPriceLimitX96: 0n,
          hookData: '0x',
        },
      ],
    })) as readonly [bigint, bigint, number];

    if (result[0] <= 0n) return null;
    return {
      amountOut: result[0],
      sqrtPriceX96After: result[1],
      tickAfter: Number(result[2]),
    };
  } catch {
    return null;
  }
}

async function quoteMulti(
  publicClient: PublicClient,
  quoter: Address,
  path: Hex,
  amountIn: bigint
): Promise<bigint | null> {
  try {
    const amountOut = (await publicClient.readContract({
      address: quoter,
      abi: SupaQuoterABI,
      functionName: 'quoteExactInput',
      args: [path, amountIn],
    })) as bigint;
    return amountOut > 0n ? amountOut : null;
  } catch {
    return null;
  }
}

function feeLabel(fee: number): string {
  return `${(fee / 10000).toFixed(2)}%`;
}

/**
 * Quote every live single-hop pool + every viable 2-hop curve combo; return the max amountOut.
 */
export async function findBestSwapRoute(args: {
  publicClient: PublicClient;
  poolManager: Address;
  quoter: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  intermediates: Address[];
  symbolOf: (addr: Address) => string;
  preferredByPair?: Map<
    string,
    { fee: number; curveType: CurveType; plugin?: Address; tickSpacing?: number }[]
  >;
}): Promise<RouteLookupResult> {
  const { zeroForOne } = sortTokens(args.tokenIn, args.tokenOut);
  let best: RankedRoute | null = null;
  const emptyLiquidityPools: LivePool[] = [];

  const consider = (route: RankedRoute) => {
    if (!best || route.amountOut > best.amountOut) best = route;
  };

  // ——— Single-hop: quote all live curve/fee pools ———
  const directPools = await findAllLivePools(
    args.publicClient,
    args.poolManager,
    args.tokenIn,
    args.tokenOut,
    args.preferredByPair?.get(pairKey(args.tokenIn, args.tokenOut))
  );

  for (const pool of directPools) {
    if (pool.liquidity === 0n) emptyLiquidityPools.push(pool);
  }

  await Promise.all(
    directPools
      .filter((p) => p.liquidity > 0n)
      .map(async (pool) => {
        const q = await quoteSingle(
          args.publicClient,
          args.quoter,
          pool.key,
          zeroForOne,
          args.amountIn
        );
        if (!q) return;
        const curve = curveTypeLabel(pool.key.curveType);
        consider({
          kind: 'single',
          amountOut: q.amountOut,
          sqrtPriceX96After: q.sqrtPriceX96After,
          tickAfter: q.tickAfter,
          poolKey: pool.key,
          zeroForOne,
          routeLabel: `${args.symbolOf(args.tokenIn)} → ${args.symbolOf(args.tokenOut)} · ${curve} ${feeLabel(pool.key.fee)}`,
          hopCurveLabels: [`${curve} ${feeLabel(pool.key.fee)}`],
          recommendedCurve: pool.key.curveType,
          slot0Raw: pool.slot0Raw,
        });
      })
  );

  // ——— Multi-hop: for each bridge, quote top pools × top pools ———
  const tin = args.tokenIn.toLowerCase();
  const tout = args.tokenOut.toLowerCase();
  const seenMids = new Set<string>();

  for (const mid of args.intermediates) {
    const m = mid.toLowerCase();
    if (m === tin || m === tout || seenMids.has(m)) continue;
    seenMids.add(m);

    const hop1Pools = (
      await findAllLivePools(
        args.publicClient,
        args.poolManager,
        args.tokenIn,
        mid,
        args.preferredByPair?.get(pairKey(args.tokenIn, mid))
      )
    )
      .filter((p) => p.liquidity > 0n)
      .slice(0, MAX_POOLS_PER_LEG);

    if (hop1Pools.length === 0) continue;

    const hop2Pools = (
      await findAllLivePools(
        args.publicClient,
        args.poolManager,
        mid,
        args.tokenOut,
        args.preferredByPair?.get(pairKey(mid, args.tokenOut))
      )
    )
      .filter((p) => p.liquidity > 0n)
      .slice(0, MAX_POOLS_PER_LEG);

    if (hop2Pools.length === 0) continue;

    const combos: { hop1: LivePool; hop2: LivePool }[] = [];
    for (const h1 of hop1Pools) {
      for (const h2 of hop2Pools) {
        combos.push({ hop1: h1, hop2: h2 });
      }
    }

    await Promise.all(
      combos.map(async ({ hop1, hop2 }) => {
        const swapHop1: SwapHop = {
          tokenIn: args.tokenIn,
          tokenOut: mid,
          poolKey: hop1.key,
        };
        const swapHop2: SwapHop = {
          tokenIn: mid,
          tokenOut: args.tokenOut,
          poolKey: hop2.key,
        };
        const path = encodeTwoHopPath(swapHop1, swapHop2);
        const amountOut = await quoteMulti(
          args.publicClient,
          args.quoter,
          path,
          args.amountIn
        );
        if (!amountOut) return;

        const c1 = curveTypeLabel(hop1.key.curveType);
        const c2 = curveTypeLabel(hop2.key.curveType);
        const symIn = args.symbolOf(args.tokenIn);
        const symMid = args.symbolOf(mid);
        const symOut = args.symbolOf(args.tokenOut);

        consider({
          kind: 'multi',
          amountOut,
          sqrtPriceX96After: 0n,
          tickAfter: 0,
          poolKey: null,
          zeroForOne,
          path,
          hops: [swapHop1, swapHop2],
          routeLabel: `${symIn} → ${symMid} → ${symOut} · ${c1}/${c2}`,
          hopCurveLabels: [
            `${c1} ${feeLabel(hop1.key.fee)}`,
            `${c2} ${feeLabel(hop2.key.fee)}`,
          ],
          recommendedCurve: hop1.key.curveType,
          slot0Raw: hop1.slot0Raw,
        });
      })
    );
  }

  return { route: best, emptyLiquidityPools };
}

function pairKey(a: Address, b: Address): string {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}

export function buildPreferredPairMap(
  pools: {
    token0: { address: Address };
    token1: { address: Address };
    feeNumber: number;
    curveType: CurveType;
    plugin?: string;
    tickSpacing?: number;
  }[]
): Map<string, { fee: number; curveType: CurveType; plugin?: Address; tickSpacing?: number }[]> {
  const map = new Map<
    string,
    { fee: number; curveType: CurveType; plugin?: Address; tickSpacing?: number }[]
  >();
  for (const p of pools) {
    const k = pairKey(p.token0.address, p.token1.address);
    const list = map.get(k) ?? [];
    list.push({
      fee: p.feeNumber,
      curveType: p.curveType,
      plugin: (p.plugin as Address) || zeroAddress,
      tickSpacing: p.tickSpacing,
    });
    map.set(k, list);
  }
  return map;
}
