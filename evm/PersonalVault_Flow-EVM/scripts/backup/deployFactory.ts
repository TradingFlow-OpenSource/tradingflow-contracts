import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. 先部署逻辑合约
  console.log("Deploying PersonalVaultUpgradeableUniV2 implementation...");
  const VaultImpl = await ethers.getContractFactory(
    "PersonalVaultUpgradeableUniV2"
  );
  const implementation = await VaultImpl.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(
    "PersonalVaultUpgradeableUniV2 implementation deployed to:",
    implAddress
  );

  // 2. 再部署工厂合约
  console.log("Deploying PersonalVaultFactoryUniV2...");
  const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
  const factory = await Factory.deploy(deployer.address, implAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("PersonalVaultFactoryUniV2 deployed to:", factoryAddress);

  // 3. 输出环境变量设置指南
  console.log("\nFor future scripts, set these environment variables:\n");
  console.log(`PERSONAL_VAULT_IMPL_ADDRESS=${implAddress}`);
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
