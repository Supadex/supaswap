import React, { useState, useMemo } from "react";
import { useConnection } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { TokenAmountInput } from "../components/ui/TokenAmountInput";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { TokenLogo } from "../components/ui/TokenLogo";
import { useToast } from "../components/ui/Toast";
import { useSupaQuoter } from "../hooks/useSupaQuoter";
import { useSupaRouter, formatSwapError } from "../hooks/useSupaRouter";
import { useTokenList } from "../hooks/useTokenList";
import { useTokenWalletBalance } from "../hooks/useTokenWalletBalance";
import { CurveType, type TokenMetadata } from "../contracts/types";
import {
  ArrowDownUp,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Activity,
  Percent,
  Wallet,
  Check,
  ChevronDown,
  ExternalLink,
  Plus,
} from "lucide-react";

export const SwapPage: React.FC = () => {
  const { isConnected } = useConnection();
  const { open } = useAppKit();

  const { success, error: toastError } = useToast();
  const { swapExactIn, isSwapping, approveToken, isApproving, useAllowance } =
    useSupaRouter();
  const { tokens, fetchTokenByAddress, importToken, isLoadingToken } =
    useTokenList();

  const [payAmount, setPayAmount] = useState("");
  const [payToken, setPayToken] = useState<TokenMetadata>(tokens[0]);
  const [receiveToken, setReceiveToken] = useState<TokenMetadata>(tokens[1]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTokenSelectOpen, setIsTokenSelectOpen] = useState(false);
  const [selectingSide, setSelectingSide] = useState<"pay" | "receive">("pay");
  const [tokenTab, setTokenTab] = useState<"erc20" | "erc6909">("erc20");
  const [slippage, setSlippage] = useState("0.5");
  const [deadlineMinutes, setDeadlineMinutes] = useState("20");
  const [isRotating, setIsRotating] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [searchedImportToken, setSearchedImportToken] =
    useState<TokenMetadata | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rateInverted, setRateInverted] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStep, setTxStep] = useState<
    "idle" | "approving" | "swapping" | "success"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Separate native vs ERC-20 reads so ETH + USDC never share one balance cache entry
  const { formatted: payTokenBalance, refetch: refetchPayBalance } =
    useTokenWalletBalance(payToken);
  const { formatted: receiveTokenBalance, refetch: refetchReceiveBalance } =
    useTokenWalletBalance(receiveToken);

  // Live quoter hook with debounced simulation & on-chain pool verification
  const {
    quote,
    isPoolInitialized,
    error: quoteError,
    poolKey,
    zeroForOne,
  } = useSupaQuoter({
    tokenIn: payToken.address,
    tokenOut: receiveToken.address,
    amountIn: payAmount,
    decimalsIn: payToken.decimals,
    decimalsOut: receiveToken.decimals,
    tokenInPriceUSD: payToken.priceUSD,
    tokenOutPriceUSD: receiveToken.priceUSD,
    tokenMetaIn: payToken,
    tokenMetaOut: receiveToken,
  });

  // Check token allowance for router
  const { data: allowanceData, refetch: refetchAllowance } = useAllowance(
    payToken.address,
  );
  const parsedIn = useMemo(() => {
    if (!payAmount || Number(payAmount) <= 0) return 0n;
    try {
      return BigInt(Math.floor(Number(payAmount) * 10 ** payToken.decimals));
    } catch {
      return 0n;
    }
  }, [payAmount, payToken.decimals]);

  const needsApproval = useMemo(() => {
    if (payToken.isNative || payToken.isClaim) return false;
    if (!parsedIn || parsedIn === 0n) return false;
    if (allowanceData === undefined) return false;
    return allowanceData < parsedIn;
  }, [payToken.isNative, payToken.isClaim, parsedIn, allowanceData]);

  const receiveAmount = useMemo(() => {
    if (!quote || !payAmount || Number(payAmount) <= 0) return "";
    const rawOut = Number(quote.amountOut) / 10 ** receiveToken.decimals;
    return rawOut > 1000
      ? rawOut.toFixed(2)
      : rawOut > 1
        ? rawOut.toFixed(4)
        : rawOut.toFixed(6);
  }, [quote, payAmount, receiveToken.decimals]);

  // Route Name based on best-quoted path (curve auto-selected per hop)
  const routeName =
    quote?.hopCount && quote.hopCount > 1
      ? `Best multi-hop`
      : quote?.hopCurveLabels?.[0]
        ? quote.hopCurveLabels[0].split(" ")[0]
        : quote?.recommendedCurve === CurveType.STABLE_AMM
          ? "StableAMM"
          : quote?.recommendedCurve === CurveType.BIN_AMM
            ? "BinAMM"
            : "CLAMM";

  const routeDescription = quote?.routeLabel
    ? `Best quote · ${quote.routeLabel}`
    : quote?.recommendedCurve === CurveType.STABLE_AMM
      ? "Invariable sum-product curve for zero-loss 1:1 pegs"
      : quote?.recommendedCurve === CurveType.BIN_AMM
        ? "Discretized bins with zero interior slippage"
        : "Concentrated liquidity with sub-tick price precision";

  const exchangeRate =
    payToken.priceUSD && receiveToken.priceUSD
      ? payToken.priceUSD / receiveToken.priceUSD
      : 1;
  const invertedExchangeRate =
    payToken.priceUSD && receiveToken.priceUSD
      ? receiveToken.priceUSD / payToken.priceUSD
      : 1;

  const minReceived = useMemo(() => {
    if (!receiveAmount) return "0.00";
    const slipMultiplier = 1 - Number(slippage) / 100;
    const minVal = Number(receiveAmount) * slipMultiplier;
    return minVal > 1000 ? minVal.toFixed(2) : minVal.toFixed(4);
  }, [receiveAmount, slippage]);

  // Soft quote warnings (e.g. liquidity read) must not lock the Swap button when a quote exists
  const canExecuteSwap = Boolean(
    payAmount &&
    Number(payAmount) > 0 &&
    quote &&
    (poolKey || quote.path) &&
    isPoolInitialized === true &&
    !isSwapping,
  );

  const handleSwapTokens = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 300);
    const tempT = payToken;
    setPayToken(receiveToken);
    setReceiveToken(tempT);
    setPayAmount("");
  };

  const handleSelectTokenClick = (side: "pay" | "receive") => {
    setSelectingSide(side);
    setTokenSearch("");
    setSearchedImportToken(null);
    const current = side === "pay" ? payToken : receiveToken;
    setTokenTab(current.isClaim ? "erc6909" : "erc20");
    setIsTokenSelectOpen(true);
  };

  const toggleLedger = (side: "pay" | "receive") => {
    const current = side === "pay" ? payToken : receiveToken;
    const counterpart = tokens.find(
      (t) =>
        t.address.toLowerCase() === current.address.toLowerCase() &&
        Boolean(t.isClaim) !== Boolean(current.isClaim),
    );
    if (!counterpart) return;

    const other = side === "pay" ? receiveToken : payToken;
    const sameAssetAsOther =
      other.address.toLowerCase() === counterpart.address.toLowerCase() &&
      Boolean(other.isClaim) === Boolean(counterpart.isClaim);

    if (side === "pay") {
      setPayToken(counterpart);
      if (sameAssetAsOther) setReceiveToken(current);
    } else {
      setReceiveToken(counterpart);
      if (sameAssetAsOther) setPayToken(current);
    }
  };

  // Search filter and on-chain address lookup
  const handleSearchChange = async (val: string) => {
    setTokenSearch(val);
    setSearchedImportToken(null);

    if (val.startsWith("0x") && val.length === 42) {
      const found = await fetchTokenByAddress(val);
      if (found) {
        setSearchedImportToken(found);
      }
    }
  };

  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      const matchesTab = tokenTab === "erc6909" ? t.isClaim : !t.isClaim;
      if (!matchesTab) return false;

      const q = tokenSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
      );
    });
  }, [tokens, tokenTab, tokenSearch]);

  const sameAsset = (a: TokenMetadata, b: TokenMetadata) =>
    a.address.toLowerCase() === b.address.toLowerCase() &&
    Boolean(a.isClaim) === Boolean(b.isClaim);

  const handleTokenChosen = (token: TokenMetadata) => {
    if (selectingSide === "pay") {
      if (sameAsset(token, receiveToken)) {
        setReceiveToken(payToken);
      }
      setPayToken(token);
    } else {
      if (sameAsset(token, payToken)) {
        setPayToken(receiveToken);
      }
      setReceiveToken(token);
    }
    setIsTokenSelectOpen(false);
  };

  const handleImportAndSelect = (token: TokenMetadata) => {
    importToken(token);
    handleTokenChosen(token);
    success("Token Imported", `Imported ${token.symbol} (${token.name})`);
  };

  const handleApprove = async () => {
    if (!isConnected) {
      open();
      return;
    }
    try {
      setTxModalOpen(true);
      setTxStep("approving");
      await approveToken(payToken.address);
      await refetchAllowance();
      setTxModalOpen(false);
      setTxStep("idle");
      success("Approval Success", `Approved ${payToken.symbol} for SupaRouter`);
    } catch (err: unknown) {
      setTxModalOpen(false);
      setTxStep("idle");
      toastError("Approval Failed", formatSwapError(err));
    }
  };

  const handleExecuteSwap = async () => {
    if (!isConnected) {
      open();
      return;
    }

    if (!quote || parsedIn === 0n) return;
    if (!quote.path && !poolKey) return;

    setTxModalOpen(true);
    setTxStep("swapping");

    try {
      // Only enforce slippage against verified on-chain quotes.
      // Simulated (USD-price) estimates must use amountOutMin=0 — they caused SlippageExceeded.
      const minOut =
        quote.isSimulated === false
          ? (quote.amountOut *
              BigInt(10000 - Math.floor(Number(slippage) * 100))) /
            10000n
          : 0n;

      const hash = await swapExactIn({
        poolKey: quote.path ? null : poolKey,
        zeroForOne: quote.path ? undefined : zeroForOne,
        path: quote.path,
        amountIn: parsedIn,
        amountOutMin: minOut,
        payWithClaims: payToken.isClaim ?? false,
        receiveAsClaims: receiveToken.isClaim ?? false,
        deadlineMinutes: Number(deadlineMinutes) || 20,
      });

      setTxHash(hash);
      setTxStep("success");
      // Receipt is confirmed inside swapExactIn — refresh balances (RPC may lag once).
      await Promise.all([
        refetchPayBalance(),
        refetchReceiveBalance(),
        refetchAllowance(),
      ]);
      await new Promise((r) => setTimeout(r, 750));
      await Promise.all([refetchPayBalance(), refetchReceiveBalance()]);
      setPayAmount("");
      success(
        "Swap Executed",
        `Swapped ${payAmount} ${payToken.symbol} for ${receiveAmount} ${receiveToken.symbol}`,
      );
    } catch (err: unknown) {
      setTxModalOpen(false);
      setTxStep("idle");
      toastError("Swap Failed", formatSwapError(err));
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4 sm:px-0">
      <Card
        variant="glass"
        className="border-neutral-200/80 dark:border-white/[0.08] shadow-2xl p-5 relative overflow-hidden backdrop-blur-2xl"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight">
              Swap
            </span>
            <Badge variant="brand" size="sm" className="font-mono text-[10px]">
              Dynamic LVR
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pay Input Section */}
        <div className="space-y-1">
          <TokenAmountInput
            label="You Pay"
            value={payAmount}
            onChange={setPayAmount}
            tokenSymbol={payToken.symbol}
            tokenIcon={
              <TokenLogo
                symbol={payToken.symbol}
                address={payToken.address}
                logoURI={payToken.logoURI}
                size="sm"
              />
            }
            usdValue={
              payAmount && payToken.priceUSD
                ? `${(Number(payAmount) * payToken.priceUSD).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}`
                : undefined
            }
            balance={payTokenBalance}
            onSelectToken={() => handleSelectTokenClick("pay")}
            onMaxClick={() => {
              if (payTokenBalance !== "-" && Number(payTokenBalance) > 0) {
                setPayAmount(payTokenBalance);
              }
            }}
            onHalfClick={() => {
              if (payTokenBalance !== "-" && Number(payTokenBalance) > 0) {
                setPayAmount((Number(payTokenBalance) / 2).toFixed(4));
              }
            }}
            isVaultClaim={payToken.isClaim}
            onToggleVaultClaim={() => toggleLedger("pay")}
          />
        </div>

        {/* Flip Direction Button */}
        <div className="relative flex justify-center -my-2.5 z-10">
          <button
            type="button"
            onClick={handleSwapTokens}
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#15171C] border border-neutral-200 dark:border-white/[0.08] shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            aria-label="Invert Tokens"
          >
            <ArrowDownUp
              className={`w-4 h-4 transition-transform duration-300 ${
                isRotating ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Receive Input Section */}
        <div className="space-y-1">
          <TokenAmountInput
            label="You Receive"
            value={receiveAmount}
            onChange={() => {}}
            tokenSymbol={receiveToken.symbol}
            tokenIcon={
              <TokenLogo
                symbol={receiveToken.symbol}
                address={receiveToken.address}
                logoURI={receiveToken.logoURI}
                size="sm"
              />
            }
            usdValue={
              receiveAmount && receiveToken.priceUSD
                ? `${(
                    Number(receiveAmount) * receiveToken.priceUSD
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : undefined
            }
            balance={receiveTokenBalance}
            onSelectToken={() => handleSelectTokenClick("receive")}
            readOnly
            isVaultClaim={receiveToken.isClaim}
            onToggleVaultClaim={() => toggleLedger("receive")}
          />
        </div>

        {/* Live Simulation Details */}
        {Number(payAmount) > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/[0.06] transition-all duration-200">
            <div
              className="flex items-center justify-between text-xs cursor-pointer select-none"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center gap-1.5 font-mono text-neutral-600 dark:text-neutral-300">
                <span>
                  1 {rateInverted ? receiveToken.symbol : payToken.symbol} ={" "}
                  {(rateInverted ? invertedExchangeRate : exchangeRate).toFixed(
                    4,
                  )}{" "}
                  {rateInverted ? payToken.symbol : receiveToken.symbol}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRateInverted(!rateInverted);
                  }}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                >
                  <ArrowDownUp className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-mono text-[11px]">
                  LVR:{" "}
                  {quote
                    ? `${(quote.dynamicLvrSpreadBps / 100).toFixed(2)}%`
                    : "0.04%"}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                    showDetails ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {/* Expandable Technical Details */}
            {showDetails && (
              <div className="px-1 pb-1 pt-3 border-t border-neutral-200/60 dark:border-white/[0.04] space-y-2 text-xs mt-2">
                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Dynamic LVR Decay</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-neutral-800 dark:text-neutral-200">
                    <span className="text-emerald-500">MEV Protected</span>
                    <span>•</span>
                    <span>
                      {quote
                        ? `${(quote.dynamicLvrSpreadBps / 100).toFixed(2)}%`
                        : "0.04%"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Automated Route</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono text-neutral-800 dark:text-neutral-200 font-medium">
                      {routeName}
                    </span>
                    <p className="text-[10px] text-neutral-400">
                      {routeDescription}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Price Impact</span>
                  <span
                    className={`font-mono font-medium ${
                      (quote?.priceImpactBps || 0) > 100
                        ? "text-amber-500"
                        : "text-neutral-800 dark:text-neutral-200"
                    }`}
                  >
                    {quote
                      ? `${quote.priceImpactBps < 1 ? "< 0.01" : (quote.priceImpactBps / 100).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Minimum Received</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-200">
                    {minReceived} {receiveToken.symbol}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uninitialized / no-route Notice */}
        {Number(payAmount) > 0 && isPoolInitialized === false && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <span>No Route Found</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {quoteError ||
                `No direct or multi-hop path for ${payToken.symbol} → ${receiveToken.symbol}. Create overlapping pools (e.g. ${payToken.symbol}/ETH and ETH/${receiveToken.symbol}).`}
            </p>
          </div>
        )}

        {/* Soft quote warning (does not disable Swap) */}
        {Number(payAmount) > 0 && isPoolInitialized === true && quoteError && (
          <div className="mt-3 p-3 rounded-2xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {quoteError}
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4 space-y-2">
          {!isConnected ? (
            <Button
              variant="brand"
              size="lg"
              leftIcon={<Wallet className="w-4 h-4" />}
              className="w-full text-base font-semibold py-3.5 rounded-2xl"
              onClick={() => open()}
            >
              Connect Wallet
            </Button>
          ) : isPoolInitialized === false ? (
            <Button
              variant="secondary"
              size="lg"
              className="w-full text-sm font-semibold py-3.5 rounded-2xl border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              disabled
            >
              No Route Available
            </Button>
          ) : needsApproval ? (
            <Button
              variant="brand"
              size="lg"
              className="w-full text-base font-semibold py-3.5 rounded-2xl"
              onClick={handleApprove}
              isLoading={isApproving}
              disabled={isApproving}
            >
              {isApproving
                ? `Approving ${payToken.symbol}...`
                : `Approve ${payToken.symbol}`}
            </Button>
          ) : (
            <Button
              variant="brand"
              size="lg"
              className="w-full text-base font-semibold py-3.5 rounded-2xl"
              onClick={handleExecuteSwap}
              disabled={!canExecuteSwap}
              isLoading={isSwapping}
            >
              {!payAmount
                ? "Enter an amount"
                : isSwapping
                  ? "Swapping..."
                  : isPoolInitialized === null && Number(payAmount) > 0
                    ? "Checking pool…"
                    : !quote
                      ? "Fetching quote…"
                      : "Execute Swap"}
            </Button>
          )}
        </div>
      </Card>

      {/* Token Select Modal */}
      <Modal
        isOpen={isTokenSelectOpen}
        onClose={() => setIsTokenSelectOpen(false)}
        title="Select Asset"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Dual Ledger Tabs */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setTokenTab("erc20")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                tokenTab === "erc20"
                  ? "bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Physical ERC-20
            </button>
            <button
              type="button"
              onClick={() => setTokenTab("erc6909")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                tokenTab === "erc6909"
                  ? "bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Vault Claims (ERC-6909)
            </button>
          </div>

          {/* Search Input */}
          <Input
            placeholder="Search name, symbol, or paste 0x contract address"
            value={tokenSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
            className="rounded-xl"
            autoFocus
          />

          {/* Quick Popular Tokens Row */}
          <div className="flex flex-wrap gap-2 pt-1">
            {tokens.slice(0, 4).map((t) => (
              <button
                key={t.symbol}
                onClick={() => handleTokenChosen(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50 dark:bg-white/[0.03] hover:bg-neutral-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer text-xs font-medium"
              >
                <TokenLogo symbol={t.symbol} address={t.address} size="xs" />
                <span>{t.symbol}</span>
              </button>
            ))}
          </div>

          {/* Dynamic On-Chain Import Result */}
          {searchedImportToken && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TokenLogo
                  symbol={searchedImportToken.symbol}
                  address={searchedImportToken.address}
                  size="sm"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                    {searchedImportToken.name} ({searchedImportToken.symbol})
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">
                    {searchedImportToken.address}
                  </div>
                </div>
              </div>
              <Button
                variant="brand"
                size="sm"
                className="h-7 text-xs px-2.5"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={() => handleImportAndSelect(searchedImportToken)}
              >
                Import
              </Button>
            </div>
          )}

          {/* Asset List */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {isLoadingToken ? (
              <div className="py-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching
                token metadata...
              </div>
            ) : filteredTokens.length === 0 && !searchedImportToken ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                No tokens found matching &quot;{tokenSearch}&quot;. Paste a
                valid ERC-20 contract address to import.
              </div>
            ) : (
              filteredTokens.map((t) => {
                const isSelected =
                  (selectingSide === "pay" && sameAsset(t, payToken)) ||
                  (selectingSide === "receive" && sameAsset(t, receiveToken));

                return (
                  <button
                    key={`${t.symbol}-${t.address}-${t.isClaim ? "c" : "p"}`}
                    onClick={() => handleTokenChosen(t)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-neutral-100 dark:bg-white/[0.08]"
                        : "hover:bg-neutral-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <TokenLogo
                        symbol={t.symbol}
                        address={t.address}
                        size="md"
                      />
                      <div>
                        <div className="font-medium text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {t.isNative && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-500 rounded">
                              Native
                            </span>
                          )}
                          {tokenTab === "erc6909" && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-200 dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 rounded">
                              6909 Claim
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                          {t.symbol}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-mono text-neutral-900 dark:text-white">
                        {t.priceUSD > 0
                          ? `$${t.priceUSD.toLocaleString()}`
                          : "--"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Slippage & Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Transaction Settings"
        maxWidth="md"
      >
        <div className="space-y-5">
          {/* Slippage Tolerance */}
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 block">
              Slippage Tolerance
            </label>
            <div className="flex items-center gap-2">
              {["0.1", "0.5", "1.0"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSlippage(val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                    slippage === val
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                      : "bg-neutral-100 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/[0.1]"
                  }`}
                >
                  {val}%
                </button>
              ))}
              <div className="w-24">
                <Input
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  rightIcon={
                    <span className="text-xs text-neutral-400">%</span>
                  }
                  className="text-xs font-mono py-1.5 text-center"
                />
              </div>
            </div>
          </div>

          {/* Transaction Deadline */}
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 block">
              Transaction Deadline
            </label>
            <div className="w-32">
              <Input
                value={deadlineMinutes}
                onChange={(e) => setDeadlineMinutes(e.target.value)}
                rightIcon={
                  <span className="text-xs text-neutral-400">min</span>
                }
                className="text-xs font-mono py-1.5 text-center"
              />
            </div>
          </div>

          {/* Dynamic LVR Spread Active Defense Notice */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/70 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-neutral-900 dark:text-white flex items-center gap-1.5">
                <span>Dynamic LVR Defense</span>
                <Badge
                  variant="success"
                  size="sm"
                  className="font-mono text-[9px]"
                >
                  Active
                </Badge>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Automatically adjusts spread to neutralize toxic latency
                arbitrage
              </p>
            </div>
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <Check className="w-3 h-3" />
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full rounded-xl"
            onClick={() => setIsSettingsOpen(false)}
          >
            Save Settings
          </Button>
        </div>
      </Modal>

      {/* Transaction Progress Modal */}
      <Modal
        isOpen={txModalOpen}
        onClose={() => {
          if (txStep === "success") {
            setTxModalOpen(false);
            setTxStep("idle");
            setPayAmount("");
          }
        }}
        title="Transaction Status"
        maxWidth="sm"
      >
        <div className="py-4 text-center space-y-5">
          {txStep === "approving" ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full border-2 border-neutral-200 dark:border-neutral-800 border-t-emerald-500 animate-spin mx-auto" />
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Approving Token
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Please approve SupaRouter to spend {payToken.symbol} in your
                  wallet...
                </p>
              </div>
            </div>
          ) : txStep === "swapping" ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full border-2 border-neutral-200 dark:border-neutral-800 border-t-emerald-500 animate-spin mx-auto" />
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Executing Swap
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Routing {payAmount} {payToken.symbol} through {routeName}...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Swap Completed
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Received {receiveAmount} {receiveToken.symbol}
                </p>
              </div>

              {txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-mono transition-colors"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <Button
                variant="primary"
                size="md"
                className="w-full rounded-xl mt-2"
                onClick={() => {
                  setTxModalOpen(false);
                  setTxStep("idle");
                  setPayAmount("");
                }}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
