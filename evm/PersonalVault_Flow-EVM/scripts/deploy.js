// 部署PersonalVaultUpgradeableUniV2和PersonalVaultFactoryUniV2合约
const { ethers } = require("hardhat");
require("dotenv").config({ path: "../.env" });
// 从环境变量获取机器人私钥，如果未设置则使用部署者地址
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY || "";

async function main() {
  console.log("开始部署PersonalVault合约...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log(`使用部署账户: ${deployer.address}`);

  // 获取账户余额
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`部署账户余额: ${ethers.formatEther(balance)} ETH`);

  // 1. 部署PersonalVaultUpgradeableUniV2实现合约
  console.log("\n部署PersonalVaultUpgradeableUniV2实现合约...");
  const PersonalVaultUpgradeableUniV2 = await ethers.getContractFactory(
    "PersonalVaultUpgradeableUniV2"
  );
  const personalVaultImplementation =
    await PersonalVaultUpgradeableUniV2.deploy();
  await personalVaultImplementation.waitForDeployment();
  const implementationAddress = await personalVaultImplementation.getAddress();
  console.log(
    `PersonalVaultUpgradeableUniV2实现合约已部署到: ${implementationAddress}`
  );

  // 确定机器人地址
  let botAddress;
  if (BOT_PRIVATE_KEY) {
    const botWallet = new ethers.Wallet(BOT_PRIVATE_KEY);
    botAddress = botWallet.address;
  } else {
    botAddress = deployer.address;
  }
  console.log(`使用机器人地址: ${botAddress}`);

  // 2. 部署PersonalVaultFactoryUniV2合约
  console.log("\n部署PersonalVaultFactoryUniV2合约...");
  const PersonalVaultFactoryUniV2 = await ethers.getContractFactory(
    "PersonalVaultFactoryUniV2"
  );
  const personalVaultFactory = await PersonalVaultFactoryUniV2.deploy(
    deployer.address, // 初始管理员
    implementationAddress, // 实现合约地址
    botAddress // 机器人地址
  );
  await personalVaultFactory.waitForDeployment();
  const factoryAddress = await personalVaultFactory.getAddress();
  console.log(`PersonalVaultFactoryUniV2合约已部署到: ${factoryAddress}`);

  // 3. 验证合约部署
  console.log("\n验证合约部署...");

  // 验证工厂合约
  const factory = await ethers.getContractAt(
    "PersonalVaultFactoryUniV2",
    factoryAddress
  );
  const storedImplementation = await factory.personalVaultImplementation();
  console.log(`工厂合约存储的实现合约地址: ${storedImplementation}`);
  console.log(
    `实现合约地址匹配: ${storedImplementation === implementationAddress}`
  );

  // 验证工厂合约的管理员
  const adminRole = await factory.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await factory.hasRole(adminRole, deployer.address);
  console.log(`部署者是否有管理员角色: ${hasAdminRole}`);

  // 验证机器人地址
  const storedBotAddress = await factory.botAddress();
  console.log(`工厂合约存储的机器人地址: ${storedBotAddress}`);
  console.log(`机器人地址匹配: ${storedBotAddress === botAddress}`);

  // 验证机器人角色
  const botRole = await factory.BOT_ROLE();
  const hasBotRole = await factory.hasRole(botRole, botAddress);
  console.log(`机器人是否有BOT_ROLE: ${hasBotRole}`);

  // 4. 输出部署信息
  console.log("\n部署完成！请将以下信息添加到.env文件中:");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PERSONAL_VAULT_IMPL_ADDRESS=${implementationAddress}`);
  console.log("\n请确保还设置了以下环境变量:");
  console.log(
    "SWAP_ROUTER=0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d  # Flow EVM 主网 PunchSwap V2 Router"
  );
  console.log(
    "WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e  # Flow EVM 主网 WFLOW"
  );
  console.log("USER_PRIVATE_KEY=<用户钱包私钥>");
  console.log("BOT_PRIVATE_KEY=<机器人钱包私钥>  # 或者使用BOT_ADDRESS");
  console.log("NETWORK=flow  # 使用Flow EVM主网");
  console.log(
    "FLOW_RPC_URL=https://mainnet.evm.nodes.onflow.org  # Flow EVM RPC URL"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
