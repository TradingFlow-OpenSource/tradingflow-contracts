import { ethers } from "hardhat";

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  const newImpl = process.env.NEW_IMPLEMENTATION!;
  const Factory = await ethers.getContractAt("PersonalVaultFactory", factoryAddress);
  const vaultCount = await Factory.allVaults.length;
  const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
  for (let i = 0; i < vaultCount; i++) {
    const proxyAddr = await Factory.allVaults(i);
    const proxy = Vault.attach(proxyAddr);
    const tx = await proxy.upgradeTo(newImpl);
    await tx.wait();
    console.log(`Upgraded vault ${proxyAddr} to ${newImpl}`);
  }
}
main();
