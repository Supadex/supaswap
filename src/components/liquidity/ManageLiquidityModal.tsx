import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TokenAmountInput } from '../ui/TokenAmountInput';
import { Slider } from '../ui/Slider';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { useToast } from '../ui/Toast';
import { usePositions, type PositionDetail } from '../../hooks/usePositions';
import {
  Plus,
  Minus,
  Coins,
} from 'lucide-react';

interface ManageLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PositionDetail | null;
  initialMode?: 'increase' | 'decrease';
}

export const ManageLiquidityModal: React.FC<ManageLiquidityModalProps> = ({
  isOpen,
  onClose,
  position,
  initialMode = 'increase',
}) => {
  const [mode, setMode] = useState<'increase' | 'decrease'>(initialMode);
  const [removePercent, setRemovePercent] = useState<number>(50);
  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');
  const [useClaims, setUseClaims] = useState<boolean>(false);
  const [collectWithWithdraw, setCollectWithWithdraw] = useState<boolean>(true);

  const { increaseLiquidity, decreaseLiquidity, isManaging } = usePositions();
  const { info, success, error, warning } = useToast();

  if (!position) return null;

  // Calculate estimated returns for decrease
  const token0Estimated = (
    (parseFloat(position.amount0.replace(/,/g, '') || '0') * removePercent) /
    100
  ).toFixed(4);
  const token1Estimated = (
    (parseFloat(position.amount1.replace(/,/g, '') || '0') * removePercent) /
    100
  ).toFixed(4);

  const handleIncrease = async () => {
    if (!amount0 && !amount1) {
      warning('Enter Amount', 'Please specify an amount of liquidity to add.');
      return;
    }

    try {
      info(
        'Adding Liquidity',
        `Increasing liquidity for position #${position.tokenId.toString()}...`
      );

      const hash = await increaseLiquidity({
        tokenId: position.tokenId,
        amount0Desired: amount0 || '0',
        amount1Desired: amount1 || '0',
        amount0Decimals: position.token0.decimals,
        amount1Decimals: position.token1.decimals,
      });

      success('Liquidity Added', `Successfully added liquidity (Tx: ${hash.slice(0, 10)}...)`);
      onClose();
    } catch (err: unknown) {
      error(
        'Transaction Failed',
        err instanceof Error ? err.message : 'Could not add liquidity'
      );
    }
  };

  const handleDecrease = async () => {
    try {
      info(
        'Removing Liquidity',
        `Withdrawing ${removePercent}% of liquidity from position #${position.tokenId.toString()}...`
      );

      const hash = await decreaseLiquidity({
        tokenId: position.tokenId,
        liquidityPercent: removePercent,
      });

      success(
        'Liquidity Removed',
        `Withdrew ${removePercent}% liquidity${
          collectWithWithdraw ? ' and collected unearned fees' : ''
        } (Tx: ${hash.slice(0, 10)}...)`
      );
      onClose();
    } catch (err: unknown) {
      error(
        'Withdrawal Failed',
        err instanceof Error ? err.message : 'Could not remove liquidity'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="md"
    >
      <div className="space-y-5 pt-1">
        {/* Top Switcher Segment */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-neutral-900 dark:text-white">
              {position.pair}
            </span>
            <Badge variant="default" size="sm" className="font-mono">
              #{position.tokenId.toString()}
            </Badge>
          </div>

          <div className="flex p-1 bg-neutral-100 dark:bg-white/[0.04] rounded-xl">
            <button
              onClick={() => setMode('increase')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'increase'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Add
            </button>
            <button
              onClick={() => setMode('decrease')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'decrease'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Remove
            </button>
          </div>
        </div>

        {/* MODE: INCREASE LIQUIDITY */}
        {mode === 'increase' && (
          <div className="space-y-4">
            <div className="p-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04] rounded-xl text-xs flex justify-between">
              <span className="text-neutral-500">Current Position Value</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                {position.liquidityUSD}
              </span>
            </div>

            <TokenAmountInput
              tokenSymbol={position.token0.symbol}
              value={amount0}
              onChange={(val) => {
                setAmount0(val);
                // Simple proportional estimate if numeric
                const num = parseFloat(val);
                if (!isNaN(num) && num > 0) {
                  const ratio =
                    parseFloat(position.amount1.replace(/,/g, '') || '1') /
                    parseFloat(position.amount0.replace(/,/g, '') || '1');
                  setAmount1((num * ratio).toFixed(4));
                }
              }}
              label={`Deposit ${position.token0.symbol}`}
              balance="12.50"
            />

            <TokenAmountInput
              tokenSymbol={position.token1.symbol}
              value={amount1}
              onChange={(val) => setAmount1(val)}
              label={`Deposit ${position.token1.symbol}`}
              balance="38,420.00"
            />

            {/* Dual Ledger Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-white">
                  Use Internal Vault Claims (ERC-6909)
                </div>
                <div className="text-[11px] text-neutral-500">
                  Save gas by depositing from your protocol claim balance
                </div>
              </div>
              <Toggle checked={useClaims} onChange={setUseClaims} size="sm" />
            </div>

            <Button
              variant="brand"
              size="lg"
              className="w-full"
              isLoading={isManaging}
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleIncrease}
            >
              Increase Liquidity
            </Button>
          </div>
        )}

        {/* MODE: DECREASE LIQUIDITY */}
        {mode === 'decrease' && (
          <div className="space-y-4">
            <div className="p-4 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04] rounded-2xl text-center space-y-3">
              <div className="text-4xl font-extrabold font-mono text-neutral-900 dark:text-white">
                {removePercent}%
              </div>
              <div className="text-xs text-neutral-500">Amount of Liquidity to Remove</div>

              <Slider
                value={removePercent}
                onChange={setRemovePercent}
                min={1}
                max={100}
                step={1}
                className="py-2"
              />

              {/* Quick Percent Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setRemovePercent(pct)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      removePercent === pct
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-neutral-200 dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-white/[0.04] text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {pct === 100 ? 'Max' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Output Card */}
            <div className="p-3.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04] rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span>You will receive:</span>
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="flex justify-between font-mono font-medium text-neutral-900 dark:text-white">
                <span>{position.token0.symbol}:</span>
                <span>~{token0Estimated}</span>
              </div>
              <div className="flex justify-between font-mono font-medium text-neutral-900 dark:text-white">
                <span>{position.token1.symbol}:</span>
                <span>~{token1Estimated}</span>
              </div>
            </div>

            {/* Collect Fees Automatically Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-white">
                  Collect Unclaimed Fees ({position.uncollectedFeesUSD})
                </div>
                <div className="text-[11px] text-neutral-500">
                  Harvest accumulated fees in the same transaction
                </div>
              </div>
              <Toggle
                checked={collectWithWithdraw}
                onChange={setCollectWithWithdraw}
                size="sm"
              />
            </div>

            <Button
              variant="danger"
              size="lg"
              className="w-full"
              isLoading={isManaging}
              leftIcon={<Minus className="w-4 h-4" />}
              onClick={handleDecrease}
            >
              Remove Liquidity ({removePercent}%)
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
