// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Using our own interface and library files
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./libraries/UniswapV2Library.sol";

// Using SafeERC20 instead of TransferHelper
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PersonalVaultUpgradeableV1
 * @author TradingFlow
 * @notice UUPS upgradeable personal vault contract with initialization and upgrade support
 * 
 * @dev Contract Version: V1
 *      Target Chain: Flow EVM
 *      DEX Integration: PunchSwap V2 (Uniswap V2 Fork)
 *      Swap Router: 0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1
 *      WFLOW: 0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
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
    IUniswapV2Router02 public swapRouter;

    // --- Native Token Related ---
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    address public WRAPPED_NATIVE; // WFLOW address

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
     * @param _wrappedNative The wrapped native token address (WFLOW)
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
        swapRouter = IUniswapV2Router02(_swapRouter);
        WRAPPED_NATIVE = _wrappedNative;

        // Grant roles - Owner gets DEFAULT_ADMIN_ROLE to manage all roles
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        
        // Admin gets ADMIN_ROLE for settings
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
            emit UserDeposit(msg.sender, NATIVE_TOKEN, msg.value, block.timestamp);
        }
    }

    // --- Deposit ERC20 ---
    function deposit(address token, uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(amount > 0, "Amount=0");
        require(token != NATIVE_TOKEN, "Use depositNative");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
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
        IERC20(token).transfer(msg.sender, amount);
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
     * @notice PunchSwap V2 Swap: Exact Input (fixed input for maximum output)
     * @dev Uses PunchSwap V2 Router (Uniswap V2 Fork) for swap
     *      Router address: 0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1
     */
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
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
            // If input is native token, use swapExactETHForTokens
            address[] memory path = new address[](2);
            path[0] = WRAPPED_NATIVE; // path starts with WFLOW
            path[1] = tokenOut;

            // Execute swap
            uint[] memory amounts = swapRouter.swapExactETHForTokens{value: amountIn}(
                amountOutMinimum,
                path,
                address(this),
                deadline
            );

            // Get output amount
            amountOut = amounts[1];
        } else if (tokenOut == NATIVE_TOKEN) {
            // If output is native token, use swapExactTokensForETH
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = WRAPPED_NATIVE; // path ends with WFLOW

            // Approve router to use tokens
            IERC20(tokenIn).approve(address(swapRouter), amountIn);

            // Execute swap
            uint[] memory amounts = swapRouter.swapExactTokensForETH(
                amountIn,
                amountOutMinimum,
                path,
                address(this),
                deadline
            );

            // Get output amount
            amountOut = amounts[1];
        } else {
            // Swap between ERC20 tokens
            // Approve router to use tokens
            IERC20(tokenIn).approve(address(swapRouter), amountIn);

            // First try direct path
            address[] memory directPath = new address[](2);
            directPath[0] = tokenIn;
            directPath[1] = tokenOut;

            // Check if direct pair exists
            address directPair = IUniswapV2Factory(swapRouter.factory()).getPair(tokenIn, tokenOut);

            if (directPair != address(0)) {
                // Direct path exists, use two-hop swap
                uint[] memory amounts = swapRouter.swapExactTokensForTokens(
                    amountIn,
                    amountOutMinimum,
                    directPath,
                    address(this),
                    deadline
                );
                amountOut = amounts[1];
            } else {
                // Direct path doesn't exist, try routing through WRAPPED_NATIVE
                address[] memory routedPath = new address[](3);
                routedPath[0] = tokenIn;
                routedPath[1] = WRAPPED_NATIVE;
                routedPath[2] = tokenOut;

                // Verify routed path exists
                address pair1 = IUniswapV2Factory(swapRouter.factory()).getPair(tokenIn, WRAPPED_NATIVE);
                address pair2 = IUniswapV2Factory(swapRouter.factory()).getPair(WRAPPED_NATIVE, tokenOut);
                require(pair1 != address(0) && pair2 != address(0), "No valid trading route");

                uint[] memory amounts = swapRouter.swapExactTokensForTokens(
                    amountIn,
                    amountOutMinimum,
                    routedPath,
                    address(this),
                    deadline
                );
                amountOut = amounts[2]; // final output of three-hop path
            }
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
                IERC20(tokenOut).transfer(feeRecipient, feeAmount);
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
