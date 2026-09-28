import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { maxUint256 } from 'viem';
import { SupaRouterABI, ERC20ABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';
import type { PoolKey } from '../contracts/types';

export function useSupaRouter() {
  const { address: userAddress, chainId } = useAccount();
  const addresses = getAddressesForChain(chainId);
  const { writeContractAsync } = useWriteContract();
  const [isSwapping, setIsSwapping] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Check token allowance for router
  const useAllowance = (tokenAddress: Address) => {
    return useReadContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: userAddress ? [userAddress, addresses.router] : undefined,
      query: {
        enabled: Boolean(userAddress && tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000'),
      },
    });
  };

  // Approve token spend for router
  const approveToken = async (tokenAddress: Address, amount: bigint = maxUint256) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [addresses.router, amount],
      });
      return hash;
    } finally {
      setIsApproving(false);
    }
  };

  // Execute Exact Input Swap
  const swapExactIn = async ({
    poolKey,
    zeroForOne,
    amountIn,
    amountOutMin,
    settleClaims = false,
    takeClaims = false,
  }: {
    poolKey: PoolKey;
    zeroForOne: boolean;
    amountIn: bigint;
    amountOutMin: bigint;
    settleClaims?: boolean;
    takeClaims?: boolean;
  }) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsSwapping(true);
    try {
      const hash = await writeContractAsync({
        address: addresses.router,
        abi: SupaRouterABI,
        functionName: 'exactInputSingle',
        args: [
          {
            poolKey: {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              curveType: poolKey.curveType,
              hooks: poolKey.hooks,
            },
            zeroForOne,
            recipient: userAddress,
            amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: BigInt(0),
            settleClaims,
            takeClaims,
          },
        ],
      });
      return hash;
    } finally {
      setIsSwapping(false);
    }
  };

  return {
    routerAddress: addresses.router,
    useAllowance,
    approveToken,
    swapExactIn,
    isSwapping,
    isApproving,
  };
}
