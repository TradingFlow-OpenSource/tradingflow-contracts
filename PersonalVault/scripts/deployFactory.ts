import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const implementation = process.env.PERSONAL_VAULT_IMPL!; // 实现合约地址
  const factory = await Factory.deploy(deployer.address, implementation);
  await factory.deployed();

  console.log("PersonalVaultFactory deployed to:", factory.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
