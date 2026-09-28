import React, { useEffect, useRef } from 'react';
import { createAppKit, useAppKitTheme } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, networks, projectId, wagmiAdapter } from '../config/wagmi';
import { useTheme } from './useTheme';

// Initialize React Query Client with optimal caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10_000,
      retry: 1,
    },
  },
});

// Initialize Reown AppKit Modal with Apple-minimalist theme overrides
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'SupaDex V4',
    description: 'Multi-Curve AMM with Dynamic LVR Spread Defense & ERC-6909 Vault Claims',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://supadex.fi',
    icons: ['https://supadex.fi/favicon.ico'],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e',
    '--w3m-border-radius-master': '1.25px',
    '--w3m-font-family': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

// Synchronize Reown AppKit Theme with App Light/Dark Theme safely without re-render loops
const AppKitThemeSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const { themeMode, setThemeMode } = useAppKitTheme();
  const lastSyncedTheme = useRef<string | null>(null);

  useEffect(() => {
    if (lastSyncedTheme.current !== resolvedTheme && themeMode !== resolvedTheme) {
      lastSyncedTheme.current = resolvedTheme;
      setThemeMode(resolvedTheme);
    }
  }, [resolvedTheme, themeMode, setThemeMode]);

  return <>{children}</>;
};

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppKitThemeSync>
          {children}
        </AppKitThemeSync>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
