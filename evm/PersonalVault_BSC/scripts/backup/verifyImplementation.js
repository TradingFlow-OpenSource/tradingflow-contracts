// 验证实现合约的地址和代码
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("开始验证实现合约...");

  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const personalVaultImpl = process.env.PERSONAL_VAULT_IMPL_ADDRESS;
  const rpcUrl =
    process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org";

  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`配置的实现合约地址: ${personalVaultImpl}`);
  console.log(`RPC URL: ${rpcUrl}`);

  try {
    // 创建provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 获取工厂合约ABI
    const factoryAbi = [
      "function personalVaultImplementation() view returns (address)",
    ];

    // 创建工厂合约实例
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

    // 获取工厂合约中存储的实现合约地址
    const implAddress = await factory.personalVaultImplementation();
    console.log(`工厂合约中存储的实现合约地址: ${implAddress}`);

    // 验证实现合约地址是否匹配
    if (personalVaultImpl && implAddress !== personalVaultImpl) {
      console.log(`警告: 配置的实现合约地址与工厂合约中存储的不匹配!`);
    } else {
      console.log(`实现合约地址验证通过`);
    }

    // 检查实现合约的代码
    const implCode = await provider.getCode(implAddress);
    if (implCode === "0x") {
      console.error(`错误: 实现合约地址没有代码!`);
    } else {
      console.log(`实现合约代码长度: ${implCode.length} 字节`);
      console.log(`实现合约代码验证通过`);
    }

    // 尝试获取实现合约的初始化函数选择器
    const initSelector = ethers
      .id("initialize(address,address,address,address,address)")
      .substring(0, 10);
    console.log(`初始化函数选择器: ${initSelector}`);

    // 检查实现合约代码中是否包含初始化函数选择器
    if (implCode.includes(initSelector.substring(2))) {
      console.log(`实现合约包含正确的初始化函数`);
    } else {
      console.log(`警告: 实现合约可能没有正确的初始化函数!`);
    }

    // 检查是否有足够的gas限制
    console.log("\n尝试估算创建金库所需的gas...");

    // 获取用户私钥
    const userPrivateKey = process.env.USER_PRIVATE_KEY;
    if (!userPrivateKey) {
      console.error("缺少USER_PRIVATE_KEY环境变量");
      return;
    }

    // 创建用户钱包
    const user = new ethers.Wallet(userPrivateKey, provider);
    console.log(`用户地址: ${user.address}`);

    // 获取swapRouter和wrappedNative
    const swapRouter = process.env.SWAP_ROUTER;
    const wrappedNative = process.env.WRAPPED_NATIVE;

    // 获取bot地址
    let botAddr;
    const botAddress = process.env.BOT_ADDRESS;
    const botPrivateKey = process.env.BOT_PRIVATE_KEY;

    if (botAddress) {
      botAddr = botAddress;
    } else if (botPrivateKey) {
      const bot = new ethers.Wallet(botPrivateKey);
      botAddr = bot.address;
    } else {
      console.error("缺少BOT_ADDRESS或BOT_PRIVATE_KEY环境变量");
      return;
    }

    // 获取工厂合约的createVault函数ABI
    const createVaultAbi = [
      "function createVault(address swapRouter, address wrappedNative, address bot) returns (address)",
    ];

    // 创建工厂合约实例
    const factoryWithCreateVault = new ethers.Contract(
      factoryAddress,
      createVaultAbi,
      provider
    );

    // 连接用户钱包到合约
    const factoryWithSigner = factoryWithCreateVault.connect(user);

    try {
      // 尝试估算gas
      console.log(
        `尝试估算createVault(${swapRouter}, ${wrappedNative}, ${botAddr})的gas...`
      );
      const gasEstimate = await factoryWithSigner.createVault.estimateGas(
        swapRouter,
        wrappedNative,
        botAddr,
        { gasLimit: 5000000 } // 设置一个较大的初始gasLimit
      );
      console.log(`估算的gas: ${gasEstimate}`);
      console.log(`建议的gas限制: ${Math.floor(Number(gasEstimate) * 1.5)}`); // 增加50%的gas限制
    } catch (error) {
      console.error(`估算gas失败: ${error.message}`);
      if (error.data) {
        console.error(`错误数据: ${error.data}`);

        // 尝试解码错误数据
        try {
          // 常见的错误选择器
          const errorSelectors = {
            "0x08c379a0": "Error(string)", // 标准错误
            "0x4e487b71": "Panic(uint256)", // Panic错误
            "0xe2517d3f": "自定义错误", // 我们看到的错误选择器
          };

          const errorSelector = error.data.substring(0, 10);
          console.log(`错误选择器: ${errorSelector}`);

          if (errorSelectors[errorSelector]) {
            console.log(`已知错误类型: ${errorSelectors[errorSelector]}`);
          } else {
            console.log(`未知错误类型`);
          }
        } catch (decodeError) {
          console.error(`解码错误数据失败: ${decodeError.message}`);
        }
      }
    }

    // 检查是否有足够的余额支付gas
    const userBalance = await provider.getBalance(user.address);
    console.log(`用户余额: ${ethers.formatEther(userBalance)} ETH`);

    if (userBalance < ethers.parseEther("0.1")) {
      console.log(`警告: 用户余额较低，可能无法支付足够的gas`);
    } else {
      console.log(`用户有足够的余额支付gas`);
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
