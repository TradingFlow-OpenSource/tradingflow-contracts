import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  const amount = ethers.utils.parseUnits("10", 18); // 10 Token

  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  const tx = await Vault.connect(user).withdraw(tokenAddress, amount);
  await tx.wait();
  console.log("Withdraw success");
}
main();
