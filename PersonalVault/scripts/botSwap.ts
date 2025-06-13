import { ethers } from "hardhat";

async function main() {
  const [bot] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  // 示例参数
  const tokenIn = process.env.TOKEN_IN!;
  const tokenOut = process.env.TOKEN_OUT!;
  const fee = 3000; // 0.3%
  const amountIn = ethers.utils.parseUnits("1", 18);
  const amountOutMin = 0;
  const tx = await Vault.connect(bot).swapExactInputSingle(tokenIn, tokenOut, fee, amountIn, amountOutMin);
  await tx.wait();
  console.log("Swap success");
}
main();
