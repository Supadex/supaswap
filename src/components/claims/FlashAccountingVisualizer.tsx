import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const FlashAccountingVisualizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'flow' | 'comparison'>('flow');

  return (
    <Card variant="surface" className="border-neutral-200/80 dark:border-white/[0.08] overflow-hidden">
      <div className="p-5 border-b border-neutral-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              SupaVault Flash Accounting Engine
            </h2>
            <Badge variant="brand" size="sm" className="font-mono text-[10px]">
              EIP-6909 Native
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Netting transient balance deltas directly in EVM transient storage (<code className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">TSTORE/TLOAD</code>) to eliminate intermediate token transfers.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200/60 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'flow'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Transient Flow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'comparison'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Gas Benchmark
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === 'flow' ? (
          <div className="space-y-4">
            {/* Visual Workflow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Step 1</span>
                  <Badge variant="outline" size="sm" className="font-mono text-[9px]">Unlock</Badge>
                </div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-white mb-1">
                  Lock & Take Delta
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Caller acquires the Flash Accounting lock. Internal currency debits are recorded in transient memory without external ERC-20 calls.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Step 2</span>
                  <Badge variant="purple" size="sm" className="font-mono text-[9px]">Multi-Hop</Badge>
                </div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-white mb-1">
                  Multi-Curve Execution
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Swaps route through CLAMM, BinAMM, or StableAMM pools. Intermediate tokens settle as virtual ERC-6909 credits instantly.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Step 3</span>
                  <Badge variant="brand" size="sm" className="font-mono text-[9px]">Net Settle</Badge>
                </div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-white mb-1">
                  Delta Verification
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Vault verifies net currency deltas equal zero. Only net physical tokens are transferred, saving up to 70% in gas costs.
                </p>
              </div>
            </div>

            {/* Bottom Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Average Gas Savings</div>
                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">~68,400 Gas</div>
              </div>
              <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Intermediate ERC-20 Tax</div>
                <div className="text-base font-bold font-mono text-neutral-900 dark:text-white">0.00% (Bypassed)</div>
              </div>
              <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Permit2 Batch Support</div>
                <div className="text-base font-bold font-mono text-purple-600 dark:text-purple-400">1-Signature</div>
              </div>
              <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/[0.04]">
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Transient Netting Safety</div>
                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">Invariant Checked</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Legacy AMM */}
              <div className="p-4 rounded-xl bg-neutral-100/60 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Legacy AMM (Uniswap V3 Style)
                  </span>
                  <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                    3 Physical Transfers
                  </Badge>
                </div>
                <div className="space-y-2 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  <div className="flex justify-between py-1 border-b border-neutral-200/50 dark:border-white/[0.04]">
                    <span>1. Inbound Transfer (Token A)</span>
                    <span>~45,000 gas</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-200/50 dark:border-white/[0.04]">
                    <span>2. Intermediate Hop (Token B)</span>
                    <span>~48,000 gas</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-200/50 dark:border-white/[0.04]">
                    <span>3. Outbound Transfer (Token C)</span>
                    <span>~52,000 gas</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-neutral-900 dark:text-white">
                    <span>Total Estimated Overhead</span>
                    <span>~145,000 gas</span>
                  </div>
                </div>
              </div>

              {/* SupaDex Flash Accounting */}
              <div className="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/[0.04] border border-emerald-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    SupaDex Flash Accounting
                  </span>
                  <Badge variant="brand" size="sm" className="font-mono text-[10px]">
                    1 Net Settlement
                  </Badge>
                </div>
                <div className="space-y-2 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span>1. Inbound Permit2 (Token A)</span>
                    <span>~38,000 gas</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span>2. Internal Claim Netting (Token B)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 gas (TSTORE)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span>3. Outbound Net Settle (Token C)</span>
                    <span>~38,500 gas</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-emerald-700 dark:text-emerald-300">
                    <span>Total Estimated Overhead</span>
                    <span className="text-emerald-600 dark:text-emerald-400">~76,500 gas (-47%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
