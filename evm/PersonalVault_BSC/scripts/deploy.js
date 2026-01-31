/**
 * Deploy PersonalVault contracts to BSC (Binance Smart Chain)
 * 
 * Contract Version: V1
 * DEX Integration: PancakeSwap V3 (Uniswap V3 Fork)
 * Swap Router: 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
 * WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
 * 
 * Role Separation:
 * - Vault Owner: Can upgrade contracts (UUPS), has DEFAULT_ADMIN_ROLE
 * - Vault Admin: Has ADMIN_ROLE for settings (setRouterV2, etc.)
 * - Bot: Has ORACLE_ROLE for executing trades
 * - Investor: User who can deposit/withdraw (set at vault creation)
 * 
 * @see contracts/PersonalVaultUpgradeableV1.sol
 * @see contracts/PersonalVaultFactoryV1.sol
 */
const { ethers } = require("hardhat");
require("dotenv").config({ path: "../.env" });

// Get addresses from environment
const VAULT_OWNER_PRIVATE_KEY = process.env.VAULT_OWNER_PRIVATE_KEY || "";
const VAULT_ADMIN_PRIVATE_KEY = process.env.VAULT_ADMIN_PRIVATE_KEY || "";
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY || "";

async function main() {
  console.log("Starting PersonalVault V1 deployment to BSC...");
  console.log("DEX: PancakeSwap V3");
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer account: ${deployer.address}`);

  // Get account balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BNB`);

  // Determine vault owner address (for UUPS upgrades)
  let vaultOwner;
  if (VAULT_OWNER_PRIVATE_KEY) {
    const ownerWallet = new ethers.Wallet(VAULT_OWNER_PRIVATE_KEY);
    vaultOwner = ownerWallet.address;
  } else {
    vaultOwner = deployer.address;
  }
  console.log(`Vault Owner (for upgrades): ${vaultOwner}`);

  // Determine vault admin address (for settings)
  let vaultAdmin;
  if (VAULT_ADMIN_PRIVATE_KEY) {
    const adminWallet = new ethers.Wallet(VAULT_ADMIN_PRIVATE_KEY);
    vaultAdmin = adminWallet.address;
  } else {
    vaultAdmin = deployer.address;
  }
  console.log(`Vault Admin (for settings): ${vaultAdmin}`);

  // Determine bot address
  let botAddress;
  if (BOT_PRIVATE_KEY) {
    const botWallet = new ethers.Wallet(BOT_PRIVATE_KEY);
    botAddress = botWallet.address;
  } else {
    botAddress = deployer.address;
  }
  console.log(`Bot (for trades): ${botAddress}`);
  console.log("");

  // 1. Deploy PersonalVaultUpgradeableV1 implementation
  console.log("Deploying PersonalVaultUpgradeableV1 implementation...");
  const PersonalVaultUpgradeableV1 = await ethers.getContractFactory(
    "PersonalVaultUpgradeableV1"
  );
  const personalVaultImplementation =
    await PersonalVaultUpgradeableV1.deploy();
  await personalVaultImplementation.waitForDeployment();
  const implementationAddress = await personalVaultImplementation.getAddress();
  console.log(
    `PersonalVaultUpgradeableV1 implementation deployed to: ${implementationAddress}`
  );

  // 2. Deploy PersonalVaultFactoryV1 with separated roles
  console.log("\nDeploying PersonalVaultFactoryV1...");
  const PersonalVaultFactoryV1 = await ethers.getContractFactory(
    "PersonalVaultFactoryV1"
  );
  const personalVaultFactory = await PersonalVaultFactoryV1.deploy(
    vaultOwner,           // Vault owner address (for UUPS upgrades)
    vaultAdmin,           // Vault admin address (for settings)
    implementationAddress, // Implementation address
    botAddress            // Bot address
  );
  await personalVaultFactory.waitForDeployment();
  const factoryAddress = await personalVaultFactory.getAddress();
  console.log(`PersonalVaultFactoryV1 deployed to: ${factoryAddress}`);

  // 3. Verify deployment
  console.log("\nVerifying deployment...");

  // Verify factory contract
  const factory = await ethers.getContractAt(
    "PersonalVaultFactoryV1",
    factoryAddress
  );
  
  const storedImplementation = await factory.personalVaultImplementation();
  const storedVaultOwner = await factory.vaultOwner();
  const storedVaultAdmin = await factory.vaultAdmin();
  const storedBotAddress = await factory.botAddress();
  
  console.log(`Factory stored implementation: ${storedImplementation}`);
  console.log(`Factory stored vaultOwner: ${storedVaultOwner}`);
  console.log(`Factory stored vaultAdmin: ${storedVaultAdmin}`);
  console.log(`Factory stored botAddress: ${storedBotAddress}`);

  // Verify factory roles
  const adminRole = await factory.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await factory.hasRole(adminRole, deployer.address);
  console.log(`\nDeployer has DEFAULT_ADMIN_ROLE on factory: ${hasAdminRole}`);

  const factoryAdminRole = await factory.ADMIN_ROLE();
  const vaultAdminHasRole = await factory.hasRole(factoryAdminRole, vaultAdmin);
  console.log(`Vault admin has ADMIN_ROLE on factory: ${vaultAdminHasRole}`);

  const botRole = await factory.BOT_ROLE();
  const hasBotRole = await factory.hasRole(botRole, botAddress);
  console.log(`Bot has BOT_ROLE on factory: ${hasBotRole}`);

  // 4. Output deployment info
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nAdd the following to your .env file:");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PERSONAL_VAULT_IMPL_ADDRESS=${implementationAddress}`);
  console.log("");
  console.log("Role addresses configured:");
  console.log(`VAULT_OWNER_ADDRESS=${vaultOwner}  # Can upgrade vaults`);
  console.log(`VAULT_ADMIN_ADDRESS=${vaultAdmin}  # Can change vault settings`);
  console.log(`BOT_ADDRESS=${botAddress}  # Can execute trades`);
  console.log("");
  console.log("Network configuration:");
  console.log("SWAP_ROUTER=0x13f4EA83D0bd40E75C8222255bc855a974568Dd4  # BSC PancakeSwap V3");
  console.log("WRAPPED_NATIVE=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c  # BSC WBNB");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
