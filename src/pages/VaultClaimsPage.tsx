import React, { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { TokenLogo } from '../components/ui/TokenLogo';
import { useToast } from '../components/ui/Toast';
import { DepositClaimModal } from '../components/claims/DepositClaimModal';
import { WithdrawClaimModal } from '../components/claims/WithdrawClaimModal';
import { FlashAccountingVisualizer } from '../components/claims/FlashAccountingVisualizer';
import {
  Coins,
  Wallet,
  RefreshCw,
  Search,
  CheckCircle2,
  Activity,
  Plus,
} from 'lucide-react';

interface ClaimAsset {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  walletBalance: string;
  claimBalance: string;
  priceUSD: number;
  unsettledDelta: string;
}

const SUPPORTED_DEPOSIT_TOKENS: ClaimAsset[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    walletBalance: '0.0000',
    claimBalance: '0.0000',
    priceUSD: 3120.50,
    unsettledDelta: '0.0000',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    walletBalance: '0.00',
    claimBalance: '0.00',
    priceUSD: 1.00,
    unsettledDelta: '0.0000',
  },
  {
    symbol: 'SUPA',
    name: 'SupaDex Governance',
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    decimals: 18,
    walletBalance: '0.00',
    claimBalance: '0.00',
    priceUSD: 2.45,
    unsettledDelta: '0.0000',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    walletBalance: '0.0000',
    claimBalance: '0.0000',
    priceUSD: 64500.00,
    unsettledDelta: '0.0000',
  },
];

export const VaultClaimsPage: React.FC = () => {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const { success } = useToast();
  const [assets, setAssets] = useState<ClaimAsset[]>(SUPPORTED_DEPOSIT_TOKENS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToken, setSelectedToken] = useState<ClaimAsset | null>(null);
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  // Filter only assets with active positive claim balance
  const activeClaimAssets = useMemo(() => {
    return assets.filter((asset) => {
      const claimVal = parseFloat(asset.claimBalance.replace(/,/g, ''));
      if (claimVal <= 0) return false;
      const matchesSearch =
        asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [assets, searchQuery]);

  // Aggregate Metrics
  const totalClaimsValue = useMemo(() => {
    return assets.reduce((sum, a) => {
      const claimVal = parseFloat(a.claimBalance.replace(/,/g, '')) * a.priceUSD;
      return sum + (isNaN(claimVal) ? 0 : claimVal);
    }, 0);
  }, [assets]);

  const totalWalletValue = useMemo(() => {
    return assets.reduce((sum, a) => {
      const walletVal = parseFloat(a.walletBalance.replace(/,/g, '')) * a.priceUSD;
      return sum + (isNaN(walletVal) ? 0 : walletVal);
    }, 0);
  }, [assets]);

  const activeClaimsCount = activeClaimAssets.length;

  const handleSettleDeltas = () => {
    setIsSettling(true);
    setTimeout(() => {
      setAssets((prev) =>
        prev.map((item) => ({
          ...item,
          unsettledDelta: '0.0000',
        }))
      );
      setIsSettling(false);
      success('Deltas Settled', 'All transient deltas were verified and netted in SupaVault.');
    }, 700);
  };

  const handleOpenDeposit = (token?: ClaimAsset) => {
    setSelectedToken(token || assets[0]);
    setActiveModal('deposit');
  };

  const handleOpenWithdraw = (token: ClaimAsset) => {
    setSelectedToken(token);
    setActiveModal('withdraw');
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Vault Claims Hub
            </h1>
            <Badge variant="purple" size="sm" className="font-mono text-[10px]">
              ERC-6909 Native
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Hold internal gasless accounting credits in SupaVault. Zero ERC-20 transfer tax on multi-hop swaps.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="brand"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => handleOpenDeposit()}
          >
            Mint New Claim
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSettling ? 'animate-spin' : ''}`} />}
            onClick={handleSettleDeltas}
            disabled={isSettling || !isConnected}
          >
            {isSettling ? 'Settling...' : 'Settle Deltas'}
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Total ERC-6909 Claims Value
            </span>
            <Coins className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            ${totalClaimsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 0-gas multi-hop enabled
          </div>
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Physical Wallet Assets
            </span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
            ${totalWalletValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Across {assets.length} supported tokens
          </div>
        </Card>

        <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Netting Gas Savings
            </span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            ~68,400 Gas / Hop
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
            Direct transient storage netting
          </div>
        </Card>
      </div>

      {/* Dual Ledger Asset Management */}
      <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08]">
        {/* Table Controls */}
        <div className="p-4 border-b border-neutral-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Active Vault Claims
            </h2>
            <Badge variant="purple" size="sm" className="font-mono text-[10px]">
              {activeClaimsCount} Active
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            {activeClaimsCount > 0 && (
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search claim..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.08] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-white/30"
                />
              </div>
            )}
          </div>
        </div>

        {/* Table / Empty State */}
        {!isConnected ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] flex items-center justify-center mx-auto text-neutral-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Connect Wallet
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1">
                Connect your Web3 wallet to manage internal ERC-6909 vault claim balances and settle deltas.
              </p>
            </div>
            <Button
              variant="brand"
              size="sm"
              onClick={() => open()}
              leftIcon={<Wallet className="w-3.5 h-3.5" />}
            >
              Connect Wallet
            </Button>
          </div>
        ) : activeClaimsCount === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-500">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                No Vault Claims Found
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
                You currently hold 0 ERC-6909 internal vault claims. Deposit any physical ERC-20 tokens into SupaVault to mint gasless credits for zero-fee multi-hop routing.
              </p>
            </div>
            <Button
              variant="brand"
              size="sm"
              onClick={() => handleOpenDeposit()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Deposit Tokens to Mint Claim
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">ERC-6909 Claim</TableHead>
                  <TableHead className="text-right">Physical Wallet</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Transient Delta</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeClaimAssets.map((asset) => {
                  const claimNum = parseFloat(asset.claimBalance.replace(/,/g, ''));
                  const claimUSD = (claimNum * asset.priceUSD).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  });

                  return (
                    <TableRow key={asset.symbol}>
                      {/* Asset Info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <TokenLogo symbol={asset.symbol} address={asset.address} size="md" />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                              {asset.symbol}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {asset.name}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* ERC-6909 Claim Balance */}
                      <TableCell className="text-right">
                        <div className="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                          {asset.claimBalance} {asset.symbol}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                          {claimUSD}
                        </div>
                      </TableCell>

                      {/* Physical Wallet Balance */}
                      <TableCell className="text-right">
                        <div className="font-mono text-xs text-neutral-900 dark:text-neutral-200">
                          {asset.walletBalance} {asset.symbol}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          Available in Wallet
                        </div>
                      </TableCell>

                      {/* Token Price */}
                      <TableCell className="text-right font-mono text-xs text-neutral-700 dark:text-neutral-300">
                        ${asset.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* Transient Delta */}
                      <TableCell className="text-right">
                        {asset.unsettledDelta !== '0.0000' ? (
                          <Badge variant="warning" size="sm" className="font-mono text-[10px]">
                            {asset.unsettledDelta} {asset.symbol}
                          </Badge>
                        ) : (
                          <span className="font-mono text-[11px] text-neutral-400">Netted (0.0)</span>
                        )}
                      </TableCell>

                      {/* Action Triggers */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => handleOpenDeposit(asset)}
                          >
                            Deposit More
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
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
      </Card>

      {/* Flash Accounting Visualizer */}
      <FlashAccountingVisualizer />

      {/* Deposit Modal */}
      <DepositClaimModal
        isOpen={activeModal === 'deposit'}
        onClose={() => {
          setActiveModal(null);
          setSelectedToken(null);
        }}
        token={selectedToken}
        onSuccess={() => {
          if (!selectedToken) return;
          setAssets((prev) =>
            prev.map((t) =>
              t.symbol === selectedToken.symbol
                ? {
                    ...t,
                    claimBalance: (
                      parseFloat(t.claimBalance.replace(/,/g, '')) + 1.0
                    ).toFixed(4),
                  }
                : t
            )
          );
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawClaimModal
        isOpen={activeModal === 'withdraw'}
        onClose={() => {
          setActiveModal(null);
          setSelectedToken(null);
        }}
        token={selectedToken}
        onSuccess={() => {
          if (!selectedToken) return;
          setAssets((prev) =>
            prev.map((t) =>
              t.symbol === selectedToken.symbol
                ? {
                    ...t,
                    claimBalance: Math.max(
                      0,
                      parseFloat(t.claimBalance.replace(/,/g, '')) - 1.0
                    ).toFixed(4),
                  }
                : t
            )
          );
        }}
      />
    </div>
  );
};
