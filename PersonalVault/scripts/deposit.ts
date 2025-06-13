import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  const amount = ethers.utils.parseUnits("100", 18); // 100 Token

  // 1. 先授权
  const ERC20 = await ethers.getContractAt("IERC20", tokenAddress);
  await ERC20.connect(user).approve(vaultAddress, amount);

  // 2. 存款
  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  const tx = await Vault.connect(user).deposit(tokenAddress, amount);
  await tx.wait();
  console.log("Deposit success");
}
main();
