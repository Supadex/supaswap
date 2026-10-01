import { useState } from 'react';
import { useConnection, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import type { Address, Hex } from 'viem';
import { maxUint256, zeroAddress } from 'viem';
import { SupaRouterABI, ERC20ABI, SupaVaultABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';
import type { PoolKey } from '../contracts/types';

function isNativeCurrency(tokenAddress: Address): boolean {
  return tokenAddress.toLowerCase() === zeroAddress;
}

/** Decode common periphery custom errors for user-facing messages. */
export function formatSwapError(err: unknown): string {
  const anyErr = err as {
    shortMessage?: string;
    message?: string;
    cause?: { data?: Hex; reason?: string };
    data?: Hex;
  };
  const data =
    (typeof anyErr?.data === 'string' && anyErr.data) ||
    (typeof anyErr?.cause?.data === 'string' && anyErr.cause.data) ||
    '';
  const msg = `${anyErr?.shortMessage || ''} ${anyErr?.message || ''} ${data}`;

  if (msg.includes('0x71c4efed') || /SlippageExceeded/i.test(msg)) {
    return 'Slippage exceeded — widen the price range around spot (or use Full Range), and ensure both token balances cover the deposit.';
  }
  if (msg.includes('0x7939f424') || /TransferFromFailed/i.test(msg)) {
    return 'Token transfer failed — check wallet balance and token approval, then try a smaller deposit.';
  }
  if (msg.includes('0x10074548') || /ZeroLiquidity/i.test(msg)) {
    return 'Liquidity is zero for this price range — use Full Range or a range around the current price.';
  }
  if (msg.includes('0xdc15460a') || /PoolNotInitialized/i.test(msg)) {
    return 'Pool is not initialized for this fee/plugin — open Add from the pool row, or create the pool first.';
  }
  if (/user rejected|User rejected|denied/i.test(msg)) {
    return 'Transaction rejected in wallet.';
  }
  if (/Transaction reverted on-chain/i.test(msg)) {
    return 'Transaction reverted on-chain — check the price range is around spot and balances cover both tokens.';
  }
  return anyErr?.shortMessage || anyErr?.message || 'Transaction failed';
}

async function waitForSuccess(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  hash: Hex
): Promise<Hex> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error('Transaction reverted on-chain');
  }
  return hash;
}

export function useSupaRouter() {
  const { address: userAddress, chainId, chain } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const publicClient = usePublicClient();
  const { mutateAsync } = useWriteContract();
  const [isSwapping, setIsSwapping] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const useAllowance = (tokenAddress: Address) => {
    const isNative = isNativeCurrency(tokenAddress);

    return useReadContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: userAddress ? [userAddress, addresses.router] : undefined,
      query: {
        enabled: Boolean(userAddress && tokenAddress && !isNative),
      },
    });
  };

  const approveToken = async (tokenAddress: Address, amount: bigint = maxUint256) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (isNativeCurrency(tokenAddress)) return;
    if (!publicClient) throw new Error('RPC client unavailable');

    setIsApproving(true);
    try {
      const hash = (await mutateAsync({
        address: tokenAddress,
        account: userAddress,
        chain,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [addresses.router, amount],
      })) as Hex;
      return waitForSuccess(publicClient, hash);
    } finally {
      setIsApproving(false);
    }
  };

  const swapExactIn = async ({
    poolKey,
    zeroForOne,
    amountIn,
    amountOutMin,
    path,
    payWithClaims = false,
    receiveAsClaims = false,
    deadlineMinutes = 20,
  }: {
    poolKey?: PoolKey | null;
    zeroForOne?: boolean;
    amountIn: bigint;
    amountOutMin: bigint;
    /** When set, executes multi-hop exactInput */
    path?: Hex;
    payWithClaims?: boolean;
    receiveAsClaims?: boolean;
    deadlineMinutes?: number;
  }) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC client unavailable');
    setIsSwapping(true);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

    try {
      if (payWithClaims) {
        const approved = (await publicClient.readContract({
          address: addresses.vault,
          abi: SupaVaultABI,
          functionName: 'isOperator',
          args: [userAddress, addresses.router],
        })) as boolean;
        if (!approved) {
          const opHash = (await mutateAsync({
            address: addresses.vault,
            chain,
            account: userAddress,
            abi: SupaVaultABI,
            functionName: 'setOperator',
            args: [addresses.router, true],
          })) as Hex;
          await waitForSuccess(publicClient, opHash);
        }
      }

      if (path) {
        // First hop input currency is first 20 bytes of path
        const inputCurrency = (`0x${path.slice(2, 42)}` as Address);
        const isInputNative = isNativeCurrency(inputCurrency);
        const value = !payWithClaims && isInputNative ? amountIn : 0n;

        const hash = (await mutateAsync({
          address: addresses.router,
          abi: SupaRouterABI,
          account: userAddress,
          chain,
          functionName: 'exactInput',
          args: [
            {
              path,
              recipient: userAddress,
              amountIn,
              amountOutMinimum: amountOutMin,
              payWithClaims,
              receiveAsClaims,
              deadline,
            },
          ],
          value,
        })) as Hex;

        return waitForSuccess(publicClient, hash);
      }

      if (!poolKey || zeroForOne === undefined) {
        throw new Error('Missing pool key for single-hop swap');
      }

      const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
      const isInputNative = isNativeCurrency(inputCurrency);
      const value = !payWithClaims && isInputNative ? amountIn : 0n;

      const hash = (await mutateAsync({
        address: addresses.router,
        abi: SupaRouterABI,
        account: userAddress,
        chain,
        functionName: 'exactInputSingle',
        args: [
          {
            poolKey: {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              plugin: poolKey.hooks,
              curveType: poolKey.curveType,
            },
            zeroForOne,
            recipient: userAddress,
            amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0n,
            hookData: '0x',
            payWithClaims,
            receiveAsClaims,
            deadline,
          },
        ],
        value,
      })) as Hex;

      return waitForSuccess(publicClient, hash);
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
