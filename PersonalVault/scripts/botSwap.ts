import { ethers } from "hardhat";

async function main() {
  // 使用 BOT_PRIVATE_KEY 创建 bot signer
  const provider = ethers.provider;
  const botPrivateKey = process.env.BOT_PRIVATE_KEY;
  if (!botPrivateKey) {
    throw new Error("请在 .env 中设置 BOT_PRIVATE_KEY");
  }
  const bot = new ethers.Wallet(botPrivateKey, provider);

  const vaultAddress = process.env.VAULT_ADDRESS!;
  if (!vaultAddress) {
    throw new Error("请设置 VAULT_ADDRESS 环境变量");
  }

  // 获取合约实例
  const Vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

  // 示例参数
  const tokenIn = process.env.TOKEN_IN!;
  const tokenOut = process.env.TOKEN_OUT!;
  const amountIn = ethers.parseUnits("1", 18); // 使用新的ethers v6 API
  const amountOutMin = 0n;

  console.log(`Bot地址: ${bot.address}`);
  console.log(`金库地址: ${vaultAddress}`);
  console.log(`输入代币: ${tokenIn}`);
  console.log(`输出代币: ${tokenOut}`);
  console.log(`输入金额: ${ethers.formatUnits(amountIn, 18)}`);

  // 检查是否有ORACLE_ROLE角色
  const hasRole = await Vault.hasRole(await Vault.ORACLE_ROLE(), bot.address);
  console.log(`Bot是否有ORACLE_ROLE: ${hasRole}`);

  if (!hasRole) {
    console.log("警告: Bot没有ORACLE_ROLE权限，交易可能会失败");
  }

  // 使用UniV2版本的swap函数
  const tx = await Vault.swapExactInputSingle(tokenIn, tokenOut, amountIn, amountOutMin);
  await tx.wait();
  console.log("Swap 交易成功！");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
