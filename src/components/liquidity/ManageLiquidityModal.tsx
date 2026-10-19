import React, { useState, useEffect, useMemo } from "react";
import { parseUnits, zeroAddress } from "viem";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TokenAmountInput } from "../ui/TokenAmountInput";
import { Slider } from "../ui/Slider";
import { Badge } from "../ui/Badge";
import { Toggle } from "../ui/Toggle";
import { TokenLogo } from "../ui/TokenLogo";
import { useToast } from "../ui/Toast";
import { usePositions, type PositionDetail } from "../../hooks/usePositions";
import { useTokenWalletBalance } from "../../hooks/useTokenWalletBalance";
import { usePoolManager } from "../../hooks/usePoolManager";
import { useAntiJitResidency } from "../../hooks/useAntiJitResidency";
import { CurveType, type PoolKey } from "../../contracts/types";
import { getLiquidityForAmounts } from "../../utils/poolMath";
import { formatSwapError } from "../../hooks/useSupaRouter";
import { Plus, Minus, Coins } from "lucide-react";

interface ManageLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PositionDetail | null;
  initialMode?: "increase" | "decrease";
}

function parseHumanAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.eE+-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Human token1 per token0 from position inventory or USD mid. */
function depositRatio(position: PositionDetail): number {
  const a0 = parseHumanAmount(position.amount0);
  const a1 = parseHumanAmount(position.amount1);
  if (a0 > 0 && a1 > 0) return a1 / a0;

  const p0 = position.token0.priceUSD || 0;
  const p1 = position.token1.priceUSD || 0;
  if (p0 > 0 && p1 > 0) return p0 / p1; // equal-USD deposit: a1 = a0 * (p0/p1)

  return 1;
}

export const ManageLiquidityModal: React.FC<ManageLiquidityModalProps> = ({
  isOpen,
  onClose,
  position,
  initialMode = "increase",
}) => {
  const [mode, setMode] = useState<"increase" | "decrease">(initialMode);
  const [removePercent, setRemovePercent] = useState<number>(50);
  const [amount0, setAmount0] = useState<string>("");
  const [amount1, setAmount1] = useState<string>("");
  const [useClaims, setUseClaims] = useState<boolean>(false);
  const [collectWithWithdraw, setCollectWithWithdraw] = useState<boolean>(true);

  const { increaseLiquidity, decreaseLiquidity, isManaging } = usePositions();
  const { getPoolSqrtPrice } = usePoolManager();
  const { info, success, error, warning } = useToast();
  const antiJit = useAntiJitResidency(
    position
      ? {
          hooks: position.hooks,
          currency0: position.token0.address,
          currency1: position.token1.address,
          fee: position.feeNumber,
          tickSpacing: position.tickSpacing ?? 60,
          curveType: position.curveType,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          tokenId: position.tokenId,
        }
      : {},
  );

  const balance0 = useTokenWalletBalance(
    position?.token0 ?? {
      address: zeroAddress,
      symbol: "",
      name: "",
      decimals: 18,
      priceUSD: 0,
    },
  );
  const balance1 = useTokenWalletBalance(
    position?.token1 ?? {
      address: zeroAddress,
      symbol: "",
      name: "",
      decimals: 18,
      priceUSD: 0,
    },
  );

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAmount0("");
      setAmount1("");
      setRemovePercent(50);
    }
  }, [isOpen, initialMode]);

  const ratio = useMemo(
    () => (position ? depositRatio(position) : 1),
    [position],
  );

  if (!position) return null;

  const token0Estimated = (
    (parseHumanAmount(position.amount0) * removePercent) /
    100
  ).toFixed(4);
  const token1Estimated = (
    (parseHumanAmount(position.amount1) * removePercent) /
    100
  ).toFixed(4);

  const handleAmount0Change = (val: string) => {
    setAmount0(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && Number.isFinite(ratio) && ratio > 0) {
      const paired = num * ratio;
      if (Number.isFinite(paired)) {
        setAmount1(paired.toFixed(position.token1.decimals > 6 ? 6 : 4));
      }
    } else if (val === "" || num === 0) {
      setAmount1("");
    }
  };

  const handleAmount1Change = (val: string) => {
    setAmount1(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && Number.isFinite(ratio) && ratio > 0) {
      const paired = num / ratio;
      if (Number.isFinite(paired)) {
        setAmount0(paired.toFixed(position.token0.decimals > 6 ? 6 : 4));
      }
    } else if (val === "" || num === 0) {
      setAmount0("");
    }
  };

  const handleIncrease = async () => {
    if (!amount0 && !amount1) {
      warning("Enter Amount", "Please specify an amount of liquidity to add.");
      return;
    }

    try {
      info(
        "Adding Liquidity",
        `Increasing liquidity for position #${position.tokenId.toString()}...`,
      );

      const amount0Wei = parseUnits(amount0 || "0", position.token0.decimals);
      const amount1Wei = parseUnits(amount1 || "0", position.token1.decimals);

      let liquidity: bigint | undefined;
      if (
        position.curveType === CurveType.BIN_AMM ||
        position.curveType === CurveType.STABLE_AMM
      ) {
        liquidity = amount0Wei > 0n ? amount0Wei : amount1Wei;
      } else {
        const poolKey: PoolKey = {
          currency0: position.token0.address,
          currency1: position.token1.address,
          fee: position.feeNumber,
          tickSpacing: position.tickSpacing ?? 60,
          curveType: position.curveType,
          // Must match NFT PoolKey.plugin — zeroAddress probes a different pool id.
          hooks: (position.hooks || zeroAddress) as `0x${string}`,
        };
        const sqrt = await getPoolSqrtPrice(poolKey);
        liquidity = getLiquidityForAmounts(
          sqrt,
          position.tickLower,
          position.tickUpper,
          amount0Wei,
          amount1Wei,
        );
        if (liquidity === 0n) {
          liquidity = amount0Wei > 0n ? amount0Wei : amount1Wei;
        }
      }

      const hash = await increaseLiquidity({
        tokenId: position.tokenId,
        amount0Desired: amount0 || "0",
        amount1Desired: amount1 || "0",
        amount0Decimals: position.token0.decimals,
        amount1Decimals: position.token1.decimals,
        curveType: position.curveType,
        liquidity,
        payWithClaims: useClaims,
      });

      success(
        "Liquidity Added",
        `Successfully added liquidity (Tx: ${hash.slice(0, 10)}...)`,
      );
      onClose();
    } catch (err: unknown) {
      error("Transaction Failed", formatSwapError(err));
    }
  };

  const handleDecrease = async () => {
    try {
      if (antiJit?.isAntiJit && antiJit.unvestedBps > 0) {
        warning(
          "AntiJIT early withdraw",
          `~${(antiJit.unvestedBps / 100).toFixed(0)}% of accrued fees may be confiscated (residency ${antiJit.blocksElapsed}/${antiJit.minResidencyBlocks} blocks).`,
        );
      }
      info(
        "Removing Liquidity",
        `Withdrawing ${removePercent}% of liquidity from position #${position.tokenId.toString()}...`,
      );

      const hash = await decreaseLiquidity({
        tokenId: position.tokenId,
        liquidityPercent: removePercent,
        liquidityRaw: position.liquidityRaw,
        collectFeesAfter: collectWithWithdraw,
      });

      success(
        "Liquidity Removed",
        `Withdrew ${removePercent}% liquidity${
          collectWithWithdraw ? " and collected fees" : ""
        } (Tx: ${hash.slice(0, 10)}...)`,
      );
      onClose();
    } catch (err: unknown) {
      error("Withdrawal Failed", formatSwapError(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="md">
      <div className="space-y-5 pt-1">
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
              type="button"
              onClick={() => setMode("increase")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "increase"
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setMode("decrease")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "decrease"
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              Remove
            </button>
          </div>
        </div>

        {mode === "increase" && (
          <div className="space-y-4">
            <div className="p-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04] rounded-xl text-xs flex justify-between">
              <span className="text-neutral-500">Current Position Value</span>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                {position.liquidityUSD}
              </span>
            </div>

            {position.status === "out-of-range" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                This position is out of range. Extra liquidity here still
                won&apos;t serve swaps until the price re-enters the range — use
                your Full Range position (#4) or mint a new in-range position
                instead.
              </div>
            )}

            <TokenAmountInput
              tokenSymbol={position.token0.symbol}
              tokenIcon={
                <TokenLogo
                  symbol={position.token0.symbol}
                  address={position.token0.address}
                  logoURI={position.token0.logoURI}
                  size="sm"
                />
              }
              value={amount0}
              onChange={handleAmount0Change}
              label={`Deposit ${position.token0.symbol}`}
              balance={balance0.formatted}
              onMaxClick={() => {
                if (
                  balance0.formatted !== "-" &&
                  Number(balance0.formatted) > 0
                ) {
                  handleAmount0Change(balance0.formatted);
                }
              }}
              usdValue={
                amount0
                  ? `${(parseFloat(amount0) * (position.token0.priceUSD || 0)).toFixed(2)}`
                  : undefined
              }
            />

            <TokenAmountInput
              tokenSymbol={position.token1.symbol}
              tokenIcon={
                <TokenLogo
                  symbol={position.token1.symbol}
                  address={position.token1.address}
                  logoURI={position.token1.logoURI}
                  size="sm"
                />
              }
              value={amount1}
              onChange={handleAmount1Change}
              label={`Deposit ${position.token1.symbol}`}
              balance={balance1.formatted}
              onMaxClick={() => {
                if (
                  balance1.formatted !== "-" &&
                  Number(balance1.formatted) > 0
                ) {
                  handleAmount1Change(balance1.formatted);
                }
              }}
              usdValue={
                amount1
                  ? `${(parseFloat(amount1) * (position.token1.priceUSD || 0)).toFixed(2)}`
                  : undefined
              }
            />

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

        {mode === "decrease" && (
          <div className="space-y-4">
            {antiJit?.isAntiJit && antiJit.unvestedBps > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Anti-JIT vesting: ~{(antiJit.unvestedBps / 100).toFixed(0)}% of accrued fees may be
                confiscated on withdraw/collect (residency {antiJit.blocksElapsed}/
                {antiJit.minResidencyBlocks} blocks, {antiJit.progressPct.toFixed(0)}% vested).
              </div>
            )}
            <div className="p-4 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04] rounded-2xl text-center space-y-3">
              <div className="text-4xl font-extrabold font-mono text-neutral-900 dark:text-white">
                {removePercent}%
              </div>
              <div className="text-xs text-neutral-500">
                Amount of Liquidity to Remove
              </div>

              <Slider
                value={removePercent}
                onChange={setRemovePercent}
                min={1}
                max={100}
                step={1}
                className="py-2"
              />

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRemovePercent(pct)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      removePercent === pct
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-neutral-200 dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-white/[0.04] text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    {pct === 100 ? "Max" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

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

            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.04]">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-white">
                  Collect Unclaimed Fees ({position.uncollectedFeesUSD})
                </div>
                <div className="text-[11px] text-neutral-500">
                  Harvest accumulated fees after withdrawing liquidity
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
