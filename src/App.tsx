import React, { useState, Suspense, lazy } from 'react';
import type { Hex } from 'viem';
import { ThemeProvider } from './context/ThemeContext';
import { Web3Provider } from './context/Web3Provider';
import { ToastProvider } from './components/ui/Toast';
import { Navbar, type NavPage } from './components/layout/Navbar';
import { Skeleton } from './components/ui/Skeleton';
import type { TokenMetadata, CurveType } from './contracts/types';

// Dynamic route lazy loading for optimal bundle splitting
const SwapPage = lazy(() => import('./pages/SwapPage').then(m => ({ default: m.SwapPage })));
const PoolsPage = lazy(() => import('./pages/PoolsPage').then(m => ({ default: m.PoolsPage })));
const NewPositionPage = lazy(() => import('./pages/NewPositionPage').then(m => ({ default: m.NewPositionPage })));
const PositionsPage = lazy(() => import('./pages/PositionsPage').then(m => ({ default: m.PositionsPage })));
const PositionDetailPage = lazy(() =>
  import('./pages/PositionDetailPage').then((m) => ({ default: m.PositionDetailPage }))
);
const PoolDetailPage = lazy(() =>
  import('./pages/PoolDetailPage').then((m) => ({ default: m.PoolDetailPage }))
);
const VaultClaimsPage = lazy(() => import('./pages/VaultClaimsPage').then(m => ({ default: m.VaultClaimsPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then(m => ({ default: m.ExplorePage })));

interface NewPositionInitState {
  token0?: TokenMetadata;
  token1?: TokenMetadata;
  curveType?: CurveType;
  feeTier?: number;
  plugin?: `0x${string}`;
  tickSpacing?: number;
}

const PageFallback: React.FC = () => (
  <div className="w-full max-w-6xl mx-auto py-12 px-4 sm:px-6 space-y-6 animate-pulse">
    <div className="flex justify-between items-center">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-8 w-32 rounded-lg" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
    <Skeleton className="h-96 rounded-2xl w-full" />
  </div>
);

const AppContent: React.FC = () => {
  const [activePage, setActivePage] = useState<NavPage>('swap');
  const [newPositionParams, setNewPositionParams] = useState<NewPositionInitState>({});
  const [detailTokenId, setDetailTokenId] = useState<bigint | null>(null);
  const [detailPoolId, setDetailPoolId] = useState<Hex | null>(null);

  const handleNavigateNewPosition = (
    token0?: TokenMetadata,
    token1?: TokenMetadata,
    curveType?: CurveType,
    feeTier?: number,
    plugin?: `0x${string}`,
    tickSpacing?: number
  ) => {
    setNewPositionParams({
      token0,
      token1,
      curveType,
      feeTier,
      plugin,
      tickSpacing,
    });
    setActivePage('new_position');
  };

  const handleNavigatePositionDetail = (tokenId: bigint) => {
    setDetailTokenId(tokenId);
    setDetailPoolId(null);
    setActivePage('position_detail');
  };

  const handleNavigatePoolDetail = (poolId: string) => {
    setDetailPoolId(poolId as Hex);
    setDetailTokenId(null);
    setActivePage('pool_detail');
  };

  const handlePageChange = (page: NavPage) => {
    if (page !== 'position_detail') setDetailTokenId(null);
    if (page !== 'pool_detail') setDetailPoolId(null);
    setActivePage(page);
  };

  const navbarPage: NavPage =
    activePage === 'position_detail'
      ? 'positions'
      : activePage === 'pool_detail' || activePage === 'new_position'
        ? 'pools'
        : activePage;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#08090B] text-neutral-900 dark:text-white transition-colors duration-200 selection:bg-emerald-500/20 selection:text-emerald-500">
      <Navbar activePage={navbarPage} onPageChange={handlePageChange} />

      <main className="flex-1 flex flex-col">
        <Suspense fallback={<PageFallback />}>
          {activePage === 'swap' && <SwapPage />}
          {activePage === 'pools' && (
            <PoolsPage
              onNavigateNewPosition={handleNavigateNewPosition}
              onNavigatePoolDetail={handleNavigatePoolDetail}
            />
          )}
          {activePage === 'new_position' && (
            <NewPositionPage
              onBack={() => setActivePage('pools')}
              initialToken0={newPositionParams.token0}
              initialToken1={newPositionParams.token1}
              initialCurve={newPositionParams.curveType}
              initialFeeTier={newPositionParams.feeTier}
              initialPlugin={newPositionParams.plugin}
              initialTickSpacing={newPositionParams.tickSpacing}
            />
          )}
          {activePage === 'positions' && (
            <PositionsPage
              onNavigateNewPosition={() => handleNavigateNewPosition()}
              onNavigateDetail={handleNavigatePositionDetail}
            />
          )}
          {activePage === 'position_detail' && detailTokenId !== null && (
            <PositionDetailPage
              tokenId={detailTokenId}
              onBack={() => {
                setDetailTokenId(null);
                setActivePage('positions');
              }}
            />
          )}
          {activePage === 'pool_detail' && detailPoolId !== null && (
            <PoolDetailPage
              poolId={detailPoolId}
              onBack={() => {
                setDetailPoolId(null);
                setActivePage('pools');
              }}
              onAddLiquidity={handleNavigateNewPosition}
            />
          )}
          {activePage === 'claims' && <VaultClaimsPage />}
          {activePage === 'explore' && <ExplorePage />}
        </Suspense>
      </main>

      <footer className="w-full border-t border-black/[0.06] dark:border-white/[0.08] py-6 px-4 sm:px-6 bg-white/50 dark:bg-[#08090B]/50 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-neutral-900 dark:text-white">SupaDex</span>
            <span>•</span>
            <span>Multi-Curve AMM & Dynamic LVR Engine</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setActivePage('swap')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Swap
            </button>
            <button
              onClick={() => setActivePage('pools')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Pools
            </button>
            <button
              onClick={() => setActivePage('claims')}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              ERC-6909 Claims
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <Web3Provider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}

export default App;
