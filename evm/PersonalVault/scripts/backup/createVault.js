// 尝试创建用户金库，增加详细日志和错误捕获，估算并增加gas限制以避免交易失败。
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("开始创建用户金库...");
  
  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;
  const userPrivateKey = process.env.USER_PRIVATE_KEY;
  const botPrivateKey = process.env.BOT_PRIVATE_KEY;
  const botAddress = process.env.BOT_ADDRESS;
  const rpcUrl = process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org";
  
  if (!factoryAddress || !swapRouter || !wrappedNative) {
    console.error("缺少必要的环境变量: FACTORY_ADDRESS, SWAP_ROUTER, WRAPPED_NATIVE");
    process.exit(1);
  }
  
  if (!userPrivateKey) {
    console.error("缺少USER_PRIVATE_KEY环境变量");
    process.exit(1);
  }
  
  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`SwapRouter: ${swapRouter}`);
  console.log(`WrappedNative: ${wrappedNative}`);
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
      "function allVaults(uint256) view returns (address)"
    ];
    
    // 创建工厂合约实例
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    
    // 检查用户是否已有金库
    const userVault = await factory.userVaults(user.address);
    console.log(`用户金库地址: ${userVault}`);
    
    if (userVault !== ethers.ZeroAddress) {
      console.log("用户已有金库，无需创建");
      process.exit(0);
    }
    
    console.log("用户没有金库，尝试创建一个新金库...");
    
    // 检查用户余额
    const userBalance = await provider.getBalance(user.address);
    console.log(`用户余额: ${ethers.formatEther(userBalance)} ETH`);
    
    if (userBalance < ethers.parseEther("0.01")) {
      console.error("用户余额不足，无法支付交易费用");
      process.exit(1);
    }
    
    // 尝试创建金库
    console.log(`尝试为用户 ${user.address} 创建金库...`);
    
    try {
      // 连接用户钱包到合约 - 正确的方法
      const factoryWithSigner = new ethers.Contract(factoryAddress, factoryAbi, user);
      
      // 估算gas
      console.log("估算交易gas...");
      const gasEstimate = await factoryWithSigner.createVault.estimateGas(
        swapRouter, 
        wrappedNative, 
        botAddr
      );
      
      console.log(`估算的gas: ${gasEstimate}`);
      
      // 创建金库
      console.log("提交创建金库交易...");
      const tx = await factoryWithSigner.createVault(
        swapRouter, 
        wrappedNative, 
        botAddr,
        { 
          gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 增加20%的gas限制
        }
      );
      
      console.log(`交易已提交: ${tx.hash}`);
      console.log("等待交易确认...");
      const receipt = await tx.wait();
      console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
      
      // 获取创建的金库地址
      const newVaultAddress = await factory.userVaults(user.address);
      console.log(`成功创建金库，地址: ${newVaultAddress}`);
    } catch (error) {
      console.error(`创建金库失败: ${error.message}`);
      
      // 尝试获取更详细的错误信息
      if (error.data) {
        console.error(`错误数据: ${error.data}`);
      }
      
      if (error.transaction) {
        console.error(`交易数据: ${JSON.stringify(error.transaction)}`);
      }
      
      process.exit(1);
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
