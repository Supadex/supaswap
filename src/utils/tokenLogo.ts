import { getAddress, isAddress, zeroAddress } from 'viem';
import type { TokenMetadata } from '../contracts/types';

/** Canonical mainnet logos (works for Anvil/test symbols + prod fallback). */
export const POPULAR_TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  WETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  USDT: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  WBTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  DAI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  UNI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  LINK: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
  AAVE: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png',
  ARB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  OP: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
  MATIC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
};

export function normalizeLogoSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  // Claim tokens: cETH / cUSDC → base symbol for logo lookup
  if (upper.startsWith('C') && upper.length > 1 && POPULAR_TOKEN_LOGOS[upper.slice(1)]) {
    return upper.slice(1);
  }
  return upper;
}

export function popularLogoForSymbol(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return POPULAR_TOKEN_LOGOS[normalizeLogoSymbol(symbol)];
}

/** Trust Wallet assets require EIP-55 checksummed paths. */
export function trustWalletLogoUrl(address?: string): string | undefined {
  if (!address || !isAddress(address)) return undefined;
  if (address.toLowerCase() === zeroAddress) return undefined;
  try {
    const checksummed = getAddress(address);
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${checksummed}/logo.png`;
  } catch {
    return undefined;
  }
}

/** Attach a logoURI when missing (popular symbol → Uniswap list URI already set). */
export function enrichTokenLogo<T extends Pick<TokenMetadata, 'symbol' | 'logoURI'>>(
  token: T
): T {
  if (token.logoURI) return token;
  const popular = popularLogoForSymbol(token.symbol);
  if (!popular) return token;
  return { ...token, logoURI: popular };
}
