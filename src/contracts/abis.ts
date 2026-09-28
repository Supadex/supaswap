import { parseAbi } from 'viem';

export const SupaVaultABI = parseAbi([
  'function reservesOf(address currency) external view returns (uint256)',
  'function claimsOf(address owner, address currency) external view returns (uint256)',
  'function deposit(address currency, address to, uint256 amount) external payable returns (uint256)',
  'function withdraw(address currency, address to, uint256 amount) external returns (uint256)',
  'function flashAccountingLock() external view returns (bool)',
  'event Deposit(address indexed sender, address indexed currency, address indexed to, uint256 amount)',
  'event Withdraw(address indexed sender, address indexed currency, address indexed to, uint256 amount)',
  'event ClaimSettled(address indexed sender, address indexed currency, int256 delta)',
] as const);

export const SupaPoolManagerABI = parseAbi([
  'function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee, uint16 dynamicLvrSpread, bool unlocked)',
  'function getLiquidity(bytes32 id) external view returns (uint128)',
  'function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) key, uint160 sqrtPriceX96, bytes calldata hookData) external returns (int24 tick)',
  'function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes calldata hookData) external returns (int256 delta0, int256 delta1)',
  'function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes calldata hookData) external returns (int256 delta0, int256 delta1)',
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks)',
  'event Swap(bytes32 indexed id, address indexed sender, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
] as const);

export const SupaRouterABI = parseAbi([
  'function exactInputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) poolKey, bool zeroForOne, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96, bool settleClaims, bool takeClaims ) params) external payable returns (uint256 amountOut)',
  'function exactOutputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) poolKey, bool zeroForOne, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96, bool settleClaims, bool takeClaims ) params) external payable returns (uint256 amountIn)',
] as const);

export const SupaQuoterABI = parseAbi([
  'function quoteExactInputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) poolKey, bool zeroForOne, uint256 amountIn, uint160 sqrtPriceLimitX96, bytes hookData ) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, int24 tickAfter, uint256 gasEstimate, uint16 dynamicLvrSpread)',
  'function quoteBestCurve(address currency0, address currency1, bool zeroForOne, uint256 amountIn) external returns (uint256 amountOut, uint8 bestCurveType, uint24 poolFee, uint256 gasEstimate, uint16 dynamicLvrSpread)',
] as const);

export const SupaPositionManagerABI = parseAbi([
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, (address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function mint(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, uint8 curveType, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline ) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function increaseLiquidity(( uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline ) params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity(( uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline ) params) external returns (uint256 amount0, uint256 amount1)',
  'function collect(( uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max ) params) external returns (uint256 amount0, uint256 amount1)',
  'function burn(uint256 tokenId) external payable',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
] as const);

export const ERC20ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
] as const);
