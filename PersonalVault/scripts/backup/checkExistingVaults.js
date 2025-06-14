// 检查链上已存在的金库，分析成功创建的案例
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("检查链上已存在的金库...");
  
  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const rpcUrl = process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org";
  
  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`RPC URL: ${rpcUrl}`);
  
  try {
    // 创建provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // 获取工厂合约ABI
    const factoryAbi = [
      "function userVaults(address) view returns (address)",
      "function getVaultCount() view returns (uint256)",
      "function allVaults(uint256) view returns (address)"
    ];
    
    // 创建工厂合约实例
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    
    // 获取金库总数
    const vaultCount = await factory.getVaultCount();
    console.log(`链上金库总数: ${vaultCount}`);
    
    if (vaultCount > 0) {
      console.log("\n分析已存在的金库:");
      
      // 遍历所有金库
      for (let i = 0; i < Math.min(vaultCount, 10); i++) { // 最多显示10个金库
        const vaultAddress = await factory.allVaults(i);
        console.log(`\n金库 #${i}: ${vaultAddress}`);
        
        try {
          // 获取金库所有者
          const code = await provider.getCode(vaultAddress);
          console.log(`金库合约代码长度: ${code.length} 字节`);
          
          // 查询金库创建的交易历史
          console.log(`尝试查找金库创建交易...`);
          
          // 获取金库的交易历史
          const blockNumber = await provider.getBlockNumber();
          console.log(`当前区块高度: ${blockNumber}`);
          
          // 检查最近的交易，尝试找到创建交易
          const vaultCreationFilter = {
            address: factoryAddress,
            fromBlock: blockNumber - 10000, // 查询最近10000个区块
            toBlock: "latest"
          };
          
          try {
            const logs = await provider.getLogs(vaultCreationFilter);
            console.log(`找到 ${logs.length} 条日志记录`);
            
            if (logs.length > 0) {
              for (const log of logs.slice(0, 3)) { // 只显示前3条
                console.log(`  区块: ${log.blockNumber}, 交易哈希: ${log.transactionHash}`);
              }
            }
          } catch (error) {
            console.log(`获取日志失败: ${error.message}`);
          }
        } catch (error) {
          console.error(`分析金库 #${i} 失败: ${error.message}`);
        }
      }
    } else {
      console.log("链上没有金库，尝试检查工厂合约的其他功能");
    }
    
    // 检查用户是否有金库
    const userPrivateKey = process.env.USER_PRIVATE_KEY;
    if (userPrivateKey) {
      const user = new ethers.Wallet(userPrivateKey);
      const userVault = await factory.userVaults(user.address);
      console.log(`\n用户 ${user.address} 的金库: ${userVault}`);
      
      if (userVault !== ethers.ZeroAddress) {
        console.log(`用户已有金库!`);
      } else {
        console.log(`用户没有金库`);
      }
    }
    
    // 检查是否有其他用户有金库
    console.log("\n检查是否有其他用户有金库:");
    const botPrivateKey = process.env.BOT_PRIVATE_KEY;
    if (botPrivateKey) {
      const bot = new ethers.Wallet(botPrivateKey);
      const botVault = await factory.userVaults(bot.address);
      console.log(`机器人 ${bot.address} 的金库: ${botVault}`);
      
      if (botVault !== ethers.ZeroAddress) {
        console.log(`机器人已有金库!`);
      }
    }
    
    // 检查部署者是否有金库
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (deployerPrivateKey) {
      const deployer = new ethers.Wallet(deployerPrivateKey);
      const deployerVault = await factory.userVaults(deployer.address);
      console.log(`部署者 ${deployer.address} 的金库: ${deployerVault}`);
      
      if (deployerVault !== ethers.ZeroAddress) {
        console.log(`部署者已有金库!`);
      }
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
