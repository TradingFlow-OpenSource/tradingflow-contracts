import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. 先部署逻辑合约
  console.log("Deploying PersonalVaultUpgradeable implementation...");
  const VaultImpl = await ethers.getContractFactory("PersonalVaultUpgradeable");
  const implementation = await VaultImpl.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log("PersonalVaultUpgradeable implementation deployed to:", implAddress);

  // 2. 再部署工厂合约
  console.log("Deploying PersonalVaultFactory...");
  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const factory = await Factory.deploy(deployer.address, implAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("PersonalVaultFactory deployed to:", factoryAddress);

  // 3. 输出环境变量设置指南
  console.log("\nFor future scripts, set these environment variables:\n");
  console.log(`PERSONAL_VAULT_IMPL=${implAddress}`);
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
