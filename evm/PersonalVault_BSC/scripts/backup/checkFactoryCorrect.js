// 使用正确的函数名检查工厂合约
const { ethers } = require("hardhat");

async function main() {
  console.log("验证部署的合约是否可以正常访问...");

  // 获取部署地址
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const implAddress = process.env.PERSONAL_VAULT_IMPL_ADDRESS;

  console.log(`Factory地址: ${factoryAddress}`);
  console.log(`Implementation地址: ${implAddress}`);

  try {
    // 获取合约实例
    const Factory = await ethers.getContractFactory(
      "PersonalVaultFactoryUniV2"
    );
    const factory = Factory.attach(factoryAddress);

    // 验证工厂合约
    const owner = await factory.owner();
    console.log(`工厂合约所有者: ${owner}`);
    console.log("✅ 工厂合约验证成功");

    // 获取环境变量
    const swapRouter = process.env.SWAP_ROUTER;
    const wrappedNative = process.env.WRAPPED_NATIVE;

    console.log(`SwapRouter: ${swapRouter}`);
    console.log(`WrappedNative: ${wrappedNative}`);

    // 获取签名者
    const [deployer] = await ethers.getSigners();
    console.log(`当前连接的账户: ${deployer.address}`);

    // 检查是否有用户金库 - 使用正确的函数名 getVaultCount 而不是 vaultCount
    try {
      const vaultCount = await factory.getVaultCount();
      console.log(`已创建的金库数量: ${vaultCount}`);

      if (vaultCount > 0) {
        console.log("尝试获取金库地址...");

        // 获取所有金库
        for (let i = 0; i < Math.min(vaultCount, 5); i++) {
          // 最多显示5个金库
          const vaultAddress = await factory.allVaults(i);
          console.log(`金库 ${i} 地址: ${vaultAddress}`);

          // 获取金库合约
          const Vault = await ethers.getContractFactory(
            "PersonalVaultUpgradeableUniV2"
          );
          const vault = Vault.attach(vaultAddress);

          // 获取金库信息
          try {
            const investor = await vault.investor();
            console.log(`金库 ${i} 投资者: ${investor}`);

            // 检查用户映射是否正确
            const mappedVault = await factory.userVaults(investor);
            console.log(`通过userVaults映射获取的金库: ${mappedVault}`);

            // 检查金库的SwapRouter
            const vaultRouter = await vault.swapRouter();
            console.log(`金库 ${i} SwapRouter: ${vaultRouter}`);

            // 检查金库的WRAPPED_NATIVE
            const vaultWrappedNative = await vault.WRAPPED_NATIVE();
            console.log(`金库 ${i} WRAPPED_NATIVE: ${vaultWrappedNative}`);
          } catch (vaultError) {
            console.error(`获取金库 ${i} 信息失败: ${vaultError.message}`);
          }
        }
      } else {
        console.log("目前没有创建任何金库");

        // 检查用户是否有金库
        const userPrivateKey = process.env.USER_PRIVATE_KEY;
        if (userPrivateKey) {
          const userWallet = new ethers.Wallet(userPrivateKey);
          const userAddress = userWallet.address;
          console.log(`检查用户 ${userAddress} 是否有金库...`);

          const userVault = await factory.userVaults(userAddress);
          if (userVault !== ethers.ZeroAddress) {
            console.log(`用户有金库，地址: ${userVault}`);
          } else {
            console.log("用户没有金库");
          }
        }
      }
    } catch (error) {
      console.error(`获取金库信息失败: ${error.message}`);
    }
  } catch (error) {
    console.error(`合约验证失败: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
