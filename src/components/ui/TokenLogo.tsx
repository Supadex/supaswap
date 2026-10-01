import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { zeroAddress } from 'viem';
import {
  normalizeLogoSymbol,
  popularLogoForSymbol,
  trustWalletLogoUrl,
} from '../../utils/tokenLogo';

interface TokenLogoProps {
  symbol?: string;
  name?: string;
  address?: string;
  logoURI?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

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
  const cleanSymbol = normalizeLogoSymbol(symbol);
  const isNative =
    !address ||
    address.toLowerCase() === zeroAddress ||
    cleanSymbol === 'ETH';

  const candidates = useMemo(() => {
    const list: string[] = [];
    const popular = popularLogoForSymbol(cleanSymbol);
    // Prefer known CDN logos (especially native ETH) over potentially-broken logoURI
    if (popular) list.push(popular);
    if (logoURI && logoURI !== popular) list.push(logoURI);
    if (address && !isNative) {
      const tw = trustWalletLogoUrl(address);
      if (tw && !list.includes(tw)) list.push(tw);
    }
    return list;
  }, [cleanSymbol, logoURI, address, isNative]);

  const [srcIndex, setSrcIndex] = useState(0);

  // Reset load state whenever the token identity changes
  useEffect(() => {
    setImgError(false);
    setSrcIndex(0);
  }, [symbol, address, logoURI]);

  const primarySrc =
    !imgError && candidates.length > 0
      ? candidates[Math.min(srcIndex, candidates.length - 1)]
      : undefined;

  if (primarySrc) {
    return (
      <img
        key={`${symbol}-${address}-${srcIndex}`}
        src={primarySrc}
        alt={symbol}
        referrerPolicy="no-referrer"
        onError={() => {
          if (srcIndex + 1 < candidates.length) {
            setSrcIndex((i) => i + 1);
          } else {
            setImgError(true);
          }
        }}
        className={cn(
          'rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-white/10 shrink-0',
          SIZE_MAP[size],
          className
        )}
        loading="lazy"
      />
    );
  }

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
