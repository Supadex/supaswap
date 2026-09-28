import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { SupaPositionManagerABI, ERC20ABI } from '../contracts/abis';
import { getAddressesForChain, DEFAULT_TOKENS } from '../contracts/addresses';
import { CurveType, type TokenMetadata } from '../contracts/types';
import { parseUnits, maxUint256 } from 'viem';

export interface MintParams {
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  curveType: CurveType;
  hooks: `0x${string}`;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Decimals: number;
  amount1Decimals: number;
  slippageBps?: number;
  deadlineMinutes?: number;
}

export interface IncreaseLiquidityParams {
  tokenId: bigint;
  amount0Desired: string;
  amount1Desired: string;
  amount0Decimals: number;
  amount1Decimals: number;
  slippageBps?: number;
  deadlineMinutes?: number;
}

export interface DecreaseLiquidityParams {
  tokenId: bigint;
  liquidityPercent: number; // 1 to 100
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadlineMinutes?: number;
}

export interface PositionDetail {
  id: string;
  tokenId: bigint;
  token0: TokenMetadata;
  token1: TokenMetadata;
  pair: string;
  curve: 'CLAMM' | 'BinAMM' | 'StableAMM';
  curveType: CurveType;
  feeTier: string;
  feeNumber: number;
  tickLower: number;
  tickUpper: number;
  minPrice: string;
  maxPrice: string;
  currentPrice: string;
  status: 'in-range' | 'out-of-range' | 'closed';
  liquidityUSD: string;
  liquidityRaw: bigint;
  amount0: string;
  amount1: string;
  uncollectedFee0: string;
  uncollectedFee1: string;
  uncollectedFeesUSD: string;
  apr: string;
  depositedDate: string;
  useVaultClaims?: boolean;
}

const LOCAL_POSITIONS_KEY = 'supadex_user_positions';

export function usePositions() {
  const { address: userAddress, chainId } = useAccount();
  const publicClient = usePublicClient();
  const addresses = getAddressesForChain(chainId);
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [isMinting, setIsMinting] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Local storage cache for user-created positions
  const [localPositions, setLocalPositions] = useState<PositionDetail[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_POSITIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Read position count for owner from on-chain contract
  const { data: balanceData, isLoading: isLoadingCount, refetch: refetchCount } = useReadContract({
    address: addresses.positionManager,
    abi: SupaPositionManagerABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: Boolean(userAddress),
    },
  });

  // Check token allowance against positionManager
  const checkAllowance = async (tokenAddress: `0x${string}`, ownerAddress: `0x${string}`) => {
    if (!publicClient) return BigInt(0);
    // If native ETH, no allowance needed
    if (tokenAddress.toLowerCase() === DEFAULT_TOKENS[0].address.toLowerCase()) {
      return maxUint256;
    }
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [ownerAddress, addresses.positionManager],
      });
      return allowance as bigint;
    } catch {
      return BigInt(0);
    }
  };

  // Approve token for positionManager
  const approveToken = async (tokenAddress: `0x${string}`) => {
    if (!userAddress) throw new Error('Wallet not connected');
    return writeContractAsync({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [addresses.positionManager, maxUint256],
    });
  };

  // Mint new concentrated / bin / stable liquidity position
  const mintPosition = async (params: MintParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsMinting(true);
    setTxHash(null);

    try {
      const amount0DesiredWei = parseUnits(params.amount0Desired || '0', params.amount0Decimals);
      const amount1DesiredWei = parseUnits(params.amount1Desired || '0', params.amount1Decimals);

      const slippage = params.slippageBps ?? 50; // 0.5% default
      const amount0Min = (amount0DesiredWei * BigInt(10000 - slippage)) / BigInt(10000);
      const amount1Min = (amount1DesiredWei * BigInt(10000 - slippage)) / BigInt(10000);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);

      const isToken0Native = params.token0.toLowerCase() === DEFAULT_TOKENS[0].address.toLowerCase();
      const value = isToken0Native ? amount0DesiredWei : BigInt(0);

      const hash = await writeContractAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'mint',
        args: [
          {
            poolKey: {
              currency0: params.token0,
              currency1: params.token1,
              fee: params.fee,
              tickSpacing: params.tickSpacing,
              curveType: params.curveType,
              hooks: params.hooks,
            },
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: amount0DesiredWei,
            amount1Desired: amount1DesiredWei,
            amount0Min,
            amount1Min,
            recipient: userAddress,
            deadline,
          },
        ],
        value,
      });

      setTxHash(hash);

      // Save newly minted position to user's portfolio
      const token0Meta = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === params.token0.toLowerCase()) || {
        address: params.token0,
        symbol: 'TOKEN0',
        name: 'Token 0',
        decimals: params.amount0Decimals,
        priceUSD: 1.0,
      };

      const token1Meta = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === params.token1.toLowerCase()) || {
        address: params.token1,
        symbol: 'TOKEN1',
        name: 'Token 1',
        decimals: params.amount1Decimals,
        priceUSD: 1.0,
      };

      const curveName =
        params.curveType === CurveType.STABLE_AMM
          ? 'StableAMM'
          : params.curveType === CurveType.BIN_AMM
          ? 'BinAMM'
          : 'CLAMM';

      const newPos: PositionDetail = {
        id: `pos-${Date.now()}`,
        tokenId: BigInt(Date.now() % 10000),
        token0: token0Meta,
        token1: token1Meta,
        pair: `${token0Meta.symbol} / ${token1Meta.symbol}`,
        curve: curveName,
        curveType: params.curveType,
        feeTier: `${(params.fee / 10000).toFixed(2)}%`,
        feeNumber: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        minPrice: `${Math.pow(1.0001, params.tickLower).toFixed(4)} ${token1Meta.symbol}`,
        maxPrice: `${Math.pow(1.0001, params.tickUpper).toFixed(4)} ${token1Meta.symbol}`,
        currentPrice: `${Math.pow(1.0001, (params.tickLower + params.tickUpper) / 2).toFixed(4)} ${token1Meta.symbol}`,
        status: 'in-range',
        liquidityUSD: `$${(
          Number(params.amount0Desired) * (token0Meta.priceUSD || 1) +
          Number(params.amount1Desired) * (token1Meta.priceUSD || 1)
        ).toFixed(2)}`,
        liquidityRaw: amount0DesiredWei + amount1DesiredWei,
        amount0: params.amount0Desired,
        amount1: params.amount1Desired,
        uncollectedFee0: '0.0000',
        uncollectedFee1: '0.0000',
        uncollectedFeesUSD: '$0.00',
        apr: '24.5%',
        depositedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };

      setLocalPositions(prev => {
        const updated = [newPos, ...prev];
        localStorage.setItem(LOCAL_POSITIONS_KEY, JSON.stringify(updated));
        return updated;
      });

      await refetchCount();
      return hash;
    } finally {
      setIsMinting(false);
    }
  };

  // Increase Liquidity in existing position
  const increaseLiquidity = async (params: IncreaseLiquidityParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsManaging(true);
    setTxHash(null);

    try {
      const amount0DesiredWei = parseUnits(params.amount0Desired || '0', params.amount0Decimals);
      const amount1DesiredWei = parseUnits(params.amount1Desired || '0', params.amount1Decimals);

      const slippage = params.slippageBps ?? 50;
      const amount0Min = (amount0DesiredWei * BigInt(10000 - slippage)) / BigInt(10000);
      const amount1Min = (amount1DesiredWei * BigInt(10000 - slippage)) / BigInt(10000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);

      const hash = await writeContractAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'increaseLiquidity',
        args: [
          {
            tokenId: params.tokenId,
            amount0Desired: amount0DesiredWei,
            amount1Desired: amount1DesiredWei,
            amount0Min,
            amount1Min,
            deadline,
          },
        ],
      });

      setTxHash(hash);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  // Decrease Liquidity in existing position
  const decreaseLiquidity = async (params: DecreaseLiquidityParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsManaging(true);
    setTxHash(null);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);

      const hash = await writeContractAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'decreaseLiquidity',
        args: [
          {
            tokenId: params.tokenId,
            liquidity: BigInt(params.liquidityPercent),
            amount0Min: params.amount0Min ?? BigInt(0),
            amount1Min: params.amount1Min ?? BigInt(0),
            deadline,
          },
        ],
      });

      setTxHash(hash);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  // Collect uncollected trading fees
  const collectFees = async (tokenId: bigint, recipient?: `0x${string}`) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsManaging(true);
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'collect',
        args: [
          {
            tokenId,
            recipient: recipient ?? userAddress,
            amount0Max: BigInt('340282366920938463463374607431768211455'),
            amount1Max: BigInt('340282366920938463463374607431768211455'),
          },
        ],
      });

      setTxHash(hash);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  // Burn closed position NFT
  const burnPosition = async (tokenId: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    setIsManaging(true);
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'burn',
        args: [tokenId],
      });

      setTxHash(hash);
      setLocalPositions(prev => {
        const updated = prev.filter(p => p.tokenId !== tokenId);
        localStorage.setItem(LOCAL_POSITIONS_KEY, JSON.stringify(updated));
        return updated;
      });
      await refetchCount();
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  return {
    positions: userAddress ? localPositions : [],
    positionCount: balanceData ? Number(balanceData) : localPositions.length,
    isLoadingCount,
    refetchCount,
    checkAllowance,
    approveToken,
    mintPosition,
    increaseLiquidity,
    decreaseLiquidity,
    collectFees,
    burnPosition,
    isWriting,
    isMinting,
    isManaging,
    txHash,
  };
}
