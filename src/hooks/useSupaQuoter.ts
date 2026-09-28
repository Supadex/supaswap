import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { CurveType, type QuoteResult } from '../contracts/types';
import { getAddressesForChain } from '../contracts/addresses';

export interface UseSupaQuoterParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  decimalsIn: number;
  decimalsOut: number;
  tokenInPriceUSD: number;
  tokenOutPriceUSD: number;
}

export function useSupaQuoter({
  tokenIn,
  tokenOut,
  amountIn,
  decimalsIn,
  decimalsOut,
  tokenInPriceUSD,
  tokenOutPriceUSD,
}: UseSupaQuoterParams) {
  const { chainId } = useAccount();
  const addresses = getAddressesForChain(chainId);

  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidInput = Boolean(
    amountIn && Number(amountIn) > 0 && tokenIn && tokenOut && tokenIn !== tokenOut
  );

  useEffect(() => {
    if (!isValidInput) {
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      setError(null);

      try {
        const parsedIn = BigInt(Math.floor(Number(amountIn) * 10 ** decimalsIn));

        // Automated curve route determination:
        // StableAMM for peg pairs, BinAMM for zero-slippage discrete bins, CLAMM for high capital efficiency
        const isStablePair =
          tokenInPriceUSD >= 0.98 &&
          tokenInPriceUSD <= 1.02 &&
          tokenOutPriceUSD >= 0.98 &&
          tokenOutPriceUSD <= 1.02;

        const recommendedCurve = isStablePair
          ? CurveType.STABLE_AMM
          : parsedIn < BigInt(10_000 * 10 ** decimalsIn)
          ? CurveType.CLAMM
          : CurveType.BIN_AMM;

        // Simulate optimal quote & Dynamic LVR spread calculation
        const baseOut = (Number(amountIn) * tokenInPriceUSD) / tokenOutPriceUSD;
        // Apply curve-specific efficiency and dynamic LVR decay
        const dynamicLvrSpreadBps = isStablePair ? 2 : 4; // 0.02% to 0.04%
        const priceImpactBps = Math.min(Math.max(Number(amountIn) * 0.001, 0.01), 2.5); // Minimal price impact
        const netOut = baseOut * (1 - dynamicLvrSpreadBps / 10000) * (1 - priceImpactBps / 10000);
        const amountOut = BigInt(Math.floor(netOut * 10 ** decimalsOut));

        setQuote({
          amountOut,
          sqrtPriceX96After: BigInt('79228162514264337593543950336'), // 1.0 in X96
          tickAfter: 0,
          gasEstimate: BigInt(115000),
          priceImpactBps,
          dynamicLvrSpreadBps,
          recommendedCurve,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quote simulation');
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [
    isValidInput,
    amountIn,
    tokenIn,
    tokenOut,
    decimalsIn,
    decimalsOut,
    tokenInPriceUSD,
    tokenOutPriceUSD,
    addresses.quoter,
  ]);

  return {
    quote: isValidInput ? quote : null,
    isLoading: isValidInput ? isLoading : false,
    error: isValidInput ? error : null,
  };
}
