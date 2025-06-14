// 使用hardhat ethers创建金库
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("开始创建金库...");

  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;

  // 验证必要的环境变量
  if (!factoryAddress || !swapRouter || !wrappedNative) {
    console.error("缺少必要的环境变量");
    console.log(`FACTORY_ADDRESS: ${factoryAddress || "未设置"}`);
    console.log(`SWAP_ROUTER: ${swapRouter || "未设置"}`);
    console.log(`WRAPPED_NATIVE: ${wrappedNative || "未设置"}`);
    process.exit(1);
  }

  // 显示配置信息
  console.log("配置信息:");
  console.log(`- Factory地址: ${factoryAddress}`);
  console.log(`- SwapRouter: ${swapRouter}`);
  console.log(`- WrappedNative: ${wrappedNative}`);

  try {
    // 获取签名者
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    // 使用第二个签名者作为用户，如果不存在则使用第一个
    const user = signers.length > 1 ? signers[1] : deployer;
    console.log(`- 部署者地址: ${deployer.address}`);
    console.log(`- 用户地址: ${user.address}`);
    
    // 检查用户余额
    const balance = await ethers.provider.getBalance(user.address);
    console.log(`- 用户余额: ${ethers.formatEther(balance)} ETH`);

    // 获取工厂合约中的机器人地址
    const factory = await ethers.getContractAt(
      "PersonalVaultFactoryUniV2",
      factoryAddress
    );
    const botAddress = await factory.botAddress();
    console.log(`- 机器人地址: ${botAddress}`);

    // 工厂合约实例已在上面创建

    // 检查用户是否已有金库
    const existingVault = await factory.userVaults(user.address);
    console.log(`- 现有金库地址: ${existingVault}`);

    if (existingVault !== ethers.ZeroAddress) {
      console.log("用户已有金库，无需创建");
      process.exit(0);
    }

    console.log("\n准备创建金库...");

    // 设置交易参数
    const gasLimit = 5000000; // 设置足够高的gas限制

    // 创建金库
    console.log("\n发送创建金库交易...");

    // 使用hardhat ethers发送交易
    const tx = await factory
      .connect(user)
      .createVault(swapRouter, wrappedNative, { gasLimit });

    console.log(`交易已发送，哈希: ${tx.hash}`);
    console.log("等待交易确认...");

    // 等待交易确认
    const receipt = await tx.wait();
    console.log(`交易已确认，区块号: ${receipt.blockNumber}`);

    // 检查新创建的金库
    const newVault = await factory.userVaults(user.address);
    console.log(`新金库地址: ${newVault}`);

    if (newVault !== ethers.ZeroAddress) {
      console.log("金库创建成功！");
      console.log(`请将以下环境变量添加到.env文件中:`);
      console.log(`VAULT_ADDRESS=${newVault}`);
    } else {
      console.log("金库创建失败，地址仍为零地址");
    }
  } catch (error) {
    console.error("创建金库时出错:", error);

    // 检查是否有详细的错误信息
    if (error.data) {
      console.log(`错误数据: ${error.data}`);
    }

    // 检查是否有错误原因
    if (error.reason) {
      console.log(`错误原因: ${error.reason}`);
    }

    process.exit(1);
  }
}

// 执行主函数
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("未捕获的错误:", error);
    process.exit(1);
  });
