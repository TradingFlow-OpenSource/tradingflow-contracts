/**
 * Create a vault using hardhat ethers
 * 
 * Contract Version: V1
 * Target Chain: BSC (Binance Smart Chain)
 * DEX Integration: PancakeSwap V3 (Uniswap V3 Fork)
 */
const { ethers } = require("hardhat");
const { ZeroAddress } = require("ethers");
require("dotenv").config({ path: "../.env" });

async function main() {
  console.log("Starting vault creation (PersonalVault V1)...");

  // Get environment variables
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;

  // Validate required environment variables
  if (!factoryAddress || !swapRouter || !wrappedNative) {
    console.error("Missing required environment variables");
    console.log(`FACTORY_ADDRESS: ${factoryAddress || "not set"}`);
    console.log(`SWAP_ROUTER: ${swapRouter || "not set"}`);
    console.log(`WRAPPED_NATIVE: ${wrappedNative || "not set"}`);
    process.exit(1);
  }

  // Display configuration
  console.log("Configuration:");
  console.log(`- Factory address: ${factoryAddress}`);
  console.log(`- SwapRouter: ${swapRouter}`);
  console.log(`- WrappedNative: ${wrappedNative}`);

  try {
    // Get signers
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    // Use second signer as user if available, otherwise use deployer
    const user = signers.length > 1 ? signers[1] : deployer;
    console.log(`- Deployer address: ${deployer.address}`);
    console.log(`- User address: ${user.address}`);

    // Check user balance
    const balance = await ethers.provider.getBalance(user.address);
    console.log(`- User balance: ${ethers.formatEther(balance)} BNB`);

    // Get bot address from factory contract
    const factory = await ethers.getContractAt(
      "PersonalVaultFactoryV1",
      factoryAddress
    );
    const botAddress = await factory.botAddress();
    console.log(`- Bot address: ${botAddress}`);

    // Check if user already has a vault
    const existingVault = await factory.getVault(user.address);
    console.log(`- Existing vault address: ${existingVault}`);

    if (existingVault !== ZeroAddress) {
      console.log("User already has a vault, no need to create");
      process.exit(0);
    }

    console.log("\nPreparing to create vault...");

    // Set transaction parameters
    const gasLimit = 5000000; // Set high enough gas limit

    // Create vault
    console.log("\nSending create vault transaction...");

    // Send transaction using hardhat ethers
    const tx = await factory
      .connect(user)
      .createVault(swapRouter, wrappedNative, { gasLimit });

    console.log(`Transaction sent, hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log(`Transaction confirmed, block number: ${receipt.blockNumber}`);

    // Check newly created vault
    const newVault = await factory.getVault(user.address);
    console.log(`New vault address: ${newVault}`);

    if (newVault !== ZeroAddress) {
      console.log("Vault created successfully!");
      console.log(`Add the following to your .env file:`);
      console.log(`VAULT_ADDRESS=${newVault}`);
    } else {
      console.log("Vault creation failed, address is still zero");
    }
  } catch (error) {
    console.error("Error creating vault:", error);

    // Check for detailed error info
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }

    // Check for error reason
    if (error.reason) {
      console.log(`Error reason: ${error.reason}`);
    }

    // Check transaction failure details
    if (error.transaction) {
      console.log(`Transaction hash: ${error.transaction.hash}`);
      console.log(`Transaction data: ${error.transaction.data}`);

      // Try to decode error
      try {
        const iface = new ethers.Interface([
          "function createVault(address _swapRouter, address _wrappedNative)",
        ]);
        const decodedData = iface.parseTransaction({
          data: error.transaction.data,
        });
        console.log("Decoded transaction data:", decodedData);
      } catch (decodeError) {
        console.log("Unable to decode transaction data:", decodeError.message);
      }
    }

    process.exit(1);
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Uncaught error:", error);
    process.exit(1);
  });
