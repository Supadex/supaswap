import { useCallback } from 'react';
import {
  useConnection,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { type Address, type Hex, maxUint256, zeroAddress } from 'viem';
import { SupaVaultABI, SupaClaimsRouterABI, ERC20ABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';
import { currencyId } from '../contracts/utils';

export function useSupaVault() {
  const { address: userAddress, chainId, chain } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const publicClient = usePublicClient();
  const { mutateAsync, isPending: isWriting } = useWriteContract();

  const waitForSuccess = useCallback(
    async (hash: Hex): Promise<Hex> => {
      if (!publicClient) throw new Error('RPC client unavailable');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain');
      return hash;
    },
    [publicClient]
  );

  const useClaimBalance = (currency: Address | undefined) => {
    const id = currency ? currencyId(currency) : 0n;
    return useReadContract({
      address: addresses.vault,
      abi: SupaVaultABI,
      functionName: 'balanceOf',
      args: userAddress && currency ? [userAddress, id] : undefined,
      query: {
        enabled: Boolean(userAddress && currency && addresses.vault),
      },
    });
  };

  const useIsOperator = (operator: Address | undefined) => {
    return useReadContract({
      address: addresses.vault,
      abi: SupaVaultABI,
      functionName: 'isOperator',
      args: userAddress && operator ? [userAddress, operator] : undefined,
      query: {
        enabled: Boolean(userAddress && operator && addresses.vault),
      },
    });
  };

  const useTokenBalance = (tokenAddress: Address) => {
    return useReadContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: userAddress ? [userAddress] : undefined,
      query: {
        enabled: Boolean(
          userAddress && tokenAddress && tokenAddress.toLowerCase() !== zeroAddress
        ),
      },
    });
  };

  const ensureOperator = useCallback(
    async (operator: Address) => {
      if (!userAddress) throw new Error('Wallet not connected');
      if (!publicClient) throw new Error('RPC unavailable');
      if (!operator || operator === zeroAddress) return;

      const approved = (await publicClient.readContract({
        address: addresses.vault,
        abi: SupaVaultABI,
        functionName: 'isOperator',
        args: [userAddress, operator],
      })) as boolean;

      if (approved) return;

      const hash = (await mutateAsync({
        address: addresses.vault,
        chain,
        account: userAddress,
        abi: SupaVaultABI,
        functionName: 'setOperator',
        args: [operator, true],
      })) as Hex;
      await waitForSuccess(hash);
    },
    [userAddress, publicClient, addresses.vault, mutateAsync, chain, waitForSuccess]
  );

  const ensureErc20Allowance = useCallback(
    async (token: Address, spender: Address, amount: bigint) => {
      if (!userAddress) throw new Error('Wallet not connected');
      if (!publicClient) throw new Error('RPC unavailable');
      if (token.toLowerCase() === zeroAddress) return;

      const allowance = (await publicClient.readContract({
        address: token,
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [userAddress, spender],
      })) as bigint;

      if (allowance >= amount) return;

      const hash = (await mutateAsync({
        address: token,
        chain,
        account: userAddress,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [spender, maxUint256],
      })) as Hex;
      await waitForSuccess(hash);
    },
    [userAddress, publicClient, mutateAsync, chain, waitForSuccess]
  );

  const deposit = useCallback(
    async (currency: Address, recipient: Address, amount: bigint) => {
      if (!userAddress) throw new Error('Wallet not connected');
      if (!addresses.claimsRouter) throw new Error('ClaimsRouter not deployed on this chain');

      const isNative = currency.toLowerCase() === zeroAddress;
      if (!isNative) {
        await ensureErc20Allowance(currency, addresses.claimsRouter, amount);
      }

      const hash = (await mutateAsync({
        address: addresses.claimsRouter,
        chain,
        account: userAddress,
        abi: SupaClaimsRouterABI,
        functionName: 'deposit',
        args: [currency, recipient, amount],
        value: isNative ? amount : 0n,
      })) as Hex;
      return waitForSuccess(hash);
    },
    [
      userAddress,
      addresses.claimsRouter,
      ensureErc20Allowance,
      mutateAsync,
      chain,
      waitForSuccess,
    ]
  );

  const withdraw = useCallback(
    async (currency: Address, recipient: Address, amount: bigint) => {
      if (!userAddress) throw new Error('Wallet not connected');
      if (!addresses.claimsRouter) throw new Error('ClaimsRouter not deployed on this chain');

      await ensureOperator(addresses.claimsRouter);

      const hash = (await mutateAsync({
        address: addresses.claimsRouter,
        chain,
        account: userAddress,
        abi: SupaClaimsRouterABI,
        functionName: 'withdraw',
        args: [currency, recipient, amount],
      })) as Hex;
      return waitForSuccess(hash);
    },
    [
      userAddress,
      addresses.claimsRouter,
      ensureOperator,
      mutateAsync,
      chain,
      waitForSuccess,
    ]
  );

  const readClaimBalance = useCallback(
    async (currency: Address, owner?: Address): Promise<bigint> => {
      if (!publicClient || !addresses.vault) return 0n;
      const who = owner || userAddress;
      if (!who) return 0n;
      return (await publicClient.readContract({
        address: addresses.vault,
        abi: SupaVaultABI,
        functionName: 'balanceOf',
        args: [who, currencyId(currency)],
      })) as bigint;
    },
    [publicClient, addresses.vault, userAddress]
  );

  return {
    vaultAddress: addresses.vault,
    claimsRouterAddress: addresses.claimsRouter,
    useClaimBalance,
    useIsOperator,
    useTokenBalance,
    deposit,
    withdraw,
    ensureOperator,
    ensureErc20Allowance,
    readClaimBalance,
    isWriting,
  };
}
