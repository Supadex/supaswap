import type { Address } from 'viem';

export const CurveType = {
  CLAMM: 0,
  BIN_AMM: 1,
  STABLE_AMM: 2,
} as const;

export type CurveType = (typeof CurveType)[keyof typeof CurveType];

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  curveType: CurveType;
  hooks: Address;
}

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  dynamicLvrSpread: number;
  unlocked: boolean;
}

export interface PositionInfo {
  nonce: bigint;
  operator: Address;
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface QuoteResult {
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  tickAfter: number;
  gasEstimate: bigint;
  priceImpactBps: number;
  dynamicLvrSpreadBps: number;
  recommendedCurve: CurveType;
}

export interface TokenMetadata {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD: number;
  isNative?: boolean;
  isClaim?: boolean;
}
