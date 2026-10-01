import { encodeAbiParameters, keccak256, getAddress, isAddress, type Address, zeroAddress } from 'viem';
import type { PoolKey } from './types';

export function sortTokens(
  tokenA: Address,
  tokenB: Address
): { currency0: Address; currency1: Address; zeroForOne: boolean } {
  const isAFirst = tokenA.toLowerCase() < tokenB.toLowerCase();
  return {
    currency0: isAFirst ? tokenA : tokenB,
    currency1: isAFirst ? tokenB : tokenA,
    zeroForOne: isAFirst,
  };
}


/** ERC-6909 currency id = uint160(tokenAddress). Native ETH uses id 0. */
export function currencyId(currency: Address | string): bigint {
  if (!currency || currency === zeroAddress || String(currency).toLowerCase() === zeroAddress) {
    return 0n;
  }
  if (!isAddress(currency)) return 0n;
  return BigInt(getAddress(currency));
}

export function computePoolId(poolKey: PoolKey): `0x${string}` {
  // PoolKey ABI struct: (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType)
  const encoded = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'plugin', type: 'address' },
          { name: 'curveType', type: 'uint8' },
        ],
      },
    ],
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        plugin: poolKey.hooks,
        curveType: poolKey.curveType,
      },
    ]
  );

  return keccak256(encoded);
}

export function getFeeTierDefaultTickSpacing(fee: number): number {
  switch (fee) {
    case 100:
      return 1;
    case 500:
      return 10;
    case 3000:
      return 60;
    case 10000:
      return 200;
    default:
      return 60;
  }
}
