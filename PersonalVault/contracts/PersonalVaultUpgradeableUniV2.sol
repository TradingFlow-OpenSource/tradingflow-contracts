// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";   
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// 使用我们自己创建的接口和库文件
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./libraries/UniswapV2Library.sol";

// 使用SafeERC20替代TransferHelper
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PersonalVaultUpgradeableUniV2
 * @notice UUPS可升级的个人金库合约，使用Uniswap V2/PunchSwap V2进行交换，支持初始化和升级
 */
contract PersonalVaultUpgradeableUniV2 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // 使用SafeERC20库
    using SafeERC20 for IERC20;
    
    // --- Roles ---
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // bot or admin for trade
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address public investor;
    IUniswapV2Router02 public swapRouter;
    
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

    function initialize(address _investor, address admin, address bot, address _swapRouter, address _wrappedNative, address factory) public initializer {
        __Ownable_init(admin);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        investor = _investor;
        swapRouter = IUniswapV2Router02(_swapRouter);
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

    // --- UniswapV2/PunchSwapV2 Swap: Exact Input (固定输入换最多输出) ---
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external onlyRole(ORACLE_ROLE) nonReentrant returns (uint256 amountOut) {
        require(balances[tokenIn] >= amountIn, "Insufficient balance");
        balances[tokenIn] -= amountIn;
        
        // 设置交易截止时间
        uint deadline = block.timestamp + 600;
        
        // 创建交易路径
        address[] memory path = new address[](2);
        
        // 处理输入代币
        if (tokenIn == NATIVE_TOKEN) {
            // 如果输入是原生代币，使用swapExactETHForTokens
            path[0] = WRAPPED_NATIVE; // 路径起点是WETH/WFLOW
            path[1] = tokenOut;
            
            // 执行交换
            uint[] memory amounts = swapRouter.swapExactETHForTokens{value: amountIn}(
                amountOutMinimum,
                path,
                address(this),
                deadline
            );
            
            // 获取输出金额
            amountOut = amounts[1];
        } else if (tokenOut == NATIVE_TOKEN) {
            // 如果输出是原生代币，使用swapExactTokensForETH
            path[0] = tokenIn;
            path[1] = WRAPPED_NATIVE; // 路径终点是WETH/WFLOW
            
            // 批准路由器使用代币
            IERC20(tokenIn).approve(address(swapRouter), amountIn);
            
            // 执行交换
            uint[] memory amounts = swapRouter.swapExactTokensForETH(
                amountIn,
                amountOutMinimum,
                path,
                address(this),
                deadline
            );
            
            // 获取输出金额
            amountOut = amounts[1];
        } else {
            // 如果是常规ERC20代币交换，使用swapExactTokensForTokens
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            // 批准路由器使用代币
            IERC20(tokenIn).approve(address(swapRouter), amountIn);
            
            // 执行交换
            uint[] memory amounts = swapRouter.swapExactTokensForTokens(
                amountIn,
                amountOutMinimum,
                path,
                address(this),
                deadline
            );
            
            // 获取输出金额
            amountOut = amounts[1];
        }
        
        // 更新余额
        if (tokenOut == NATIVE_TOKEN) {
            // 对于原生代币，已经通过swapExactTokensForETH自动转入合约
            balances[NATIVE_TOKEN] += amountOut;
        } else {
            // 常规ERC20代币，已经转入合约
            balances[tokenOut] += amountOut;
        }
        
        emit TradeSignal(investor, tokenIn, tokenOut, amountIn, amountOutMinimum, amountOut, block.timestamp);
    }

    // --- Get Balance ---
    function getBalance(address token) external view returns (uint256) {
        return balances[token];
    }
}
