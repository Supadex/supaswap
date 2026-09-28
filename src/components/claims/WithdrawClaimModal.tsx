import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TokenAmountInput } from '../ui/TokenAmountInput';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { useSupaVault } from '../../hooks/useSupaVault';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';
import { Wallet, CheckCircle2, ArrowRight } from 'lucide-react';

interface WithdrawClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    symbol: string;
    name: string;
    address: `0x${string}`;
    decimals: number;
    walletBalance: string;
    claimBalance: string;
    priceUSD: number;
  } | null;
  onSuccess?: () => void;
}

export const WithdrawClaimModal: React.FC<WithdrawClaimModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const { address } = useAccount();
  const { withdraw, isWriting } = useSupaVault();
  const { success, error: toastError } = useToast();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) return null;

  const numericAmount = parseFloat(amount) || 0;
  const usdValue = (numericAmount * token.priceUSD).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const claimBalanceNum = parseFloat(token.claimBalance.replace(/,/g, '')) || 0;
  const isExceedingBalance = numericAmount > claimBalanceNum;
  const isZero = numericAmount <= 0;

  const handlePercentage = (pct: number) => {
    if (claimBalanceNum <= 0) return;
    const calculated = ((claimBalanceNum * pct) / 100).toFixed(4);
    setAmount(calculated);
  };

  const handleWithdraw = async () => {
    if (!address) {
      toastError('Wallet Required', 'Please connect your Web3 wallet to redeem claims.');
      return;
    }
    if (isZero || isExceedingBalance) return;

    try {
      setIsSubmitting(true);
      const parsedAmount = parseUnits(amount, token.decimals);
      await withdraw(token.address, address, parsedAmount);

      success(
        'Claim Redeemed',
        `Redeemed ${amount} ${token.symbol} ERC-6909 claims for physical ERC-20 tokens.`
      );
      setAmount('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toastError('Redeem Failed', err?.shortMessage || err?.message || 'Transaction rejected');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Redeem Physical Tokens"
      description="Burn ERC-6909 internal vault claims to withdraw native ERC-20 tokens to your wallet."
      maxWidth="md"
    >
      <div className="space-y-5 pt-1">
        {/* Token Info Header */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-neutral-800 dark:text-white border border-neutral-300 dark:border-white/10">
              {token.symbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {token.name}
                </span>
                <Badge variant="purple" size="sm" className="font-mono text-[9px]">
                  ERC-6909
                </Badge>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {token.symbol}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Claims Available</div>
            <div className="text-sm font-mono font-semibold text-purple-600 dark:text-purple-400">
              {token.claimBalance} {token.symbol}
            </div>
          </div>
        </div>

        {/* Input Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Redeem Amount
            </label>
            <div className="flex items-center gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentage(pct)}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-white/[0.06] dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <TokenAmountInput
              value={amount}
              onChange={setAmount}
              tokenSymbol={token.symbol}
              usdValue={numericAmount > 0 ? usdValue : undefined}
              balance={token.claimBalance}
              isVaultClaim={true}
              onMaxClick={() => handlePercentage(100)}
              onHalfClick={() => handlePercentage(50)}
              disabled={isSubmitting || isWriting}
            />
          </div>
        </div>

        {/* Accounting Flow Preview */}
        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06] space-y-2.5">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
            <span>Ledger State Transition</span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 1:1 Instant Payout
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-white/[0.04]">
              <span className="text-[10px] text-purple-500 dark:text-purple-400 block mb-0.5">ERC-6909 Burned</span>
              <span className="font-mono text-purple-600 dark:text-purple-300 font-semibold">
                - {numericAmount > 0 ? numericAmount.toFixed(4) : '0.0000'} {token.symbol}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-white/[0.04]">
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 block mb-0.5">Physical ERC-20</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                + {numericAmount > 0 ? numericAmount.toFixed(4) : '0.0000'} {token.symbol}
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-neutral-400" /> Transferred to Connected Wallet
            </span>
            <span className="font-mono text-neutral-600 dark:text-neutral-300">
              Standard ERC-20 transfer
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting || isWriting}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            className="flex-1"
            onClick={handleWithdraw}
            isLoading={isSubmitting || isWriting}
            disabled={isZero || isExceedingBalance || isSubmitting || isWriting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isExceedingBalance
              ? 'Insufficient Claims'
              : isZero
              ? 'Enter Amount'
              : 'Confirm Redeem'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
