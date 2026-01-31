/**
 * Generate 3 new Ethereum wallets for BSC deployment
 * 
 * Usage:
 *   node scripts/generate_wallets.js
 * 
 * Output will be saved to: ./new_wallets.txt (gitignored)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

function generateWallets() {
  console.log("\n========================================");
  console.log("Generating 3 new BSC wallets...");
  console.log("========================================\n");

  const wallets = [];
  const roles = [
    { role: "Deployer/Factory Owner", envKey: "BSC_PRIVATE_KEY_1" },
    { role: "Admin/Bot", envKey: "BSC_PRIVATE_KEY_2" },
    { role: "Test User", envKey: "BSC_PRIVATE_KEY_3" },
  ];

  for (let i = 0; i < 3; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({
      ...roles[i],
      address: wallet.address,
      privateKey: wallet.privateKey,
    });

    console.log(`Wallet ${i + 1} - ${roles[i].role}`);
    console.log(`  Address:     ${wallet.address}`);
    console.log(`  Private Key: ${wallet.privateKey}`);
    console.log("");
  }

  // Generate .env format
  console.log("========================================");
  console.log("Environment Variables (copy to .env):");
  console.log("========================================\n");
  
  let envContent = "# BSC Wallets - Generated " + new Date().toISOString() + "\n";
  envContent += "# IMPORTANT: Keep these private keys secure!\n\n";
  
  wallets.forEach((w, i) => {
    const envLine = `${w.envKey}=${w.privateKey}`;
    console.log(envLine);
    envContent += `# Wallet ${i + 1}: ${w.role}\n`;
    envContent += `# Address: ${w.address}\n`;
    envContent += `${envLine}\n\n`;
  });

  // Save to file (for backup)
  const outputPath = path.join(__dirname, "..", "new_wallets.txt");
  fs.writeFileSync(outputPath, envContent);
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log("⚠️  Delete this file after copying the keys!\n");

  // Add to .gitignore if not already
  const gitignorePath = path.join(__dirname, "..", ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes("new_wallets.txt")) {
      fs.appendFileSync(gitignorePath, "\nnew_wallets.txt\n");
      console.log("📝 Added new_wallets.txt to .gitignore\n");
    }
  }

  console.log("========================================");
  console.log("Next Steps:");
  console.log("========================================");
  console.log("1. Send BNB to Wallet 1 (Deployer) for gas fees");
  console.log("   - BSC Mainnet: ~0.05 BNB");
  console.log("   - BSC Testnet: Get from faucet https://testnet.bnbchain.org/faucet-smart");
  console.log("");
  console.log("2. Update .env files with new private keys:");
  console.log("   - 04_weather_monitor/.env");
  console.log("   - 02_weather_control/.env");
  console.log("   - 20_weather_infra/environments/staging/.env/control-and-monitor.env");
  console.log("");
  console.log("3. Deploy contracts:");
  console.log("   cd 09_weather_vault/evm/PersonalVault_BSC");
  console.log("   npx hardhat run scripts/deploy.js --network bscTestnet  # Testnet");
  console.log("   npx hardhat run scripts/deploy.js --network bsc         # Mainnet");
  console.log("");
  console.log("4. Update FACTORY_ADDRESS in .env files after deployment");
  console.log("");
}

generateWallets();
