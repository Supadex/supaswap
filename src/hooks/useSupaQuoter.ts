import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { parseUnits, zeroAddress } from 'viem';
import { type QuoteResult, type PoolKey, type TokenMetadata } from '../contracts/types';
import { getAddressesForChain, getTokensForChain } from '../contracts/addresses';
import { sortTokens } from '../contracts/utils';
import {
  unpackSqrtPriceX96,
  unpackDynamicFee,
  sqrtPriceX96ToPrice,
  computePriceImpactBps,
  computePriceImpactBpsFromUSD,
} from '../utils/poolMath';
import { findBestSwapRoute, buildPreferredPairMap } from '../utils/swapPath';
import { usePools } from './usePools';
import { formatSwapError } from './useSupaRouter';

export interface UseSupaQuoterParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  decimalsIn: number;
  decimalsOut: number;
  tokenInPriceUSD: number;
  tokenOutPriceUSD: number;
  tokenMetaIn?: TokenMetadata;
  tokenMetaOut?: TokenMetadata;
}

export function useSupaQuoter({
  tokenIn,
  tokenOut,
  amountIn,
  decimalsIn,
  decimalsOut,
  tokenInPriceUSD,
  tokenOutPriceUSD,
  tokenMetaIn,
  tokenMetaOut,
}: UseSupaQuoterParams) {
  const { chainId } = useAccount();
  const publicClient = usePublicClient();
  const addresses = getAddressesForChain(chainId);
  const { pools } = usePools();

  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPoolInitialized, setIsPoolInitialized] = useState<boolean | null>(null);
  const [poolKey, setPoolKey] = useState<PoolKey | null>(null);
  const [zeroForOne, setZeroForOne] = useState<boolean>(true);

  const isValidInput = Boolean(
    amountIn &&
      Number(amountIn) > 0 &&
      tokenIn &&
      tokenOut &&
      tokenIn.toLowerCase() !== tokenOut.toLowerCase()
  );

  useEffect(() => {
    if (!isValidInput) {
      setQuote(null);
      setError(null);
      setIsPoolInitialized(null);
      setPoolKey(null);
      return;
    }

    let isMounted = true;

    const symbolOf = (addr: Address): string => {
      const lower = addr.toLowerCase();
      if (tokenMetaIn && tokenMetaIn.address.toLowerCase() === lower) return tokenMetaIn.symbol;
      if (tokenMetaOut && tokenMetaOut.address.toLowerCase() === lower) return tokenMetaOut.symbol;
      if (lower === zeroAddress) return 'ETH';
      for (const p of pools) {
        if (p.token0.address.toLowerCase() === lower) return p.token0.symbol;
        if (p.token1.address.toLowerCase() === lower) return p.token1.symbol;
      }
      const chainTokens = getTokensForChain(chainId);
      const hit = chainTokens.find((t) => t.address.toLowerCase() === lower);
      return hit?.symbol ?? `${addr.slice(0, 6)}…`;
    };

    const fetchQuoteAndPoolState = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { zeroForOne: direction } = sortTokens(tokenIn, tokenOut);
        if (isMounted) setZeroForOne(direction);

        let amountInWei = 0n;
        try {
          amountInWei = parseUnits(amountIn, decimalsIn);
        } catch {
          amountInWei = 0n;
        }

        if (!publicClient || !addresses.poolManager || !addresses.quoter || amountInWei === 0n) {
          if (!isMounted) return;
          setIsPoolInitialized(false);
          setPoolKey(null);
          setQuote(null);
          setError('Unable to quote — check wallet network / RPC.');
          return;
        }

        const hubs: Address[] = [zeroAddress];
        for (const p of pools) {
          hubs.push(p.token0.address, p.token1.address);
        }
        for (const t of getTokensForChain(chainId)) {
          if (!t.isClaim) hubs.push(t.address);
        }

        const { route: best, emptyLiquidityPools } = await findBestSwapRoute({
          publicClient,
          poolManager: addresses.poolManager,
          quoter: addresses.quoter,
          tokenIn,
          tokenOut,
          amountIn: amountInWei,
          intermediates: hubs,
          symbolOf,
          preferredByPair: buildPreferredPairMap(pools),
        });

        if (!isMounted) return;

        if (!best) {
          setIsPoolInitialized(emptyLiquidityPools.length > 0);
          setPoolKey(emptyLiquidityPools[0]?.key ?? null);
          setQuote(null);
          setError(
            emptyLiquidityPools.length > 0
              ? 'Pool exists but has no active in-range liquidity. Remint with Full Range (or a range around the current price) — decimal-scaled ticks are required for pairs like USDC/UNI.'
              : 'No direct or multi-hop route found. Create overlapping pools (e.g. TOKEN/ETH and ETH/USDC).'
          );
          return;
        }

        setIsPoolInitialized(true);
        setPoolKey(best.poolKey);
        setZeroForOne(best.zeroForOne);
        setError(null);

        // Metrics from mid price when we have slot0 (single-hop); else USD fallback
        let priceImpactBps = 0;
        let dynamicLvrSpreadBps = 1;
        const amountInHuman = Number(amountIn);
        const amountOutHuman = Number(best.amountOut) / 10 ** decimalsOut;

        if (best.kind === 'single' && best.poolKey && best.slot0Raw) {
          const decimals0 = best.zeroForOne ? decimalsIn : decimalsOut;
          const decimals1 = best.zeroForOne ? decimalsOut : decimalsIn;
          const spot = sqrtPriceX96ToPrice(
            unpackSqrtPriceX96(best.slot0Raw),
            decimals0,
            decimals1
          );
          const mid =
            spot > 0 ? (best.zeroForOne ? spot : 1 / spot) : 0;
          priceImpactBps =
            mid > 0
              ? computePriceImpactBps(amountInHuman, amountOutHuman, mid)
              : computePriceImpactBpsFromUSD(
                  amountInHuman,
                  amountOutHuman,
                  tokenInPriceUSD,
                  tokenOutPriceUSD
                );
          const feeUnits = unpackDynamicFee(best.slot0Raw) || best.poolKey.fee;
          dynamicLvrSpreadBps = Math.max(1, Math.round(feeUnits / 100));
        } else {
          priceImpactBps = computePriceImpactBpsFromUSD(
            amountInHuman,
            amountOutHuman,
            tokenInPriceUSD || 1,
            tokenOutPriceUSD || 1
          );
          const fee0 = best.hops?.[0]?.poolKey.fee ?? 500;
          dynamicLvrSpreadBps = Math.max(1, Math.round(fee0 / 100));
        }

        setQuote({
          amountOut: best.amountOut,
          sqrtPriceX96After: best.sqrtPriceX96After,
          tickAfter: best.tickAfter,
          gasEstimate: best.kind === 'multi' ? 280000n : 150000n,
          priceImpactBps,
          dynamicLvrSpreadBps,
          recommendedCurve: best.recommendedCurve,
          isSimulated: false,
          path: best.path,
          hopCount: best.kind === 'multi' ? 2 : 1,
          routeLabel: best.routeLabel,
          hopCurveLabels: best.hopCurveLabels,
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(formatSwapError(err));
        setQuote(null);
        setIsPoolInitialized(false);
        setPoolKey(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchQuoteAndPoolState, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isValidInput,
    amountIn,
    tokenIn,
    tokenOut,
    decimalsIn,
    decimalsOut,
    tokenInPriceUSD,
    tokenOutPriceUSD,
    tokenMetaIn,
    tokenMetaOut,
    chainId,
    publicClient,
    addresses.poolManager,
    addresses.quoter,
    pools,
  ]);

  return {
    quote: isValidInput ? quote : null,
    isLoading: isValidInput ? isLoading : false,
    error: isValidInput ? error : null,
    isPoolInitialized,
    poolKey,
    zeroForOne,
  };
}
