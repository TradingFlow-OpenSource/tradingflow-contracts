// 使用完整ABI定义尝试创建金库
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("使用完整ABI定义尝试创建金库...");
  
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
    
    // 使用完整的ABI定义
    const factoryAbi = [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "swapRouter",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "wrappedNative",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "bot",
            "type": "address"
          }
        ],
        "name": "createVault",
        "outputs": [
          {
            "internalType": "address payable",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "userVaults",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
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
      // 创建带有签名者的合约实例
      const factoryWithSigner = factory.connect(user);
      
      // 设置交易选项
      const gasLimit = 5000000;
      console.log(`使用固定gas限制: ${gasLimit}`);
      
      // 直接编码函数调用数据
      const data = factory.interface.encodeFunctionData("createVault", [
        swapRouter,
        wrappedNative,
        botAddr
      ]);
      console.log(`编码后的函数调用数据: ${data}`);
      
      // 创建交易对象
      const tx = {
        to: factoryAddress,
        data: data,
        gasLimit: gasLimit
      };
      
      console.log("提交创建金库交易...");
      const response = await user.sendTransaction(tx);
      
      console.log(`交易已提交: ${response.hash}`);
      console.log("等待交易确认...");
      
      // 等待交易确认
      const receipt = await response.wait();
      console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
      
      // 获取创建的金库地址
      const newVaultAddress = await factory.userVaults(user.address);
      console.log(`成功创建金库，地址: ${newVaultAddress}`);
    } catch (error) {
      console.error(`创建金库失败: ${error.message}`);
      
      // 尝试获取更详细的错误信息
      if (error.transaction) {
        console.log(`交易数据: ${JSON.stringify(error.transaction)}`);
      }
      if (error.receipt) {
        console.log(`交易收据: ${JSON.stringify(error.receipt)}`);
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
