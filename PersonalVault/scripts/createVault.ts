import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  const [user] = await ethers.getSigners();
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const factory = Factory.attach(factoryAddress);

  // 配置参数
  const swapRouter = process.env.SWAP_ROUTER!;

  const tx = await factory.createVault(swapRouter);
  const receipt = await tx.wait();
  console.log("Vault created, tx hash:", receipt.transactionHash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
