// 检查用户是否已经有金库
const { ethers } = require("hardhat");

async function main() {
  // 获取部署地址
  const factoryAddress = process.env.FACTORY_ADDRESS;
  console.log(`Factory地址: ${factoryAddress}`);
  
  try {
    // 获取合约实例
    const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
    const factory = Factory.attach(factoryAddress);
    
    // 获取用户地址
    const userPrivateKey = process.env.USER_PRIVATE_KEY;
    if (!userPrivateKey) {
      console.error("缺少USER_PRIVATE_KEY环境变量");
      return;
    }
    
    const user = new ethers.Wallet(userPrivateKey, ethers.provider);
    console.log(`用户地址: ${user.address}`);
    
    // 检查用户是否已有金库
    const vaultAddress = await factory.userVaults(user.address);
    console.log(`用户金库地址: ${vaultAddress}`);
    
    if (vaultAddress === ethers.ZeroAddress) {
      console.log("用户没有金库，可以创建新金库");
    } else {
      console.log("用户已有金库，无法创建新金库");
      
      // 获取金库合约
      const Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      const vault = Vault.attach(vaultAddress);
      
      // 获取金库信息
      try {
        const investor = await vault.investor();
        console.log(`金库投资者: ${investor}`);
        
        const swapRouter = await vault.swapRouter();
        console.log(`金库SwapRouter: ${swapRouter}`);
        
        const wrappedNative = await vault.WRAPPED_NATIVE();
        console.log(`金库WRAPPED_NATIVE: ${wrappedNative}`);
        
        // 检查bot权限
        const botPrivateKey = process.env.BOT_PRIVATE_KEY;
        if (botPrivateKey) {
          const botWallet = new ethers.Wallet(botPrivateKey);
          const botAddress = botWallet.address;
          console.log(`Bot地址: ${botAddress}`);
          
          const hasOracleRole = await vault.hasRole(await vault.ORACLE_ROLE(), botAddress);
          console.log(`Bot是否有ORACLE_ROLE: ${hasOracleRole}`);
        }
      } catch (error) {
        console.error(`获取金库信息失败: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`检查用户金库失败: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
