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
 * @title PersonalVaultUpgradeableUniV3
 * @notice UUPS可升级的个人金库合约，使用PancakeSwap V3进行交换，支持初始化和升级
 */
contract PersonalVaultUpgradeableUniV3 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
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

    function initialize(address _investor, address admin, address bot, address _swapRouter, address _wrappedNative, address factory) public initializer {
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
        _grantRole(ORACLE_ROLE, bot);
        
        // 授予工厂合约管理员权限，以便它可以管理角色
        _grantRole(DEFAULT_ADMIN_ROLE, factory);
        
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

    // --- PancakeSwap V3 Swap: Exact Input (固定输入换最多输出) ---
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address feeRecipient,
        uint256 feeRate  // 费率，按百万分之一为基本单位 (1 = 0.0001%)
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        require(feeRate <= 1000000, "Fee rate too high"); // 最大费率100%
        balances[tokenIn] -= amountIn;
        
        // 设置交易截止时间
        uint deadline = block.timestamp + 600;
        
        // 处理输入代币
        if (tokenIn == NATIVE_TOKEN) {
            // 如果是原生代币，使用value参数
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: WRAPPED_NATIVE, // 使用WBNB地址
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
            // 如果输出是原生代币，需要先换成WBNB然后unwrap
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: WRAPPED_NATIVE, // 输出到WBNB
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
            amountOut = swapRouter.exactInputSingle(params);
            
            // 将WBNB转换为BNB
            IWETH(WRAPPED_NATIVE).withdraw(amountOut);
        } else {
            // ERC20代币之间的交换
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
        
        // 计算费用金额（按百万分之一为基本单位）
        uint256 feeAmount = (amountOut * feeRate) / 1000000;
        uint256 userAmount = amountOut - feeAmount;
        
        // 转账费用给收费人（如果费用大于0且收费人不是零地址）
        if (feeAmount > 0 && feeRecipient != address(0)) {
            if (tokenOut == NATIVE_TOKEN) {
                // 原生代币费用转账
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                require(success, "Fee transfer failed");
            } else {
                // ERC20代币费用转账
                IERC20(tokenOut).transfer(feeRecipient, feeAmount);
            }
        } else {
            // 如果没有费用或收费人为零地址，用户获得全部输出
            userAmount = amountOut;
            feeAmount = 0;
        }
        
        // 更新用户余额（扣除费用后的金额）
        balances[tokenOut] += userAmount;
        
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
}

