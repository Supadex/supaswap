import type { Address } from 'viem';
import type { TokenMetadata } from './types';

export interface ProtocolAddresses {
  vault: Address;
  poolManager: Address;
  router: Address;
  quoter: Address;
  positionManager: Address;
  permit2: Address;
}

// Registry mapped by Chain ID
export const CONTRACT_ADDRESSES: Record<number, ProtocolAddresses> = {
  // Sepolia Testnet (Default deployment)
  11155111: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Ethereum Mainnet
  1: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Base
  8453: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Arbitrum One
  42161: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Localhost Anvil (Chain ID 31337)
  31337: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
};

export const getAddressesForChain = (chainId?: number): ProtocolAddresses => {
  if (chainId && CONTRACT_ADDRESSES[chainId]) {
    return CONTRACT_ADDRESSES[chainId];
  }
  return CONTRACT_ADDRESSES[11155111]; // Fallback to Sepolia
};

// Strict EVM tokens mapped by EVM Chain ID (No non-EVM tokens like XRP, SOL, DOGE)
export const CHAIN_TOKENS: Record<number, TokenMetadata[]> = {
  // Sepolia Testnet (11155111)
  11155111: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Sepolia Ether',
      decimals: 18,
      priceUSD: 3120.5,
      isNative: true,
    },
    {
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      symbol: 'USDC',
      name: 'USD Coin (Sepolia)',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      symbol: 'SUPA',
      name: 'SupaDex Governance',
      decimals: 18,
      priceUSD: 2.45,
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped BTC (Sepolia)',
      decimals: 8,
      priceUSD: 64500.0,
    },
    {
      address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      symbol: 'USDT',
      name: 'Tether USD (Sepolia)',
      decimals: 6,
      priceUSD: 1.0,
    },
    // ERC-6909 Vault Claims
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cETH',
      name: 'Vault Claim ETH',
      decimals: 18,
      priceUSD: 3120.5,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cUSDC',
      name: 'Vault Claim USDC',
      decimals: 6,
      priceUSD: 1.0,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cSUPA',
      name: 'Vault Claim SUPA',
      decimals: 18,
      priceUSD: 2.45,
      isClaim: true,
    },
  ],

  // Ethereum Mainnet (1)
  1: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      priceUSD: 3120.5,
      isNative: true,
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      priceUSD: 64500.0,
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'SUPA',
      name: 'SupaDex Governance',
      decimals: 18,
      priceUSD: 2.45,
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      priceUSD: 1.0,
    },
    {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      priceUSD: 7.85,
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      priceUSD: 12.4,
    },
    // ERC-6909 Vault Claims
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cETH',
      name: 'Vault Claim ETH',
      decimals: 18,
      priceUSD: 3120.5,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cUSDC',
      name: 'Vault Claim USDC',
      decimals: 6,
      priceUSD: 1.0,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cSUPA',
      name: 'Vault Claim SUPA',
      decimals: 18,
      priceUSD: 2.45,
      isClaim: true,
    },
  ],

  // Base (8453)
  8453: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum (Base)',
      decimals: 18,
      priceUSD: 3120.5,
      isNative: true,
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      symbol: 'cbBTC',
      name: 'Coinbase Wrapped BTC',
      decimals: 8,
      priceUSD: 64500.0,
    },
    {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      priceUSD: 1.0,
    },
    {
      address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
      symbol: 'AERO',
      name: 'Aerodrome',
      decimals: 18,
      priceUSD: 1.15,
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'SUPA',
      name: 'SupaDex Governance',
      decimals: 18,
      priceUSD: 2.45,
    },
    // ERC-6909 Vault Claims
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cETH',
      name: 'Vault Claim ETH',
      decimals: 18,
      priceUSD: 3120.5,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cUSDC',
      name: 'Vault Claim USDC',
      decimals: 6,
      priceUSD: 1.0,
      isClaim: true,
    },
  ],

  // Arbitrum (42161)
  42161: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum (Arbitrum)',
      decimals: 18,
      priceUSD: 3120.5,
      isNative: true,
    },
    {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      symbol: 'ARB',
      name: 'Arbitrum',
      decimals: 18,
      priceUSD: 0.58,
    },
    {
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      priceUSD: 64500.0,
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'SUPA',
      name: 'SupaDex Governance',
      decimals: 18,
      priceUSD: 2.45,
    },
    // ERC-6909 Vault Claims
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cETH',
      name: 'Vault Claim ETH',
      decimals: 18,
      priceUSD: 3120.5,
      isClaim: true,
    },
    {
      address: '0x1000000000000000000000000000000000000001',
      symbol: 'cUSDC',
      name: 'Vault Claim USDC',
      decimals: 6,
      priceUSD: 1.0,
      isClaim: true,
    },
  ],

  // Localhost Anvil (31337)
  31337: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Anvil Ether',
      decimals: 18,
      priceUSD: 3120.5,
      isNative: true,
    },
    {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      symbol: 'USDC',
      name: 'Test USDC',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      symbol: 'SUPA',
      name: 'Test SUPA',
      decimals: 18,
      priceUSD: 2.45,
    },
  ],
};

export const getTokensForChain = (chainId?: number): TokenMetadata[] => {
  if (chainId && CHAIN_TOKENS[chainId]) {
    return CHAIN_TOKENS[chainId];
  }
  return CHAIN_TOKENS[11155111]; // Default Sepolia
};

export const DEFAULT_TOKENS: TokenMetadata[] = CHAIN_TOKENS[11155111];
