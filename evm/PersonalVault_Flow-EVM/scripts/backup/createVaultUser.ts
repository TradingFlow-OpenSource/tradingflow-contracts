import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  // 使用 USER_PRIVATE_KEY 创建新的 signer
  const provider = ethers.provider;
  const userPrivateKey = process.env.USER_PRIVATE_KEY;
  if (!userPrivateKey) {
    throw new Error("请在 .env 中设置 USER_PRIVATE_KEY");
  }
  const user = new ethers.Wallet(userPrivateKey, provider);

  const factoryAddress = process.env.FACTORY_ADDRESS;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;
  const botAddress = process.env.BOT_ADDRESS || process.env.BOT_PRIVATE_KEY ? new ethers.Wallet(process.env.BOT_PRIVATE_KEY!, provider).address : user.address;
  
  if (!factoryAddress || !swapRouter || !wrappedNative) {
    throw new Error("请设置 FACTORY_ADDRESS、SWAP_ROUTER 和 WRAPPED_NATIVE 环境变量");
  }

  console.log("使用以下参数创建金库:");
  console.log("- 工厂地址:", factoryAddress);
  console.log("- 交换路由:", swapRouter);
  console.log("- 包装原生代币:", wrappedNative);
  console.log("- Bot地址:", botAddress);

  const Factory = await ethers.getContractAt("PersonalVaultFactoryUniV2", factoryAddress, user);
  const tx = await Factory.createVault(swapRouter, wrappedNative, botAddress);
  const receipt = await tx.wait();
  console.log("金库创建交易已发送，hash:", receipt.hash);

  // 查询用户金库地址
  const vaultAddress = await Factory.userVaults(user.address);
  console.log("用户金库地址:", vaultAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
