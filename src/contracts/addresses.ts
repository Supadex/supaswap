import type { Address } from 'viem';
import type { TokenMetadata } from './types';
import { enrichTokenLogo } from '../utils/tokenLogo';

export interface ProtocolAddresses {
  vault: Address;
  poolManager: Address;
  router: Address;
  quoter: Address;
  positionManager: Address;
  claimsRouter: Address;
  permit2: Address;
  /** Optional LVR shield plugin — used when creating / minting into shielded pools */
  lvrShieldPlugin?: Address;
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
    claimsRouter: '0x6000000000000000000000000000000000000006',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Ethereum Mainnet
  1: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    claimsRouter: '0x6000000000000000000000000000000000000006',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Base
  8453: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    claimsRouter: '0x6000000000000000000000000000000000000006',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Arbitrum One
  42161: {
    vault: '0x1000000000000000000000000000000000000001',
    poolManager: '0x2000000000000000000000000000000000000002',
    router: '0x3000000000000000000000000000000000000003',
    quoter: '0x4000000000000000000000000000000000000004',
    positionManager: '0x5000000000000000000000000000000000000005',
    claimsRouter: '0x6000000000000000000000000000000000000006',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  // Localhost Anvil (Chain ID 31337)
  31337: {
    vault: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    poolManager: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    router: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d',
    quoter: '0x59b670e9fA9D0A427751Af201D676719a970857b',
    positionManager: '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
    claimsRouter: '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    lvrShieldPlugin: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
  },
};

export const getAddressesForChain = (chainId?: number): ProtocolAddresses => {
  const base =
    chainId && CONTRACT_ADDRESSES[chainId]
      ? CONTRACT_ADDRESSES[chainId]
      : CONTRACT_ADDRESSES[11155111];

  const env = (key: string): Address | undefined => {
    const v = (import.meta.env as Record<string, string | undefined>)[key];
    if (v && /^0x[a-fA-F0-9]{40}$/.test(v)) return v as Address;
    return undefined;
  };

  return {
    vault: env('VITE_VAULT_ADDRESS') ?? base.vault,
    poolManager: env('VITE_POOL_MANAGER_ADDRESS') ?? base.poolManager,
    router: env('VITE_ROUTER_ADDRESS') ?? base.router,
    quoter: env('VITE_QUOTER_ADDRESS') ?? base.quoter,
    positionManager: env('VITE_POSITION_MANAGER_ADDRESS') ?? base.positionManager,
    claimsRouter: env('VITE_CLAIMS_ROUTER_ADDRESS') ?? base.claimsRouter,
    permit2: base.permit2,
    lvrShieldPlugin:
      env('VITE_LVR_SHIELD_PLUGIN_ADDRESS') ?? base.lvrShieldPlugin,
  };
};

// Strict EVM defaults by chain — ETH / USDC / USDT only on prod nets.
// Full catalogs come from Uniswap + CoinGecko remote lists (see fetchTokenList).
// Anvil keeps the full local test mint set.
export const CHAIN_TOKENS: Record<number, TokenMetadata[]> = {
  // Sepolia Testnet (11155111)
  11155111: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Sepolia Ether',
      decimals: 18,
      priceUSD: 0,
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
      address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      symbol: 'USDT',
      name: 'Tether USD (Sepolia)',
      decimals: 6,
      priceUSD: 1.0,
    },
  ],

  // Ethereum Mainnet (1)
  1: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      priceUSD: 0,
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
  ],

  // Base (8453)
  8453: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum (Base)',
      decimals: 18,
      priceUSD: 0,
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
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      priceUSD: 1.0,
    },
  ],

  // Arbitrum (42161)
  42161: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum (Arbitrum)',
      decimals: 18,
      priceUSD: 0,
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
  ],

  // Localhost Anvil (31337) — full DeployTestTokens set
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
      address: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      priceUSD: 1.0,
    },
    {
      address: '0x851356ae760d987E095750cCeb3bC6014560891C',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      priceUSD: 1.0,
    },
    {
      address: '0xf5059a5D33d5853360D16C683c16e67980206f36',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      priceUSD: 64500.0,
    },
    {
      address: '0x95401dc811bb5740090279Ba06cfA8fcF6113778',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      priceUSD: 3120.5,
    },
    {
      address: '0x998abeb3E57409262aE5b751f60747921B33613E',
      symbol: 'SUPA',
      name: 'SupaDex Governance',
      decimals: 18,
      priceUSD: 2.45,
    },
    {
      address: '0x70e0bA845a1A0F2DA3359C97E0285013525FFC49',
      symbol: 'LINK',
      name: 'Chainlink Token',
      decimals: 18,
      priceUSD: 12.4,
    },
    {
      address: '0x4826533B4897376654Bb4d4AD88B7faFD0C98528',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      priceUSD: 7.85,
    },
    {
      address: '0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf',
      symbol: 'AAVE',
      name: 'Aave Token',
      decimals: 18,
      priceUSD: 155.0,
    },
    {
      address: '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF',
      symbol: 'ARB',
      name: 'Arbitrum',
      decimals: 18,
      priceUSD: 0.58,
    },
  ],
};

export const getTokensForChain = (chainId?: number): TokenMetadata[] => {
  const list =
    chainId && CHAIN_TOKENS[chainId] ? CHAIN_TOKENS[chainId] : CHAIN_TOKENS[11155111];
  return list.map(enrichTokenLogo);
};

export const DEFAULT_TOKENS: TokenMetadata[] = CHAIN_TOKENS[11155111];
