import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Vault = await ethers.getContractFactory("OracleGuidedVault");
  // 示例参数，实际请根据你的合约构造函数调整
  const baseAsset = process.env.BASE_ASSET!;
  const name = "MultiUserVault";
  const symbol = "MUV";
  const swapRouter = process.env.SWAP_ROUTER!;
  const priceOracle = process.env.PRICE_ORACLE!;
  const investor = deployer.address;
  const vault = await Vault.deploy(baseAsset, name, symbol, swapRouter, priceOracle, investor);
  await vault.deployed();

  console.log("MultiUserVault deployed to:", vault.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
