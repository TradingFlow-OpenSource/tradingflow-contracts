import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  
  if (!vaultAddress || !tokenAddress) {
    console.error("请设置环境变量 VAULT_ADDRESS 和 TOKEN_ADDRESS");
    process.exit(1);
  }
  
  const amount = ethers.parseUnits("10", 18); // 10 Token

  console.log(`准备从金库 ${vaultAddress} 提取 ${ethers.formatUnits(amount, 18)} 代币`);
  
  try {
    console.log("步骤 1: 发起提款交易...");
    const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
    // @ts-ignore - 忽略类型检查
    const tx = await Vault.connect(user).withdraw(tokenAddress, amount);
    const receipt = await tx.wait();
    
    console.log("提款成功！");
    console.log("- 交易哈希:", receipt.hash);
    
    // 查询余额
    // @ts-ignore - 忽略类型检查
    const balance = await Vault.getBalance(tokenAddress);
    console.log(`- 当前金库余额: ${ethers.formatUnits(balance, 18)} 代币`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
