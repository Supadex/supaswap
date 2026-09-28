import React, { useState } from 'react';
import { cn } from '../../utils/cn';

interface TokenLogoProps {
  symbol?: string;
  name?: string;
  address?: string;
  logoURI?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Known high-res logos map
const POPULAR_LOGOS: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  WETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  USDT: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  WBTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  DAI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  UNI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
  ARB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  OP: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
  MATIC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
};

const SIZE_MAP = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
  xl: 'w-11 h-11 text-base',
};

export const TokenLogo: React.FC<TokenLogoProps> = ({
  symbol = '???',
  address,
  logoURI,
  size = 'md',
  className,
}) => {
  const [imgError, setImgError] = useState(false);

  const cleanSymbol = symbol.toUpperCase().replace(/^C/, ''); // handle claim tokens like cETH -> ETH
  const primarySrc =
    logoURI ||
    POPULAR_LOGOS[cleanSymbol] ||
    (address && address !== '0x0000000000000000000000000000000000000000'
      ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`
      : undefined);

  if (primarySrc && !imgError) {
    return (
      <img
        src={primarySrc}
        alt={symbol}
        onError={() => setImgError(true)}
        className={cn(
          'rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-white/10 shrink-0',
          SIZE_MAP[size],
          className
        )}
        loading="lazy"
      />
    );
  }

  // Graceful Apple-minimalist fallback glyph with first letter
  const initial = (symbol.trim()[0] || '?').toUpperCase();
  return (
    <div
      className={cn(
        'rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold font-mono flex items-center justify-center border border-neutral-300 dark:border-white/10 select-none shrink-0 shadow-xs',
        SIZE_MAP[size],
        className
      )}
    >
      {initial}
    </div>
  );
};
