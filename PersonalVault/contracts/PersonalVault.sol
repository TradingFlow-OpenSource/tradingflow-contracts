// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PersonalVault
 * @notice EVM personal vault contract inspired by TradingFlow Aptos vault logic
 * @dev Each instance is owned by a single user, all balances are tracked per vault
 */
contract PersonalVault is Ownable, ReentrancyGuard, AccessControl {
    // --- Roles ---
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // bot or admin for trade
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address public immutable investor;

    // --- Events ---
    event VaultInitialized(address indexed owner, uint256 timestamp);
    event UserDeposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event UserWithdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event TradeSignal(address indexed user, address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOutMin, uint256 amountOut, uint256 timestamp);

    // --- Balances ---
    mapping(address => uint256) public balances; // token address => amount

    constructor(
        IERC20 baseAsset,
        string memory name,
        string memory symbol,
        address swapRouter,
        address priceOracle,
        address _investor,
        address admin
    ) Ownable(admin) {
        require(_investor != address(0), "Invalid investor");
        investor = _investor;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        emit VaultInitialized(_investor, block.timestamp);
    }

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

    // --- Trade Signal (to be called by bot/admin) ---
    function tradeSignal(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address swapRouter,
        bytes calldata swapData
    ) external nonReentrant onlyRole(ORACLE_ROLE) returns (uint256 amountOut) {
        require(balances[fromToken] >= amountIn, "Insufficient balance");
        balances[fromToken] -= amountIn;
        IERC20(fromToken).approve(swapRouter, amountIn);
        // Assume swapRouter is a contract that supports low-level call with swapData
        (bool success, bytes memory result) = swapRouter.call(swapData);
        require(success, "Swap failed");
        // Parse amountOut from result (implementation depends on router ABI)
        // For demonstration, assume result is uint256 amountOut
        amountOut = abi.decode(result, (uint256));
        require(amountOut >= amountOutMin, "Below min amount");
        balances[toToken] += amountOut;
        emit TradeSignal(investor, fromToken, toToken, amountIn, amountOutMin, amountOut, block.timestamp);
    }

    // --- Get Balance ---
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }
}
