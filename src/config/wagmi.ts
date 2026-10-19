import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  mainnet,
  sepolia,
  arbitrum,
  base,
  baseSepolia,
  anvil,
} from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { defineChain } from 'viem';
import { cookieStorage, createStorage, http, type Transport } from 'wagmi';

export const projectId =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string) || 'b56e18d47c72ab683b10814fe9495694';

export const metadata = {
  name: 'SupaDex',
  description: 'Multi-Curve AMM with Dynamic LVR Spread Defense & ERC-6909 Vault Claims',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://supadex.fi',
  icons: ['https://supadex.fi/favicon.ico'],
};

/**
 * Network visibility mode:
 * - `local` — Anvil + mainnets + Sepolia (local machine / Anvil E2E)
 * - `test`  — Sepolia, Base Sepolia, Monad Testnet only
 * - `prod`  — mainnets only (no Anvil, no public testnets)
 *
 * Set via `VITE_NETWORK_MODE`. Defaults to `local` in Vite DEV, else `prod`.
 */
export type NetworkMode = 'local' | 'test' | 'prod';

export function resolveNetworkMode(): NetworkMode {
  const raw = String(import.meta.env.VITE_NETWORK_MODE ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'local' || raw === 'test' || raw === 'prod') return raw;
  return import.meta.env.DEV ? 'local' : 'prod';
}

export const networkMode = resolveNetworkMode();

/** Monad Testnet — not always re-exported by AppKit; define explicitly. */
export const monadTestnet = defineChain({
  id: 10_143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Testnet MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadExplorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
}) as unknown as AppKitNetwork;

function asNetworkTuple(list: AppKitNetwork[]): [AppKitNetwork, ...AppKitNetwork[]] {
  if (list.length === 0) {
    throw new Error('At least one network is required');
  }
  return list as [AppKitNetwork, ...AppKitNetwork[]];
}

function networksForMode(mode: NetworkMode): [AppKitNetwork, ...AppKitNetwork[]] {
  switch (mode) {
    case 'test':
      return asNetworkTuple([sepolia, baseSepolia, monadTestnet]);
    case 'prod':
      return asNetworkTuple([mainnet, base, arbitrum]);
    case 'local':
    default:
      return asNetworkTuple([sepolia, mainnet, arbitrum, base, anvil]);
  }
}

export const networks = networksForMode(networkMode);

function transportsFor(nets: AppKitNetwork[]): Record<number, Transport> {
  const out: Record<number, Transport> = {};
  for (const net of nets) {
    const id = Number(net.id);
    if (id === anvil.id) {
      out[id] = http('http://127.0.0.1:8545');
    } else if (id === monadTestnet.id) {
      out[id] = http('https://testnet-rpc.monad.xyz');
    } else {
      out[id] = http();
    }
  }
  return out;
}

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: false,
  projectId,
  networks,
  transports: transportsFor(networks),
});

export const config = wagmiAdapter.wagmiConfig;
