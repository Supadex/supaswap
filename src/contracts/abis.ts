import { parseAbi } from 'viem';

export const SupaVaultABI = parseAbi([
  'function reservesOf(address currency) external view returns (uint256)',
  'function balanceOf(address owner, uint256 id) external view returns (uint256)',
  'function isOperator(address owner, address operator) external view returns (bool)',
  'function setOperator(address operator, bool approved) external returns (bool)',
  'function allowance(address owner, address spender, uint256 id) external view returns (uint256)',
  'function approve(address spender, uint256 id, uint256 amount) external returns (bool)',
  'function transfer(address receiver, uint256 id, uint256 amount) external returns (bool)',
  'function transferFrom(address sender, address receiver, uint256 id, uint256 amount) external returns (bool)',
  'function isUnlocked() external view returns (bool)',
  'event OperatorSet(address indexed owner, address indexed operator, bool approved)',
  'event Transfer(address indexed caller, address indexed from, address indexed to, uint256 id, uint256 amount)',
  'event ClaimMinted(address indexed currency, address indexed to, uint256 amount)',
  'event ClaimBurned(address indexed currency, address indexed from, uint256 amount)',
] as const);

export const SupaClaimsRouterABI = parseAbi([
  'function vault() external view returns (address)',
  'function deposit(address currency, address to, uint256 amount) external payable',
  'function withdraw(address currency, address to, uint256 amount) external',
  'event ClaimDeposited(address indexed sender, address indexed to, address indexed currency, uint256 amount)',
  'event ClaimWithdrawn(address indexed sender, address indexed to, address indexed currency, uint256 amount)',
] as const);

export const SupaPoolManagerABI = parseAbi([
  'function getSlot0(bytes32 id) external view returns (bytes32)',
  'function getLiquidity(bytes32 id) external view returns (uint128)',
  'function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) key, uint160 sqrtPriceX96, bytes calldata hookData) external returns (int24 tick)',
  'function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes calldata hookData) external returns (int256 delta0, int256 delta1)',
  'function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes calldata hookData) external returns (int256 delta0, int256 delta1)',
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address plugin, uint160 sqrtPriceX96, int24 tick)',
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)',
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
] as const);

export const SupaRouterABI = parseAbi([
  'function exactInputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, bool zeroForOne, address recipient, uint128 amountIn, uint128 amountOutMinimum, uint160 sqrtPriceLimitX96, bytes hookData, bool payWithClaims, bool receiveAsClaims, uint256 deadline ) params) external payable returns (uint256 amountOut)',
  'function exactInput(( bytes path, address recipient, uint128 amountIn, uint128 amountOutMinimum, bool payWithClaims, bool receiveAsClaims, uint256 deadline ) params) external payable returns (uint256 amountOut)',
  'function exactOutputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, bool zeroForOne, address recipient, uint128 amountOut, uint128 amountInMaximum, uint160 sqrtPriceLimitX96, bytes hookData, bool payWithClaims, bool receiveAsClaims, uint256 deadline ) params) external payable returns (uint256 amountIn)',
] as const);

export const SupaQuoterABI = parseAbi([
  'function quoteExactInputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, bool zeroForOne, uint128 amountIn, uint160 sqrtPriceLimitX96, bytes hookData ) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, int24 tickAfter)',
  'function quoteExactInput(bytes memory path, uint128 amountIn) external returns (uint256 amountOut)',
  'function quoteExactOutputSingle(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, bool zeroForOne, uint128 amountOut, uint160 sqrtPriceLimitX96, bytes hookData ) params) external returns (uint256 amountIn, uint160 sqrtPriceX96After, int24 tickAfter)',
  'function quoteExactOutput(bytes memory path, uint128 amountOut) external returns (uint256 amountIn)',
] as const);

export const SupaPositionManagerABI = parseAbi([
  'function positions(uint256 tokenId) external view returns (( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1 ))',
  'function mint(( (address currency0, address currency1, uint24 fee, int24 tickSpacing, address plugin, uint8 curveType) poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Max, uint128 amount1Max, address recipient, uint256 deadline, bytes hookData, bool payWithClaims ) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function increaseLiquidity(( uint256 tokenId, uint128 liquidity, uint128 amount0Max, uint128 amount1Max, uint256 deadline, bytes hookData, bool payWithClaims ) params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity(( uint256 tokenId, uint128 liquidity, uint128 amount0Min, uint128 amount1Min, uint256 deadline, bytes hookData ) params) external payable returns (uint256 amount0, uint256 amount1)',
  'function collect(( uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max ) params) external payable returns (uint256 amount0, uint256 amount1)',
  'function syncFees(uint256 tokenId) external payable returns (uint256 fees0, uint256 fees1)',
  'function burn(uint256 tokenId) external payable',
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed id)',
  'event PositionMinted(uint256 indexed tokenId, address indexed owner, bytes32 indexed poolId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event LiquidityIncreased(uint256 indexed tokenId, uint128 liquidityAdded, uint256 amount0, uint256 amount1)',
  'event LiquidityDecreased(uint256 indexed tokenId, uint128 liquidityRemoved, uint256 amount0, uint256 amount1)',
  'event FeesCollected(uint256 indexed tokenId, address indexed recipient, uint256 amount0, uint256 amount1)',
  'event FeesSynced(uint256 indexed tokenId, uint256 fees0, uint256 fees1)',
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
