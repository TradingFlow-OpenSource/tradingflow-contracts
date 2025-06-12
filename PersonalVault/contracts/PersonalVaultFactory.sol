// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PersonalVault.sol";

/**
 * @title PersonalVaultFactory
 * @notice Factory contract for creating and managing personal vaults
 * @dev Each user gets their own personal vault
 */
contract PersonalVaultFactory is Ownable, ReentrancyGuard, AccessControl {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    
    // Mapping from user address to their vault
    mapping(address => address) public userVaults;
    
    // Array of all vault addresses
    address[] public allVaults;
    
    // Events
    event VaultCreated(address indexed user, address indexed vault);
    event BotAdded(address indexed bot);
    event BotRemoved(address indexed bot);
    
    /**
     * @notice Constructor
     * @param initialAdmin The initial admin address
     */
    constructor(address initialAdmin) Ownable(msg.sender) {
        require(initialAdmin != address(0), "Invalid admin address");
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, initialAdmin);
    }
    
    /**
     * @notice Create a new personal vault for a user
     * @param baseAsset The base asset (token) for the vault
     * @param name The name for the vault token
     * @param symbol The symbol for the vault token
     * @param swapRouter The address of the Uniswap swap router
     * @param priceOracle The address of the price oracle
     * @return The address of the newly created vault
     */
    function createVault(
        IERC20 baseAsset,
        string memory name,
        string memory symbol,
        address swapRouter,
        address priceOracle
    ) external nonReentrant returns (address) {
        require(userVaults[msg.sender] == address(0), "User already has a vault");
        
        // Create a new personal vault
        PersonalVault newVault = new PersonalVault(
            baseAsset,
            name,
            symbol,
            swapRouter,
            priceOracle,
            msg.sender, // The user is the investor
            address(this) // The factory is the owner
        );
        
        // Store the vault address
        address vaultAddress = address(newVault);
        userVaults[msg.sender] = vaultAddress;
        allVaults.push(vaultAddress);
        
        // Grant the factory admin role on the vault
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
        
        // Grant the bot role on all existing vaults
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVault vault = PersonalVault(allVaults[i]);
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
        
        // Revoke the bot role on all existing vaults
        for (uint i = 0; i < allVaults.length; i++) {
            PersonalVault vault = PersonalVault(allVaults[i]);
            vault.revokeRole(vault.ORACLE_ROLE(), botAddress);
        }
        
        emit BotRemoved(botAddress);
    }
    
    /**
     * @notice Get the vault address for a user
     * @param user The user address
     * @return The vault address
     */
    function getVault(address user) external view returns (address) {
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
    function _setupBotsForVault(PersonalVault vault) internal {
        // Get all addresses with the BOT_ROLE
        uint256 roleCount = getRoleMemberCount(BOT_ROLE);
        
        // Grant each bot the ORACLE_ROLE on the new vault
        for (uint256 i = 0; i < roleCount; i++) {
            address bot = getRoleMember(BOT_ROLE, i);
            vault.grantRole(vault.ORACLE_ROLE(), bot);
        }
    }
}
