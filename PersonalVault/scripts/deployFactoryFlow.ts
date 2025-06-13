import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 检查是否在 Flow EVM 网络上
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 545n && chainId !== 747n) {
    console.warn("警告: 当前网络不是 Flow EVM 网络 (测试网 chainId=545, 主网 chainId=747)");
    console.warn("当前 chainId:", chainId.toString());
    const continueDeployment = process.env.FORCE_DEPLOY === "true";
    if (!continueDeployment) {
      console.error("部署已取消。如果确定要在此网络上部署，请设置环境变量 FORCE_DEPLOY=true");
      process.exit(1);
    }
  } else {
    console.log("已确认 Flow EVM 网络, chainId:", chainId.toString());
  }

  // 1. 先部署逻辑合约
  console.log("部署 PersonalVaultUpgradeable 实现合约...");
  const VaultImpl = await ethers.getContractFactory("PersonalVaultUpgradeable");
  const implementation = await VaultImpl.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log("PersonalVaultUpgradeable 实现合约已部署到:", implAddress);

  // 2. 再部署工厂合约
  console.log("部署 PersonalVaultFactory...");
  const Factory = await ethers.getContractFactory("PersonalVaultFactory");
  const factory = await Factory.deploy(deployer.address, implAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("PersonalVaultFactory 已部署到:", factoryAddress);

  // 3. 输出环境变量设置指南
  console.log("\n为后续脚本设置以下环境变量:\n");
  console.log(`export PERSONAL_VAULT_IMPL=${implAddress}`);
  console.log(`export FACTORY_ADDRESS=${factoryAddress}`);

  // 4. 输出验证命令
  console.log("\n验证合约命令:");
  console.log(`npx hardhat verify --network ${chainId === 545n ? 'flowTestnet' : 'flow'} ${implAddress}`);
  console.log(`npx hardhat verify --network ${chainId === 545n ? 'flowTestnet' : 'flow'} ${factoryAddress} ${deployer.address} ${implAddress}`);
  
  // 5. 输出 Flowscan 链接
  const flowscanBaseUrl = chainId === 545n 
    ? "https://evm-testnet.flowscan.io/address/" 
    : "https://evm.flowscan.io/address/";
  console.log("\nFlowscan 链接:");
  console.log(`实现合约: ${flowscanBaseUrl}${implAddress}`);
  console.log(`工厂合约: ${flowscanBaseUrl}${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
