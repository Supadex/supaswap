import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, arbitrum, base, localhost } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { cookieStorage, createStorage, http } from 'wagmi';

// Get project ID from environment or fallback to standard public test ID
export const projectId =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string) || 'b56e18d47c72ab683b10814fe9495694';

export const metadata = {
  name: 'SupaDex V4',
  description: 'Multi-Curve AMM with Dynamic LVR Spread Defense & ERC-6909 Vault Claims',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://supadex.fi',
  icons: ['https://supadex.fi/favicon.ico'],
};

// Supported Networks
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  sepolia,
  mainnet,
  arbitrum,
  base,
  localhost,
];

// Set up Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: false,
  projectId,
  networks,
  transports: {
    [sepolia.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [localhost.id]: http('http://127.0.0.1:8545'),
  },
});

export const config = wagmiAdapter.wagmiConfig;
