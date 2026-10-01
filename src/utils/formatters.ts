/**
 * Shorten an Ethereum address to 0x1234...5678 format
 */
export function shortenAddress(address?: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format numbers with high precision and compact notation when large
 */
export function formatAmount(value: number | string | bigint, decimals = 4): string {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'bigint' ? Number(value) : Number(value);
  if (isNaN(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format USD currency values
 */
export function formatUSD(value: number | string | bigint): string {
  if (value === undefined || value === null || value === '') return '$0.00';
  const num = typeof value === 'bigint' ? Number(value) : Number(value);
  if (isNaN(num)) return '$0.00';

  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format percentages (e.g. APR, Slippage, Dynamic Fee)
 */
export function formatPercent(value: number | string, decimals = 2): string {
  const num = Number(value);
  if (isNaN(num)) return '0.00%';
  return `${num >= 0 ? '' : ''}${num.toFixed(decimals)}%`;
}

/** Block explorer origin for a chain, or null when none (e.g. Anvil). */
export function getExplorerBaseUrl(chainId?: number): string | null {
  switch (chainId) {
    case 1:
      return 'https://etherscan.io';
    case 11155111:
      return 'https://sepolia.etherscan.io';
    case 8453:
      return 'https://basescan.org';
    case 42161:
      return 'https://arbiscan.io';
    case 31337:
      return null;
    default:
      return chainId ? null : 'https://etherscan.io';
  }
}

export function getExplorerAddressUrl(address?: string, chainId?: number): string | null {
  if (!address) return null;
  const base = getExplorerBaseUrl(chainId);
  if (!base) return null;
  return `${base}/address/${address}`;
}

export function getExplorerNftUrl(
  contract?: string,
  tokenId?: string | bigint | number,
  chainId?: number
): string | null {
  if (!contract || tokenId === undefined || tokenId === null) return null;
  const base = getExplorerBaseUrl(chainId);
  if (!base) return null;
  return `${base}/nft/${contract}/${tokenId.toString()}`;
}

export function getExplorerTxUrl(hash?: string, chainId?: number): string | null {
  if (!hash) return null;
  const base = getExplorerBaseUrl(chainId);
  if (!base) return null;
  return `${base}/tx/${hash}`;
}

/** Relative age for activity feeds (e.g. "2m ago"). */
export function formatTimeAgo(timestampSec: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const delta = Math.max(0, nowSec - timestampSec);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 86400 * 30) return `${Math.floor(delta / 86400)}d ago`;
  return `${Math.floor(delta / (86400 * 30))}mo ago`;
}
