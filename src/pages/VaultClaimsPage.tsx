import React, { useState, useMemo, useCallback } from 'react';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits, type Address, zeroAddress } from 'viem';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { TokenLogo } from '../components/ui/TokenLogo';
import { useToast } from '../components/ui/Toast';
import { DepositClaimModal } from '../components/claims/DepositClaimModal';
import { WithdrawClaimModal } from '../components/claims/WithdrawClaimModal';
import { FlashAccountingVisualizer } from '../components/claims/FlashAccountingVisualizer';
import type { ClaimAsset } from '../components/claims/types';
import { useTokenList } from '../hooks/useTokenList';
import { useSupaVault } from '../hooks/useSupaVault';
import { ERC20ABI, SupaVaultABI } from '../contracts/abis';
import { currencyId } from '../contracts/utils';
import {
  Coins,
  Wallet,
  RefreshCw,
  Search,
  CheckCircle2,
  Activity,
  Plus,
} from 'lucide-react';

export type { ClaimAsset };

function formatBal(raw: bigint | undefined, decimals: number): string {
  if (raw === undefined) return '0.0000';
  const n = Number.parseFloat(formatUnits(raw, decimals));
  return Number.isFinite(n) ? n.toFixed(4) : '0.0000';
}

export const VaultClaimsPage: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { success, error: toastError } = useToast();
  const { tokens } = useTokenList();
  const { vaultAddress } = useSupaVault();

  const physicalTokens = useMemo(
    () => tokens.filter((t) => !t.isClaim),
    [tokens]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToken, setSelectedToken] = useState<ClaimAsset | null>(null);
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: nativeBal, refetch: refetchNative } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  const erc20Contracts = useMemo(
    () =>
      physicalTokens
        .filter((t) => t.address.toLowerCase() !== zeroAddress)
        .map((t) => ({
          address: t.address as Address,
          abi: ERC20ABI,
          functionName: 'balanceOf' as const,
          args: [address as Address],
        })),
    [physicalTokens, address]
  );

  const claimContracts = useMemo(
    () =>
      physicalTokens.map((t) => ({
        address: vaultAddress as Address,
        abi: SupaVaultABI,
        functionName: 'balanceOf' as const,
        args: [address as Address, currencyId(t.address)],
      })),
    [physicalTokens, vaultAddress, address]
  );

  const {
    data: erc20Results,
    isLoading: loadingErc20,
    refetch: refetchErc20,
  } = useReadContracts({
    contracts: erc20Contracts,
    query: { enabled: Boolean(address && erc20Contracts.length) },
  });

  const {
    data: claimResults,
    isLoading: loadingClaims,
    refetch: refetchClaims,
  } = useReadContracts({
    contracts: claimContracts,
    query: { enabled: Boolean(address && vaultAddress && claimContracts.length) },
  });

  const isLoading = Boolean(isConnected && (loadingErc20 || loadingClaims));

  const assets: ClaimAsset[] = useMemo(() => {
    let erc20Idx = 0;
    return physicalTokens.map((t, i) => {
      const isNative = t.address.toLowerCase() === zeroAddress || t.isNative;
      let walletRaw: bigint | undefined;
      if (isNative) {
        walletRaw = nativeBal?.value;
      } else {
        walletRaw = erc20Results?.[erc20Idx]?.result as bigint | undefined;
        erc20Idx += 1;
      }
      const claimRaw = claimResults?.[i]?.result as bigint | undefined;
      return {
        symbol: t.symbol,
        name: t.name,
        address: t.address as `0x${string}`,
        decimals: t.decimals,
        walletBalance: formatBal(walletRaw, t.decimals),
        claimBalance: formatBal(claimRaw, t.decimals),
        priceUSD: t.priceUSD || 0,
        logoURI: t.logoURI,
      };
    });
  }, [physicalTokens, nativeBal, erc20Results, claimResults]);

  /** Prefer tokens with wallet balance for minting; fall back to full list. */
  const mintableTokens = useMemo(
    () =>
      assets.filter((a) => {
        const wallet = parseFloat(a.walletBalance.replace(/,/g, '')) || 0;
        return wallet > 0;
      }),
    [assets]
  );

  const refreshBalances = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchNative(), refetchErc20(), refetchClaims()]);
      success('Balances Refreshed', 'Wallet and vault claim balances updated.');
    } catch {
      toastError('Refresh Failed', 'Could not reload balances from RPC.');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchNative, refetchErc20, refetchClaims, success, toastError]);

  /** Only tokens with a positive vault claim balance (optionally search-filtered). */
  const activeClaimAssets = useMemo(() => {
    return assets.filter((asset) => {
      const claimVal = parseFloat(asset.claimBalance.replace(/,/g, ''));
      if (claimVal <= 0) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q)
      );
    });
  }, [assets, searchQuery]);

  const totalClaimsValue = useMemo(
    () =>
      assets.reduce((sum, a) => {
        const v = parseFloat(a.claimBalance.replace(/,/g, '')) * a.priceUSD;
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    [assets]
  );

  const totalWalletValue = useMemo(
    () =>
      assets.reduce((sum, a) => {
        const v = parseFloat(a.walletBalance.replace(/,/g, '')) * a.priceUSD;
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    [assets]
  );

  const handleOpenDeposit = (token?: ClaimAsset) => {
    setSelectedToken(token ?? mintableTokens[0] ?? assets[0] ?? null);
    setActiveModal('deposit');
  };

  const handleOpenWithdraw = (token: ClaimAsset) => {
    setSelectedToken(token);
    setActiveModal('withdraw');
  };

  const onModalSuccess = () => {
    void refreshBalances();
  };

  const depositSelectable = useMemo(() => {
    if (activeModal !== 'deposit') return undefined;
    const base = mintableTokens.length > 0 ? mintableTokens : assets;
    if (
      selectedToken &&
      !base.some(
        (t) => t.address.toLowerCase() === selectedToken.address.toLowerCase()
      )
    ) {
      return [selectedToken, ...base];
    }
    return base;
  }, [activeModal, mintableTokens, assets, selectedToken]);

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Vault Claims Hub
            </h1>
            <Badge variant="default" size="sm" className="font-mono text-[10px]">
              ERC-6909 Native
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Prepaid credits in SupaVault — mint once, swap or LP without repeated ERC-20 transfers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="brand"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => handleOpenDeposit()}
            disabled={!isConnected || assets.length === 0}
          >
            Mint New Claim
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            }
            onClick={() => void refreshBalances()}
            disabled={isRefreshing || !isConnected}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Total ERC-6909 Claims Value
            </span>
            <Coins className="w-4 h-4 text-neutral-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                ${totalClaimsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 0-gas multi-hop enabled
              </div>
            </>
          )}
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Wallet Physical Value
            </span>
            <Wallet className="w-4 h-4 text-neutral-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                ${totalWalletValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-neutral-400 mt-1 font-mono">Available to mint claims</div>
            </>
          )}
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Active Claim Currencies
            </span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
                {activeClaimAssets.length}
              </div>
              <div className="text-xs text-neutral-400 mt-1">With positive claim balance</div>
            </>
          )}
        </Card>
      </div>

      <FlashAccountingVisualizer />

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter active claims by symbol..."
          className="w-full h-10 pl-9.5 pr-3 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.08] text-sm outline-none focus:border-neutral-400 dark:focus:border-white/20"
        />
      </div>

      {!isConnected ? (
        <Card variant="surface" className="p-16 text-center border-neutral-200 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Connect Your Wallet
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Connect to mint ERC-6909 vault claims and redeem them for physical tokens.
          </p>
          <Button variant="brand" size="md" leftIcon={<Wallet className="w-4 h-4" />} onClick={() => open()}>
            Connect Wallet
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111317] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-200/80 dark:border-white/[0.06]">
                {['Asset', 'Wallet', 'Claims', 'Value', 'Actions'].map((h) => (
                  <TableHead key={h} className="py-3.5 px-4 text-xs text-neutral-500">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-neutral-200/60 dark:border-white/[0.04]">
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Skeleton variant="circular" className="w-7 h-7" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <Skeleton className="h-3.5 w-14" />
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <Skeleton className="h-7 w-28 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : activeClaimAssets.length === 0 ? (
        <Card variant="surface" className="p-14 text-center border-neutral-200 dark:border-white/[0.08]">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            No vault claims yet
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            {searchQuery
              ? `No active claims match “${searchQuery}”.`
              : 'Deposit ERC-20 tokens to mint claims. Only currencies you hold in the vault appear here.'}
          </p>
          {!searchQuery && (
            <Button
              variant="brand"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => handleOpenDeposit()}
            >
              Mint New Claim
            </Button>
          )}
        </Card>
      ) : (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111317] overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-200/80 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
                <TableHead className="py-3.5 px-4 text-xs text-neutral-500">Asset</TableHead>
                <TableHead className="py-3.5 px-4 text-xs text-neutral-500 text-right">Wallet</TableHead>
                <TableHead className="py-3.5 px-4 text-xs text-neutral-500 text-right">Claims</TableHead>
                <TableHead className="py-3.5 px-4 text-xs text-neutral-500 text-right">Claim Value</TableHead>
                <TableHead className="py-3.5 px-4 text-xs text-neutral-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeClaimAssets.map((asset) => {
                const claimNum = parseFloat(asset.claimBalance) || 0;
                const claimUsd = claimNum * asset.priceUSD;
                return (
                  <TableRow
                    key={asset.address}
                    className="border-b border-neutral-200/60 dark:border-white/[0.04] hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <TableCell className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <TokenLogo
                          symbol={asset.symbol}
                          address={asset.address}
                          logoURI={asset.logoURI}
                          size="md"
                        />
                        <div>
                          <div className="font-semibold text-sm text-neutral-900 dark:text-white">
                            {asset.symbol}
                          </div>
                          <div className="text-[11px] text-neutral-500">{asset.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right font-mono text-xs">
                      {asset.walletBalance}
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right font-mono text-xs text-neutral-800 dark:text-neutral-200">
                      {asset.claimBalance}
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right font-mono text-xs">
                      ${claimUsd.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenDeposit(asset)}
                        >
                          Mint
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenWithdraw(asset)}
                        >
                          Redeem
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DepositClaimModal
        isOpen={activeModal === 'deposit'}
        onClose={() => setActiveModal(null)}
        token={selectedToken}
        selectableTokens={depositSelectable}
        onSuccess={onModalSuccess}
      />
      <WithdrawClaimModal
        isOpen={activeModal === 'withdraw'}
        onClose={() => setActiveModal(null)}
        token={selectedToken}
        onSuccess={onModalSuccess}
      />
    </div>
  );
};
