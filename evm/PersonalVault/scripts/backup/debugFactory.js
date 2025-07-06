// 调试工厂合约脚本
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("开始调试工厂合约...");
  
  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const implAddress = process.env.PERSONAL_VAULT_IMPL;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;
  
  if (!factoryAddress || !implAddress || !swapRouter || !wrappedNative) {
    console.error("缺少必要的环境变量: FACTORY_ADDRESS, PERSONAL_VAULT_IMPL, SWAP_ROUTER, WRAPPED_NATIVE");
    process.exit(1);
  }
  
  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`Implementation地址: ${implAddress}`);
  console.log(`SwapRouter: ${swapRouter}`);
  console.log(`WrappedNative: ${wrappedNative}`);
  
  try {
    // 获取签名者
    const [deployer] = await hre.ethers.getSigners();
    console.log(`当前连接的账户: ${deployer.address}`);
    
    // 获取用户和bot账户
    const userPrivateKey = process.env.USER_PRIVATE_KEY;
    const botPrivateKey = process.env.BOT_PRIVATE_KEY;
    
    if (!userPrivateKey || !botPrivateKey) {
      console.error("缺少USER_PRIVATE_KEY或BOT_PRIVATE_KEY环境变量");
      process.exit(1);
    }
    
    const user = new hre.ethers.Wallet(userPrivateKey, hre.ethers.provider);
    const bot = new hre.ethers.Wallet(botPrivateKey, hre.ethers.provider);
    
    console.log(`用户地址: ${user.address}`);
    console.log(`机器人地址: ${bot.address}`);
    
    // 获取合约实例
    const Factory = await hre.ethers.getContractFactory("PersonalVaultFactoryUniV2");
    const factory = Factory.attach(factoryAddress);
    
    // 验证工厂合约
    const owner = await factory.owner();
    console.log(`工厂合约所有者: ${owner}`);
    
    // 检查实现合约
    const implementation = await factory.personalVaultImplementation();
    console.log(`当前实现合约地址: ${implementation}`);
    console.log(`环境变量中的实现合约地址: ${implAddress}`);
    
    // 检查是否有用户金库
    const vaultCount = await factory.getVaultCount();
    console.log(`已创建的金库数量: ${vaultCount}`);
    
    // 列出所有金库
    console.log("\n所有金库列表:");
    for (let i = 0; i < vaultCount; i++) {
      const vaultAddress = await factory.allVaults(i);
      console.log(`金库 ${i}: ${vaultAddress}`);
      
      // 尝试获取金库投资者
      try {
        const Vault = await hre.ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
        const vault = Vault.attach(vaultAddress);
        const investor = await vault.investor();
        console.log(`  投资者: ${investor}`);
        
        // 检查这个金库是否属于我们的用户
        if (investor.toLowerCase() === user.address.toLowerCase()) {
          console.log(`  ⚠️ 这个金库属于我们的用户!`);
        }
      } catch (error) {
        console.log(`  无法获取金库信息: ${error.message}`);
      }
    }
    
    // 检查用户是否有金库
    const userVault = await factory.userVaults(user.address);
    console.log(`\n用户金库地址: ${userVault}`);
    if (userVault !== hre.ethers.ZeroAddress) {
      console.log(`用户已有金库!`);
    } else {
      console.log(`用户没有金库`);
    }
    
    // 检查bot权限
    const BOT_ROLE = await factory.BOT_ROLE();
    const isBotRole = await factory.hasRole(BOT_ROLE, bot.address);
    console.log(`\nBot是否有BOT_ROLE: ${isBotRole}`);
    
    if (!isBotRole) {
      console.log("Bot没有BOT_ROLE权限，尝试授权...");
      
      // 检查当前用户是否有管理员权限
      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
      const isAdmin = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
      console.log(`当前连接账户是否有管理员权限: ${isAdmin}`);
      
      if (isAdmin) {
        console.log("尝试授权Bot为BOT_ROLE...");
        try {
          const tx = await factory.grantRole(BOT_ROLE, bot.address);
          await tx.wait();
          console.log("已授权Bot为BOT_ROLE");
        } catch (error) {
          console.error(`授权失败: ${error.message}`);
        }
      }
    }
    
    // 尝试以工厂合约所有者身份创建金库
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("\n尝试以工厂合约所有者身份创建金库...");
      
      if (userVault === hre.ethers.ZeroAddress) {
        try {
          console.log(`尝试为用户 ${user.address} 创建金库...`);
          
          // 方法1：尝试使用impersonateAccount模拟用户账户
          console.log("方法1：尝试使用impersonateAccount模拟用户账户...");
          try {
            // 启用账户模拟
            await hre.network.provider.request({
              method: "hardhat_impersonateAccount",
              params: [user.address],
            });
            
            // 获取模拟的用户签名者
            const impersonatedUser = await hre.ethers.getSigner(user.address);
            console.log(`模拟用户地址: ${impersonatedUser.address}`);
            
            // 创建金库
            const tx1 = await factory.connect(impersonatedUser).createVault(
              swapRouter, 
              wrappedNative, 
              bot.address,
              { gasLimit: 1000000 }
            );
            
            console.log(`交易已提交: ${tx1.hash}`);
            const receipt1 = await tx1.wait();
            console.log(`交易已确认，区块号: ${receipt1.blockNumber}`);
            
            // 停止账户模拟
            await hre.network.provider.request({
              method: "hardhat_stopImpersonatingAccount",
              params: [user.address],
            });
            
            // 获取创建的金库地址
            const newVaultAddress1 = await factory.userVaults(user.address);
            console.log(`成功创建金库，地址: ${newVaultAddress1}`);
            return;
          } catch (error) {
            console.error(`使用impersonateAccount创建金库失败: ${error.message}`);
            // 如果impersonateAccount失败，继续尝试其他方法
          }
          
          // 方法2：尝试直接使用部署者账户为用户创建金库
          console.log("\n方法2：尝试直接使用部署者账户为用户创建金库...");
          
          // 检查工厂合约是否有代表用户创建金库的功能
          console.log("检查工厂合约是否有createVaultFor功能...");
          let hasCreateVaultFor = false;
          try {
            hasCreateVaultFor = typeof factory.createVaultFor === 'function';
            console.log(`是否有createVaultFor功能: ${hasCreateVaultFor}`);
          } catch (error) {
            console.log("无法检测createVaultFor功能");
          }
          
          if (hasCreateVaultFor) {
            // 如果有createVaultFor功能，使用它为用户创建金库
            console.log(`尝试为用户 ${user.address} 创建金库...`);
            const tx2 = await factory.createVaultFor(
              user.address,
              swapRouter, 
              wrappedNative, 
              bot.address,
              { gasLimit: 1000000 }
            );
            
            console.log(`交易已提交: ${tx2.hash}`);
            const receipt2 = await tx2.wait();
            console.log(`交易已确认，区块号: ${receipt2.blockNumber}`);
          } else {
            // 如果没有createVaultFor功能，提示用户需要直接使用用户账户创建金库
            console.log("工厂合约没有代表用户创建金库的功能，需要用户直接调用createVault");
            console.log("建议使用以下命令创建金库:");
            console.log(`npx hardhat run scripts/createVault.js --network flow`);
          }
          
          // 获取创建的金库地址
          const newVaultAddress = await factory.userVaults(user.address);
          console.log(`用户金库地址: ${newVaultAddress}`);
        } catch (error) {
          console.error(`创建金库失败: ${error.message}`);
          
          // 尝试获取更详细的错误信息
          if (error.data) {
            console.error(`错误数据: ${error.data}`);
          }
          
          if (error.transaction) {
            console.error(`交易数据: ${JSON.stringify(error.transaction)}`);
          }
        }
      } else {
        console.log("用户已有金库，跳过创建");
      }
    } else {
      console.log("\n当前连接账户不是工厂合约所有者，无法执行管理员操作");
    }
    
    console.log("\n调试完成");
  } catch (error) {
    console.error(`调试失败: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
