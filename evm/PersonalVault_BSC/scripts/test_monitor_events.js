/**
 * Test script to generate events for monitor testing
 * Uses existing deployed Factory contract
 */

const { ethers } = require("hardhat");

// Deployed Factory address
const FACTORY_ADDRESS = "0x900D6498A4DDa72745B4B2c0Ed80B6F305B3eE51";
// Existing Vault address (from database)
const VAULT_ADDRESS = "0x5e5c29d1d2cb097db3d539039dfb9a537828396e";
// BSC Testnet addresses
const SWAP_ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap V2 Router
const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"; // Wrapped BNB Testnet

const FACTORY_ABI = [
  "function createVault(address swapRouter, address wrappedNative) external returns (address)",
  "function userVaults(address user) external view returns (address)",
  "event VaultCreated(address indexed user, address indexed vault)"
];

const VAULT_ABI = [
  "function deposit() external payable",
  "function investor() external view returns (address)",
  "event UserDeposit(address indexed user, uint256 amount)"
];

async function main() {
  console.log("\n============================================================");
  console.log("TEST MONITOR EVENTS");
  console.log("============================================================\n");

  const signers = await ethers.getSigners();
  // Use first account (Deployer) - it doesn't have a vault yet
  const user = signers[0]; // Deployer account
  
  console.log(`Test account: ${user.address}`);
  const balance = await ethers.provider.getBalance(user.address);
  console.log(`User balance: ${ethers.formatEther(balance)} tBNB`);

  // Connect to Factory
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, user);
  
  // Connect to existing Vault
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, user);
  
  try {
    // Check if user is the investor of the vault
    const investor = await vault.investor();
    console.log(`\nVault investor: ${investor}`);
    
    // Check if user already has a vault
    const existingVault = await factory.userVaults(user.address);
    console.log(`\nExisting vault for user: ${existingVault}`);
    
    if (existingVault !== ethers.ZeroAddress) {
      console.log("User already has a vault, skipping creation");
    } else {
      // Try to create a new vault to generate VaultCreated event
      console.log("\n--- Creating New Vault ---");
      console.log(`Swap Router: ${SWAP_ROUTER}`);
      console.log(`WBNB: ${WBNB}`);
      console.log("Creating new vault via Factory...");
    }
    
    try {
      const tx = await factory.createVault(SWAP_ROUTER, WBNB);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      
      // Find VaultCreated event
      console.log(`\nSearching for VaultCreated event in ${receipt.logs.length} logs...`);
      for (const log of receipt.logs) {
        console.log(`  Log from: ${log.address}`);
        if (log.topics[0] === ethers.id("VaultCreated(address,address)")) {
          const userAddr = ethers.getAddress("0x" + log.topics[1].slice(26));
          const vaultAddr = ethers.getAddress("0x" + log.topics[2].slice(26));
          console.log(`✅ VaultCreated event found!`);
          console.log(`   User: ${userAddr}`);
          console.log(`   Vault: ${vaultAddr}`);
        }
      }
    } catch (createError) {
      // Vault might already exist for this user
      console.log(`Create vault error: ${createError.message}`);
      if (createError.message.includes("Vault already exists")) {
        console.log("User already has a vault, trying deposit instead...");
      }
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }

  console.log("\n============================================================");
  console.log("TEST COMPLETE - Check monitor logs for event processing");
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
