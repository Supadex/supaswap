import React, { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Button } from '../components/ui/Button';
import { TokenAmountInput } from '../components/ui/TokenAmountInput';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { InteractiveLiquidityGraph } from '../components/liquidity/InteractiveLiquidityGraph';
import type { BinShape } from '../components/liquidity/BinDistributionVisualizer';
import { usePositions } from '../hooks/usePositions';
import { DEFAULT_TOKENS } from '../contracts/addresses';
import { CurveType, type TokenMetadata } from '../contracts/types';
import { formatUSD } from '../utils/formatters';
import {
  ArrowLeft,
  ChevronDown,
  Search,
  Check,
  TrendingUp,
  BarChart2,
  Coins,
  ArrowDownUp,
  Info,
} from 'lucide-react';

interface NewPositionPageProps {
  onBack: () => void;
  initialToken0?: TokenMetadata;
  initialToken1?: TokenMetadata;
  initialCurve?: CurveType;
  initialFeeTier?: number;
}

const FEE_TIERS = [
  { fee: 100, label: '0.01%', desc: 'Ultra-stable pairs', tvlPct: '48%' },
  { fee: 500, label: '0.05%', desc: 'Blue-chip pairs', tvlPct: '36%' },
  { fee: 3000, label: '0.30%', desc: 'Standard pairs', tvlPct: '12%' },
  { fee: 10000, label: '1.00%', desc: 'Exotic & volatile', tvlPct: '4%' },
];

export const NewPositionPage: React.FC<NewPositionPageProps> = ({
  onBack,
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

  // Token Selector Modal State
  const [isTokenSelectOpen, setIsTokenSelectOpen] = useState(false);
  const [tokenSelectingTarget, setTokenSelectingTarget] = useState<'token0' | 'token1'>('token0');
  const [tokenSearch, setTokenSearch] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'erc20' | 'erc6909'>('erc20');

  // Execution Flow
  const [step, setStep] = useState<'idle' | 'approving0' | 'approving1' | 'minting' | 'success'>('idle');
  const [mintedTxHash, setMintedTxHash] = useState<string | null>(null);

  // Switch token0 and token1
  const handleSwapTokens = () => {
    const prev0 = token0;
    const prev1 = token1;
    setToken0(prev1);
    setToken1(prev0);
    setAmount0(amount1);
    setAmount1(amount0);
  };

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

  // Total USD calculation
  const totalValueUSD = useMemo(() => {
    const num0 = parseFloat(amount0) || 0;
    const num1 = parseFloat(amount1) || 0;
    return num0 * token0.priceUSD + num1 * token1.priceUSD;
  }, [amount0, amount1, token0, token1]);

  // Execute Deposit / Mint
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
      // 1. Check Allowance for Token0
      if (!token0.isNative) {
        setStep('approving0');
        const allowance0 = await checkAllowance(token0.address, address);
        if (allowance0 === BigInt(0)) {
          await approveToken(token0.address);
        }
      }

      // 2. Check Allowance for Token1
      if (!token1.isNative) {
        setStep('approving1');
        const allowance1 = await checkAllowance(token1.address, address);
        if (allowance1 === BigInt(0)) {
          await approveToken(token1.address);
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
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Decimals: token0.decimals,
        amount1Decimals: token1.decimals,
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
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-xl bg-neutral-100 dark:bg-white/[0.06] flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-white/[0.12] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Pools</span>
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="brand" size="sm" className="font-mono">
            Permit2 Active
          </Badge>
          <Badge variant="purple" size="sm" className="font-mono">
            ERC-6909 Native
          </Badge>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Create Liquidity Position
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Provide capital across Concentrated, Discretized Bins, or StableSwap curve architectures.
        </p>
      </div>

      {/* Two-Column Apple Minimalist Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Multi-Step Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: Select Token Pair */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  1
                </span>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Select Token Pair</h2>
              </div>
              <button
                type="button"
                onClick={handleSwapTokens}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                <span>Switch Pair</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              {/* Token 0 */}
              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token0');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center font-mono">
                    {token0.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token0.symbol}
                      {token0.isClaim && <Badge variant="purple" size="sm">6909</Badge>}
                    </div>
                    <div className="text-xs text-neutral-500">{token0.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Token 1 */}
              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token1');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center font-mono">
                    {token1.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token1.symbol}
                      {token1.isClaim && <Badge variant="purple" size="sm">6909</Badge>}
                    </div>
                    <div className="text-xs text-neutral-500">{token1.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* STEP 2: Curve Architecture & Educational Explanations */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  2
                </span>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Curve Architecture Engine
                </h2>
              </div>
              <span className="text-xs text-neutral-400">Choose AMM Math</span>
            </div>

            {/* Segmented Curve Buttons */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  type: CurveType.CLAMM,
                  label: 'CLAMM',
                  badge: 'Concentrated',
                  icon: TrendingUp,
                  sub: 'Custom price range',
                },
                {
                  type: CurveType.BIN_AMM,
                  label: 'BinAMM',
                  badge: '0-Slippage',
                  icon: BarChart2,
                  sub: 'Discretized bins',
                },
                {
                  type: CurveType.STABLE_AMM,
                  label: 'StableAMM',
                  badge: 'Pegged 1:1',
                  icon: Coins,
                  sub: 'Stableswap invariant',
                },
              ].map((c) => {
                const Icon = c.icon;
                const isSelected = selectedCurve === c.type;
                return (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setSelectedCurve(c.type)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl transition-all cursor-pointer border text-left ${
                      isSelected
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-md'
                        : 'bg-neutral-50 dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className="w-4 h-4" />
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono ${
                          isSelected
                            ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black'
                            : 'bg-neutral-200 dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {c.badge}
                      </span>
                    </div>
                    <div className="text-sm font-bold">{c.label}</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        isSelected
                          ? 'text-neutral-300 dark:text-neutral-600'
                          : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {c.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* SELF-EXPLANATORY EDUCATIONAL CALLOUT BOX */}
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-white">
                <Info className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {selectedCurve === CurveType.CLAMM
                    ? 'Concentrated Liquidity Architecture (CLAMM)'
                    : selectedCurve === CurveType.BIN_AMM
                    ? 'Discretized Bin Architecture (BinAMM)'
                    : 'Stableswap Invariant Architecture (StableAMM)'}
                </span>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {selectedCurve === CurveType.CLAMM && (
                  <>
                    <strong>Concentrated Liquidity</strong> focuses 100% of your deposited assets
                    within a custom price interval between your minimum and maximum target prices. This achieves up to{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      25x higher capital efficiency
                    </span>{' '}
                    and maximizes fee accrual compared to legacy full-range pools. Liquidity
                    automatically rests when the market price moves outside your chosen range.
                  </>
                )}
                {selectedCurve === CurveType.BIN_AMM && (
                  <>
                    <strong>Discretized Bins</strong> allocate your capital into discrete price
                    steps (e.g. 10 bps, 25 bps). Trades executed within a single bin experience{' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      0 internal slippage
                    </span>{' '}
                    with 100% price certainty. Ideal for dynamic market making and orderbook-style
                    liquidity ladders.
                  </>
                )}
                {selectedCurve === CurveType.STABLE_AMM && (
                  <>
                    <strong>StableSwap Invariant (x³y + y³x = k)</strong> is specifically
                    engineered for 1:1 pegged asset pairs (e.g. USDC/USDT, DAI/USDC). It maintains an
                    ultra-deep liquidity density around 1.0000 with{' '}
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      near-zero price divergence
                    </span>{' '}
                    and low flat fees.
                  </>
                )}
              </p>

              <div className="flex items-center gap-4 pt-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 border-t border-neutral-200/60 dark:border-white/[0.04]">
                <span>
                  Best for:{' '}
                  <strong className="text-neutral-700 dark:text-neutral-200">
                    {selectedCurve === CurveType.CLAMM
                      ? 'ETH/USDC, WBTC/ETH'
                      : selectedCurve === CurveType.BIN_AMM
                      ? 'SUPA/ETH, Volatile Pairs'
                      : 'USDC/USDT, Pegged Pairs'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Slippage Model:{' '}
                  <strong className="text-neutral-700 dark:text-neutral-200">
                    {selectedCurve === CurveType.CLAMM
                      ? 'Continuous Tick'
                      : selectedCurve === CurveType.BIN_AMM
                      ? '0-Slippage Step'
                      : 'Invariant Peg'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* STEP 3: Fee Tier */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  3
                </span>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Select Fee Tier</h2>
              </div>
              <span className="text-xs text-neutral-400">Trading fee share</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FEE_TIERS.map((tier) => {
                const isSelected = selectedFee === tier.fee;
                return (
                  <button
                    key={tier.fee}
                    type="button"
                    onClick={() => setSelectedFee(tier.fee)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white shadow-sm'
                        : 'bg-neutral-50 dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="text-sm font-bold font-mono">{tier.label}</div>
                    <div className="text-[11px] opacity-75 mt-0.5 truncate">{tier.desc}</div>
                    <div
                      className={`text-[10px] font-mono mt-1.5 px-1.5 py-0.5 rounded-md inline-block ${
                        isSelected
                          ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black'
                          : 'bg-neutral-200 dark:bg-white/[0.06] text-neutral-500'
                      }`}
                    >
                      {tier.tvlPct} TVL
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 4: Deposit Amounts */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  4
                </span>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Deposit Amounts</h2>
              </div>
              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-white">
                Total: {formatUSD(totalValueUSD)}
              </span>
            </div>

            <div className="space-y-3">
              <TokenAmountInput
                label="Deposit Token 0"
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
                label="Deposit Token 1"
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

            {/* Action Button */}
            <div className="pt-2">
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
                    ? 'Minting Position NFT...'
                    : 'Preview & Mint Position'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Live Graph & Market Telemetry */}
        <div className="lg:col-span-5 sticky top-24">
          <InteractiveLiquidityGraph
            curveType={selectedCurve}
            currentPrice={currentSpotPrice}
            minPrice={minPrice}
            maxPrice={maxPrice}
            isFullRange={isFullRange}
            binStepBps={binStepBps}
            binShape={binShape}
            ampFactor={ampFactor}
            token0Symbol={token0.symbol}
            token1Symbol={token1.symbol}
            token0Amount={amount0}
            token1Amount={amount1}
            onSetMinPrice={setMinPrice}
            onSetMaxPrice={setMaxPrice}
            onToggleFullRange={setIsFullRange}
            onSelectBinShape={setBinShape}
            onSelectBinStep={setBinStepBps}
            onSelectAmp={setAmpFactor}
          />
        </div>
      </div>

      {/* Token Selector Modal */}
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
            onBack();
          }}
          title="Position Created Successfully"
          description="Your multi-curve liquidity position has been minted on-chain."
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
                onBack();
              }}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
