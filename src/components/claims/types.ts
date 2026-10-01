export interface ClaimAsset {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  walletBalance: string;
  claimBalance: string;
  priceUSD: number;
  logoURI?: string;
}
