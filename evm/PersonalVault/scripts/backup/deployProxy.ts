import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
  const proxy = await upgrades.deployProxy(
    Vault,
    [deployer.address, deployer.address], // _investor, admin
    { initializer: "initialize" }
  );
  await proxy.deployed();
  console.log("PersonalVault Proxy deployed to:", proxy.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
