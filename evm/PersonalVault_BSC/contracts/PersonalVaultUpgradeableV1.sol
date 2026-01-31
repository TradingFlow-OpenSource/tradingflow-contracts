// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";   
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/**
 * @title IWETH
 * @notice Interface for wrapped native token
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

/**
 * @title IV3SwapRouter
 * @notice Interface for PancakeSwap V3 multi-hop swap (exactInput)
 */
interface IV3SwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title IPancakeRouterV2
 * @notice Interface for PancakeSwap V2 Router
 */
interface IPancakeRouterV2 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    
    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/**
 * @title PersonalVaultUpgradeableV1
 * @author TradingFlow
 * @notice UUPS upgradeable personal vault contract with initialization and upgrade support
 * 
 * @dev Contract Version: V1
 *      Target Chain: BSC (Binance Smart Chain)
 *      DEX Integration: PancakeSwap V3 (Uniswap V3 Fork)
 *      Swap Router: 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
 *      WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
 * 
 * @dev Upgrade Notes:
 *      - Uses UUPS proxy pattern
 *      - Upgrade permission: onlyOwner
 *      - Storage layout must remain backward compatible
 */
contract PersonalVaultUpgradeableV1 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // --- Roles ---
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // bot or admin for trade
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address public investor;
    ISwapRouter public swapRouter;      // V3 SwapRouter (single-hop)
    address public routerV2;            // V2 Router for legacy swaps
    
    // --- Native Token Related ---
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    address public WRAPPED_NATIVE; // WBNB address

    // --- Events ---
    event VaultInitialized(address indexed owner, uint256 timestamp);
    event UserDeposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event UserWithdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event TradeSignal(
        address indexed user, 
        address indexed fromToken, 
        address indexed toToken, 
        uint256 amountIn, 
        uint256 amountOutMin, 
        uint256 amountOut, 
        address feeRecipient, 
        uint256 feeAmount, 
        uint256 timestamp
    );

    // --- Balances ---
    mapping(address => uint256) public balances; // token address => amount
    address[] private tokenList; // stores all added token addresses
    mapping(address => bool) private tokenExists; // quick check if token is added

    /**
     * @notice Initialize the vault with separated owner and admin
     * @param _investor The investor address (can deposit/withdraw)
     * @param _owner The owner address (can upgrade contract via UUPS)
     * @param _admin The admin address (has ADMIN_ROLE for settings)
     * @param bot The bot address (has ORACLE_ROLE for trading)
     * @param _swapRouter The swap router address
     * @param _wrappedNative The wrapped native token address (WBNB)
     * @param factory The factory contract address
     */
    function initialize(
        address _investor, 
        address _owner, 
        address _admin, 
        address bot, 
        address _swapRouter, 
        address _wrappedNative, 
        address factory
    ) public initializer {
        __Ownable_init(_owner);  // Owner for UUPS upgrades
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        require(_investor != address(0), "Invalid investor");
        require(_owner != address(0), "Invalid owner");
        require(_admin != address(0), "Invalid admin");
        require(_swapRouter != address(0), "Invalid router");
        require(_wrappedNative != address(0), "Invalid wrapped native");
        
        investor = _investor;
        swapRouter = ISwapRouter(_swapRouter);
        WRAPPED_NATIVE = _wrappedNative;
        
        // Grant roles - Owner gets DEFAULT_ADMIN_ROLE to manage all roles
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        
        // Admin gets ADMIN_ROLE for settings (setRouterV2, etc.)
        _grantRole(ADMIN_ROLE, _admin);
        
        // Bot gets ORACLE_ROLE for trading
        _grantRole(ORACLE_ROLE, bot);
        
        // Grant factory contract DEFAULT_ADMIN_ROLE so it can manage roles
        _grantRole(DEFAULT_ADMIN_ROLE, factory);
        
        emit VaultInitialized(_investor, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}


    // --- Receive Native Token ---
    receive() external payable {
        if (msg.sender == investor) {
            balances[NATIVE_TOKEN] += msg.value;
            
            // Add to token list if new token
            if (!tokenExists[NATIVE_TOKEN]) {
                tokenList.push(NATIVE_TOKEN);
                tokenExists[NATIVE_TOKEN] = true;
            }
            
            emit UserDeposit(msg.sender, NATIVE_TOKEN, msg.value, block.timestamp);
        }
    }
    
    // --- Deposit ERC20 ---
    function deposit(address token, uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(amount > 0, "Amount=0");
        require(token != NATIVE_TOKEN, "Use depositNative");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;

        // Add to token list if new token
        if (!tokenExists[token]) {
            tokenList.push(token);
            tokenExists[token] = true;
        }

        emit UserDeposit(msg.sender, token, amount, block.timestamp);
    }
    
    // --- Deposit Native Token ---
    function depositNative() external payable nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(msg.value > 0, "Amount=0");
        balances[NATIVE_TOKEN] += msg.value;

        // Add to token list if new token
        if (!tokenExists[NATIVE_TOKEN]) {
            tokenList.push(NATIVE_TOKEN);
            tokenExists[NATIVE_TOKEN] = true;
        }

        emit UserDeposit(msg.sender, NATIVE_TOKEN, msg.value, block.timestamp);
    }

    // --- Withdraw ERC20 ---
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(token != NATIVE_TOKEN, "Use withdrawNative");
        require(balances[token] >= amount, "Insufficient balance");
        balances[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit UserWithdraw(msg.sender, token, amount, block.timestamp);
    }
    
    // --- Withdraw Native Token ---
    function withdrawNative(uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(balances[NATIVE_TOKEN] >= amount, "Insufficient balance");
        balances[NATIVE_TOKEN] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        emit UserWithdraw(msg.sender, NATIVE_TOKEN, amount, block.timestamp);
    }

    /**
     * @notice PancakeSwap V3 Swap: Exact Input (fixed input for maximum output)
     * @dev Uses PancakeSwap V3 Router for swap
     *      Router address: 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
     */
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address feeRecipient,
        uint256 feeRate  // fee rate in millionths (1 = 0.0001%)
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        require(feeRate <= 1000000, "Fee rate too high"); // max fee rate 100%
        balances[tokenIn] -= amountIn;
        
        // Set transaction deadline
        uint deadline = block.timestamp + 600;
        
        // Handle input token
        if (tokenIn == NATIVE_TOKEN) {
            // If native token, use value parameter
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: WRAPPED_NATIVE, // Use WBNB address
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle{value: amountIn}(params);
        } else if (tokenOut == NATIVE_TOKEN) {
            // If output is native token, swap to WBNB first then unwrap
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: WRAPPED_NATIVE, // Output to WBNB
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle(params);
            
            // Convert WBNB to BNB
            IWETH(WRAPPED_NATIVE).withdraw(amountOut);
        } else {
            // Swap between ERC20 tokens
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle(params);
        }
        
        // Calculate fee amount (in millionths)
        uint256 feeAmount = (amountOut * feeRate) / 1000000;
        uint256 userAmount = amountOut - feeAmount;
        
        // Transfer fee to recipient (if fee > 0 and recipient is not zero address)
        if (feeAmount > 0 && feeRecipient != address(0)) {
            if (tokenOut == NATIVE_TOKEN) {
                // Native token fee transfer
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                require(success, "Fee transfer failed");
            } else {
                // ERC20 token fee transfer
                IERC20(tokenOut).safeTransfer(feeRecipient, feeAmount);
            }
        } else {
            // If no fee or recipient is zero address, user gets all output
            userAmount = amountOut;
            feeAmount = 0;
        }
        
        // Update user balance (amount after fee deduction)
        balances[tokenOut] += userAmount;
        
        // Add output token to list if new
        if (!tokenExists[tokenOut]) {
            tokenList.push(tokenOut);
            tokenExists[tokenOut] = true;
        }
        
        emit TradeSignal(
            investor, 
            tokenIn, 
            tokenOut, 
            amountIn, 
            amountOutMinimum, 
            amountOut, 
            feeRecipient, 
            feeAmount, 
            block.timestamp
        );
    }

    /**
     * @notice PancakeSwap V3 Multi-Hop Swap: Exact Input with path encoding
     * @dev Supports multi-hop swaps through multiple V3 pools
     *      Path encoding: tokenIn + fee + tokenMid + fee + tokenOut (packed bytes)
     * @param path Encoded swap path (tokenIn, fee, tokenMid, fee, tokenOut...)
     * @param tokenIn First token in the path (for balance check and event)
     * @param tokenOut Last token in the path (for balance update and event)
     * @param amountIn Amount of input token
     * @param amountOutMinimum Minimum amount of output token
     * @param feeRecipient Address to receive platform fee
     * @param feeRate Fee rate in millionths (1 = 0.0001%)
     */
    function swapExactInput(
        bytes calldata path,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address feeRecipient,
        uint256 feeRate
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        require(feeRate <= 1000000, "Fee rate too high");
        balances[tokenIn] -= amountIn;
        
        // Handle native token input
        if (tokenIn == NATIVE_TOKEN) {
            // For native token, we need to wrap it first
            IWETH(WRAPPED_NATIVE).deposit{value: amountIn}();
            TransferHelper.safeApprove(WRAPPED_NATIVE, address(swapRouter), amountIn);
        } else {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
        }
        
        // Determine actual output token address for router
        address actualTokenOut = tokenOut == NATIVE_TOKEN ? WRAPPED_NATIVE : tokenOut;
        
        // Execute V3 multi-hop swap
        IV3SwapRouter.ExactInputParams memory params = IV3SwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum
        });
        
        amountOut = IV3SwapRouter(address(swapRouter)).exactInput(params);
        
        // If output is native token, unwrap WBNB
        if (tokenOut == NATIVE_TOKEN) {
            IWETH(WRAPPED_NATIVE).withdraw(amountOut);
        }
        
        // Calculate and transfer fee
        uint256 feeAmount = (amountOut * feeRate) / 1000000;
        uint256 userAmount = amountOut - feeAmount;
        
        if (feeAmount > 0 && feeRecipient != address(0)) {
            if (tokenOut == NATIVE_TOKEN) {
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                require(success, "Fee transfer failed");
            } else {
                IERC20(tokenOut).safeTransfer(feeRecipient, feeAmount);
            }
        } else {
            userAmount = amountOut;
            feeAmount = 0;
        }
        
        // Update balance
        balances[tokenOut] += userAmount;
        
        if (!tokenExists[tokenOut]) {
            tokenList.push(tokenOut);
            tokenExists[tokenOut] = true;
        }
        
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountOutMinimum, amountOut, feeRecipient, feeAmount, block.timestamp);
    }

    /**
     * @notice PancakeSwap V2 Swap: Multi-hop through V2 pools
     * @dev Uses PancakeSwap V2 Router for legacy token swaps
     * @param path Array of token addresses [tokenIn, tokenMid..., tokenOut]
     * @param amountIn Amount of input token
     * @param amountOutMinimum Minimum amount of output token
     * @param feeRecipient Address to receive platform fee
     * @param feeRate Fee rate in millionths (1 = 0.0001%)
     */
    function swapV2(
        address[] calldata path,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address feeRecipient,
        uint256 feeRate
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(routerV2 != address(0), "V2 router not set");
        require(path.length >= 2, "Invalid path");
        
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        require(feeRate <= 1000000, "Fee rate too high");
        balances[tokenIn] -= amountIn;
        
        uint deadline = block.timestamp + 600;
        uint[] memory amounts;
        
        // Build actual path (replace NATIVE_TOKEN with WRAPPED_NATIVE)
        address[] memory actualPath = new address[](path.length);
        for (uint i = 0; i < path.length; i++) {
            actualPath[i] = path[i] == NATIVE_TOKEN ? WRAPPED_NATIVE : path[i];
        }
        
        if (tokenIn == NATIVE_TOKEN) {
            // Native -> Token(s)
            amounts = IPancakeRouterV2(routerV2).swapExactETHForTokens{value: amountIn}(
                amountOutMinimum,
                actualPath,
                address(this),
                deadline
            );
        } else if (tokenOut == NATIVE_TOKEN) {
            // Token(s) -> Native
            TransferHelper.safeApprove(tokenIn, routerV2, amountIn);
            amounts = IPancakeRouterV2(routerV2).swapExactTokensForETH(
                amountIn,
                amountOutMinimum,
                actualPath,
                address(this),
                deadline
            );
        } else {
            // Token -> Token(s)
            TransferHelper.safeApprove(tokenIn, routerV2, amountIn);
            amounts = IPancakeRouterV2(routerV2).swapExactTokensForTokens(
                amountIn,
                amountOutMinimum,
                actualPath,
                address(this),
                deadline
            );
        }
        
        amountOut = amounts[amounts.length - 1];
        
        // Calculate and transfer fee
        uint256 feeAmount = (amountOut * feeRate) / 1000000;
        uint256 userAmount = amountOut - feeAmount;
        
        if (feeAmount > 0 && feeRecipient != address(0)) {
            if (tokenOut == NATIVE_TOKEN) {
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                require(success, "Fee transfer failed");
            } else {
                IERC20(tokenOut).safeTransfer(feeRecipient, feeAmount);
            }
        } else {
            userAmount = amountOut;
            feeAmount = 0;
        }
        
        // Update balance
        balances[tokenOut] += userAmount;
        
        if (!tokenExists[tokenOut]) {
            tokenList.push(tokenOut);
            tokenExists[tokenOut] = true;
        }
        
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountOutMinimum, amountOut, feeRecipient, feeAmount, block.timestamp);
    }

    /**
     * @notice Set V2 Router address
     * @dev Can only be called by admin
     * @param _routerV2 PancakeSwap V2 Router address
     */
    function setRouterV2(address _routerV2) external onlyRole(ADMIN_ROLE) {
        require(_routerV2 != address(0), "Invalid router");
        routerV2 = _routerV2;
    }

    // --- Get Balance ---
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }

    // --- Get Tokens ---
    /**
     * @notice Get list of all token addresses added to the vault
     * @return Array of token addresses
     */
    function getTokens() external view returns (address[] memory) {
        return tokenList;
    }
}
