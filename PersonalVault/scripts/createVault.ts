import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  
  if (!factoryAddress) {
    console.error("请设置环境变量 FACTORY_ADDRESS");
    process.exit(1);
  }
  
  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const factory = await Factory.attach(factoryAddress);

  // 配置参数
  const swapRouter = process.env.SWAP_ROUTER!;
  
  if (!swapRouter) {
    console.error("请设置环境变量 SWAP_ROUTER");
    process.exit(1);
  }

  console.log(`创建金库，用户: ${user.address}, 交换路由: ${swapRouter}`);
  const tx = await factory.createVault(swapRouter);
  const receipt = await tx.wait();
  
  // 获取用户的金库地址
  const userVault = await factory.userVaults(user.address);
  
  console.log("Vault created successfully!");
  console.log("- Transaction hash:", receipt.hash);
  console.log("- User vault address:", userVault);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
