import React, { useMemo } from 'react';
import { CurveType } from '../../contracts/types';
import { int24ToBinId } from '../../utils/poolMath';

export interface PositionNFTArtProps {
  tokenId: bigint | number | string;
  symbol0: string;
  symbol1: string;
  curveType: CurveType;
  feeTier: string;
  tickLower: number;
  tickUpper: number;
  currency0?: string;
  currency1?: string;
  className?: string;
}

function accentForCurve(curveType: CurveType): string {
  if (curveType === CurveType.BIN_AMM) return '#FBBF24';
  if (curveType === CurveType.STABLE_AMM) return '#94A3B8';
  return '#34D399';
}

function curveLabel(curveType: CurveType): string {
  if (curveType === CurveType.BIN_AMM) return 'BinAMM';
  if (curveType === CurveType.STABLE_AMM) return 'StableAMM';
  return 'CLAMM';
}

function rangeArc(
  tickLower: number,
  tickUpper: number,
  curveType: CurveType
): { startDeg: number; spanDeg: number } {
  if (curveType === CurveType.BIN_AMM) return { startDeg: 210, spanDeg: 40 };
  if (curveType === CurveType.STABLE_AMM) return { startDeg: 160, spanDeg: 80 };
  const span = Math.abs(tickUpper - tickLower);
  if (span > 1_000_000) return { startDeg: 40, spanDeg: 300 };
  let mapped = Math.floor(span / 400);
  if (mapped < 24) mapped = 24;
  if (mapped > 300) mapped = 300;
  const startDeg = 40 + (Math.abs(tickLower) % 200);
  return { startDeg, spanDeg: mapped };
}

function hashSeed(tokenId: string, c0: string, c1: string): number[] {
  const s = `${tokenId}:${c0}:${c1}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bytes: number[] = [];
  let x = h >>> 0;
  for (let i = 0; i < 16; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    bytes.push(x & 0xff);
  }
  return bytes;
}

/**
 * Client-side Obsidian Lattice art — mirrors on-chain NFTSVGLib for wallets/detail UI.
 */
export const PositionNFTArt: React.FC<PositionNFTArtProps> = ({
  tokenId,
  symbol0,
  symbol1,
  curveType,
  feeTier,
  tickLower,
  tickUpper,
  currency0 = '',
  currency1 = '',
  className,
}) => {
  const id = tokenId.toString();
  const accent = accentForCurve(curveType);
  const label = curveLabel(curveType);
  const { startDeg, spanDeg } = rangeArc(tickLower, tickUpper, curveType);
  const circ = 804;
  const dash = Math.max(20, Math.floor((spanDeg * circ) / 360));
  const gap = circ - dash;

  const stars = useMemo(() => {
    const bytes = hashSeed(id, currency0, currency1);
    return Array.from({ length: 7 }, (_, i) => {
      const b0 = bytes[i] ?? 0;
      const b1 = bytes[i + 7] ?? 0;
      return {
        x: 56 + (b0 % 400),
        y: 56 + (b1 % 360),
        r: 1 + (b0 % 2),
        op: (18 + (b1 % 40)) / 100,
      };
    });
  }, [id, currency0, currency1]);

  const tickLine =
    curveType === CurveType.BIN_AMM
      ? `BIN ${int24ToBinId(tickLower)}`
      : `TICKS ${tickLower} -> ${tickUpper}`;

  const gid = `nft-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label={`SupaDex ${label} position ${symbol0}/${symbol1} #${id}`}
    >
      <defs>
        <radialGradient id={`${gid}-bg`} cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#16181D" />
          <stop offset="55%" stopColor="#0C0D10" />
          <stop offset="100%" stopColor="#08090B" />
        </radialGradient>
        <linearGradient id={`${gid}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8EAED" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${gid}-glow`}>
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="512" height="512" fill={`url(#${gid}-bg)`} />
      <rect
        x="18"
        y="18"
        width="476"
        height="476"
        rx="28"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        fill="none"
      />
      <rect
        x="28"
        y="28"
        width="456"
        height="456"
        rx="22"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
        fill="none"
      />

      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#E2E8F0" fillOpacity={s.op} />
      ))}

      <circle cx="256" cy="236" r="128" stroke="rgba(148,163,184,0.14)" strokeWidth="1.25" fill="none" />
      <circle cx="256" cy="236" r="96" stroke="rgba(148,163,184,0.08)" strokeWidth="1" fill="none" />

      <circle
        cx="256"
        cy="236"
        r="128"
        stroke={`url(#${gid}-ring)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${gid}-glow)`}
        strokeDasharray={`${dash} ${gap}`}
        transform={`rotate(${startDeg} 256 236)`}
      />
      <circle
        cx="256"
        cy="236"
        r="128"
        stroke={accent}
        strokeOpacity="0.55"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${gap}`}
        transform={`rotate(${startDeg} 256 236)`}
      />

      <circle cx="256" cy="236" r="6" fill={accent} filter={`url(#${gid}-glow)`} />
      <circle cx="256" cy="236" r="2.5" fill="#F8FAFC" />

      {curveType === CurveType.BIN_AMM ? (
        <g transform="translate(400 52)" stroke={accent} strokeWidth="1.4" fill="none" opacity="0.9">
          <rect x="0" y="0" width="14" height="14" rx="2" />
          <rect x="18" y="0" width="14" height="14" rx="2" />
          <rect x="0" y="18" width="14" height="14" rx="2" />
          <rect x="18" y="18" width="14" height="14" rx="2" fill={accent} fillOpacity="0.35" />
        </g>
      ) : curveType === CurveType.STABLE_AMM ? (
        <g transform="translate(402 58)" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.95">
          <ellipse cx="14" cy="14" rx="16" ry="9" />
          <ellipse cx="14" cy="14" rx="9" ry="16" />
        </g>
      ) : (
        <g transform="translate(404 54)" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.95">
          <path d="M4 28 L18 4 L32 28" />
          <path d="M10 28 L18 14 L26 28" opacity="0.55" />
        </g>
      )}

      <text
        x="44"
        y="64"
        fill="#F8FAFC"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="15"
        fontWeight="700"
        letterSpacing="2"
      >
        SUPADEX
      </text>
      <text
        x="44"
        y="86"
        fill="#64748B"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
        letterSpacing="1.5"
      >
        POSITION LATTICE
      </text>
      <text
        x="468"
        y="64"
        textAnchor="end"
        fill="#94A3B8"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="12"
      >
        #{id}
      </text>

      <text
        x="256"
        y="400"
        textAnchor="middle"
        fill="#F8FAFC"
        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
        fontSize="28"
        fontWeight="700"
      >
        {symbol0} / {symbol1}
      </text>

      <rect
        x="118"
        y="420"
        width="110"
        height="28"
        rx="8"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.08)"
      />
      <text
        x="173"
        y="439"
        textAnchor="middle"
        fill={accent}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
        fontWeight="600"
      >
        {label}
      </text>
      <rect
        x="240"
        y="420"
        width="72"
        height="28"
        rx="8"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.08)"
      />
      <text
        x="276"
        y="439"
        textAnchor="middle"
        fill="#CBD5E1"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="11"
        fontWeight="600"
      >
        {feeTier}
      </text>
      <rect
        x="324"
        y="420"
        width="70"
        height="28"
        rx="8"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.08)"
      />
      <text
        x="359"
        y="439"
        textAnchor="middle"
        fill="#94A3B8"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10"
      >
        LP NFT
      </text>

      <text
        x="256"
        y="472"
        textAnchor="middle"
        fill="#475569"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10"
      >
        {tickLine}
      </text>
    </svg>
  );
};

export default PositionNFTArt;
