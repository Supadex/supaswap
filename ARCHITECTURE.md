# SupaDex Core Trading Frontend Architecture (`/frontend`)

## 1. Executive Summary
The **SupaDex Core Frontend** is the primary trading and liquidity provision interface for the SupaDex AMM protocol. It communicates directly with the singleton `SupaPoolManager`, `SupaVault`, `SupaRouter`, `SupaPositionManager`, and `SupaQuoter` smart contracts.

---

## 2. Multi-Curve Architecture: Swapper UX vs. LP Provision

SupaDex decouples AMM curve mathematics into three dedicated engines (`CLAMMEngine`, `BinAMMEngine`, `StableAMMEngine`), uniquely identified by `PoolKey.curveType`.

### A. Frictionless Automated Swap Routing (`/swap`)
* **Uniswap-Grade Experience**: Swappers never manually select pools or curve types.
* **Automated Multi-Quote Resolution**: When the user enters Token In, Token Out, and Amount, the frontend/quoter concurrently simulates quotes across all existing pools for that pair across `CLAMM`, `BinAMM`, and `StableAMM`.
* **Winning Route Dispatch**: The route producing the highest output and lowest price impact is automatically selected and passed to `SupaRouter.swap()`.

### B. Explicit LP Strategy Configuration (`/pools`)
* **Liquidity Provider Choices**: When creating a pool or adding liquidity, LPs explicitly select:
  1. **Concentrated Liquidity (CLAMM)**: For volatile pairs with custom range orders $[P_{min}, P_{max}]$.
  2. **Discretized Bins (BinAMM)**: For zero-slippage active bin liquidity distribution.
  3. **Stableswap (StableAMM)**: For pegged/correlated assets utilizing the amplified invariant.
  4. **Fee Tier & Plugin Configuration**: Selecting base fee (e.g., 0.05%, 0.30%) and native LVR / Anti-JIT hook attachments.

---

## 3. Directory Structure & Layer Separation

```
frontend/src/
├── assets/                  # Optimized SVGs, brand marks, and tokens
├── components/
│   ├── ui/                  # Atomic Reusable Component Library
│   │   ├── Button/          # Multi-variant Apple-style interactive buttons
│   │   ├── Card/            # Glass, elevated, and surface card containers
│   │   ├── Input/           # TextInput, NumberInput, TokenAmountInput with balance hooks
│   │   ├── Select/          # Headless accessible select with animated options
│   │   ├── Modal/           # Dialog and mobile slide-up sheet drawers
│   │   ├── Toast/           # Dynamic Island floating notification stack
│   │   ├── Alert/           # Informational, warning, error, and LVR fee notices
│   │   ├── Table/           # High-performance virtualized pool & position tables
│   │   ├── Tabs/            # Segmented pill control with fluid sliding indicator
│   │   ├── Badge/           # Status indicators (Curve type, Anti-JIT status, MEV protected)
│   │   ├── Skeleton/        # Shimmer geometry matching exact loading states
│   │   ├── Loader/          # Apple spinner and progress indicator
│   │   ├── Dropdown/        # Action menus and context triggers
│   │   ├── Popover/         # Tooltips and slippage parameter controls
│   │   ├── Slider/          # High-precision tick range and percentage sliders
│   │   └── Toggle/          # iOS-style smooth state switchers
│   ├── web3/                # Web3-specific reusable UI blocks
│   │   ├── ConnectWallet/   # Reown AppKit customized wallet trigger
│   │   ├── NetworkBadge/    # Active chain selector with latency & block height
│   │   ├── TokenSelector/   # Token search modal with ERC-20 & ERC-6909 tabs
│   │   ├── TxProgressModal/ # Unlock callback & multi-hop transaction tracker
│   │   └── SlippageModal/   # Slippage tolerance, deadline & MEV protection settings
│   └── layout/              # App Shell (Navbar, Footer, Subnav, MobileDrawer)
├── config/                  # App configuration, Reown Project ID, chain configs, RPCs
├── constants/               # Contract ABIs, deployed addresses, token lists, error codes
├── context/                 # ThemeContext, NotificationContext, DexContext
├── hooks/
│   ├── useTheme.ts          # Dark / Light theme controller
│   ├── useDebounce.ts       # Input debounce for quoter simulations
│   ├── useSupaVault.ts      # ERC-6909 claims balance, deposit & settlement hooks
│   ├── usePoolManager.ts    # Pool state, slot0, tick bitmap & dynamic fee query
│   ├── useSupaRouter.ts     # Multi-hop swap execution via Permit2 & flash accounting
│   ├── useSupaQuoter.ts     # Static zero-gas off-chain swap quote simulator
│   └── usePositions.ts      # ERC-721 Concentrated & Bin liquidity position management
├── pages/                   # Route Pages (Lazy-loaded)
│   ├── Swap/                # Multi-curve swap interface with dynamic LVR chart
│   ├── Liquidity/           # Pool overview, TVL ranking & curve selector
│   ├── AddLiquidity/        # Concentrated CLAMM range picker & Bin AMM distributor
│   ├── Positions/           # User LP positions, unclaimed fees & compounding
│   ├── Claims/              # ERC-6909 internal vault claims management
│   └── NotFound/            # 404 Fallback page
├── providers/               # AppProviders (Reown AppKit, Wagmi, TanStack Query, Theme)
├── routes/                  # React Router configuration with Suspense boundaries
├── types/                   # Strict TypeScript definitions matching web3 contracts
└── utils/                   # Pure utility functions (cn, formatters, bigInt math, error handling)
```

---

## 4. Web3 State & Dual-Ledger Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   USER ACTION (SWAP / LP)                              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              REOWN APPKIT + WAGMI PROVIDER                             │
│  • Account Address, Chain ID, Connector State, EIP-1193 Provider                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  DEX TRANSACTION PIPELINE                              │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Balance Discovery: ERC-20 Physical Tokens + ERC-6909 Internal Vault Claims  │   │
│   │ 2. Route & Quote: Off-chain simulation via `SupaQuoter` with dynamic LVR decay │   │
│   │ 3. Settlement: Single-signature Permit2 approval + `SupaRouter.unlock()`       │   │
│   │ 4. Delta Resolution: Instant settlement or ERC-6909 claim balance crediting   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Design Token Matrix (Light / Dark Monochromatic)

* **Base Canvas**: Dark `#08090B` / Light `#F8F9FA`
* **Card Surface**: Dark `#111317` / Light `#FFFFFF`
* **Elevated Surface**: Dark `#181A20` / Light `#F1F3F5`
* **Hairline Border**: Dark `rgba(255, 255, 255, 0.08)` / Light `rgba(0, 0, 0, 0.09)`
* **Active Border**: Dark `rgba(255, 255, 255, 0.22)` / Light `rgba(0, 0, 0, 0.25)`
* **Brand Accent**: Dark `#22C55E` / Light `#16A34A`
* **Brand Purple (Claims)**: Dark `#A855F7` / Light `#7E22CE`
* **Typography**: Primary `#F3F4F6` (Dark) / `#0F172A` (Light); Secondary `#9CA3AF` / `#475569`.
