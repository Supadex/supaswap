import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import type { Address } from 'viem';
import { SupaVaultABI, ERC20ABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';

export function useSupaVault() {
  const { address: userAddress, chainId } = useAccount();
  const addresses = getAddressesForChain(chainId);
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  // Get ERC-6909 internal vault claim balance
  const useClaimBalance = (currency: Address) => {
    return useReadContract({
      address: addresses.vault,
      abi: SupaVaultABI,
      functionName: 'claimsOf',
      args: userAddress && currency ? [userAddress, currency] : undefined,
      query: {
        enabled: Boolean(userAddress && currency),
      },
    });
  };

  // Get physical ERC-20 token balance
  const useTokenBalance = (tokenAddress: Address) => {
    return useReadContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: userAddress ? [userAddress] : undefined,
      query: {
        enabled: Boolean(userAddress && tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000'),
      },
    });
  };

  // Deposit ERC-20 tokens into SupaVault to mint ERC-6909 claims
  const deposit = async (currency: Address, recipient: Address, amount: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    return writeContractAsync({
      address: addresses.vault,
      abi: SupaVaultABI,
      functionName: 'deposit',
      args: [currency, recipient, amount],
    });
  };

  // Withdraw ERC-6909 claims to redeem physical ERC-20 tokens
  const withdraw = async (currency: Address, recipient: Address, amount: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    return writeContractAsync({
      address: addresses.vault,
      abi: SupaVaultABI,
      functionName: 'withdraw',
      args: [currency, recipient, amount],
    });
  };

  return {
    vaultAddress: addresses.vault,
    useClaimBalance,
    useTokenBalance,
    deposit,
    withdraw,
    isWriting,
  };
}
