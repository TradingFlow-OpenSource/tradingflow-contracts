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
 * @title IWETH
 * @notice 包装原生代币的接口
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

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
    
    // --- 原生代币相关 ---
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    address public WRAPPED_NATIVE; // WETH/WFLOW 地址

    // --- Events ---
    event VaultInitialized(address indexed owner, uint256 timestamp);
    event UserDeposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event UserWithdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event TradeSignal(address indexed user, address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOutMin, uint256 amountOut, uint256 timestamp);

    // --- Balances ---
    mapping(address => uint256) public balances; // token address => amount

    function initialize(address _investor, address admin, address _swapRouter, address _wrappedNative) public initializer {
        __Ownable_init(admin);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        require(_investor != address(0), "Invalid investor");
        require(_swapRouter != address(0), "Invalid router");
        require(_wrappedNative != address(0), "Invalid wrapped native");
        investor = _investor;
        swapRouter = ISwapRouter(_swapRouter);
        WRAPPED_NATIVE = _wrappedNative;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        emit VaultInitialized(_investor, block.timestamp);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}


    // --- 接收原生代币 ---
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
        emit UserDeposit(msg.sender, token, amount, block.timestamp);
    }
    
    // --- Deposit Native Token ---
    function depositNative() external payable nonReentrant {
        require(msg.sender == investor, "Only investor");
        require(msg.value > 0, "Amount=0");
        balances[NATIVE_TOKEN] += msg.value;
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
        
        // 处理输入代币
        if (tokenIn == NATIVE_TOKEN) {
            // 如果是原生代币，使用value参数
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: WRAPPED_NATIVE, // 使用WETH/WFLOW地址
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 600,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle{value: amountIn}(params);
        } else {
            // 如果是ERC20代币，使用常规方式
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut == NATIVE_TOKEN ? WRAPPED_NATIVE : tokenOut, // 如果输出是原生代币，使用WETH/WFLOW
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 600,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle(params);
        }
        
        // 如果输出是原生代币，需要特殊处理
        if (tokenOut == NATIVE_TOKEN) {
            // 原生代币已经自动转入合约
            balances[NATIVE_TOKEN] += amountOut;
        } else {
            // 常规ERC20代币
            balances[tokenOut] += amountOut;
        }
        
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountOutMinimum, amountOut, block.timestamp);
    }

    // --- Get Balance ---
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }
}

