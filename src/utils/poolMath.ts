import { parseUnits, zeroAddress, type Address } from 'viem';
import { CurveType } from '../contracts/types';
import { getFeeTierDefaultTickSpacing } from '../contracts/utils';

const Q96 = 2n ** 96n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;
/** Matches TickMathLib.MIN_SQRT_RATIO / MAX_SQRT_RATIO (Uniswap V3 bounds). */
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;
/** Uniswap V3 full-range ticks aligned to spacing 60 (common default). */
export const FULL_RANGE_TICK_LOWER = -887220;
export const FULL_RANGE_TICK_UPPER = 887220;

/** BinAMM center bin id (matches BinMathLib.CENTER_BIN_ID = 2^23 as uint24). */
export const CENTER_BIN_ID = 8388608;

/**
 * BinAMM stores bin ids as uint24, but mint/modifyLiquidity ABI uses int24 tickLower/Upper.
 * Encode the uint24 bit pattern as a signed int24 so viem accepts it; the engine recovers
 * with `uint24(uint256(int256(tickLower)))`.
 * e.g. 8388608 → -8388608, 8388609 → -8388607
 */
export function binIdToInt24(binId: number): number {
  const u = binId & 0xffffff;
  return u >= 0x800000 ? u - 0x1000000 : u;
}

/** Decode signed int24 tickLower back to uint24 bin id. */
export function int24ToBinId(tickAsInt24: number): number {
  return tickAsInt24 < 0 ? tickAsInt24 + 0x1000000 : tickAsInt24;
}

/** Compact human price for display (avoids scientific notation). */
export function formatCompactPrice(price: number, maxDecimals = 6): string {
  if (!Number.isFinite(price) || price < 0) return '—';
  if (price === 0) return '0';
  if (price >= 1e12) return '∞';
  if (price >= 1e6) return `${(price / 1e6).toFixed(2)}M`;
  if (price >= 1e3) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(Math.min(4, maxDecimals));
  if (price >= 0.0001) return price.toFixed(maxDecimals);
  return '<0.0001';
}

export function isClammFullRangeTicks(tickLower: number, tickUpper: number): boolean {
  return tickLower <= FULL_RANGE_TICK_LOWER + 60 && tickUpper >= FULL_RANGE_TICK_UPPER - 60;
}

/**
 * Curve-aware min/max labels for position cards & detail.
 */
export function formatPositionPriceRange(
  curveType: CurveType,
  tickLower: number,
  tickUpper: number,
  quoteSymbol: string
): { minPrice: string; maxPrice: string; currentPrice: string } {
  const sym = quoteSymbol || 'TOKEN';

  if (curveType === CurveType.BIN_AMM) {
    const binId = int24ToBinId(tickLower);
    return {
      minPrice: `Bin #${binId}`,
      maxPrice: `Bin #${binId}`,
      currentPrice: `Active bin #${binId}`,
    };
  }

  if (curveType === CurveType.STABLE_AMM) {
    const lo = tickToPrice(tickLower);
    const hi = tickToPrice(tickUpper);
    // Near-peg display when ticks are tiny / spacing-sized
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || Math.abs(tickLower) > 100000) {
      return {
        minPrice: `~1.00 ${sym}`,
        maxPrice: `~1.00 ${sym}`,
        currentPrice: `~1.00 ${sym}`,
      };
    }
    return {
      minPrice: `${formatCompactPrice(lo)} ${sym}`,
      maxPrice: `${formatCompactPrice(hi)} ${sym}`,
      currentPrice: `${formatCompactPrice((lo + hi) / 2)} ${sym}`,
    };
  }

  // CLAMM
  if (isClammFullRangeTicks(tickLower, tickUpper)) {
    return {
      minPrice: `0 ${sym}`,
      maxPrice: `∞ ${sym}`,
      currentPrice: 'Full range',
    };
  }

  const lo = tickToPrice(tickLower);
  const hi = tickToPrice(tickUpper);
  const mid = tickToPrice(Math.floor((tickLower + tickUpper) / 2));
  return {
    minPrice: `${formatCompactPrice(lo)} ${sym}`,
    maxPrice: `${formatCompactPrice(hi)} ${sym}`,
    currentPrice: `${formatCompactPrice(mid)} ${sym}`,
  };
}

/**
 * Human price of token1 per token0 → Q64.96 sqrtPriceX96
 * (ported from admin poolMath.ts)
 */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number = 18,
  decimals1: number = 6
): bigint {
  if (price <= 0 || Number.isNaN(price)) return 0n;

  const decimalAdjustment = 10 ** (decimals1 - decimals0);
  const adjustedPrice = price * decimalAdjustment;
  const sqrtPrice = Math.sqrt(adjustedPrice);
  const sqrtPriceScaled = BigInt(Math.floor(sqrtPrice * 1e12));
  let sqrtPriceX96 = (sqrtPriceScaled * Q96) / BigInt(1e12);
  // Clamp so StableAMM / TickMath post-swap checks do not revert on extreme seeds.
  if (sqrtPriceX96 <= MIN_SQRT_RATIO) sqrtPriceX96 = MIN_SQRT_RATIO + 1n;
  if (sqrtPriceX96 >= MAX_SQRT_RATIO) sqrtPriceX96 = MAX_SQRT_RATIO - 1n;
  return sqrtPriceX96;
}

/** Q64.96 sqrtPriceX96 → human price (token1 per token0). */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number = 18,
  decimals1: number = 6
): number {
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return 0;
  const numerator = (sqrtPriceX96 * BigInt(1e12)) / Q96;
  const sqrtPrice = Number(numerator) / 1e12;
  const rawPrice = sqrtPrice * sqrtPrice;
  const decimalAdjustment = 10 ** (decimals1 - decimals0);
  return rawPrice / decimalAdjustment;
}

/**
 * Resolve PoolKey-ordered price (token1 per token0 in human units) from UI tokens.
 * Priority: explicit UI starting price → deposit ratio → USD mid → 1.0.
 */
export function resolvePoolOrderedPrice(args: {
  tokenA: { address: Address; decimals: number; priceUSD?: number };
  tokenB: { address: Address; decimals: number; priceUSD?: number };
  amountA?: string;
  amountB?: string;
  /** Explicit price in UI order: how many tokenB per 1 tokenA. */
  uiPriceTokenBPerTokenA?: number;
}): {
  currency0: Address;
  currency1: Address;
  decimals0: number;
  decimals1: number;
  /** Human token1 per token0 in PoolKey order */
  priceToken1PerToken0: number;
  uiMatchesPoolOrder: boolean;
} {
  const aIsFirst = args.tokenA.address.toLowerCase() < args.tokenB.address.toLowerCase();
  const currency0 = (aIsFirst ? args.tokenA.address : args.tokenB.address) as Address;
  const currency1 = (aIsFirst ? args.tokenB.address : args.tokenA.address) as Address;
  const decimals0 = aIsFirst ? args.tokenA.decimals : args.tokenB.decimals;
  const decimals1 = aIsFirst ? args.tokenB.decimals : args.tokenA.decimals;
  const priceUSD0 = aIsFirst ? args.tokenA.priceUSD ?? 0 : args.tokenB.priceUSD ?? 0;
  const priceUSD1 = aIsFirst ? args.tokenB.priceUSD ?? 0 : args.tokenA.priceUSD ?? 0;
  const amount0 = aIsFirst ? args.amountA : args.amountB;
  const amount1 = aIsFirst ? args.amountB : args.amountA;

  let priceToken1PerToken0 = 0;

  const uiOverride = args.uiPriceTokenBPerTokenA;
  if (uiOverride !== undefined && uiOverride > 0 && Number.isFinite(uiOverride)) {
    // UI price is tokenB per tokenA; convert to PoolKey currency1 per currency0
    priceToken1PerToken0 = aIsFirst ? uiOverride : 1 / uiOverride;
  } else {
    const n0 = Number.parseFloat(amount0 || '');
    const n1 = Number.parseFloat(amount1 || '');
    if (n0 > 0 && n1 > 0) {
      priceToken1PerToken0 = n1 / n0;
    } else if (priceUSD0 > 0 && priceUSD1 > 0) {
      priceToken1PerToken0 = priceUSD0 / priceUSD1;
    }
  }

  if (!(priceToken1PerToken0 > 0)) {
    priceToken1PerToken0 = 1;
  }

  return {
    currency0,
    currency1,
    decimals0,
    decimals1,
    priceToken1PerToken0,
    uiMatchesPoolOrder: aIsFirst,
  };
}

/**
 * Bin id whose raw price ≈ human token1/token0 (matches BinMathLib.getIdFromPrice).
 */
export function getBinIdFromHumanPrice(
  priceToken1PerToken0: number,
  decimals0: number,
  decimals1: number,
  binStep: number
): number {
  if (!(priceToken1PerToken0 > 0) || binStep <= 0) return CENTER_BIN_ID;
  const rawPrice = priceToken1PerToken0 * 10 ** (decimals1 - decimals0);
  if (!(rawPrice > 0)) return CENTER_BIN_ID;
  const step = 1 + binStep / 10000;
  const shift = Math.round(Math.log(rawPrice) / Math.log(step));
  const binId = CENTER_BIN_ID + shift;
  return Math.max(0, Math.min(0xffffff, binId));
}

/** Unpack packed Slot0 bytes32 → sqrtPriceX96 (lowest 160 bits). */
export function unpackSqrtPriceX96(slot0Raw: bigint | `0x${string}` | undefined): bigint {
  if (slot0Raw === undefined || slot0Raw === null) return 0n;
  const slot0Big = typeof slot0Raw === 'bigint' ? slot0Raw : BigInt(slot0Raw);
  return slot0Big & ((1n << 160n) - 1n);
}

/** Unpack packed Slot0 → tick (bits 160..183 as signed int24). */
export function unpackTick(slot0Raw: bigint | `0x${string}` | undefined): number {
  if (slot0Raw === undefined || slot0Raw === null) return 0;
  const slot0Big = typeof slot0Raw === 'bigint' ? slot0Raw : BigInt(slot0Raw);
  let tick = Number((slot0Big >> 160n) & 0xffffffn);
  if (tick >= 0x800000) tick -= 0x1000000; // sign-extend int24
  return tick;
}

/** Unpack packed Slot0 → dynamicFee (bits 208..231, Uniswap fee units). */
export function unpackDynamicFee(slot0Raw: bigint | `0x${string}` | undefined): number {
  if (slot0Raw === undefined || slot0Raw === null) return 0;
  const slot0Big = typeof slot0Raw === 'bigint' ? slot0Raw : BigInt(slot0Raw);
  return Number((slot0Big >> 208n) & 0xffffffn);
}

/**
 * Price impact in basis points: |1 - executionRate/midRate| * 10000
 * Prefer pool mid (token-out per token-in). USD prices are a fallback only.
 */
export function computePriceImpactBps(
  amountInHuman: number,
  amountOutHuman: number,
  midRateOutPerIn: number
): number {
  if (amountInHuman <= 0 || amountOutHuman <= 0 || midRateOutPerIn <= 0) {
    return 0;
  }
  const executionRate = amountOutHuman / amountInHuman;
  const impact = Math.abs(1 - executionRate / midRateOutPerIn);
  return Math.min(Math.round(impact * 10000), 9999);
}

/** USD-oracle fallback when pool spot is unavailable. */
export function computePriceImpactBpsFromUSD(
  amountInHuman: number,
  amountOutHuman: number,
  tokenInPriceUSD: number,
  tokenOutPriceUSD: number
): number {
  if (tokenInPriceUSD <= 0 || tokenOutPriceUSD <= 0) return 0;
  return computePriceImpactBps(
    amountInHuman,
    amountOutHuman,
    tokenInPriceUSD / tokenOutPriceUSD
  );
}

export function priceToTick(price: number): number {
  if (price <= 0 || Number.isNaN(price)) return 0;
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Human token1/token0 price → Uniswap tick (applies decimal scaling like priceToSqrtPriceX96).
 * Without this, pairs like USDC(6)/UNI(18) mint ranges thousands of ticks away from spot.
 */
export function humanPriceToTick(price: number, decimals0: number, decimals1: number): number {
  if (price <= 0 || Number.isNaN(price)) return 0;
  const rawPrice = price * 10 ** (decimals1 - decimals0);
  return priceToTick(rawPrice);
}

/** Uniswap tick → human token1/token0 price. */
export function tickToHumanPrice(tick: number, decimals0: number, decimals1: number): number {
  const raw = tickToPrice(tick);
  return raw / 10 ** (decimals1 - decimals0);
}

export function snapTickToSpacing(tick: number, tickSpacing: number, roundUp = false): number {
  const spacing = Math.max(1, Math.abs(tickSpacing));
  const compressed = tick / spacing;
  const floored = Math.floor(compressed);
  let snapped = (roundUp && compressed !== floored ? floored + 1 : floored) * spacing;
  if (snapped < MIN_TICK) snapped = Math.ceil(MIN_TICK / spacing) * spacing;
  if (snapped > MAX_TICK) snapped = Math.floor(MAX_TICK / spacing) * spacing;
  return snapped;
}

export function getTickSpacingForFee(fee: number, curveType: CurveType = CurveType.CLAMM): number {
  if (curveType === CurveType.BIN_AMM) {
    switch (fee) {
      case 100:
        return 1;
      case 500:
        return 10;
      case 3000:
        return 20;
      case 10000:
        return 50;
      default:
        return 10;
    }
  }
  if (curveType === CurveType.STABLE_AMM) {
    switch (fee) {
      case 100:
        return 1;
      case 500:
        return 5;
      case 3000:
        return 10;
      case 10000:
        return 25;
      default:
        return 5;
    }
  }
  return getFeeTierDefaultTickSpacing(fee);
}

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

/** Liquidity for amount0 given sqrt ratios (Uniswap V3). */
function getLiquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  let sqrtRatioAX96 = sqrtA;
  let sqrtRatioBX96 = sqrtB;
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  if (sqrtRatioAX96 === 0n) return 0n;
  const intermediate = mulDiv(sqrtRatioAX96, sqrtRatioBX96, Q96);
  return mulDiv(amount0, intermediate, sqrtRatioBX96 - sqrtRatioAX96);
}

/** Liquidity for amount1 given sqrt ratios (Uniswap V3). */
function getLiquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  let sqrtRatioAX96 = sqrtA;
  let sqrtRatioBX96 = sqrtB;
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  return mulDiv(amount1, Q96, sqrtRatioBX96 - sqrtRatioAX96);
}

function getSqrtRatioAtTickApprox(tick: number): bigint {
  const price = tickToPrice(tick);
  // decimals cancelled — raw geometric price in token1/token0 units already in tick space
  const sqrtPrice = Math.sqrt(price);
  const scaled = BigInt(Math.floor(sqrtPrice * 1e12));
  return (scaled * Q96) / BigInt(1e12);
}

/**
 * Max liquidity for amounts within [tickLower, tickUpper] at current sqrtPrice.
 */
export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  amount0: bigint,
  amount1: bigint
): bigint {
  if (tickLower >= tickUpper || amount0 === 0n && amount1 === 0n) return 0n;

  const sqrtA = getSqrtRatioAtTickApprox(tickLower);
  const sqrtB = getSqrtRatioAtTickApprox(tickUpper);

  if (sqrtPriceX96 <= sqrtA) {
    return getLiquidityForAmount0(sqrtA, sqrtB, amount0);
  }
  if (sqrtPriceX96 >= sqrtB) {
    return getLiquidityForAmount1(sqrtA, sqrtB, amount1);
  }
  const liq0 = getLiquidityForAmount0(sqrtPriceX96, sqrtB, amount0);
  const liq1 = getLiquidityForAmount1(sqrtA, sqrtPriceX96, amount1);
  return liq0 < liq1 ? liq0 : liq1;
}

/**
 * Token amounts for a liquidity position at the current sqrt price (Uniswap V3 formulas).
 */
export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n || tickLower >= tickUpper) return { amount0: 0n, amount1: 0n };

  let sqrtA = getSqrtRatioAtTickApprox(tickLower);
  let sqrtB = getSqrtRatioAtTickApprox(tickUpper);
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];

  if (sqrtPriceX96 <= sqrtA) {
    // Only token0
    const amount0 =
      sqrtA === 0n ? 0n : mulDiv(liquidity << 96n, sqrtB - sqrtA, sqrtB) / sqrtA;
    return { amount0, amount1: 0n };
  }
  if (sqrtPriceX96 >= sqrtB) {
    // Only token1
    return { amount0: 0n, amount1: mulDiv(liquidity, sqrtB - sqrtA, Q96) };
  }
  const amount0 =
    sqrtPriceX96 === 0n ? 0n : mulDiv(liquidity << 96n, sqrtB - sqrtPriceX96, sqrtB) / sqrtPriceX96;
  const amount1 = mulDiv(liquidity, sqrtPriceX96 - sqrtA, Q96);
  return { amount0, amount1 };
}

export function isNativeAddress(addr: Address | string): boolean {
  return addr.toLowerCase() === zeroAddress;
}

/**
 * Q128 price from Q64.96 sqrt — matches BinMathLib.getPriceX128FromSqrtPriceX96
 * and StableAMMEngine (amount1 = amount0 * sqrt² / 2^192).
 */
export function priceX128FromSqrtPriceX96(sqrtPriceX96: bigint): bigint {
  if (sqrtPriceX96 === 0n) return 0n;
  return (sqrtPriceX96 * sqrtPriceX96) >> 64n;
}

/** BinAMM / StableAMM: token1 owed for a token0 liquidityDelta at sqrtPrice. */
export function amount1ForToken0Liquidity(amount0: bigint, sqrtPriceX96: bigint): bigint {
  if (amount0 === 0n || sqrtPriceX96 === 0n) return 0n;
  const priceX128 = priceX128FromSqrtPriceX96(sqrtPriceX96);
  let amount1 = (amount0 * priceX128) >> 128n;
  if (amount0 > 0n && amount1 === 0n && priceX128 > 0n) amount1 = 1n;
  return amount1;
}

/** Inverse: max token0 liquidity that fits a token1 budget at sqrtPrice. */
export function amount0ForToken1Liquidity(amount1: bigint, sqrtPriceX96: bigint): bigint {
  if (amount1 === 0n || sqrtPriceX96 === 0n) return 0n;
  const priceX128 = priceX128FromSqrtPriceX96(sqrtPriceX96);
  if (priceX128 === 0n) return 0n;
  return (amount1 << 128n) / priceX128;
}

/**
 * Size BinAMM/Stable liquidityDelta + amounts so on-chain amount1 =
 * (amount0 * priceX128) >> 128 fits within the user's token budgets.
 */
export function sizeBinOrStableLiquidity(args: {
  amount0Wei: bigint;
  amount1Wei: bigint;
  sqrtPriceX96: bigint;
}): { liquidity: bigint; amount0Wei: bigint; amount1Wei: bigint } {
  const { amount0Wei, amount1Wei, sqrtPriceX96 } = args;
  if (amount0Wei === 0n && amount1Wei === 0n) {
    return { liquidity: 0n, amount0Wei: 0n, amount1Wei: 0n };
  }

  let liquidity = amount0Wei > 0n ? amount0Wei : amount0ForToken1Liquidity(amount1Wei, sqrtPriceX96);
  if (liquidity === 0n) liquidity = 1n;

  let need1 = amount1ForToken0Liquidity(liquidity, sqrtPriceX96);

  if (amount1Wei > 0n && need1 > amount1Wei) {
    liquidity = amount0ForToken1Liquidity(amount1Wei, sqrtPriceX96);
    if (amount0Wei > 0n && liquidity > amount0Wei) liquidity = amount0Wei;
    if (liquidity === 0n) liquidity = 1n;
    need1 = amount1ForToken0Liquidity(liquidity, sqrtPriceX96);
  }

  if (amount1Wei > 0n && need1 > amount1Wei) {
    return { liquidity: 0n, amount0Wei: 0n, amount1Wei: 0n };
  }

  return { liquidity, amount0Wei: liquidity, amount1Wei: need1 };
}

/** Build mint ticks + liquidity for the selected curve. */
export function buildMintLiquidityParams(args: {
  curveType: CurveType;
  fee: number;
  spotPrice: number;
  minPrice: number;
  maxPrice: number;
  isFullRange: boolean;
  amount0: string;
  amount1: string;
  decimals0: number;
  decimals1: number;
  sqrtPriceX96?: bigint;
  binId?: number;
}): {
  tickLower: number;
  tickUpper: number;
  tickSpacing: number;
  liquidity: bigint;
  amount0Wei: bigint;
  amount1Wei: bigint;
  sqrtPriceX96: bigint;
} {
  const tickSpacing = getTickSpacingForFee(args.fee, args.curveType);
  const amount0Wei = parseUnits(args.amount0 || '0', args.decimals0);
  const amount1Wei = parseUnits(args.amount1 || '0', args.decimals1);
  const sqrtPriceX96 =
    args.sqrtPriceX96 && args.sqrtPriceX96 > 0n
      ? args.sqrtPriceX96
      : priceToSqrtPriceX96(args.spotPrice, args.decimals0, args.decimals1);

  if (args.curveType === CurveType.BIN_AMM || args.curveType === CurveType.STABLE_AMM) {
    const sized = sizeBinOrStableLiquidity({ amount0Wei, amount1Wei, sqrtPriceX96 });
    if (args.curveType === CurveType.BIN_AMM) {
      const binId = args.binId ?? CENTER_BIN_ID;
      return {
        tickLower: binIdToInt24(binId),
        tickUpper: binIdToInt24(binId + 1),
        tickSpacing,
        ...sized,
        sqrtPriceX96,
      };
    }
    return {
      tickLower: 0,
      tickUpper: tickSpacing,
      tickSpacing,
      ...sized,
      sqrtPriceX96,
    };
  }

  // CLAMM
  let tickLower: number;
  let tickUpper: number;
  if (args.isFullRange) {
    tickLower = snapTickToSpacing(FULL_RANGE_TICK_LOWER, tickSpacing, false);
    tickUpper = snapTickToSpacing(FULL_RANGE_TICK_UPPER, tickSpacing, true);
  } else {
    tickLower = snapTickToSpacing(
      humanPriceToTick(args.minPrice, args.decimals0, args.decimals1),
      tickSpacing,
      false
    );
    tickUpper = snapTickToSpacing(
      humanPriceToTick(args.maxPrice, args.decimals0, args.decimals1),
      tickSpacing,
      true
    );
    if (tickLower >= tickUpper) {
      tickUpper = tickLower + tickSpacing;
    }
  }

  let liquidity = getLiquidityForAmounts(
    sqrtPriceX96,
    tickLower,
    tickUpper,
    amount0Wei,
    amount1Wei
  );
  if (liquidity === 0n) {
    // Fallback so mint does not ZeroLiquidity-revert on edge math
    liquidity = amount0Wei > 0n ? amount0Wei : amount1Wei;
  }

  return {
    tickLower,
    tickUpper,
    tickSpacing,
    liquidity,
    amount0Wei,
    amount1Wei,
    sqrtPriceX96,
  };
}
