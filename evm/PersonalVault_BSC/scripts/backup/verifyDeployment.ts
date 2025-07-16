import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("验证部署的合约是否可以正常访问...");

  // 获取部署地址
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const implAddress = process.env.PERSONAL_VAULT_IMPL_ADDRESS;

  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`Implementation地址: ${implAddress}`);

  // 获取合约实例
  const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
  const factory = Factory.attach(factoryAddress!);

  // 验证工厂合约
  try {
    const owner = await factory.owner();
    console.log(`工厂合约所有者: ${owner}`);
    console.log("✅ 工厂合约验证成功");
  } catch (error) {
    console.error(
      `❌ 工厂合约验证失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // 获取环境变量
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;

  console.log(`SwapRouter: ${swapRouter}`);
  console.log(`WrappedNative: ${wrappedNative}`);

  // 获取签名者
  const provider = ethers.provider;
  const admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const user = new ethers.Wallet(process.env.USER_PRIVATE_KEY!, provider);
  const bot = new ethers.Wallet(process.env.BOT_PRIVATE_KEY!, provider);

  console.log(`Admin地址: ${admin.address}`);
  console.log(`User地址: ${user.address}`);
  console.log(`Bot地址: ${bot.address}`);

  // 检查用户余额
  const userBalance = await provider.getBalance(user.address);
  console.log(`用户余额: ${ethers.formatEther(userBalance)} FLOW`);

  // 检查管理员余额
  const adminBalance = await provider.getBalance(admin.address);
  console.log(`管理员余额: ${ethers.formatEther(adminBalance)} FLOW`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
