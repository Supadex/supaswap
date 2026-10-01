import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import type { Hex, Address } from 'viem';
import { zeroAddress } from 'viem';
import { SupaPoolManagerABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';
import type { PoolKey } from '../contracts/types';
import { computePoolId } from '../contracts/utils';
import { unpackSqrtPriceX96, unpackTick } from '../utils/poolMath';

export function usePoolManager() {
  const { chainId, address: userAddress, chain } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const publicClient = usePublicClient();
  const { mutateAsync, isPending: isInitializing } = useWriteContract();

  const readSlot0 = async (poolId: Hex) => {
    if (!publicClient) return null;
    try {
      const raw = (await publicClient.readContract({
        address: addresses.poolManager,
        abi: SupaPoolManagerABI,
        functionName: 'getSlot0',
        args: [poolId],
      })) as Hex;

      const sqrtPriceX96 = unpackSqrtPriceX96(raw);
      const tick = unpackTick(raw);
      return {
        raw,
        sqrtPriceX96,
        tick,
        isInitialized: sqrtPriceX96 > 0n,
      };
    } catch {
      return null;
    }
  };

  const isPoolInitialized = async (poolKey: PoolKey): Promise<boolean> => {
    const poolId = computePoolId(poolKey);
    const slot0 = await readSlot0(poolId);
    return Boolean(slot0?.isInitialized);
  };

  const getPoolSqrtPrice = async (poolKey: PoolKey): Promise<bigint> => {
    const poolId = computePoolId(poolKey);
    const slot0 = await readSlot0(poolId);
    return slot0?.sqrtPriceX96 ?? 0n;
  };

  const initializePool = async (poolKey: PoolKey, sqrtPriceX96: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (sqrtPriceX96 === 0n) throw new Error('Invalid initial sqrtPriceX96');

    return mutateAsync({
      address: addresses.poolManager,
      abi: SupaPoolManagerABI,
      functionName: 'initialize',
      chain,
      account: userAddress,
      args: [
        {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          plugin: (poolKey.hooks || zeroAddress) as Address,
          curveType: poolKey.curveType,
        },
        sqrtPriceX96,
        '0x',
      ],
    });
  };

  return {
    managerAddress: addresses.poolManager,
    readSlot0,
    isPoolInitialized,
    getPoolSqrtPrice,
    initializePool,
    isInitializing,
  };
}
