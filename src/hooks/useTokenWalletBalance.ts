import { useConnection, useBalance, useReadContract } from 'wagmi';
import { formatUnits, type Address, zeroAddress } from 'viem';
import { ERC20ABI, SupaVaultABI } from '../contracts/abis';
import { getAddressesForChain } from '../contracts/addresses';
import { currencyId } from '../contracts/utils';
import type { TokenMetadata } from '../contracts/types';

function isNativeToken(token: TokenMetadata): boolean {
  return Boolean(token.isNative) || token.address.toLowerCase() === zeroAddress;
}

export interface TokenWalletBalanceResult {
  formatted: string;
  refetch: () => Promise<void>;
}

/**
 * Balance for a swap/LP token.
 * - Physical native / ERC-20 → wallet balance
 * - isClaim → SupaVault ERC-6909 balanceOf(user, currencyId)
 */
export function useTokenWalletBalance(token: TokenMetadata): TokenWalletBalanceResult {
  const { address, isConnected, chainId } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const native = isNativeToken(token);
  const isClaim = Boolean(token.isClaim);

  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address,
    query: {
      enabled: Boolean(address && !isClaim && native),
      staleTime: 0,
    },
  });

  const { data: erc20Balance, refetch: refetchErc20 } = useReadContract({
    address: token.address as Address,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && !isClaim && !native),
      staleTime: 0,
    },
  });

  const { data: claimBalance, refetch: refetchClaim } = useReadContract({
    address: addresses.vault,
    abi: SupaVaultABI,
    functionName: 'balanceOf',
    args: address ? [address, currencyId(token.address)] : undefined,
    query: {
      enabled: Boolean(address && isClaim && addresses.vault),
      staleTime: 0,
    },
  });

  const refetch = async () => {
    if (isClaim) {
      await refetchClaim({ cancelRefetch: false });
    } else if (native) {
      await refetchNative({ cancelRefetch: false });
    } else {
      await refetchErc20({ cancelRefetch: false });
    }
  };

  if (!isConnected) {
    return { formatted: '-', refetch };
  }

  const raw = isClaim
    ? (claimBalance as bigint | undefined)
    : native
      ? nativeBalance?.value
      : (erc20Balance as bigint | undefined);
  const decimals = native && !isClaim ? (nativeBalance?.decimals ?? token.decimals) : token.decimals;

  if (raw === undefined) {
    return { formatted: '0.0000', refetch };
  }

  const formatted = formatUnits(raw, decimals);
  const asNumber = Number.parseFloat(formatted);
  if (!Number.isFinite(asNumber)) {
    return { formatted: '0.0000', refetch };
  }
  return { formatted: asNumber.toFixed(4), refetch };
}
