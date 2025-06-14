import { ethers, upgrades } from "hardhat";

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS!;
  const VaultV2 = await ethers.getContractFactory("PersonalVaultUpgradeable");
  await upgrades.upgradeProxy(proxyAddress, VaultV2);
  console.log("Proxy upgraded!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
