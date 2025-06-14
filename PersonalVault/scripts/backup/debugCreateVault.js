// 详细调试创建金库失败的原因
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("开始详细调试金库创建失败原因...");
  
  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;
  const personalVaultImpl = process.env.PERSONAL_VAULT_IMPL;
  const userPrivateKey = process.env.USER_PRIVATE_KEY;
  const botPrivateKey = process.env.BOT_PRIVATE_KEY;
  const botAddress = process.env.BOT_ADDRESS;
  const rpcUrl = process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org";
  
  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`SwapRouter: ${swapRouter}`);
  console.log(`WrappedNative: ${wrappedNative}`);
  console.log(`实现合约: ${personalVaultImpl}`);
  console.log(`RPC URL: ${rpcUrl}`);
  
  try {
    // 创建provider和用户钱包
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const user = new ethers.Wallet(userPrivateKey, provider);
    console.log(`用户地址: ${user.address}`);
    
    // 获取bot地址
    let botAddr;
    if (botAddress) {
      botAddr = botAddress;
    } else if (botPrivateKey) {
      const bot = new ethers.Wallet(botPrivateKey);
      botAddr = bot.address;
    } else {
      console.error("缺少BOT_ADDRESS或BOT_PRIVATE_KEY环境变量");
      process.exit(1);
    }
    console.log(`机器人地址: ${botAddr}`);
    
    // 获取工厂合约ABI
    const factoryAbi = [
      "function userVaults(address) view returns (address)",
      "function createVault(address swapRouter, address wrappedNative, address bot) returns (address)",
      "function getVaultCount() view returns (uint256)",
      "function allVaults(uint256) view returns (address)",
      "function personalVaultImplementation() view returns (address)",
      "function hasRole(bytes32 role, address account) view returns (bool)"
    ];
    
    // 创建工厂合约实例
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    
    // 检查条件1: 用户是否已有金库
    const userVault = await factory.userVaults(user.address);
    console.log(`用户金库地址: ${userVault}`);
    console.log(`条件1 - 用户没有金库: ${userVault === ethers.ZeroAddress ? "通过" : "失败 - 用户已有金库"}`);
    
    // 检查条件2: 实现合约是否已设置
    const implAddress = await factory.personalVaultImplementation();
    console.log(`实现合约地址: ${implAddress}`);
    console.log(`条件2 - 实现合约已设置: ${implAddress !== ethers.ZeroAddress ? "通过" : "失败 - 未设置实现合约"}`);
    
    // 检查条件3: WrappedNative是否有效
    console.log(`条件3 - WrappedNative有效: ${wrappedNative !== ethers.ZeroAddress ? "通过" : "失败 - 无效的WrappedNative"}`);
    
    // 检查条件4: Bot地址是否有效
    console.log(`条件4 - Bot地址有效: ${botAddr !== ethers.ZeroAddress ? "通过" : "失败 - 无效的Bot地址"}`);
    
    // 检查条件5: Bot是否有BOT_ROLE权限
    const BOT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BOT_ROLE"));
    const hasBotRole = await factory.hasRole(BOT_ROLE, botAddr);
    console.log(`条件5 - Bot有BOT_ROLE权限: ${hasBotRole ? "通过" : "失败 - Bot没有BOT_ROLE权限"}`);
    
    // 检查用户余额
    const userBalance = await provider.getBalance(user.address);
    console.log(`用户余额: ${ethers.formatEther(userBalance)} ETH`);
    console.log(`条件6 - 用户有足够余额支付Gas: ${userBalance > ethers.parseEther("0.01") ? "通过" : "失败 - 余额不足"}`);
    
    // 检查参数是否正确
    console.log("\n检查createVault函数参数:");
    console.log(`swapRouter: ${swapRouter} - ${swapRouter === "0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d" ? "匹配" : "不匹配"}`);
    console.log(`wrappedNative: ${wrappedNative} - ${wrappedNative === "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e" ? "匹配" : "不匹配"}`);
    console.log(`botAddr: ${botAddr} - ${botAddr === "0x1227c9ED38A2D99f443FF143c36238cedf9B45af" ? "匹配" : "不匹配"}`);
    
    // 尝试调用合约的静态方法来模拟交易
    console.log("\n尝试模拟createVault交易...");
    try {
      const factoryWithUser = factory.connect(user);
      const callResult = await factoryWithUser.createVault.staticCall(
        swapRouter,
        wrappedNative,
        botAddr
      );
      console.log(`模拟交易成功，返回值: ${callResult}`);
    } catch (error) {
      console.error(`模拟交易失败: ${error.message}`);
      if (error.data) {
        console.error(`错误数据: ${error.data}`);
      }
    }
    
    console.log("\n总结:");
    if (userVault !== ethers.ZeroAddress) {
      console.log("主要问题: 用户已经有金库，无法创建新金库");
    } else if (implAddress === ethers.ZeroAddress) {
      console.log("主要问题: 未设置实现合约地址");
    } else if (!hasBotRole) {
      console.log("主要问题: Bot地址没有BOT_ROLE权限");
    } else {
      console.log("所有基本条件都满足，但交易仍然失败，可能是其他原因导致的");
    }
    
  } catch (error) {
    console.error(`脚本执行失败: ${error.message}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
