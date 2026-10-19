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
  /** Optional Anti-JIT fee-vesting plugin */
  antiJITPlugin?: Address;
  /** Optional plugin whitelist (preflight / residency UX) */
  pluginWhitelist?: Address;
}

const ZERO = '0x0000000000000000000000000000000000000000' as Address;
const ANVIL_CHAIN_ID = 31337;

// Registry mapped by Chain ID
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

/** Monad Testnet — DeploySupaDex broadcast 2026-10-18 */
const MONAD_TESTNET: ProtocolAddresses = {
  vault: '0x2d9BcA3f7Fa23863944Fd611f4970Da6fB97Fe2D',
  poolManager: '0xC6B8Dc0AA5408C1e5C836794dD61F70Bd51A3A90',
  router: '0x677654F5eD18bD863dcfabFA69894A030010c1bc',
  quoter: '0xD44B281767F32E1fb72257223366E87378a7019d',
  positionManager: '0x6fe90e8111e0A18e6A8119dB82909E50B8A8400F',
  claimsRouter: '0xc2F4605fdDC67F4a48e83dBfC945FEdeA42879a0',
  permit2: PERMIT2,
  lvrShieldPlugin: '0x16c9d6e825CE8EAd431eB1E1443e18FcDbCE2623',
  antiJITPlugin: '0x60317687C9cBb3d31a75acc2bfBcD119b411ca52',
  pluginWhitelist: '0x78c98fBB518551c7f31D932878901027F0B9cD29',
};

/** Sepolia — DeploySupaDex broadcast 2026-10-19 (EIP-3860-safe engines) */
const SEPOLIA: ProtocolAddresses = {
  vault: '0x5A7FaCaBAFBB70f2ABCF423A574B2A9D8014097e',
  poolManager: '0xD44B281767F32E1fb72257223366E87378a7019d',
  router: '0x43DC1d6fE415524dbA0a359cdaFAf7d864EECC5f',
  quoter: '0x8CBEE7D91A24Fc74659856a55CF85c3F3622285b',
  positionManager: '0xFc0bbF69664b6511Cc961F64C0948D82Bd45b707',
  claimsRouter: '0x543132b740C85F59AC3344CAEa8e81fb1514856d',
  permit2: PERMIT2,
  lvrShieldPlugin: '0x484Ec3DC5fb027C2829ced71d3f7FBCb0A40049b',
  antiJITPlugin: '0x982f42ad054152CC5bF9390c39eeB0DFad0E847c',
  pluginWhitelist: '0xA82f100207d0BE0F162b3f3b5E3048cA7ED5C88a',
};

/** Base Sepolia — DeploySupaDex broadcast 2026-10-19 */
const BASE_SEPOLIA: ProtocolAddresses = {
  vault: '0x60317687C9cBb3d31a75acc2bfBcD119b411ca52',
  poolManager: '0x6fe90e8111e0A18e6A8119dB82909E50B8A8400F',
  router: '0xb66EE27Da7E975374D7252457f0bdACE729C5096',
  quoter: '0xFc0bbF69664b6511Cc961F64C0948D82Bd45b707',
  positionManager: '0xD528B7cdb95dd607D381e0e554cB60fC54DE9f4a',
  claimsRouter: '0x43DC1d6fE415524dbA0a359cdaFAf7d864EECC5f',
  permit2: PERMIT2,
  lvrShieldPlugin: '0xD44B281767F32E1fb72257223366E87378a7019d',
  antiJITPlugin: '0x484Ec3DC5fb027C2829ced71d3f7FBCb0A40049b',
  pluginWhitelist: '0x59fcd5F6BE8C552daDA47F0af0ae008CE99f45C4',
};

export const CONTRACT_ADDRESSES: Record<number, ProtocolAddresses> = {
  11155111: SEPOLIA,
  84532: BASE_SEPOLIA,
  // Monad Testnet (10143)
  10143: MONAD_TESTNET,
  // Ethereum Mainnet (placeholders until mainnet launch)
  1: {
    vault: ZERO,
    poolManager: ZERO,
    router: ZERO,
    quoter: ZERO,
    positionManager: ZERO,
    claimsRouter: ZERO,
    permit2: PERMIT2,
  },
  // Base mainnet
  8453: {
    vault: ZERO,
    poolManager: ZERO,
    router: ZERO,
    quoter: ZERO,
    positionManager: ZERO,
    claimsRouter: ZERO,
    permit2: PERMIT2,
  },
  // Arbitrum One
  42161: {
    vault: ZERO,
    poolManager: ZERO,
    router: ZERO,
    quoter: ZERO,
    positionManager: ZERO,
    claimsRouter: ZERO,
    permit2: PERMIT2,
  },
  // Localhost Anvil (Chain ID 31337)
  31337: {
    vault: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    poolManager: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    router: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
    quoter: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
    positionManager: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
    claimsRouter: '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
    permit2: PERMIT2,
    lvrShieldPlugin: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    antiJITPlugin: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    pluginWhitelist: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
  },
};

/** True when registry still has placeholder deploy stubs (non-Anvil). */
export function isPlaceholderDeploy(addrs: ProtocolAddresses): boolean {
  return (
    addrs.poolManager.toLowerCase().startsWith('0x200000000000000000000000000000000000') ||
    addrs.vault === ZERO
  );
}

export const getAddressesForChain = (chainId?: number): ProtocolAddresses => {
  const base =
    chainId && CONTRACT_ADDRESSES[chainId]
      ? CONTRACT_ADDRESSES[chainId]
      : CONTRACT_ADDRESSES[10143];

  const env = (key: string): Address | undefined => {
    // VITE_* overrides apply only on Anvil — never leak local addresses onto prod nets.
    if (chainId !== ANVIL_CHAIN_ID) return undefined;
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
    antiJITPlugin: env('VITE_ANTI_JIT_PLUGIN_ADDRESS') ?? base.antiJITPlugin,
    pluginWhitelist: env('VITE_PLUGIN_WHITELIST_ADDRESS') ?? base.pluginWhitelist,
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

  // Base Sepolia (84532)
  84532: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Base Sepolia Ether',
      decimals: 18,
      priceUSD: 0,
      isNative: true,
    },
    {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USD Coin (Base Sepolia)',
      decimals: 6,
      priceUSD: 1.0,
    },
  ],

  // Monad Testnet (10143)
  10143: [
    {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'MON',
      name: 'Monad Testnet',
      decimals: 18,
      priceUSD: 0,
      isNative: true,
    },
    {
      address: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
      symbol: 'USDC',
      name: 'USD Coin (Monad Testnet)',
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
    chainId && CHAIN_TOKENS[chainId] ? CHAIN_TOKENS[chainId] : CHAIN_TOKENS[10143];
  return list.map(enrichTokenLogo);
};

export const DEFAULT_TOKENS: TokenMetadata[] = CHAIN_TOKENS[10143];
