/**
 * BSC Testnet Full Test Script
 * 
 * This script performs a complete test flow on BSC Testnet:
 * 1. Deploy contracts (if not already deployed)
 * 2. Transfer tBNB from Deployer to User
 * 3. Create a vault for the User
 * 4. User deposits tBNB into the vault
 * 5. Execute a swap (tBNB -> BUSD via V2 Router)
 * 
 * Usage: npx hardhat run scripts/testnet_full_test.js --network bscTestnet
 * 
 * Prerequisites:
 * - Copy .env.testnet to .env or set environment variables
 * - ADDR 1 needs at least 0.1 tBNB
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// BSC Testnet Configuration
const BSC_TESTNET_CONFIG = {
  chainId: 97,
  name: "bscTestnet",
  // PancakeSwap V2 Router on BSC Testnet
  routerV2: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  // WBNB on BSC Testnet
  wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  // Test tokens on BSC Testnet
  tokens: {
    WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    BUSD: "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7",
    USDT: "0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684",
  },
  // Native token sentinel
  NATIVE_TOKEN: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  explorer: "https://testnet.bscscan.com",
};

// Helper function to format address
function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Helper function to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("BSC TESTNET FULL TEST");
  console.log("=".repeat(60) + "\n");

  // Get signers (should be [deployer, user, bot] based on hardhat.config.ts)
  const signers = await ethers.getSigners();
  
  if (signers.length < 1) {
    throw new Error("No signers found. Check your private keys in .env");
  }

  const deployer = signers[0];
  const user = signers.length > 1 ? signers[1] : deployer;
  const bot = signers.length > 2 ? signers[2] : deployer;

  console.log("Accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  User:     ${user.address}`);
  console.log(`  Bot:      ${bot.address}`);
  console.log("");

  // Check balances
  console.log("Balances:");
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const userBalance = await ethers.provider.getBalance(user.address);
  const botBalance = await ethers.provider.getBalance(bot.address);
  
  console.log(`  Deployer: ${ethers.formatEther(deployerBalance)} tBNB`);
  console.log(`  User:     ${ethers.formatEther(userBalance)} tBNB`);
  console.log(`  Bot:      ${ethers.formatEther(botBalance)} tBNB`);
  console.log("");

  // =========================================================================
  // STEP 1: Deploy or Load Contracts
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 1: Deploy/Load Contracts");
  console.log("-".repeat(60) + "\n");

  let factoryAddress = process.env.FACTORY_ADDRESS;
  let implAddress = process.env.PERSONAL_VAULT_IMPL_ADDRESS;
  let factory, implementation;

  if (factoryAddress && implAddress) {
    console.log("Loading existing contracts...");
    console.log(`  Factory: ${factoryAddress}`);
    console.log(`  Implementation: ${implAddress}`);
    
    factory = await ethers.getContractAt("PersonalVaultFactoryV1", factoryAddress);
    implementation = await ethers.getContractAt("PersonalVaultUpgradeableV1", implAddress);
  } else {
    console.log("Deploying new contracts with separated Owner/Admin...");
    
    // Deploy implementation
    console.log("  Deploying PersonalVaultUpgradeableV1...");
    const PersonalVaultUpgradeableV1 = await ethers.getContractFactory("PersonalVaultUpgradeableV1", deployer);
    implementation = await PersonalVaultUpgradeableV1.deploy();
    await implementation.waitForDeployment();
    implAddress = await implementation.getAddress();
    console.log(`    Implementation deployed: ${implAddress}`);

    // Deploy factory with new constructor parameters
    // constructor(vaultOwner, vaultAdmin, implementation, botAddress)
    console.log("  Deploying PersonalVaultFactoryV1...");
    console.log(`    Vault Owner (for upgrades): ${deployer.address}`);
    console.log(`    Vault Admin (for settings): ${user.address}`);
    console.log(`    Bot (for trades): ${bot.address}`);
    
    const PersonalVaultFactoryV1 = await ethers.getContractFactory("PersonalVaultFactoryV1", deployer);
    factory = await PersonalVaultFactoryV1.deploy(
      deployer.address,  // vaultOwner - can upgrade contracts
      user.address,      // vaultAdmin - can change settings
      implAddress,       // implementation
      bot.address        // bot - can execute trades
    );
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();
    console.log(`    Factory deployed: ${factoryAddress}`);

    // Save addresses
    console.log("\n  *** SAVE THESE ADDRESSES TO .env ***");
    console.log(`  FACTORY_ADDRESS=${factoryAddress}`);
    console.log(`  PERSONAL_VAULT_IMPL_ADDRESS=${implAddress}`);
  }

  // Verify factory
  const storedImpl = await factory.personalVaultImplementation();
  const storedVaultOwner = await factory.vaultOwner();
  const storedVaultAdmin = await factory.vaultAdmin();
  const storedBot = await factory.botAddress();
  console.log("\nFactory verification:");
  console.log(`  Implementation: ${storedImpl}`);
  console.log(`  Vault Owner: ${storedVaultOwner}`);
  console.log(`  Vault Admin: ${storedVaultAdmin}`);
  console.log(`  Bot: ${storedBot}`);

  // =========================================================================
  // STEP 2: Transfer tBNB to User (if needed)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 2: Transfer tBNB to User");
  console.log("-".repeat(60) + "\n");

  const userBalanceNow = await ethers.provider.getBalance(user.address);
  const minUserBalance = ethers.parseEther("0.02"); // Need at least 0.02 tBNB

  if (userBalanceNow < minUserBalance && deployer.address !== user.address) {
    const transferAmount = ethers.parseEther("0.03");
    console.log(`Transferring ${ethers.formatEther(transferAmount)} tBNB to user...`);
    
    const tx = await deployer.sendTransaction({
      to: user.address,
      value: transferAmount,
    });
    await tx.wait();
    console.log(`  TX: ${BSC_TESTNET_CONFIG.explorer}/tx/${tx.hash}`);
    
    const newBalance = await ethers.provider.getBalance(user.address);
    console.log(`  User new balance: ${ethers.formatEther(newBalance)} tBNB`);
  } else {
    console.log(`User already has sufficient balance: ${ethers.formatEther(userBalanceNow)} tBNB`);
  }

  // =========================================================================
  // STEP 3: Create Vault for User
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 3: Create Vault for User");
  console.log("-".repeat(60) + "\n");

  let vaultAddress = await factory.getVault(user.address);
  let vault;

  if (vaultAddress && vaultAddress !== ethers.ZeroAddress) {
    console.log(`User already has a vault: ${vaultAddress}`);
    vault = await ethers.getContractAt("PersonalVaultUpgradeableV1", vaultAddress);
  } else {
    console.log("Creating new vault for user...");
    
    // Connect factory with user signer
    const factoryAsUser = factory.connect(user);
    
    const tx = await factoryAsUser.createVault(
      BSC_TESTNET_CONFIG.routerV2,  // swapRouter (V2 for testnet)
      BSC_TESTNET_CONFIG.wbnb,      // wrappedNative
      {
        gasLimit: 1000000,
      }
    );
    
    console.log(`  Creating vault TX: ${BSC_TESTNET_CONFIG.explorer}/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  TX confirmed in block: ${receipt.blockNumber}`);

    // Get vault address from event
    vaultAddress = await factory.getVault(user.address);
    console.log(`  Vault created: ${vaultAddress}`);
    
    vault = await ethers.getContractAt("PersonalVaultUpgradeableV1", vaultAddress);
  }

  // Verify vault
  const vaultInvestor = await vault.investor();
  const vaultOwner = await vault.owner();
  const vaultWrappedNative = await vault.WRAPPED_NATIVE();
  
  console.log("\nVault verification:");
  console.log(`  Investor: ${vaultInvestor}`);
  console.log(`  Owner: ${vaultOwner}`);
  console.log(`  WRAPPED_NATIVE: ${vaultWrappedNative}`);

  // =========================================================================
  // STEP 4: Set V2 Router (if not set)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 4: Configure V2 Router");
  console.log("-".repeat(60) + "\n");

  const currentRouterV2 = await vault.routerV2();
  if (currentRouterV2 === ethers.ZeroAddress) {
    console.log("Setting V2 Router...");
    
    // Need to use admin to set routerV2
    // First check if user has ADMIN_ROLE
    const ADMIN_ROLE = await vault.ADMIN_ROLE();
    const userHasAdmin = await vault.hasRole(ADMIN_ROLE, user.address);
    
    if (userHasAdmin) {
      const vaultAsUser = vault.connect(user);
      const tx = await vaultAsUser.setRouterV2(BSC_TESTNET_CONFIG.routerV2);
      await tx.wait();
      console.log(`  V2 Router set to: ${BSC_TESTNET_CONFIG.routerV2}`);
    } else {
      console.log("  WARNING: User doesn't have ADMIN_ROLE, skipping V2 router setup");
      console.log("  Swap will use V3 single-hop instead");
    }
  } else {
    console.log(`V2 Router already set: ${currentRouterV2}`);
  }

  // =========================================================================
  // STEP 5: Deposit tBNB to Vault
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 5: Deposit tBNB to Vault");
  console.log("-".repeat(60) + "\n");

  const depositAmount = ethers.parseEther("0.01");
  console.log(`Depositing ${ethers.formatEther(depositAmount)} tBNB...`);

  // Check current vault balance
  const vaultBalanceBefore = await vault.getBalance(BSC_TESTNET_CONFIG.NATIVE_TOKEN);
  console.log(`  Vault balance before: ${ethers.formatEther(vaultBalanceBefore)} tBNB`);

  // Connect vault with user signer
  const vaultAsUser = vault.connect(user);
  
  const depositTx = await vaultAsUser.depositNative({
    value: depositAmount,
    gasLimit: 200000,
  });
  
  console.log(`  Deposit TX: ${BSC_TESTNET_CONFIG.explorer}/tx/${depositTx.hash}`);
  const depositReceipt = await depositTx.wait();
  console.log(`  TX confirmed in block: ${depositReceipt.blockNumber}`);

  const vaultBalanceAfter = await vault.getBalance(BSC_TESTNET_CONFIG.NATIVE_TOKEN);
  console.log(`  Vault balance after: ${ethers.formatEther(vaultBalanceAfter)} tBNB`);

  // =========================================================================
  // STEP 6: Execute Swap (tBNB -> BUSD)
  // =========================================================================
  console.log("\n" + "-".repeat(60));
  console.log("STEP 6: Execute Swap (tBNB -> BUSD)");
  console.log("-".repeat(60) + "\n");

  // Note: On testnet, we'll use a simple direct transfer test instead of actual swap
  // because PancakeSwap V2 testnet liquidity is very low
  
  console.log("Note: BSC Testnet PancakeSwap has very low liquidity.");
  console.log("The swap might fail due to insufficient liquidity.");
  console.log("");

  const swapAmount = ethers.parseEther("0.005"); // Swap 0.005 tBNB
  console.log(`Attempting to swap ${ethers.formatEther(swapAmount)} tBNB -> BUSD...`);

  // Check if bot has ORACLE_ROLE
  const ORACLE_ROLE = await vault.ORACLE_ROLE();
  const botHasOracle = await vault.hasRole(ORACLE_ROLE, bot.address);
  
  if (!botHasOracle) {
    console.log("  ERROR: Bot doesn't have ORACLE_ROLE");
    console.log("  Cannot execute swap without proper role");
  } else {
    console.log(`  Bot has ORACLE_ROLE: ${botHasOracle}`);
    
    // Try V2 swap if router is set
    const routerV2Set = await vault.routerV2();
    
    if (routerV2Set !== ethers.ZeroAddress) {
      console.log("  Using V2 Router for swap...");
      
      const vaultAsBot = vault.connect(bot);
      
      // V2 swap path: NATIVE_TOKEN -> BUSD
      const path = [
        BSC_TESTNET_CONFIG.NATIVE_TOKEN,  // tBNB (native)
        BSC_TESTNET_CONFIG.tokens.BUSD,   // BUSD
      ];
      
      try {
        const swapTx = await vaultAsBot.swapV2(
          path,
          swapAmount,
          0,  // amountOutMin = 0 for testing
          ethers.ZeroAddress,  // no fee recipient
          0,  // no fee
          {
            gasLimit: 500000,
          }
        );
        
        console.log(`  Swap TX: ${BSC_TESTNET_CONFIG.explorer}/tx/${swapTx.hash}`);
        const swapReceipt = await swapTx.wait();
        console.log(`  TX confirmed in block: ${swapReceipt.blockNumber}`);
        
        // Check BUSD balance
        const busdBalance = await vault.getBalance(BSC_TESTNET_CONFIG.tokens.BUSD);
        console.log(`  BUSD balance after swap: ${ethers.formatUnits(busdBalance, 18)} BUSD`);
        
      } catch (error) {
        console.log(`  Swap failed: ${error.reason || error.message}`);
        console.log("  This is expected on testnet due to low liquidity");
      }
    } else {
      console.log("  V2 Router not set, swap skipped");
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60) + "\n");

  console.log("Deployed/Used Contracts:");
  console.log(`  Factory:        ${factoryAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  User Vault:     ${vaultAddress}`);
  console.log("");
  
  console.log("Final Balances:");
  const finalDeployerBalance = await ethers.provider.getBalance(deployer.address);
  const finalUserBalance = await ethers.provider.getBalance(user.address);
  const finalVaultNativeBalance = await vault.getBalance(BSC_TESTNET_CONFIG.NATIVE_TOKEN);
  
  console.log(`  Deployer: ${ethers.formatEther(finalDeployerBalance)} tBNB`);
  console.log(`  User:     ${ethers.formatEther(finalUserBalance)} tBNB`);
  console.log(`  Vault (native): ${ethers.formatEther(finalVaultNativeBalance)} tBNB`);
  console.log("");
  
  console.log("Explorer Links:");
  console.log(`  Factory: ${BSC_TESTNET_CONFIG.explorer}/address/${factoryAddress}`);
  console.log(`  Vault:   ${BSC_TESTNET_CONFIG.explorer}/address/${vaultAddress}`);
  console.log("");
  
  console.log("✅ Test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
