/**
 * Deploy PersonalVaultUpgradeableV1 and PersonalVaultFactoryV1 contracts
 * 
 * Contract Version: V1
 * Target Chain: Flow EVM
 * DEX Integration: PunchSwap V2 (Uniswap V2 Fork)
 * Swap Router: 0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1
 * WFLOW: 0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
 */
const { ethers } = require("hardhat");
require("dotenv").config({ path: "../.env" });
// Get bot private key from environment, use deployer address if not set
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY || "";

async function main() {
  console.log("Starting PersonalVault contract deployment...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer account: ${deployer.address}`);

  // Get account balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} FLOW`);

  // 1. Deploy PersonalVaultUpgradeableV1 implementation contract
  console.log("\nDeploying PersonalVaultUpgradeableV1 implementation...");
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

  // Determine bot address
  let botAddress;
  if (BOT_PRIVATE_KEY) {
    const botWallet = new ethers.Wallet(BOT_PRIVATE_KEY);
    botAddress = botWallet.address;
  } else {
    botAddress = deployer.address;
  }
  console.log(`Using bot address: ${botAddress}`);

  // 2. Deploy PersonalVaultFactoryV1 contract
  console.log("\nDeploying PersonalVaultFactoryV1...");
  const PersonalVaultFactoryV1 = await ethers.getContractFactory(
    "PersonalVaultFactoryV1"
  );
  const personalVaultFactory = await PersonalVaultFactoryV1.deploy(
    deployer.address, // Initial admin
    implementationAddress, // Implementation address
    botAddress // Bot address
  );
  await personalVaultFactory.waitForDeployment();
  const factoryAddress = await personalVaultFactory.getAddress();
  console.log(`PersonalVaultFactoryV1 deployed to: ${factoryAddress}`);

  // 3. Verify contract deployment
  console.log("\nVerifying deployment...");

  // Verify factory contract
  const factory = await ethers.getContractAt(
    "PersonalVaultFactoryV1",
    factoryAddress
  );
  const storedImplementation = await factory.personalVaultImplementation();
  console.log(`Factory stored implementation address: ${storedImplementation}`);
  console.log(
    `Implementation address match: ${storedImplementation === implementationAddress}`
  );

  // Verify factory admin
  const adminRole = await factory.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await factory.hasRole(adminRole, deployer.address);
  console.log(`Deployer has admin role: ${hasAdminRole}`);

  // Verify bot address
  const storedBotAddress = await factory.botAddress();
  console.log(`Factory stored bot address: ${storedBotAddress}`);
  console.log(`Bot address match: ${storedBotAddress === botAddress}`);

  // Verify bot role
  const botRole = await factory.BOT_ROLE();
  const hasBotRole = await factory.hasRole(botRole, botAddress);
  console.log(`Bot has BOT_ROLE: ${hasBotRole}`);

  // 4. Output deployment info
  console.log("\nDeployment complete! Add the following to your .env file:");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PERSONAL_VAULT_IMPL_ADDRESS=${implementationAddress}`);
  console.log("\nMake sure to also set these environment variables:");
  console.log(
    "SWAP_ROUTER=0xF9678db1CE83f6f51E5df348E2Cc842Ca51EfEc1  # Flow EVM PunchSwap V2 Router"
  );
  console.log(
    "WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e  # Flow EVM WFLOW"
  );
  console.log("USER_PRIVATE_KEY=<user wallet private key>");
  console.log("BOT_PRIVATE_KEY=<bot wallet private key>  # or use BOT_ADDRESS");
  console.log("NETWORK=flow  # Use Flow EVM mainnet");
  console.log(
    "FLOW_RPC_URL=https://mainnet.evm.nodes.onflow.org  # Flow EVM RPC URL"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
