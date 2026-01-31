// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./PersonalVaultUpgradeableV1.sol";

/**
 * @title PersonalVaultFactoryV1
 * @author TradingFlow
 * @notice Personal vault factory contract for creating and managing user vaults
 * 
 * @dev Contract Version: V1
 *      Target Chain: Flow EVM
 *      DEX Integration: PunchSwap V2 (Uniswap V2 Fork)
 *      
 *      Recommended Deployment Parameters:
 *      - Swap Router: 0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1 (PunchSwap V2)
 *      - WFLOW: 0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
 */
contract PersonalVaultFactoryV1 is Ownable, AccessControl {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    
    // Mapping from user address to their vault
    mapping(address => address payable) public userVaults;
    
    // Array of all vault addresses
    address payable[] public allVaults;
    
    // Single bot address (for ORACLE_ROLE in vaults)
    address public botAddress;
    
    // Vault owner address (for UUPS upgrades) - platform controlled
    address public vaultOwner;
    
    // Vault admin address (for ADMIN_ROLE settings) - platform controlled
    address public vaultAdmin;
    
    // Events
    event VaultCreated(address indexed user, address indexed vault);
    event BotUpdated(address indexed oldBot, address indexed newBot);
    event VaultOwnerUpdated(address indexed oldOwner, address indexed newOwner);
    event VaultAdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    
    // PersonalVault implementation contract address
    address public personalVaultImplementation;
    
    event ImplementationChanged(address indexed newImplementation);
    
    /**
     * @notice Constructor
     * @param _vaultOwner The address that will own all vaults (for UUPS upgrades)
     * @param _vaultAdmin The address that will be admin of all vaults (for settings)
     * @param _personalVaultImplementation The PersonalVault implementation contract address
     * @param _botAddress The bot address that can execute trades
     */
    constructor(
        address _vaultOwner,
        address _vaultAdmin,
        address _personalVaultImplementation, 
        address _botAddress
    ) Ownable(msg.sender) {
        require(_vaultOwner != address(0), "Invalid vault owner");
        require(_vaultAdmin != address(0), "Invalid vault admin");
        require(_personalVaultImplementation != address(0), "Invalid implementation");
        require(_botAddress != address(0), "Invalid bot address");
        
        // Set up factory roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, _vaultAdmin);
        
        // Store vault role addresses
        vaultOwner = _vaultOwner;
        vaultAdmin = _vaultAdmin;
        
        // Set implementation contract address
        personalVaultImplementation = _personalVaultImplementation;
        emit ImplementationChanged(_personalVaultImplementation);
        
        // Set bot address and grant BOT_ROLE
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
     * @dev Uses PunchSwap V2 Router for swap
     *      Role separation:
     *      - Owner (vaultOwner): Can upgrade contract via UUPS, has DEFAULT_ADMIN_ROLE
     *      - Admin (vaultAdmin): Has ADMIN_ROLE for settings
     *      - Bot (botAddress): Has ORACLE_ROLE for executing trades
     *      - Investor (msg.sender): Can deposit/withdraw funds
     * @param swapRouter The address of the swap router (recommended: 0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1)
     * @param wrappedNative The address of the wrapped native token (WFLOW: 0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e)
     * @return The address of the newly created vault
     */
    function createVault(address swapRouter, address wrappedNative) external returns (address payable) {
        require(userVaults[msg.sender] == address(0), "User already has a vault");
        require(personalVaultImplementation != address(0), "No implementation");
        require(wrappedNative != address(0), "Invalid wrapped native");
        require(botAddress != address(0), "Bot address not set");
        require(vaultOwner != address(0), "Vault owner not set");
        require(vaultAdmin != address(0), "Vault admin not set");
        
        // Encode initialize data for proxy with separated roles
        bytes memory data = abi.encodeWithSelector(
            PersonalVaultUpgradeableV1.initialize.selector,
            msg.sender,   // investor - the user who can deposit/withdraw
            vaultOwner,   // owner - platform controlled, can upgrade
            vaultAdmin,   // admin - platform controlled, can change settings
            botAddress,   // bot - can execute trades
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
        
        // Revoke old bot's permissions
        if (oldBotAddress != address(0)) {
            _revokeRole(BOT_ROLE, oldBotAddress);
            
            // Revoke old bot's permissions from all vaults
            for (uint i = 0; i < allVaults.length; i++) {
                PersonalVaultUpgradeableV1 vault = PersonalVaultUpgradeableV1(payable(allVaults[i]));
                vault.revokeRole(vault.ORACLE_ROLE(), oldBotAddress);
            }
        }
        
        // Set new bot address
        botAddress = newBotAddress;
        _grantRole(BOT_ROLE, newBotAddress);
        
        // Grant new bot's permissions to all vaults
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVaultUpgradeableV1 vault = PersonalVaultUpgradeableV1(payable(allVaults[i]));
            vault.grantRole(vault.ORACLE_ROLE(), newBotAddress);
        }
        
        emit BotUpdated(oldBotAddress, newBotAddress);
    }
    
    /**
     * @notice Set the vault owner address (for new vaults only)
     * @dev Only affects newly created vaults, existing vaults keep their owner
     * @param newVaultOwner The new vault owner address
     */
    function setVaultOwner(address newVaultOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newVaultOwner != address(0), "Invalid vault owner");
        require(newVaultOwner != vaultOwner, "Same as current owner");
        
        address oldVaultOwner = vaultOwner;
        vaultOwner = newVaultOwner;
        
        emit VaultOwnerUpdated(oldVaultOwner, newVaultOwner);
    }
    
    /**
     * @notice Set the vault admin address (for new vaults only)
     * @dev Only affects newly created vaults, existing vaults keep their admin
     * @param newVaultAdmin The new vault admin address
     */
    function setVaultAdmin(address newVaultAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newVaultAdmin != address(0), "Invalid vault admin");
        require(newVaultAdmin != vaultAdmin, "Same as current admin");
        
        address oldVaultAdmin = vaultAdmin;
        vaultAdmin = newVaultAdmin;
        
        // Update factory ADMIN_ROLE
        _revokeRole(ADMIN_ROLE, oldVaultAdmin);
        _grantRole(ADMIN_ROLE, newVaultAdmin);
        
        emit VaultAdminUpdated(oldVaultAdmin, newVaultAdmin);
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
