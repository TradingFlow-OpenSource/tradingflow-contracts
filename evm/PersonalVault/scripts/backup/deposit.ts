import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  
  if (!vaultAddress || !tokenAddress) {
    console.error("请设置环境变量 VAULT_ADDRESS 和 TOKEN_ADDRESS");
    process.exit(1);
  }
  
  const amount = ethers.parseUnits("100", 18); // 100 Token

  console.log(`准备存款 ${ethers.formatUnits(amount, 18)} 代币到金库 ${vaultAddress}`);
  
  try {
    // 1. 先授权
    console.log("步骤 1: 授权代币转账权限...");
    const ERC20 = await ethers.getContractAt("IERC20", tokenAddress);
    // @ts-ignore - 忽略类型检查
    const approveTx = await ERC20.connect(user).approve(vaultAddress, amount);
    await approveTx.wait();
    console.log("授权成功！");

    // 2. 存款
    console.log("步骤 2: 存入代币到金库...");
    const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
    // @ts-ignore - 忽略类型检查
    const depositTx = await Vault.connect(user).deposit(tokenAddress, amount);
    const receipt = await depositTx.wait();
    
    console.log("存款成功！");
    console.log("- 交易哈希:", receipt.hash);
    
    // 3. 查询余额
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
