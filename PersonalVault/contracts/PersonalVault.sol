// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";   
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/**
 * @title PersonalVaultUpgradeable
 * @notice UUPS可升级的个人金库合约，支持初始化和升级
 */
contract PersonalVaultUpgradeable is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // --- Roles ---
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // bot or admin for trade
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address public investor;
    ISwapRouter public swapRouter;

    // --- Events ---
    event VaultInitialized(address indexed owner, uint256 timestamp);
    event UserDeposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event UserWithdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event TradeSignal(address indexed user, address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOutMin, uint256 amountOut, uint256 timestamp);

    // --- Balances ---
    mapping(address => uint256) public balances; // token address => amount

    function initialize(address _investor, address admin, address _swapRouter) public initializer {
        __Ownable_init(admin);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        require(_investor != address(0), "Invalid investor");
        require(_swapRouter != address(0), "Invalid router");
        investor = _investor;
        swapRouter = ISwapRouter(_swapRouter);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        emit VaultInitialized(_investor, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}


    // --- Deposit ---
    function deposit(address token, uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(amount > 0, "Amount=0");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balances[token] += amount;
        emit UserDeposit(msg.sender, token, amount, block.timestamp);
    }

    // --- Withdraw ---
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(balances[token] >= amount, "Insufficient balance");
        balances[token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit UserWithdraw(msg.sender, token, amount, block.timestamp);
    }

    // --- UniswapV3/PunchSwapV3 Swap: Exact Input (固定输入换最多输出) ---
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        balances[tokenIn] -= amountIn;
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 600,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });
        amountOut = swapRouter.exactInputSingle(params);
        balances[tokenOut] += amountOut;
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountOutMinimum, amountOut, block.timestamp);
    }

    // --- UniswapV3/PunchSwapV3 Swap: Exact Output (固定输出换最少输入) ---
    function swapExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountIn) {
        require(balances[tokenIn] >= amountInMaximum, "Insufficient balance");
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 600,
            amountOut: amountOut,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        });
        amountIn = swapRouter.exactOutputSingle(params);
        balances[tokenIn] -= amountIn;
        balances[tokenOut] += amountOut;
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
            IERC20(tokenIn).transfer(investor, amountInMaximum - amountIn);
        }
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountInMaximum, amountOut, block.timestamp);
    }

    // --- Get Balance ---
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }
}

