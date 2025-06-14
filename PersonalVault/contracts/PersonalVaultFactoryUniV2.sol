// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./PersonalVaultUpgradeableUniV2.sol";

/**
 * @title PersonalVaultFactoryUniV2
 * @notice 个人金库工厂合约，用于创建和管理用户的个人金库，使用Uniswap V2/PunchSwap V2进行交换
 */
contract PersonalVaultFactoryUniV2 is Ownable, AccessControl {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    
    // Mapping from user address to their vault
    mapping(address => address payable) public userVaults;
    
    // Array of all vault addresses
    address payable[] public allVaults;
    
    // 单一机器人地址
    address public botAddress;
    
    // Events
    event VaultCreated(address indexed user, address indexed vault);
    event BotUpdated(address indexed oldBot, address indexed newBot);
    
    // PersonalVault implementation contract address
    address public personalVaultImplementation;
    
    event ImplementationChanged(address indexed newImplementation);
    
    /**
     * @notice Constructor
     * @param initialAdmin The initial admin address
     * @param _personalVaultImplementation The PersonalVault implementation contract address
     * @param _botAddress The bot address that can execute trades
     */
    constructor(address initialAdmin, address _personalVaultImplementation, address _botAddress) Ownable(msg.sender) {
        require(initialAdmin != address(0), "Invalid admin address");
        require(_personalVaultImplementation != address(0), "Invalid implementation");
        require(_botAddress != address(0), "Invalid bot address");
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, initialAdmin);
        
        // 设置实现合约地址
        personalVaultImplementation = _personalVaultImplementation;
        emit ImplementationChanged(_personalVaultImplementation);
        
        // 设置机器人地址并授予BOT_ROLE
        botAddress = _botAddress;
        _grantRole(BOT_ROLE, _botAddress);
        emit BotUpdated(address(0), _botAddress);
    }
    
    /**
     * @notice Set the PersonalVault implementation contract address
     * @param _impl The new implementation contract address
     */
    function setImplementation(address _impl) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_impl != address(0), "Invalid implementation");
        personalVaultImplementation = _impl;
        emit ImplementationChanged(_impl);
    }
    
    /**
     * @notice Create a new personal vault for a user
     * @param swapRouter The address of the Uniswap swap router
     * @param wrappedNative The address of the wrapped native token (WETH/WFLOW)
     * @return The address of the newly created vault
     */
    function createVault(address swapRouter, address wrappedNative) external returns (address payable) {
        require(userVaults[msg.sender] == address(0), "User already has a vault");
        require(personalVaultImplementation != address(0), "No implementation");
        require(wrappedNative != address(0), "Invalid wrapped native");
        require(botAddress != address(0), "Bot address not set");
        
        // Encode initialize data for proxy
        bytes memory data = abi.encodeWithSelector(
            PersonalVaultUpgradeableUniV2.initialize.selector,
            msg.sender, // investor
            msg.sender, // admin
            botAddress, // bot
            swapRouter,
            wrappedNative,
            address(this) // factory
        );
        
        // Create a new ERC1967Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(personalVaultImplementation, data);
        
        // Get the address of the newly created vault
        address payable vaultAddress = payable(address(proxy));
        
        // Store the vault address
        userVaults[msg.sender] = vaultAddress;
        allVaults.push(vaultAddress);
        
        // Grant the factory admin role on the vault
        PersonalVaultUpgradeableUniV2 newVault = PersonalVaultUpgradeableUniV2(vaultAddress);
        newVault.grantRole(newVault.DEFAULT_ADMIN_ROLE(), address(this));
        
        // 为新金库授予ORACLE_ROLE给机器人地址
        newVault.grantRole(newVault.ORACLE_ROLE(), botAddress);
        
        emit VaultCreated(msg.sender, vaultAddress);
        
        return vaultAddress;
    }
    
    /**
     * @notice Set the bot address that can execute trades
     * @param newBotAddress The new bot address
     */
    function setBot(address newBotAddress) external onlyRole(ADMIN_ROLE) {
        require(newBotAddress != address(0), "Invalid bot address");
        require(newBotAddress != botAddress, "Same as current bot");
        
        address oldBotAddress = botAddress;
        
        // 撤销旧机器人的权限
        if (oldBotAddress != address(0)) {
            _revokeRole(BOT_ROLE, oldBotAddress);
            
            // 从所有金库中撤销旧机器人的权限
            for (uint i = 0; i < allVaults.length; i++) {
                PersonalVaultUpgradeableUniV2 vault = PersonalVaultUpgradeableUniV2(payable(allVaults[i]));
                vault.revokeRole(vault.ORACLE_ROLE(), oldBotAddress);
            }
        }
        
        // 设置新机器人地址
        botAddress = newBotAddress;
        _grantRole(BOT_ROLE, newBotAddress);
        
        // 为所有金库授予新机器人的权限
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVaultUpgradeableUniV2 vault = PersonalVaultUpgradeableUniV2(payable(allVaults[i]));
            vault.grantRole(vault.ORACLE_ROLE(), newBotAddress);
        }
        
        emit BotUpdated(oldBotAddress, newBotAddress);
    }
    
    /**
     * @notice Get the current bot address
     * @return The current bot address
     */
    function getBot() external view returns (address) {
        return botAddress;
    }
    
    /**
     * @notice Get the vault address for a user
     * @param user The user address
     * @return The vault address
     */
    function getVault(address user) external view returns (address payable) {
        return userVaults[user];
    }
    
    /**
     * @notice Get the number of vaults created
     * @return The number of vaults
     */
    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }
    

}
