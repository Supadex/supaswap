import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useConnection, usePublicClient, useWriteContract } from 'wagmi';
import {
  parseUnits,
  maxUint256,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { SupaPositionManagerABI, ERC20ABI, SupaVaultABI } from '../contracts/abis';
import { getAddressesForChain, getTokensForChain } from '../contracts/addresses';
import { CurveType, type TokenMetadata } from '../contracts/types';
import { sortTokens } from '../contracts/utils';
import { isNativeAddress, sizeBinOrStableLiquidity } from '../utils/poolMath';
import { fetchOwnedTokenIds, hydratePosition } from '../services/onchainIndex';

export interface MintParams {
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  curveType: CurveType;
  hooks: `0x${string}`;
  tickLower: number;
  tickUpper: number;
  /** Pre-computed non-zero liquidity delta for the position. */
  liquidity: bigint;
  amount0Desired: string;
  amount1Desired: string;
  amount0Decimals: number;
  amount1Decimals: number;
  /** Pool-ordered sqrt price — required to size BinAMM/Stable amount1Max. */
  sqrtPriceX96?: bigint;
  token0Meta?: TokenMetadata;
  token1Meta?: TokenMetadata;
  slippageBps?: number;
  deadlineMinutes?: number;
  /** Pay settlement with ERC-6909 vault claims instead of ERC-20. */
  payWithClaims?: boolean;
}

export interface IncreaseLiquidityParams {
  tokenId: bigint;
  amount0Desired: string;
  amount1Desired: string;
  amount0Decimals: number;
  amount1Decimals: number;
  /** Liquidity delta; defaults to amount0 wei for Bin/Stable-style engines */
  liquidity?: bigint;
  curveType?: CurveType;
  deadlineMinutes?: number;
  payWithClaims?: boolean;
}

export interface DecreaseLiquidityParams {
  tokenId: bigint;
  /** Percent of current liquidityRaw to remove (1–100) */
  liquidityPercent: number;
  liquidityRaw: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  collectFeesAfter?: boolean;
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
  tickSpacing?: number;
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

/**
 * Positions are loaded from PositionManager (Transfer logs + positions(tokenId)).
 * No localStorage — the chain is the single source of truth.
 */
export function usePositions() {
  const { address: userAddress, chainId, chain } = useConnection();
  const addresses = getAddressesForChain(chainId);
  const publicClient = usePublicClient();
  const { mutateAsync, isPending: isWriting } = useWriteContract();
  const knownTokens = useMemo(() => getTokensForChain(chainId), [chainId]);

  const [positions, setPositions] = useState<PositionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinting, setIsMinting] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const waitForSuccess = async (hash: Hex): Promise<Hex> => {
    if (!publicClient) throw new Error('RPC client unavailable');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain');
    return hash;
  };

  const refreshAllPositions = useCallback(async () => {
    if (!publicClient || !userAddress || !addresses.positionManager) {
      setPositions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const tokenIds = await fetchOwnedTokenIds(
        publicClient,
        addresses.positionManager,
        userAddress
      );
      const hydrated = await Promise.all(
        tokenIds.map((tokenId) =>
          hydratePosition({
            publicClient,
            positionManager: addresses.positionManager,
            poolManager: addresses.poolManager,
            tokenId,
            knownTokens,
          })
        )
      );
      setPositions(hydrated.filter((p): p is PositionDetail => p !== null));
    } catch (err) {
      console.warn('refreshAllPositions failed', err);
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    publicClient,
    userAddress,
    addresses.positionManager,
    addresses.poolManager,
    knownTokens,
  ]);

  const refreshPosition = useCallback(
    async (tokenId: bigint) => {
      if (!publicClient || !addresses.positionManager) return null;
      const next = await hydratePosition({
        publicClient,
        positionManager: addresses.positionManager,
        poolManager: addresses.poolManager,
        tokenId,
        knownTokens,
      });
      if (!next) {
        setPositions((prev) => prev.filter((p) => p.tokenId !== tokenId));
        return null;
      }
      setPositions((prev) => {
        const idx = prev.findIndex((p) => p.tokenId === tokenId);
        if (idx < 0) return [...prev, next];
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      });
      return next;
    },
    [publicClient, addresses.positionManager, addresses.poolManager, knownTokens]
  );

  useLayoutEffect(() => {
    if (userAddress && publicClient && addresses.positionManager) {
      setIsLoading(true);
    } else if (!userAddress) {
      setPositions([]);
      setIsLoading(false);
    }
  }, [userAddress, publicClient, addresses.positionManager]);

  useEffect(() => {
    void refreshAllPositions();
  }, [refreshAllPositions]);

  const checkAllowance = async (tokenAddress: `0x${string}`, ownerAddress: `0x${string}`) => {
    if (isNativeAddress(tokenAddress)) return maxUint256;
    if (!publicClient) return 0n;
    try {
      return (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [ownerAddress, addresses.positionManager],
      })) as bigint;
    } catch {
      return 0n;
    }
  };

  const ensureVaultOperator = async (operator: Address) => {
    if (!userAddress || !publicClient) throw new Error('Wallet/RPC unavailable');
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
  };

  const approveToken = async (tokenAddress: `0x${string}`) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (isNativeAddress(tokenAddress)) return;
    if (!publicClient) throw new Error('RPC unavailable');
    const hash = (await mutateAsync({
      address: tokenAddress,
      chain,
      account: userAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [addresses.positionManager, maxUint256],
    })) as Hex;
    return waitForSuccess(hash);
  };

  const mintPosition = async (params: MintParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    if (!params.liquidity || params.liquidity === 0n) {
      throw new Error('Liquidity must be greater than zero');
    }
    setIsMinting(true);
    setTxHash(null);

    try {
      const amount0DesiredWei = parseUnits(params.amount0Desired || '0', params.amount0Decimals);
      const amount1DesiredWei = parseUnits(params.amount1Desired || '0', params.amount1Decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);
      const payWithClaims = Boolean(params.payWithClaims);

      const { currency0, currency1, zeroForOne } = sortTokens(params.token0, params.token1);

      let amount0Max = amount0DesiredWei;
      let amount1Max = amount1DesiredWei;
      const tickLower = params.tickLower;
      const tickUpper = params.tickUpper;

      if (!zeroForOne) {
        amount0Max = amount1DesiredWei;
        amount1Max = amount0DesiredWei;
      }

      let liquidity = params.liquidity;
      if (params.curveType === CurveType.BIN_AMM || params.curveType === CurveType.STABLE_AMM) {
        // Engine: amount1 = (amount0 * priceX128) >> 128
        const sqrt = params.sqrtPriceX96;
        if (sqrt && sqrt > 0n) {
          const sized = sizeBinOrStableLiquidity({
            amount0Wei: amount0Max,
            amount1Wei: amount1Max,
            sqrtPriceX96: sqrt,
          });
          liquidity = sized.liquidity > 0n ? sized.liquidity : amount0Max > 0n ? amount0Max : 1n;
          amount0Max = sized.amount0Wei > 0n ? sized.amount0Wei : amount0Max;
          amount1Max = sized.amount1Wei > 0n ? sized.amount1Wei : amount1Max;
        } else if (liquidity > 0n) {
          // Caller pre-sized liquidity; keep amount0Max ≥ liquidity
          if (amount0Max < liquidity) amount0Max = liquidity;
        } else {
          liquidity = amount0Max > 0n ? amount0Max : 1n;
        }
        amount0Max = amount0Max + (amount0Max * 5n) / 1000n + 1n;
        amount1Max = amount1Max + (amount1Max * 5n) / 1000n + 1n;
      } else {
        // CLAMM: JS tick/sqrt approx can undershoot on-chain amounts by a few wei
        amount0Max = amount0Max + (amount0Max * 5n) / 1000n;
        amount1Max = amount1Max + (amount1Max * 5n) / 1000n;
      }

      if (payWithClaims) {
        await ensureVaultOperator(addresses.positionManager);
      }

      const isCurrency0Native = isNativeAddress(currency0);
      // Native settle uses msg.value — pad to match amount0Max buffer
      const value = !payWithClaims && isCurrency0Native ? amount0Max : 0n;

      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        functionName: 'mint',
        chain,
        account: userAddress,
        args: [
          {
            poolKey: {
              currency0,
              currency1,
              fee: params.fee,
              tickSpacing: params.tickSpacing,
              plugin: (params.hooks || zeroAddress) as Address,
              curveType: params.curveType,
            },
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            recipient: userAddress,
            deadline,
            hookData: '0x',
            payWithClaims,
          },
        ],
        value,
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);
      await refreshAllPositions();
      return hash;
    } finally {
      setIsMinting(false);
    }
  };

  const increaseLiquidity = async (params: IncreaseLiquidityParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    setIsManaging(true);
    setTxHash(null);

    try {
      const amount0DesiredWei = parseUnits(params.amount0Desired || '0', params.amount0Decimals);
      const amount1DesiredWei = parseUnits(params.amount1Desired || '0', params.amount1Decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);
      const payWithClaims = Boolean(params.payWithClaims);

      const cached = positions.find((p) => p.tokenId === params.tokenId);
      const curveType = params.curveType ?? cached?.curveType ?? CurveType.CLAMM;

      let liquidity =
        params.liquidity && params.liquidity > 0n
          ? params.liquidity
          : amount0DesiredWei > 0n
            ? amount0DesiredWei
            : amount1DesiredWei;
      if (liquidity === 0n) throw new Error('Liquidity must be greater than zero');

      let amount0Max = amount0DesiredWei;
      let amount1Max = amount1DesiredWei;
      if (curveType === CurveType.BIN_AMM || curveType === CurveType.STABLE_AMM) {
        if (amount1Max > 0n) amount1Max = (amount1Max * 1005n) / 1000n;
        if (amount0Max === 0n) amount0Max = liquidity;
      }

      if (payWithClaims) {
        await ensureVaultOperator(addresses.positionManager);
      }

      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        chain,
        account: userAddress,
        functionName: 'increaseLiquidity',
        args: [
          {
            tokenId: params.tokenId,
            liquidity,
            amount0Max: amount0Max > 0n ? amount0Max : maxUint256,
            amount1Max: amount1Max > 0n ? amount1Max : maxUint256,
            deadline,
            hookData: '0x',
            payWithClaims,
          },
        ],
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);
      await refreshPosition(params.tokenId);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  const decreaseLiquidity = async (params: DecreaseLiquidityParams) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    setIsManaging(true);
    setTxHash(null);

    try {
      const pct = Math.min(100, Math.max(0, Math.floor(params.liquidityPercent)));
      if (pct <= 0) throw new Error('Select a withdrawal percent');
      if (params.liquidityRaw <= 0n) throw new Error('Position has no liquidity');

      let liquidityToRemove = (params.liquidityRaw * BigInt(pct)) / 100n;
      if (liquidityToRemove === 0n && pct > 0) liquidityToRemove = 1n;
      if (liquidityToRemove > params.liquidityRaw) liquidityToRemove = params.liquidityRaw;

      const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineMinutes ?? 20) * 60);

      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        chain,
        account: userAddress,
        functionName: 'decreaseLiquidity',
        args: [
          {
            tokenId: params.tokenId,
            liquidity: liquidityToRemove,
            amount0Min: params.amount0Min ?? 0n,
            amount1Min: params.amount1Min ?? 0n,
            deadline,
            hookData: '0x',
          },
        ],
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);

      if (params.collectFeesAfter) {
        try {
          const collectHash = (await mutateAsync({
            address: addresses.positionManager,
            abi: SupaPositionManagerABI,
            chain,
            account: userAddress,
            functionName: 'collect',
            args: [
              {
                tokenId: params.tokenId,
                recipient: userAddress,
                amount0Max: maxUint256,
                amount1Max: maxUint256,
              },
            ],
          })) as Hex;
          await waitForSuccess(collectHash);
        } catch (collectErr) {
          console.warn('Collect after decrease failed', collectErr);
        }
      }

      await refreshPosition(params.tokenId);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  const collectFees = async (tokenId: bigint, recipient?: `0x${string}`) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    setIsManaging(true);
    setTxHash(null);

    try {
      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        chain,
        account: userAddress,
        functionName: 'collect',
        args: [
          {
            tokenId,
            recipient: recipient ?? userAddress,
            amount0Max: maxUint256,
            amount1Max: maxUint256,
          },
        ],
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);
      await refreshPosition(tokenId);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  const syncFees = async (tokenId: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    setIsManaging(true);
    setTxHash(null);

    try {
      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        chain,
        account: userAddress,
        functionName: 'syncFees',
        args: [tokenId],
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);
      await refreshPosition(tokenId);
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  const burnPosition = async (tokenId: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!publicClient) throw new Error('RPC unavailable');
    setIsManaging(true);
    setTxHash(null);

    try {
      const hash = (await mutateAsync({
        address: addresses.positionManager,
        abi: SupaPositionManagerABI,
        chain,
        account: userAddress,
        functionName: 'burn',
        args: [tokenId],
      })) as Hex;

      await waitForSuccess(hash);
      setTxHash(hash);
      await refreshAllPositions();
      return hash;
    } finally {
      setIsManaging(false);
    }
  };

  const getPositionByTokenId = useCallback(
    (tokenId: bigint) => positions.find((p) => p.tokenId === tokenId) ?? null,
    [positions]
  );

  return {
    positions: userAddress ? positions : [],
    positionCount: positions.length,
    isLoading,
    isLoadingCount: isLoading,
    refetchCount: refreshAllPositions,
    checkAllowance,
    approveToken,
    mintPosition,
    increaseLiquidity,
    decreaseLiquidity,
    collectFees,
    syncFees,
    burnPosition,
    refreshPosition,
    refreshAllPositions,
    getPositionByTokenId,
    isWriting,
    isMinting,
    isManaging,
    txHash,
  };
}
