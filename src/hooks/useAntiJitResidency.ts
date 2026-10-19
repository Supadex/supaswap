import { useEffect, useMemo, useState } from 'react';
import { useConnection, usePublicClient } from 'wagmi';
import {
  encodePacked,
  keccak256,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { getAddressesForChain } from '../contracts/addresses';
import { AntiJITVestingPluginABI } from '../contracts/abis';
import { computePoolId } from '../contracts/utils';
import type { CurveType } from '../contracts/types';

export interface AntiJitResidencyInfo {
  isAntiJit: boolean;
  minResidencyBlocks: number;
  lastDepositBlock: number;
  blocksElapsed: number;
  vestedBps: number;
  unvestedBps: number;
  progressPct: number;
}

/**
 * Read AntiJIT residency for a PositionManager NFT.
 * positionKey = keccak256(abi.encodePacked(positionManager, tickLower, tickUpper, bytes32(tokenId)))
 */
export function useAntiJitResidency(args: {
  hooks?: Address;
  currency0?: Address;
  currency1?: Address;
  fee?: number;
  tickSpacing?: number;
  curveType?: CurveType;
  tickLower?: number;
  tickUpper?: number;
  tokenId?: bigint;
}) {
  const { chainId } = useConnection();
  const publicClient = usePublicClient();
  const addresses = getAddressesForChain(chainId);
  const [info, setInfo] = useState<AntiJitResidencyInfo | null>(null);

  const isAntiJit = useMemo(() => {
    if (!args.hooks || !addresses.antiJITPlugin) return false;
    return args.hooks.toLowerCase() === addresses.antiJITPlugin.toLowerCase();
  }, [args.hooks, addresses.antiJITPlugin]);

  useEffect(() => {
    if (
      !isAntiJit ||
      !publicClient ||
      !addresses.antiJITPlugin ||
      !addresses.positionManager ||
      args.currency0 == null ||
      args.currency1 == null ||
      args.fee == null ||
      args.tickSpacing == null ||
      args.curveType == null ||
      args.tickLower == null ||
      args.tickUpper == null ||
      args.tokenId == null
    ) {
      setInfo(isAntiJit ? { isAntiJit: true, minResidencyBlocks: 0, lastDepositBlock: 0, blocksElapsed: 0, vestedBps: 0, unvestedBps: 10000, progressPct: 0 } : null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const minRes = Number(
          await publicClient.readContract({
            address: addresses.antiJITPlugin!,
            abi: AntiJITVestingPluginABI,
            functionName: 'minResidencyBlocks',
          })
        );
        const poolId = computePoolId({
          currency0: args.currency0!,
          currency1: args.currency1!,
          fee: args.fee!,
          tickSpacing: args.tickSpacing!,
          hooks: args.hooks || zeroAddress,
          curveType: args.curveType!,
        });
        const positionKey = keccak256(
          encodePacked(
            ['address', 'int24', 'int24', 'bytes32'],
            [
              addresses.positionManager,
              args.tickLower!,
              args.tickUpper!,
              (`0x${args.tokenId!.toString(16).padStart(64, '0')}` as Hex),
            ]
          )
        );
        const residency = (await publicClient.readContract({
          address: addresses.antiJITPlugin!,
          abi: AntiJITVestingPluginABI,
          functionName: 'residencies',
          args: [poolId as Hex, positionKey],
        })) as readonly [number, number, bigint];
        const lastDepositBlock = Number(residency[0]);
        const blockNumber = Number(await publicClient.getBlockNumber());
        const elapsed =
          lastDepositBlock > 0 ? Math.max(0, blockNumber - lastDepositBlock) : 0;
        const K = Math.max(1, minRes);
        const vestedBps = Math.min(10_000, Math.floor((elapsed * 10_000) / K));
        const unvestedBps = 10_000 - vestedBps;
        if (!cancelled) {
          setInfo({
            isAntiJit: true,
            minResidencyBlocks: minRes,
            lastDepositBlock,
            blocksElapsed: elapsed,
            vestedBps,
            unvestedBps,
            progressPct: vestedBps / 100,
          });
        }
      } catch {
        if (!cancelled) {
          setInfo({
            isAntiJit: true,
            minResidencyBlocks: 10,
            lastDepositBlock: 0,
            blocksElapsed: 0,
            vestedBps: 0,
            unvestedBps: 10_000,
            progressPct: 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAntiJit,
    publicClient,
    addresses.antiJITPlugin,
    addresses.positionManager,
    args.currency0,
    args.currency1,
    args.fee,
    args.tickSpacing,
    args.curveType,
    args.hooks,
    args.tickLower,
    args.tickUpper,
    args.tokenId,
  ]);

  return info;
}
