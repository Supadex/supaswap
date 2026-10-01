import React, { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useAppKit } from '@reown/appkit/react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TokenAmountInput } from '../ui/TokenAmountInput';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { PriceRangeVisualizer } from './PriceRangeVisualizer';
import { BinDistributionVisualizer, type BinShape } from './BinDistributionVisualizer';
import { StableCurveVisualizer } from './StableCurveVisualizer';
import { usePositions } from '../../hooks/usePositions';
import { DEFAULT_TOKENS } from '../../contracts/addresses';
import { CurveType, type TokenMetadata } from '../../contracts/types';
import { formatUSD } from '../../utils/formatters';
import {
  Check,
  ChevronDown,
  Search,
  Lock,
} from 'lucide-react';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken0?: TokenMetadata;
  initialToken1?: TokenMetadata;
  initialCurve?: CurveType;
  initialFeeTier?: number;
}

const FEE_TIERS = [
  { fee: 100, label: '0.01%', desc: 'Ultra-stable pairs (USDC/USDT)' },
  { fee: 500, label: '0.05%', desc: 'Blue-chip pairs (ETH/USDC)' },
  { fee: 3000, label: '0.30%', desc: 'Standard pairs (WBTC/ETH)' },
  { fee: 10000, label: '1.00%', desc: 'Exotic & high volatility' },
];

export const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  isOpen,
  onClose,
  initialToken0 = DEFAULT_TOKENS[0],
  initialToken1 = DEFAULT_TOKENS[1],
  initialCurve = CurveType.CLAMM,
  initialFeeTier = 500,
}) => {
  const { isConnected, address } = useAccount();
  const { open: openAppKit } = useAppKit();
  const { success, error: toastError } = useToast();
  const { mintPosition, checkAllowance, approveToken, isMinting } = usePositions();

  // Selected Tokens & Curve
  const [token0, setToken0] = useState<TokenMetadata>(initialToken0);
  const [token1, setToken1] = useState<TokenMetadata>(initialToken1);
  const [selectedCurve, setSelectedCurve] = useState<CurveType>(initialCurve);
  const [selectedFee, setSelectedFee] = useState<number>(initialFeeTier);

  // Amounts
  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');

  // CLAMM State
  const currentSpotPrice = useMemo(() => {
    if (token0.priceUSD && token1.priceUSD && token1.priceUSD > 0) {
      return token0.priceUSD / token1.priceUSD;
    }
    return 2650;
  }, [token0, token1]);

  const [minPrice, setMinPrice] = useState<number>(currentSpotPrice * 0.85);
  const [maxPrice, setMaxPrice] = useState<number>(currentSpotPrice * 1.15);
  const [isFullRange, setIsFullRange] = useState<boolean>(false);

  // BinAMM State
  const [binShape, setBinShape] = useState<BinShape>('curve');
  const [binStepBps, setBinStepBps] = useState<number>(25);

  // StableAMM State
  const [ampFactor, setAmpFactor] = useState<number>(100);

  // Execution Flow Modal State
  const [step, setStep] = useState<'idle' | 'approving0' | 'approving1' | 'minting' | 'success'>('idle');
  const [mintedTxHash, setMintedTxHash] = useState<string | null>(null);

  // Token Selector Modal inside Liquidity
  const [isTokenSelectOpen, setIsTokenSelectOpen] = useState(false);
  const [tokenSelectingTarget, setTokenSelectingTarget] = useState<'token0' | 'token1'>('token0');
  const [tokenSearch, setTokenSearch] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'erc20' | 'erc6909'>('erc20');

  // Handle Token 0 input change and auto-calculate Token 1
  const handleAmount0Change = (val: string) => {
    setAmount0(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedCurve === CurveType.STABLE_AMM) {
        setAmount1(val);
      } else {
        setAmount1((num * currentSpotPrice).toFixed(token1.decimals > 6 ? 4 : 2));
      }
    } else {
      setAmount1('');
    }
  };

  // Handle Token 1 input change and auto-calculate Token 0
  const handleAmount1Change = (val: string) => {
    setAmount1(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedCurve === CurveType.STABLE_AMM) {
        setAmount0(val);
      } else {
        setAmount0((num / currentSpotPrice).toFixed(token0.decimals > 6 ? 4 : 4));
      }
    } else {
      setAmount0('');
    }
  };

  // Tick calculation helper
  const tickLower = useMemo(() => {
    if (isFullRange) return -887200;
    return Math.floor(Math.log(minPrice / currentSpotPrice) * 100);
  }, [isFullRange, minPrice, currentSpotPrice]);

  const tickUpper = useMemo(() => {
    if (isFullRange) return 887200;
    return Math.floor(Math.log(maxPrice / currentSpotPrice) * 100);
  }, [isFullRange, maxPrice, currentSpotPrice]);

  // Execute Deposit / Mint Position
  const handleDeposit = async () => {
    if (!isConnected || !address) {
      openAppKit();
      return;
    }

    if (!amount0 || parseFloat(amount0) <= 0 || !amount1 || parseFloat(amount1) <= 0) {
      toastError('Invalid Amounts', 'Please enter valid liquidity amounts for both tokens');
      return;
    }

    try {
      const payWithClaims =
        activeLedgerTab === 'erc6909' ||
        Boolean(token0.isClaim) ||
        Boolean(token1.isClaim);

      if (!payWithClaims) {
        if (!token0.isNative) {
          setStep('approving0');
          const allowance0 = await checkAllowance(token0.address, address);
          if (allowance0 === BigInt(0)) {
            await approveToken(token0.address);
          }
        }

        if (!token1.isNative) {
          setStep('approving1');
          const allowance1 = await checkAllowance(token1.address, address);
          if (allowance1 === BigInt(0)) {
            await approveToken(token1.address);
          }
        }
      }

      // 3. Mint Position
      setStep('minting');
      const hash = await mintPosition({
        token0: token0.address,
        token1: token1.address,
        fee: selectedFee,
        tickSpacing: selectedFee === 100 ? 1 : selectedFee === 500 ? 10 : 60,
        curveType: selectedCurve,
        hooks: '0x0000000000000000000000000000000000000000',
        tickLower,
        tickUpper,
        liquidity: (() => {
          const liq = parseUnits(amount0 || '0', token0.decimals);
          return liq > 0n ? liq : 1n;
        })(),
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Decimals: token0.decimals,
        amount1Decimals: token1.decimals,
        payWithClaims,
      });

      setMintedTxHash(hash);
      setStep('success');
      success('Liquidity Minted', 'Your multi-curve liquidity position is now active on-chain.');
    } catch (err: any) {
      setStep('idle');
      toastError('Deposit Failed', err?.shortMessage || err?.message || 'Transaction rejected');
    }
  };

  // Filter available tokens
  const filteredTokens = useMemo(() => {
    return DEFAULT_TOKENS.filter((t) => {
      const matchSearch =
        t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
        t.name.toLowerCase().includes(tokenSearch.toLowerCase());
      const matchLedger = activeLedgerTab === 'erc6909' ? t.isClaim : !t.isClaim;
      return matchSearch && matchLedger;
    });
  }, [tokenSearch, activeLedgerTab]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Liquidity"
        description="Provide liquidity across Concentrated, Discretized Bins, or StableSwap curves."
        maxWidth="xl"
      >
        <div className="space-y-6 pt-2">
          {/* Curve Engine Segmented Pill */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Curve Engine Architecture
            </label>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] rounded-2xl">
              {[
                { type: CurveType.CLAMM, label: 'CLAMM', badge: 'Concentrated', desc: 'Custom price ranges' },
                { type: CurveType.BIN_AMM, label: 'BinAMM', badge: '0-Slippage', desc: 'Discretized orderbook' },
                { type: CurveType.STABLE_AMM, label: 'StableAMM', badge: 'Pegged', desc: 'High invariant depth' },
              ].map((c) => (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => setSelectedCurve(c.type)}
                  className={`flex flex-col items-start p-3 rounded-xl transition-all cursor-pointer border ${
                    selectedCurve === c.type
                      ? 'bg-white dark:bg-white/[0.12] border-neutral-300 dark:border-white/[0.2] shadow-sm text-neutral-900 dark:text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm font-semibold">{c.label}</span>
                    <Badge
                      variant={
                        c.type === CurveType.CLAMM
                          ? 'brand'
                          : c.type === CurveType.BIN_AMM
                          ? 'purple'
                          : 'info'
                      }
                      size="sm"
                    >
                      {c.badge}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-neutral-400 text-left">{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Token Pair Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Select Token Pair
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Token 0 Button */}
              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token0');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center font-mono">
                    {token0.symbol.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token0.symbol}
                      {token0.isClaim && <Badge variant="purple" size="sm">6909 Claim</Badge>}
                    </div>
                    <div className="text-[11px] text-neutral-500">{token0.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Token 1 Button */}
              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token1');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center font-mono">
                    {token1.symbol.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token1.symbol}
                      {token1.isClaim && <Badge variant="purple" size="sm">6909 Claim</Badge>}
                    </div>
                    <div className="text-[11px] text-neutral-500">{token1.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* Fee Tier Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Fee Tier
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FEE_TIERS.map((tier) => (
                <button
                  key={tier.fee}
                  type="button"
                  onClick={() => setSelectedFee(tier.fee)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedFee === tier.fee
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                      : 'bg-white dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{tier.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5 truncate">{tier.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Curve-Specific Interactive Visualizer */}
          {selectedCurve === CurveType.CLAMM && (
            <PriceRangeVisualizer
              currentPrice={currentSpotPrice}
              minPrice={minPrice}
              maxPrice={maxPrice}
              isFullRange={isFullRange}
              token0Symbol={token0.symbol}
              token1Symbol={token1.symbol}
              onSetMinPrice={setMinPrice}
              onSetMaxPrice={setMaxPrice}
              onToggleFullRange={setIsFullRange}
            />
          )}

          {selectedCurve === CurveType.BIN_AMM && (
            <BinDistributionVisualizer
              currentPrice={currentSpotPrice}
              binStepBps={binStepBps}
              shape={binShape}
              binCount={14}
              onSelectShape={setBinShape}
              onSelectBinStep={setBinStepBps}
            />
          )}

          {selectedCurve === CurveType.STABLE_AMM && (
            <StableCurveVisualizer
              ampFactor={ampFactor}
              token0Symbol={token0.symbol}
              token1Symbol={token1.symbol}
              token0Amount={amount0}
              token1Amount={amount1}
              onSelectAmp={setAmpFactor}
            />
          )}

          {/* Deposit Amounts Inputs */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Deposit Amounts
            </label>

            <TokenAmountInput
              label="Deposit"
              value={amount0}
              onChange={handleAmount0Change}
              tokenSymbol={token0.symbol}
              onSelectToken={() => {
                setTokenSelectingTarget('token0');
                setIsTokenSelectOpen(true);
              }}
              balance="12.4500"
              usdValue={amount0 ? `$${(parseFloat(amount0) * token0.priceUSD).toFixed(2)}` : undefined}
              isVaultClaim={token0.isClaim}
            />

            <TokenAmountInput
              label="Deposit"
              value={amount1}
              onChange={handleAmount1Change}
              tokenSymbol={token1.symbol}
              onSelectToken={() => {
                setTokenSelectingTarget('token1');
                setIsTokenSelectOpen(true);
              }}
              balance="24,500.00"
              usdValue={amount1 ? `$${(parseFloat(amount1) * token1.priceUSD).toFixed(2)}` : undefined}
              isVaultClaim={token1.isClaim}
            />
          </div>

          {/* Dynamic LVR MEV Protection Notice */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/60 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/[0.05] text-xs">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dynamic LVR Spread & Anti-JIT Fee Protection Active</span>
            </div>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              +4.8% LP Yield Retained
            </span>
          </div>

          {/* Primary Action Button */}
          <div>
            {!isConnected ? (
              <Button variant="brand" size="lg" className="w-full" onClick={() => openAppKit()}>
                Connect Wallet
              </Button>
            ) : (
              <Button
                variant="brand"
                size="lg"
                className="w-full"
                onClick={handleDeposit}
                isLoading={isMinting || step !== 'idle'}
              >
                {step === 'approving0'
                  ? `Approving ${token0.symbol}...`
                  : step === 'approving1'
                  ? `Approving ${token1.symbol}...`
                  : step === 'minting'
                  ? 'Minting Position...'
                  : 'Deposit & Mint Position'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Asset Selector Modal */}
      <Modal
        isOpen={isTokenSelectOpen}
        onClose={() => setIsTokenSelectOpen(false)}
        title="Select Asset"
        description="Choose physical ERC-20 token or internal ERC-6909 Vault claim."
      >
        <div className="space-y-4 pt-1">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search token name or address..."
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.07] text-sm text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-white/[0.2]"
            />
          </div>

          {/* Dual-Ledger Tabs */}
          <div className="flex rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-1 border border-neutral-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveLedgerTab('erc20')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeLedgerTab === 'erc20'
                  ? 'bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-xs font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Physical ERC-20
            </button>
            <button
              type="button"
              onClick={() => setActiveLedgerTab('erc6909')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeLedgerTab === 'erc6909'
                  ? 'bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-xs font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              ERC-6909 Vault Claims
            </button>
          </div>

          {/* Token List */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {filteredTokens.map((t) => (
              <button
                key={`${t.address}-${t.isClaim ? 'claim' : 'erc20'}`}
                type="button"
                onClick={() => {
                  if (tokenSelectingTarget === 'token0') {
                    setToken0(t);
                  } else {
                    setToken1(t);
                  }
                  setIsTokenSelectOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center font-mono">
                    {t.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {t.symbol}
                      {t.isClaim && <Badge variant="purple" size="sm">6909</Badge>}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-medium text-neutral-900 dark:text-white">
                    {formatUSD(t.priceUSD)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      {step === 'success' && (
        <Modal
          isOpen={true}
          onClose={() => {
            setStep('idle');
            onClose();
          }}
          title="Position Created Successfully"
          description="Your liquidity position has been minted on-chain and is now earning fees."
        >
          <div className="space-y-5 pt-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="text-base font-bold text-neutral-900 dark:text-white">
                {token0.symbol} / {token1.symbol} Position
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                Deposited {amount0} {token0.symbol} and {amount1} {token1.symbol}
              </div>
            </div>

            {mintedTxHash && (
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] text-xs font-mono flex items-center justify-between">
                <span className="text-neutral-500">Tx Hash:</span>
                <span className="text-neutral-900 dark:text-white font-semibold">
                  {mintedTxHash.slice(0, 10)}...{mintedTxHash.slice(-8)}
                </span>
              </div>
            )}

            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={() => {
                setStep('idle');
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};
