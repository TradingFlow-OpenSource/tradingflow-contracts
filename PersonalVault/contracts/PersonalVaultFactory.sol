// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./PersonalVaultUpgradeable.sol";

/**
 * @title PersonalVaultFactory
 * @notice Factory contract for creating and managing personal vaults
 * @dev Each user gets their own personal vault
 */
contract PersonalVaultFactory is Ownable, AccessControl {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    
    // Mapping from user address to their vault
    mapping(address => address payable) public userVaults;
    
    // Array of all vault addresses
    address payable[] public allVaults;
    
    // Array to track all bot addresses
    address[] private botAddresses;
    
    // Events
    event VaultCreated(address indexed user, address indexed vault);
    event BotAdded(address indexed bot);
    event BotRemoved(address indexed bot);
    
    // PersonalVault implementation contract address
    address public personalVaultImplementation;
    
    event ImplementationChanged(address indexed newImplementation);
    
    /**
     * @notice Constructor
     * @param initialAdmin The initial admin address
     * @param _personalVaultImplementation The PersonalVault implementation contract address
     */
    constructor(address initialAdmin, address _personalVaultImplementation) Ownable(msg.sender) {
        require(initialAdmin != address(0), "Invalid admin address");
        require(_personalVaultImplementation != address(0), "Invalid implementation");
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, initialAdmin);
        
        personalVaultImplementation = _personalVaultImplementation;
        emit ImplementationChanged(_personalVaultImplementation);
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
        
        // Encode initialize data for proxy
        bytes memory data = abi.encodeWithSelector(
            PersonalVaultUpgradeable.initialize.selector,
            msg.sender, // investor
            msg.sender, // admin
            swapRouter,
            wrappedNative
        );
        
        // Create a new ERC1967Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(personalVaultImplementation, data);
        
        // Get the address of the newly created vault
        address payable vaultAddress = payable(address(proxy));
        
        // Store the vault address
        userVaults[msg.sender] = vaultAddress;
        allVaults.push(vaultAddress);
        
        // Grant the factory admin role on the vault
        PersonalVaultUpgradeable newVault = PersonalVaultUpgradeable(vaultAddress);
        newVault.grantRole(newVault.DEFAULT_ADMIN_ROLE(), address(this));
        
        // Grant bots access to the vault
        _setupBotsForVault(newVault);
        
        emit VaultCreated(msg.sender, vaultAddress);
        
        return vaultAddress;
    }
    
    /**
     * @notice Add a bot address that can execute trades
     * @param botAddress The address of the bot to add
     */
    function addBot(address botAddress) external onlyRole(ADMIN_ROLE) {
        require(botAddress != address(0), "Invalid bot address");
        
        _grantRole(BOT_ROLE, botAddress);
        botAddresses.push(botAddress);
        
        // Grant the bot role on all existing vaults
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVaultUpgradeable vault = PersonalVaultUpgradeable(payable(allVaults[i]));
            vault.grantRole(vault.ORACLE_ROLE(), botAddress);
        }
        
        emit BotAdded(botAddress);
    }
    
    /**
     * @notice Remove a bot address
     * @param botAddress The address of the bot to remove
     */
    function removeBot(address botAddress) external onlyRole(ADMIN_ROLE) {
        require(hasRole(BOT_ROLE, botAddress), "Address is not a bot");
        
        _revokeRole(BOT_ROLE, botAddress);
        
        // Remove from botAddresses array
        for (uint i = 0; i < botAddresses.length; i++) {
            if (botAddresses[i] == botAddress) {
                // Replace with the last element and pop
                botAddresses[i] = botAddresses[botAddresses.length - 1];
                botAddresses.pop();
                break;
            }
        }
        
        // Revoke the bot role on all existing vaults
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVaultUpgradeable vault = PersonalVaultUpgradeable(payable(allVaults[i]));
            vault.revokeRole(vault.ORACLE_ROLE(), botAddress);
        }
        
        emit BotRemoved(botAddress);
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
    
    /**
     * @notice Set up bots for a new vault
     * @param vault The vault to set up bots for
     */
    function _setupBotsForVault(PersonalVaultUpgradeable vault) internal {
        // Use the botAddresses array instead of role enumeration
        for (uint256 i = 0; i < botAddresses.length; i++) {
            address bot = botAddresses[i];
            vault.grantRole(vault.ORACLE_ROLE(), bot);
        }
    }
}
