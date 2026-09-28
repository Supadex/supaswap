import { useAccount, useReadContract } from 'wagmi';
import type { Hex } from 'viem';
import { SupaPoolManagerABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';

export function usePoolManager(poolId?: Hex) {
  const { chainId } = useAccount();
  const addresses = getAddressesForChain(chainId);

  const { data: slot0Data, isLoading: isLoadingSlot0, refetch: refetchSlot0 } = useReadContract({
    address: addresses.poolManager,
    abi: SupaPoolManagerABI,
    functionName: 'getSlot0',
    args: poolId ? [poolId] : undefined,
    query: {
      enabled: Boolean(poolId),
    },
  });

  const { data: liquidityData, isLoading: isLoadingLiquidity } = useReadContract({
    address: addresses.poolManager,
    abi: SupaPoolManagerABI,
    functionName: 'getLiquidity',
    args: poolId ? [poolId] : undefined,
    query: {
      enabled: Boolean(poolId),
    },
  });

  const slot0 = slot0Data
    ? {
        sqrtPriceX96: slot0Data[0],
        tick: slot0Data[1],
        protocolFee: slot0Data[2],
        lpFee: slot0Data[3],
        dynamicLvrSpread: slot0Data[4],
        unlocked: slot0Data[5],
      }
    : null;

  return {
    managerAddress: addresses.poolManager,
    slot0,
    liquidity: liquidityData ?? BigInt(0),
    isLoading: isLoadingSlot0 || isLoadingLiquidity,
    refetchSlot0,
  };
}
