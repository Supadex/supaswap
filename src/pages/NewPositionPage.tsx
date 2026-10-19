import React, { useState, useMemo, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { zeroAddress, type Address } from 'viem';
import { Button } from '../components/ui/Button';
import { TokenAmountInput } from '../components/ui/TokenAmountInput';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { TokenLogo } from '../components/ui/TokenLogo';
import { useToast } from '../components/ui/Toast';
import { InteractiveLiquidityGraph } from '../components/liquidity/InteractiveLiquidityGraph';
import type { BinShape } from '../components/liquidity/BinDistributionVisualizer';
import { usePositions } from '../hooks/usePositions';
import { usePoolManager } from '../hooks/usePoolManager';
import { usePools } from '../hooks/usePools';
import { useTokenList } from '../hooks/useTokenList';
import { useTokenWalletBalance } from '../hooks/useTokenWalletBalance';
import { formatSwapError } from '../hooks/useSupaRouter';
import { CurveType, type PoolKey, type TokenMetadata } from '../contracts/types';
import { sortTokens } from '../contracts/utils';
import { getAddressesForChain } from '../contracts/addresses';
import { PluginWhitelistABI } from '../contracts/abis';
import {
  buildMintLiquidityParams,
  CENTER_BIN_ID,
  humanPriceToTick,
  tickToHumanPrice,
  snapTickToSpacing,
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  resolvePoolOrderedPrice,
  getBinIdFromHumanPrice,
  getTickSpacingForFee,
  formatCompactPrice,
} from '../utils/poolMath';
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
  initialPlugin?: Address;
  initialTickSpacing?: number;
}

const FEE_TIERS = [
  { fee: 100, label: '0.01%', desc: 'Ultra-stable pairs', tvlPct: '48%' },
  { fee: 500, label: '0.05%', desc: 'Blue-chip pairs', tvlPct: '36%' },
  { fee: 3000, label: '0.30%', desc: 'Standard pairs', tvlPct: '12%' },
  { fee: 10000, label: '1.00%', desc: 'Exotic & volatile', tvlPct: '4%' },
];

const FALLBACK_TOKEN: TokenMetadata = {
  address: zeroAddress,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  priceUSD: 0,
  isNative: true,
};

function pickDefaultPair(tokens: TokenMetadata[]): [TokenMetadata, TokenMetadata] {
  const physical = tokens.filter((t) => !t.isClaim);
  return [physical[0] ?? FALLBACK_TOKEN, physical[1] ?? physical[0] ?? FALLBACK_TOKEN];
}

function tokenInList(tokens: TokenMetadata[], token: TokenMetadata): boolean {
  return tokens.some(
    (t) =>
      t.address.toLowerCase() === token.address.toLowerCase() &&
      Boolean(t.isClaim) === Boolean(token.isClaim)
  );
}

export const NewPositionPage: React.FC<NewPositionPageProps> = ({
  onBack,
  initialToken0,
  initialToken1,
  initialCurve = CurveType.CLAMM,
  initialFeeTier = 500,
  initialPlugin,
  initialTickSpacing,
}) => {
  const { isConnected, address, chainId } = useAccount();
  const { open: openAppKit } = useAppKit();
  const { success, error: toastError } = useToast();
  const { mintPosition, checkAllowance, approveToken, isMinting } = usePositions();
  const { isPoolInitialized, getPoolSqrtPrice, initializePool, isInitializing } = usePoolManager();
  const { pools, refreshPools } = usePools();
  const { tokens } = useTokenList();
  const publicClient = usePublicClient();
  const protocolAddrs = getAddressesForChain(chainId);

  const [defaults] = useState(() => pickDefaultPair(tokens));
  const [token0, setToken0] = useState<TokenMetadata>(initialToken0 ?? defaults[0]);
  const [token1, setToken1] = useState<TokenMetadata>(initialToken1 ?? defaults[1]);
  const [selectedCurve, setSelectedCurve] = useState<CurveType>(initialCurve);
  const [selectedFee, setSelectedFee] = useState<number>(initialFeeTier);

  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');

  const [onChainSqrtPrice, setOnChainSqrtPrice] = useState<bigint>(0n);
  const [poolExists, setPoolExists] = useState<boolean | null>(null);

  /**
   * Uniswap-style starting price in UI order: how many token1 per 1 token0.
   * Used when the pool does not exist yet (initialize sqrtPriceX96).
   */
  const [startingPriceUi, setStartingPriceUi] = useState<number>(1);
  const [startPriceDraft, setStartPriceDraft] = useState<string>('1');
  /** When true, the input shows 1 token1 = X token0 (inverted quote). */
  const [priceInverted, setPriceInverted] = useState(false);

  const poolOrdered = useMemo(
    () =>
      resolvePoolOrderedPrice({
        tokenA: token0,
        tokenB: token1,
        amountA: amount0,
        amountB: amount1,
        // Prefer explicit starting price whenever we're creating (no on-chain spot yet)
        uiPriceTokenBPerTokenA:
          onChainSqrtPrice > 0n ? undefined : startingPriceUi > 0 ? startingPriceUi : undefined,
      }),
    [token0, token1, amount0, amount1, onChainSqrtPrice, startingPriceUi]
  );

  const tokenPriceSpot = useMemo(() => {
    if (poolOrdered.uiMatchesPoolOrder) return poolOrdered.priceToken1PerToken0;
    return poolOrdered.priceToken1PerToken0 > 0 ? 1 / poolOrdered.priceToken1PerToken0 : 1;
  }, [poolOrdered]);

  const currentSpotPrice = useMemo(() => {
    if (onChainSqrtPrice > 0n) {
      const fromChain = sqrtPriceX96ToPrice(
        onChainSqrtPrice,
        poolOrdered.decimals0,
        poolOrdered.decimals1
      );
      if (fromChain > 0) {
        return poolOrdered.uiMatchesPoolOrder ? fromChain : 1 / fromChain;
      }
    }
    // New pool: use user-set starting price (UI order)
    if (startingPriceUi > 0) return startingPriceUi;
    return tokenPriceSpot > 0 ? tokenPriceSpot : 1;
  }, [onChainSqrtPrice, poolOrdered, tokenPriceSpot, startingPriceUi]);

  const priceFromChain = onChainSqrtPrice > 0n;

  const [minPrice, setMinPrice] = useState<number>(currentSpotPrice * 0.85);
  const [maxPrice, setMaxPrice] = useState<number>(currentSpotPrice * 1.15);
  const [isFullRange, setIsFullRange] = useState<boolean>(false);

  const [binShape, setBinShape] = useState<BinShape>('curve');
  const [binStepBps, setBinStepBps] = useState<number>(25);
  const [ampFactor, setAmpFactor] = useState<number>(100);

  const [isTokenSelectOpen, setIsTokenSelectOpen] = useState(false);
  const [tokenSelectingTarget, setTokenSelectingTarget] = useState<'token0' | 'token1'>('token0');
  const [tokenSearch, setTokenSearch] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'erc20' | 'erc6909'>('erc20');

  const [step, setStep] = useState<
    'idle' | 'initializing' | 'approving0' | 'approving1' | 'minting' | 'success'
  >('idle');
  const [mintedTxHash, setMintedTxHash] = useState<string | null>(null);

  const { formatted: balance0 } = useTokenWalletBalance(token0);
  const { formatted: balance1 } = useTokenWalletBalance(token1);

  const tickSpacing = useMemo(() => {
    if (
      initialTickSpacing &&
      initialTickSpacing > 0 &&
      selectedFee === initialFeeTier &&
      selectedCurve === initialCurve
    ) {
      return initialTickSpacing;
    }
    return getTickSpacingForFee(selectedFee, selectedCurve);
  }, [selectedFee, selectedCurve, initialTickSpacing, initialFeeTier, initialCurve]);

  /**
   * PoolKey.plugin is part of the pool id.
   * Prefer an explicit initialPlugin (e.g. pool-detail "Add"), else an indexed match
   * (including zeroAddress vanilla), else vanilla — never silently force LVR.
   */
  const [pluginChoice, setPluginChoice] = useState<'vanilla' | 'lvr' | 'antijit' | 'custom'>(
    () => {
      if (initialPlugin && initialPlugin !== zeroAddress) {
        if (
          protocolAddrs.lvrShieldPlugin &&
          initialPlugin.toLowerCase() === protocolAddrs.lvrShieldPlugin.toLowerCase()
        ) {
          return 'lvr';
        }
        if (
          protocolAddrs.antiJITPlugin &&
          initialPlugin.toLowerCase() === protocolAddrs.antiJITPlugin.toLowerCase()
        ) {
          return 'antijit';
        }
        return 'custom';
      }
      return 'vanilla';
    }
  );

  const resolvedPlugin = useMemo((): Address => {
    const a0 = token0.address.toLowerCase();
    const a1 = token1.address.toLowerCase();

    // Explicit navigation from an existing pool row always wins.
    if (initialPlugin !== undefined && initialPlugin !== null) {
      return (initialPlugin || zeroAddress) as Address;
    }

    const matches = pools.filter((p) => {
      if (p.curveType !== selectedCurve || p.feeNumber !== selectedFee) return false;
      const p0 = p.token0.address.toLowerCase();
      const p1 = p.token1.address.toLowerCase();
      return (p0 === a0 && p1 === a1) || (p0 === a1 && p1 === a0);
    });

    if (matches.length === 1) {
      return ((matches[0].plugin as Address) || zeroAddress) as Address;
    }
    if (matches.length > 1) {
      // Prefer the user's picker selection among duplicates.
      const want =
        pluginChoice === 'lvr'
          ? protocolAddrs.lvrShieldPlugin
          : pluginChoice === 'antijit'
            ? protocolAddrs.antiJITPlugin
            : zeroAddress;
      const hit = matches.find(
        (p) => (p.plugin || zeroAddress).toLowerCase() === (want || zeroAddress).toLowerCase()
      );
      if (hit) return ((hit.plugin as Address) || zeroAddress) as Address;
      return ((matches[0].plugin as Address) || zeroAddress) as Address;
    }

    // New pool: honor explicit plugin picker (default vanilla).
    if (pluginChoice === 'lvr' && protocolAddrs.lvrShieldPlugin) {
      return protocolAddrs.lvrShieldPlugin;
    }
    if (pluginChoice === 'antijit' && protocolAddrs.antiJITPlugin) {
      return protocolAddrs.antiJITPlugin;
    }
    return zeroAddress;
  }, [
    pools,
    token0.address,
    token1.address,
    selectedCurve,
    selectedFee,
    initialPlugin,
    pluginChoice,
    protocolAddrs.lvrShieldPlugin,
    protocolAddrs.antiJITPlugin,
  ]);

  const mintPreview = useMemo(
    () => {
      const binId =
        selectedCurve === CurveType.BIN_AMM
          ? getBinIdFromHumanPrice(
              poolOrdered.priceToken1PerToken0,
              poolOrdered.decimals0,
              poolOrdered.decimals1,
              tickSpacing
            )
          : CENTER_BIN_ID;
      const initSqrt = priceToSqrtPriceX96(
        poolOrdered.priceToken1PerToken0,
        poolOrdered.decimals0,
        poolOrdered.decimals1
      );
      return buildMintLiquidityParams({
        curveType: selectedCurve,
        fee: selectedFee,
        spotPrice: poolOrdered.priceToken1PerToken0,
        minPrice: poolOrdered.uiMatchesPoolOrder ? minPrice : 1 / maxPrice,
        maxPrice: poolOrdered.uiMatchesPoolOrder ? maxPrice : 1 / minPrice,
        isFullRange,
        // Pass amounts already in PoolKey order for Bin/Stable liquidity = currency0
        amount0: poolOrdered.uiMatchesPoolOrder ? amount0 || '0' : amount1 || '0',
        amount1: poolOrdered.uiMatchesPoolOrder ? amount1 || '0' : amount0 || '0',
        decimals0: poolOrdered.decimals0,
        decimals1: poolOrdered.decimals1,
        sqrtPriceX96: onChainSqrtPrice > 0n ? onChainSqrtPrice : initSqrt,
        binId,
      });
    },
    [
      selectedCurve,
      selectedFee,
      poolOrdered,
      minPrice,
      maxPrice,
      isFullRange,
      amount0,
      amount1,
      onChainSqrtPrice,
      tickSpacing,
    ]
  );

  // Sync tokens when chain / token list changes
  useEffect(() => {
    const [d0, d1] = pickDefaultPair(tokens);

    setToken0((prev) => {
      if (initialToken0 && tokenInList(tokens, initialToken0)) return initialToken0;
      if (tokens.length > 0 && tokenInList(tokens, prev)) return prev;
      return d0;
    });
    setToken1((prev) => {
      if (initialToken1 && tokenInList(tokens, initialToken1)) return initialToken1;
      if (tokens.length > 0 && tokenInList(tokens, prev)) return prev;
      return d1;
    });
  }, [chainId, tokens, initialToken0, initialToken1]);

  // Re-center range when the target pool identity changes or on-chain spot first loads.
  // Seeding only on token/curve used to leave min/max at ~0.85–1.15 (spot still 1) while
  // live slot0 is ~3120 → ticks ~80k away from spot → Out of Range mint reverts.
  const rangeSyncKey = `${token0.address}:${token1.address}:${selectedCurve}:${selectedFee}:${priceFromChain ? onChainSqrtPrice.toString() : 'seed'}`;
  const [lastRangeSyncKey, setLastRangeSyncKey] = useState('');
  useEffect(() => {
    if (rangeSyncKey === lastRangeSyncKey) return;
    if (!(currentSpotPrice > 0) || !Number.isFinite(currentSpotPrice)) return;
    setMinPrice(currentSpotPrice * 0.85);
    setMaxPrice(currentSpotPrice * 1.15);
    setLastRangeSyncKey(rangeSyncKey);
  }, [rangeSyncKey, lastRangeSyncKey, currentSpotPrice]);

  // Seed Uniswap-style starting price from USD mid when the pair changes (new pools only)
  useEffect(() => {
    if (priceFromChain) return;
    const usd0 = token0.priceUSD || 0;
    const usd1 = token1.priceUSD || 0;
    let seed = 1;
    if (selectedCurve === CurveType.STABLE_AMM) {
      seed = 1;
    } else if (usd0 > 0 && usd1 > 0) {
      seed = usd0 / usd1;
    }
    if (!(seed > 0) || !Number.isFinite(seed)) seed = 1;
    setStartingPriceUi(seed);
    setPriceInverted(false);
    setStartPriceDraft(formatCompactPrice(seed, 8));
    setAmount0('');
    setAmount1('');
    // Only reseed when the pair/curve identity changes — not when USD quotes refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token0.address, token1.address, selectedCurve, priceFromChain]);

  // When on-chain price appears, sync draft for display
  useEffect(() => {
    if (!priceFromChain) return;
    setStartingPriceUi(currentSpotPrice);
    setPriceInverted(false);
    setStartPriceDraft(formatCompactPrice(currentSpotPrice, 8));
  }, [priceFromChain, currentSpotPrice]);

  const applyStartingPriceDraft = (raw: string) => {
    const cleaned = raw.replace(/,/g, '').trim();
    setStartPriceDraft(cleaned);
    const n = Number.parseFloat(cleaned);
    if (!(n > 0) || !Number.isFinite(n)) return;
    // Draft is always "quote per 1 base" for the currently displayed orientation
    const uiPrice = priceInverted ? 1 / n : n;
    if (!(uiPrice > 0) || !Number.isFinite(uiPrice)) return;
    setStartingPriceUi(uiPrice);
    // Re-proportion amounts if amount0 already entered
    const a0 = Number.parseFloat(amount0);
    if (a0 > 0 && selectedCurve !== CurveType.STABLE_AMM) {
      setAmount1((a0 * uiPrice).toFixed(token1.decimals > 6 ? 6 : 2));
    }
  };

  const handleInvertStartingPrice = () => {
    const nextInverted = !priceInverted;
    setPriceInverted(nextInverted);
    const display = nextInverted
      ? startingPriceUi > 0
        ? 1 / startingPriceUi
        : 1
      : startingPriceUi;
    setStartPriceDraft(formatCompactPrice(display, 8));
  };

  // Probe whether pool already exists on-chain
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      if (!token0?.address || !token1?.address) return;
      if (token0.address.toLowerCase() === token1.address.toLowerCase()) {
        setPoolExists(null);
        setOnChainSqrtPrice(0n);
        return;
      }
      const { currency0, currency1 } = sortTokens(token0.address, token1.address);
      const key: PoolKey = {
        currency0,
        currency1,
        fee: selectedFee,
        tickSpacing,
        curveType: selectedCurve,
        hooks: resolvedPlugin,
      };
      try {
        const exists = await isPoolInitialized(key);
        if (cancelled) return;
        setPoolExists(exists);
        if (exists) {
          const sqrt = await getPoolSqrtPrice(key);
          if (!cancelled) setOnChainSqrtPrice(sqrt);
        } else {
          setOnChainSqrtPrice(0n);
        }
      } catch {
        if (!cancelled) {
          setPoolExists(false);
          setOnChainSqrtPrice(0n);
        }
      }
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [
    token0.address,
    token1.address,
    selectedFee,
    tickSpacing,
    selectedCurve,
    resolvedPlugin,
    isPoolInitialized,
    getPoolSqrtPrice,
  ]);

  const handleSwapTokens = () => {
    setToken0(token1);
    setToken1(token0);
    setAmount0(amount1);
    setAmount1(amount0);
  };

  const handleAmount0Change = (val: string) => {
    setAmount0(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedCurve === CurveType.STABLE_AMM) {
        setAmount1(val);
      } else if (currentSpotPrice > 0) {
        let paired = num * currentSpotPrice;
        const bal1 = Number(balance1);
        if (Number.isFinite(bal1) && bal1 > 0 && paired > bal1) {
          paired = bal1;
          setAmount0((paired / currentSpotPrice).toFixed(token0.decimals > 6 ? 6 : 4));
        }
        setAmount1(paired.toFixed(token1.decimals > 6 ? 6 : 2));
      }
    } else {
      setAmount1('');
    }
  };

  const handleAmount1Change = (val: string) => {
    setAmount1(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedCurve === CurveType.STABLE_AMM) {
        setAmount0(val);
      } else if (currentSpotPrice > 0) {
        let paired = num / currentSpotPrice;
        const bal0 = Number(balance0);
        if (Number.isFinite(bal0) && bal0 > 0 && paired > bal0) {
          paired = bal0;
          setAmount1((paired * currentSpotPrice).toFixed(token1.decimals > 6 ? 6 : 2));
        }
        setAmount0(paired.toFixed(token0.decimals > 6 ? 6 : 4));
      }
    } else {
      setAmount0('');
    }
  };

  const totalValueUSD = useMemo(() => {
    const num0 = parseFloat(amount0) || 0;
    const num1 = parseFloat(amount1) || 0;
    return num0 * (token0.priceUSD || 0) + num1 * (token1.priceUSD || 0);
  }, [amount0, amount1, token0, token1]);

  const handleDeposit = async () => {
    if (!isConnected || !address) {
      openAppKit();
      return;
    }

    if (!amount0 || parseFloat(amount0) <= 0 || !amount1 || parseFloat(amount1) <= 0) {
      toastError('Invalid Amounts', 'Please enter valid liquidity amounts for both tokens');
      return;
    }

    const bal0 = Number(balance0);
    const bal1 = Number(balance1);
    const need0 = parseFloat(amount0);
    const need1 = parseFloat(amount1);
    if (Number.isFinite(bal0) && need0 > bal0 + 1e-9) {
      toastError(
        'Insufficient Balance',
        `Need ${need0.toLocaleString()} ${token0.symbol} but wallet has ${bal0.toLocaleString()}.`
      );
      return;
    }
    if (Number.isFinite(bal1) && need1 > bal1 + 1e-9) {
      toastError(
        'Insufficient Balance',
        `Need ${need1.toLocaleString()} ${token1.symbol} but wallet has ${bal1.toLocaleString()}.`
      );
      return;
    }

    if (token0.address.toLowerCase() === token1.address.toLowerCase()) {
      toastError('Invalid Pair', 'Select two different tokens');
      return;
    }

    try {
      const { currency0, currency1 } = sortTokens(token0.address, token1.address);
      const poolKey: PoolKey = {
        currency0,
        currency1,
        fee: selectedFee,
        tickSpacing: mintPreview.tickSpacing,
        curveType: selectedCurve,
        hooks: resolvedPlugin,
      };

      const exists = await isPoolInitialized(poolKey);
      let sqrtPrice = exists ? await getPoolSqrtPrice(poolKey) : 0n;

      if (!exists) {
        // Whitelist preflight before initialize — avoids PluginNotWhitelisted mid-flow.
        const plugin = resolvedPlugin;
        if (
          plugin &&
          plugin !== zeroAddress &&
          protocolAddrs.pluginWhitelist &&
          publicClient
        ) {
          const listed = (await publicClient.readContract({
            address: protocolAddrs.pluginWhitelist,
            abi: PluginWhitelistABI,
            functionName: 'isPluginWhitelisted',
            args: [plugin],
          })) as boolean;
          if (!listed) {
            throw new Error(
              'This plugin is not whitelisted. Ask governance to approve it before creating the pool.'
            );
          }
          if (
            protocolAddrs.antiJITPlugin &&
            plugin.toLowerCase() === protocolAddrs.antiJITPlugin.toLowerCase()
          ) {
            const canDelta = (await publicClient.readContract({
              address: protocolAddrs.pluginWhitelist,
              abi: PluginWhitelistABI,
              functionName: 'canPluginReturnDelta',
              args: [plugin],
            })) as boolean;
            if (!canDelta) {
              throw new Error(
                'AntiJIT requires canReturnDelta on the whitelist. Ask governance to grant the delta flag.'
              );
            }
          }
        }

        setStep('initializing');
        // Always initialize with PoolKey-ordered price (currency0/currency1), never UI order
        const initSqrt =
          mintPreview.sqrtPriceX96 > 0n
            ? mintPreview.sqrtPriceX96
            : priceToSqrtPriceX96(
                poolOrdered.priceToken1PerToken0,
                poolOrdered.decimals0,
                poolOrdered.decimals1
              );
        await initializePool(poolKey, initSqrt);
        sqrtPrice = initSqrt;
        setOnChainSqrtPrice(initSqrt);
        setPoolExists(true);
      }

      const binId =
        selectedCurve === CurveType.BIN_AMM
          ? getBinIdFromHumanPrice(
              poolOrdered.priceToken1PerToken0,
              poolOrdered.decimals0,
              poolOrdered.decimals1,
              mintPreview.tickSpacing
            )
          : CENTER_BIN_ID;

      const finalParams = buildMintLiquidityParams({
        curveType: selectedCurve,
        fee: selectedFee,
        spotPrice: poolOrdered.priceToken1PerToken0,
        minPrice: poolOrdered.uiMatchesPoolOrder ? minPrice : 1 / maxPrice,
        maxPrice: poolOrdered.uiMatchesPoolOrder ? maxPrice : 1 / minPrice,
        isFullRange,
        amount0: poolOrdered.uiMatchesPoolOrder ? amount0 : amount1,
        amount1: poolOrdered.uiMatchesPoolOrder ? amount1 : amount0,
        decimals0: poolOrdered.decimals0,
        decimals1: poolOrdered.decimals1,
        sqrtPriceX96: sqrtPrice > 0n ? sqrtPrice : undefined,
        binId,
      });

      const payWithClaims =
        activeLedgerTab === 'erc6909' ||
        Boolean(token0.isClaim) ||
        Boolean(token1.isClaim);

      if (!payWithClaims) {
        if (!token0.isNative) {
          setStep('approving0');
          const allowance0 = await checkAllowance(token0.address, address);
          const need0 = finalParams.amount0Wei;
          if (allowance0 < need0) {
            await approveToken(token0.address);
          }
        }

        if (!token1.isNative) {
          setStep('approving1');
          const allowance1 = await checkAllowance(token1.address, address);
          const need1 = finalParams.amount1Wei;
          if (allowance1 < need1) {
            await approveToken(token1.address);
          }
        }
      }

      setStep('minting');
      const hash = await mintPosition({
        token0: token0.address,
        token1: token1.address,
        fee: selectedFee,
        tickSpacing: finalParams.tickSpacing,
        curveType: selectedCurve,
        hooks: resolvedPlugin,
        tickLower: finalParams.tickLower,
        tickUpper: finalParams.tickUpper,
        liquidity: finalParams.liquidity,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Decimals: token0.decimals,
        amount1Decimals: token1.decimals,
        sqrtPriceX96: finalParams.sqrtPriceX96,
        token0Meta: token0,
        token1Meta: token1,
        payWithClaims,
      });

      const curveName =
        selectedCurve === CurveType.STABLE_AMM
          ? 'StableAMM'
          : selectedCurve === CurveType.BIN_AMM
            ? 'BinAMM'
            : 'CLAMM';

      void refreshPools();

      setMintedTxHash(hash);
      setStep('success');
      success(
        exists ? 'Liquidity Minted' : 'Pool Created & Minted',
        `Your ${curveName} liquidity position is now active on-chain.`
      );
    } catch (err: unknown) {
      setStep('idle');
      toastError('Deposit Failed', formatSwapError(err));
    }
  };

  const filteredTokens = useMemo(() => {
    const q = tokenSearch.toLowerCase().trim();
    return tokens.filter((t) => {
      const matchSearch =
        !q ||
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q;
      const matchLedger = activeLedgerTab === 'erc6909' ? t.isClaim : !t.isClaim;
      return matchSearch && matchLedger;
    });
  }, [tokens, tokenSearch, activeLedgerTab]);

  const isBusy = isMinting || isInitializing || step !== 'idle';

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
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
          {poolExists === false && (
            <Badge variant="outline" size="sm" className="font-mono">
              New Pool
            </Badge>
          )}
          {poolExists === true && (
            <Badge variant="brand" size="sm" className="font-mono">
              Pool Exists
            </Badge>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1 */}
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
              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token0');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo
                    symbol={token0.symbol}
                    address={token0.address}
                    logoURI={token0.logoURI}
                    size="lg"
                  />
                  <div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token0.symbol}
                      {token0.isClaim && (
                        <Badge variant="purple" size="sm">
                          6909
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{token0.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTokenSelectingTarget('token1');
                  setIsTokenSelectOpen(true);
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] hover:border-neutral-300 dark:hover:border-white/[0.15] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo
                    symbol={token1.symbol}
                    address={token1.address}
                    logoURI={token1.logoURI}
                    size="lg"
                  />
                  <div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {token1.symbol}
                      {token1.isClaim && (
                        <Badge variant="purple" size="sm">
                          6909
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{token1.name}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* STEP 2 */}
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
                    Concentrated liquidity focuses capital in a custom price interval. Ticks are
                    snapped to fee-tier spacing ({tickSpacing}) before mint.
                  </>
                )}
                {selectedCurve === CurveType.BIN_AMM && (
                  <>
                    Liquidity is deposited into the active price bin (derived from your deposit
                    ratio / mid price — not a fixed 1:1 center). Bin step comes from pool{' '}
                    <code className="font-mono">tickSpacing</code> ({tickSpacing}).
                  </>
                )}
                {selectedCurve === CurveType.STABLE_AMM && (
                  <>
                    StableSwap uses equal dual deposits. On-chain amplification defaults to A=100 at
                    initialize (UI amp is preview only).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  3
                </span>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Select Fee Tier</h2>
              </div>
              <span className="text-xs font-mono text-neutral-400">spacing {tickSpacing}</span>
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
                  </button>
                );
              })}
            </div>

            {/* Plugin is part of PoolKey — only when not pinned from an existing pool row */}
            {initialPlugin === undefined && (
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-white/[0.06]">
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Pool plugin
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  One plugin per pool. LVR and Anti-JIT cannot be combined.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'vanilla' as const, label: 'None', desc: 'Static fee' },
                      {
                        id: 'lvr' as const,
                        label: 'LVR Shield',
                        desc: 'Dynamic fee',
                        disabled: !protocolAddrs.lvrShieldPlugin,
                      },
                      {
                        id: 'antijit' as const,
                        label: 'Anti-JIT',
                        desc: 'Fee vesting',
                        disabled: !protocolAddrs.antiJITPlugin,
                      },
                    ] as const
                  ).map((opt) => {
                    const isSelected = pluginChoice === opt.id;
                    const disabled = 'disabled' in opt && opt.disabled;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && setPluginChoice(opt.id)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          disabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white'
                            : 'bg-neutral-50 dark:bg-white/[0.03] border-neutral-200 dark:border-white/[0.06]'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 4 — Starting price (Uniswap-style) when creating a new pool */}
          {poolExists === false && (
            <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                    4
                  </span>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Set Starting Price
                  </h2>
                </div>
                <Badge variant="default" size="sm" className="font-mono text-[10px]">
                  New pool
                </Badge>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                This initializes the pool&apos;s on-chain spot (like Uniswap). Decide how many{' '}
                {priceInverted ? token0.symbol : token1.symbol} equal 1{' '}
                {priceInverted ? token1.symbol : token0.symbol}. Deposit amounts will follow this
                ratio.
              </p>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-neutral-500">
                    1 {priceInverted ? token1.symbol : token0.symbol} =
                  </span>
                  <button
                    type="button"
                    onClick={handleInvertStartingPrice}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-lg border border-neutral-200 dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                    title="Invert price"
                  >
                    <ArrowDownUp className="w-3 h-3" />
                    Invert
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={startPriceDraft}
                    onChange={(e) => applyStartingPriceDraft(e.target.value)}
                    onBlur={() => {
                      const display = priceInverted
                        ? startingPriceUi > 0
                          ? 1 / startingPriceUi
                          : 1
                        : startingPriceUi;
                      setStartPriceDraft(formatCompactPrice(display, 8));
                    }}
                    className="flex-1 min-w-0 bg-white dark:bg-[#181A20] text-neutral-900 dark:text-white text-lg font-mono font-semibold rounded-xl px-3.5 py-3 outline-none border border-neutral-200 dark:border-white/[0.08] focus:border-neutral-400 dark:focus:border-white/30"
                    placeholder="0.0"
                  />
                  <div className="shrink-0 px-3 py-3 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/[0.08] text-sm font-bold text-neutral-900 dark:text-white">
                    {priceInverted ? token0.symbol : token1.symbol}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                  <span>
                    1 {token0.symbol} = {formatCompactPrice(startingPriceUi, 8)} {token1.symbol}
                  </span>
                  {(token0.priceUSD || 0) > 0 && (token1.priceUSD || 0) > 0 && (
                    <button
                      type="button"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      onClick={() => {
                        const mid = (token0.priceUSD || 0) / (token1.priceUSD || 1);
                        setStartingPriceUi(mid);
                        setPriceInverted(false);
                        setStartPriceDraft(formatCompactPrice(mid, 8));
                        const a0 = Number.parseFloat(amount0);
                        if (a0 > 0 && selectedCurve !== CurveType.STABLE_AMM) {
                          setAmount1((a0 * mid).toFixed(token1.decimals > 6 ? 6 : 2));
                        }
                      }}
                    >
                      Use market mid
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {poolExists === true && (
            <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl px-5 py-3.5 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                  Pool already live — spot is locked from on-chain slot0 (
                  <span className="font-mono">
                    1 {token0.symbol} = {formatCompactPrice(currentSpotPrice, 6)} {token1.symbol}
                  </span>
                  )
                </span>
              </div>
              <Badge variant="success" size="sm">
                Existing
              </Badge>
            </div>
          )}

          {/* STEP 5 — Deposit amounts */}
          <div className="bg-white dark:bg-[#111317] border border-neutral-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center font-mono">
                  {poolExists === false ? '5' : '4'}
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
                tokenIcon={
                  <TokenLogo
                    symbol={token0.symbol}
                    address={token0.address}
                    logoURI={token0.logoURI}
                    size="sm"
                  />
                }
                onSelectToken={() => {
                  setTokenSelectingTarget('token0');
                  setIsTokenSelectOpen(true);
                }}
                balance={balance0}
                onMaxClick={() => {
                  if (balance0 !== '-' && Number(balance0) > 0) handleAmount0Change(balance0);
                }}
                usdValue={
                  amount0 ? `$${(parseFloat(amount0) * (token0.priceUSD || 0)).toFixed(2)}` : undefined
                }
                isVaultClaim={token0.isClaim}
              />

              <TokenAmountInput
                label="Deposit Token 1"
                value={amount1}
                onChange={handleAmount1Change}
                tokenSymbol={token1.symbol}
                tokenIcon={
                  <TokenLogo
                    symbol={token1.symbol}
                    address={token1.address}
                    logoURI={token1.logoURI}
                    size="sm"
                  />
                }
                onSelectToken={() => {
                  setTokenSelectingTarget('token1');
                  setIsTokenSelectOpen(true);
                }}
                balance={balance1}
                onMaxClick={() => {
                  if (balance1 !== '-' && Number(balance1) > 0) handleAmount1Change(balance1);
                }}
                usdValue={
                  amount1 ? `$${(parseFloat(amount1) * (token1.priceUSD || 0)).toFixed(2)}` : undefined
                }
                isVaultClaim={token1.isClaim}
              />
            </div>

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
                  isLoading={isBusy}
                >
                  {step === 'initializing'
                    ? 'Initializing Pool...'
                    : step === 'approving0'
                      ? `Approving ${token0.symbol}...`
                      : step === 'approving1'
                        ? `Approving ${token1.symbol}...`
                        : step === 'minting'
                          ? 'Minting Position NFT...'
                          : poolExists
                            ? 'Mint Position'
                            : 'Create Pool & Mint Position'}
                </Button>
              )}
            </div>
          </div>
        </div>

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
            tickLower={mintPreview.tickLower}
            tickUpper={mintPreview.tickUpper}
            selectedBinId={
              selectedCurve === CurveType.BIN_AMM
                ? getBinIdFromHumanPrice(
                    poolOrdered.priceToken1PerToken0,
                    poolOrdered.decimals0,
                    poolOrdered.decimals1,
                    tickSpacing
                  )
                : CENTER_BIN_ID
            }
            priceFromChain={priceFromChain}
            onSetMinPrice={(p) => {
              const poolHuman = poolOrdered.uiMatchesPoolOrder ? p : 1 / Math.max(p, 1e-18);
              const t = snapTickToSpacing(
                humanPriceToTick(poolHuman, poolOrdered.decimals0, poolOrdered.decimals1),
                tickSpacing,
                false
              );
              const snappedPool = tickToHumanPrice(t, poolOrdered.decimals0, poolOrdered.decimals1);
              setMinPrice(
                poolOrdered.uiMatchesPoolOrder ? snappedPool : 1 / Math.max(snappedPool, 1e-18)
              );
            }}
            onSetMaxPrice={(p) => {
              const poolHuman = poolOrdered.uiMatchesPoolOrder ? p : 1 / Math.max(p, 1e-18);
              const t = snapTickToSpacing(
                humanPriceToTick(poolHuman, poolOrdered.decimals0, poolOrdered.decimals1),
                tickSpacing,
                true
              );
              const snappedPool = tickToHumanPrice(t, poolOrdered.decimals0, poolOrdered.decimals1);
              setMaxPrice(
                poolOrdered.uiMatchesPoolOrder ? snappedPool : 1 / Math.max(snappedPool, 1e-18)
              );
            }}
            onToggleFullRange={setIsFullRange}
            onSelectBinShape={setBinShape}
            onSelectBinStep={setBinStepBps}
            onSelectAmp={setAmpFactor}
          />
        </div>
      </div>

      <Modal
        isOpen={isTokenSelectOpen}
        onClose={() => setIsTokenSelectOpen(false)}
        title="Select Asset"
        description="Choose physical ERC-20 token or internal ERC-6909 Vault claim."
      >
        <div className="space-y-4 pt-1">
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

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {filteredTokens.map((t) => (
              <button
                key={`${t.address}-${t.isClaim ? 'claim' : 'erc20'}-${t.symbol}`}
                type="button"
                onClick={() => {
                  if (tokenSelectingTarget === 'token0') setToken0(t);
                  else setToken1(t);
                  setIsTokenSelectOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo
                    symbol={t.symbol}
                    address={t.address}
                    logoURI={t.logoURI}
                    size="md"
                  />
                  <div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {t.symbol}
                      {t.isClaim && (
                        <Badge variant="purple" size="sm">
                          6909
                        </Badge>
                      )}
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
            {filteredTokens.length === 0 && (
              <div className="text-center py-8 text-sm text-neutral-500">No tokens on this chain</div>
            )}
          </div>
        </div>
      </Modal>

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
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {amount0} {token0.symbol} + {amount1} {token1.symbol} deposited
            </p>
            {mintedTxHash && (
              <p className="text-xs font-mono text-neutral-500 break-all">
                Tx: {mintedTxHash.slice(0, 10)}...{mintedTxHash.slice(-8)}
              </p>
            )}
            <Button
              variant="brand"
              className="w-full"
              onClick={() => {
                setStep('idle');
                onBack();
              }}
            >
              Back to Pools
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
