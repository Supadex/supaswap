import React from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useTheme } from '../../context/useTheme';
import { Button } from '../ui/Button';
import { Sun, Moon, Globe, ChevronDown, Wallet, LogOut } from 'lucide-react';

export type NavPage =
  | 'swap'
  | 'pools'
  | 'new_position'
  | 'positions'
  | 'position_detail'
  | 'pool_detail'
  | 'claims'
  | 'explore';

export interface NavbarProps {
  activePage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onPageChange,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { address, isConnected, chain } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  const navItems: { id: NavPage; label: string; badge?: string }[] = [
    { id: 'swap', label: 'Swap' },
    { id: 'pools', label: 'Pools' },
    { id: 'positions', label: 'Positions' },
    { id: 'claims', label: 'Vault Claims', badge: '6909' },
    { id: 'explore', label: 'Explore' },
  ];

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#08090B]/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6 md:gap-8">
          <button
            onClick={() => onPageChange('swap')}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
          >
            <img
              src="/assets/images/supadao-logo.png"
              alt="SupaDex Logo"
              className="w-8 h-8 rounded-lg object-contain transform group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-lg tracking-tight text-neutral-900 dark:text-white">
                SupaDex
              </span>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-white/[0.08]'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Network Selector, Theme Switch & Connect Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Network Pill */}
          <button
            type="button"
            onClick={() => open({ view: 'Networks' })}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span>{chain?.name || 'Ethereum'}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] transition-all cursor-pointer active:scale-95"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-700" />
            )}
          </button>

          {/* Wallet Connect Button */}
          {isConnected && address ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => open({ view: 'Account' })}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-medium hover:bg-emerald-500/15 transition-colors cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{truncatedAddress}</span>
              </button>
              <button
                type="button"
                onClick={() => disconnect()}
                title="Disconnect wallet"
                className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Wallet className="w-3.5 h-3.5" />}
              onClick={() => open()}
              className="font-medium text-xs sm:text-sm px-3.5 py-1.5 rounded-xl"
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex md:hidden items-center justify-around px-2 py-2 border-t border-black/[0.04] dark:border-white/[0.04] overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap ${
                isActive
                  ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-white/[0.08]'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
