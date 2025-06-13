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
  if (!factoryAddress || !swapRouter) {
    throw new Error("请设置 FACTORY_ADDRESS 和 SWAP_ROUTER 环境变量");
  }

  const Factory = await ethers.getContractAt("PersonalVaultFactory", factoryAddress, user);
  const tx = await Factory.createVault(swapRouter);
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
