import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TokenAmountInput } from '../ui/TokenAmountInput';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { TokenLogo } from '../ui/TokenLogo';
import { useToast } from '../ui/Toast';
import { useSupaVault } from '../../hooks/useSupaVault';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import type { ClaimAsset } from './types';

interface DepositClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: ClaimAsset | null;
  /** When provided, user can pick which token to mint claims for */
  selectableTokens?: ClaimAsset[];
  onSuccess?: () => void;
}

export const DepositClaimModal: React.FC<DepositClaimModalProps> = ({
  isOpen,
  onClose,
  token,
  selectableTokens,
  onSuccess,
}) => {
  const { address } = useAccount();
  const { deposit, isWriting } = useSupaVault();
  const { success, error: toastError } = useToast();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  const options = useMemo(
    () => selectableTokens ?? (token ? [token] : []),
    [selectableTokens, token]
  );

  const canSelect = Boolean(selectableTokens && selectableTokens.length > 0);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      return;
    }
    const initial =
      token?.address ??
      selectableTokens?.[0]?.address ??
      '';
    setSelectedAddress(initial);
    setAmount('');
  }, [isOpen, token, selectableTokens]);

  const activeToken = useMemo(() => {
    if (selectedAddress) {
      const found = options.find(
        (t) => t.address.toLowerCase() === selectedAddress.toLowerCase()
      );
      if (found) return found;
    }
    return token ?? options[0] ?? null;
  }, [options, selectedAddress, token]);

  if (!isOpen) return null;
  if (!activeToken) return null;

  const numericAmount = parseFloat(amount) || 0;
  const usdValue = (numericAmount * activeToken.priceUSD).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const walletBalanceNum =
    parseFloat(activeToken.walletBalance.replace(/,/g, '')) || 0;
  const isExceedingBalance = numericAmount > walletBalanceNum;
  const isZero = numericAmount <= 0;

  const handlePercentage = (pct: number) => {
    if (walletBalanceNum <= 0) return;
    const calculated = ((walletBalanceNum * pct) / 100).toFixed(4);
    setAmount(calculated);
  };

  const handleDeposit = async () => {
    if (!address) {
      toastError('Wallet Required', 'Please connect your Web3 wallet to mint claims.');
      return;
    }
    if (isZero || isExceedingBalance) return;

    try {
      setIsSubmitting(true);
      const parsedAmount = parseUnits(amount, activeToken.decimals);
      await deposit(activeToken.address, address, parsedAmount);

      success(
        'Claim Minted',
        `Minted ${amount} ${activeToken.symbol} ERC-6909 Vault Claim credits.`
      );
      setAmount('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toastError('Deposit Failed', err?.shortMessage || err?.message || 'Transaction rejected');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectOptions = options.map((t) => ({
    value: t.address,
    label: `${t.symbol} — ${t.name}`,
    description: `Wallet: ${t.walletBalance}`,
    icon: (
      <TokenLogo
        symbol={t.symbol}
        address={t.address}
        logoURI={t.logoURI}
        size="xs"
      />
    ),
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mint ERC-6909 Claim"
      description="Deposit physical ERC-20 tokens into SupaVault to receive gasless internal accounting credits."
      maxWidth="md"
    >
      <div className="space-y-5 pt-1">
        {canSelect ? (
          <Select
            label="Token"
            options={selectOptions}
            value={selectedAddress}
            onChange={(v) => {
              setSelectedAddress(v);
              setAmount('');
            }}
            placeholder="Select a token to mint…"
            disabled={isSubmitting || isWriting}
          />
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <TokenLogo
                symbol={activeToken.symbol}
                address={activeToken.address}
                logoURI={activeToken.logoURI}
                size="md"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-neutral-900 dark:text-white text-sm">
                    {activeToken.name}
                  </span>
                  <Badge variant="default" size="sm" className="font-mono text-[9px]">
                    ERC-6909
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  {activeToken.symbol}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Wallet Available</div>
              <div className="text-sm font-mono font-medium text-neutral-900 dark:text-white">
                {activeToken.walletBalance} {activeToken.symbol}
              </div>
            </div>
          </div>
        )}

        {canSelect && (
          <div className="flex items-center justify-between px-0.5 -mt-2">
            <span className="text-[11px] text-neutral-500">Wallet available</span>
            <span className="text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
              {activeToken.walletBalance} {activeToken.symbol}
            </span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Deposit Amount
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
              tokenSymbol={activeToken.symbol}
              usdValue={numericAmount > 0 ? usdValue : undefined}
              balance={activeToken.walletBalance}
              onMaxClick={() => handlePercentage(100)}
              onHalfClick={() => handlePercentage(50)}
              disabled={isSubmitting || isWriting}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/80 dark:border-white/[0.06] space-y-2.5">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
            <span>Ledger State Transition</span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 1:1 Pegged
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-white/[0.04]">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Physical ERC-20</span>
              <span className="font-mono text-neutral-900 dark:text-neutral-200">
                - {numericAmount > 0 ? numericAmount.toFixed(4) : '0.0000'} {activeToken.symbol}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-white/[0.04]">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">
                ERC-6909 Claim
              </span>
              <span className="font-mono text-neutral-900 dark:text-neutral-100 font-semibold">
                + {numericAmount > 0 ? numericAmount.toFixed(4) : '0.0000'} {activeToken.symbol}
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-neutral-400" /> SupaVault Custody
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              0-gas swap hops enabled
            </span>
          </div>
        </div>

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
            onClick={handleDeposit}
            isLoading={isSubmitting || isWriting}
            disabled={isZero || isExceedingBalance || isSubmitting || isWriting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isExceedingBalance
              ? 'Insufficient Balance'
              : isZero
              ? 'Enter Amount'
              : 'Confirm Mint'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
