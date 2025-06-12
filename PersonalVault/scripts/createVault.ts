import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const factory = Factory.attach(factoryAddress);

  // 配置参数
  const baseAsset = process.env.BASE_ASSET!;
  const name = "UserVaultToken";
  const symbol = "UVT";
  const swapRouter = process.env.SWAP_ROUTER!;
  const priceOracle = process.env.PRICE_ORACLE!;

  const tx = await factory.createVault(baseAsset, name, symbol, swapRouter, priceOracle);
  const receipt = await tx.wait();
  console.log("Vault created, tx hash:", receipt.transactionHash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
