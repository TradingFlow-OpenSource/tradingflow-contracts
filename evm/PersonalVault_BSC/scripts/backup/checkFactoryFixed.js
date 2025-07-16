// 使用JavaScript而不是TypeScript来避免编译问题
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

    // 检查allVaults数组长度
    try {
      // 尝试获取allVaults[0]，如果不存在会抛出错误
      const firstVault = await factory.allVaults(0);
      console.log(`找到金库: ${firstVault}`);

      // 尝试获取该金库的投资者
      const Vault = await ethers.getContractFactory(
        "PersonalVaultUpgradeableUniV2"
      );
      const vault = Vault.attach(firstVault);

      const investor = await vault.investor();
      console.log(`金库投资者: ${investor}`);

      // 检查该投资者的金库映射是否正确
      const mappedVault = await factory.userVaults(investor);
      console.log(`通过userVaults映射获取的金库: ${mappedVault}`);

      // 检查金库的SwapRouter
      const vaultRouter = await vault.swapRouter();
      console.log(`金库SwapRouter: ${vaultRouter}`);

      // 检查金库的WRAPPED_NATIVE
      const vaultWrappedNative = await vault.WRAPPED_NATIVE();
      console.log(`金库WRAPPED_NATIVE: ${vaultWrappedNative}`);

      // 检查bot权限
      const botAddress = process.env.BOT_ADDRESS;
      if (botAddress) {
        console.log(`检查Bot地址: ${botAddress}`);
        const hasOracleRole = await vault.hasRole(
          await vault.ORACLE_ROLE(),
          botAddress
        );
        console.log(`Bot是否有ORACLE_ROLE: ${hasOracleRole}`);
      }
    } catch (error) {
      console.log("没有找到已创建的金库，尝试创建一个新金库...");

      // 获取用户账户
      const userPrivateKey = process.env.USER_PRIVATE_KEY;
      if (!userPrivateKey) {
        console.error("缺少USER_PRIVATE_KEY环境变量，无法创建金库");
        return;
      }

      const user = new ethers.Wallet(userPrivateKey, ethers.provider);
      console.log(`用户地址: ${user.address}`);

      // 检查用户余额
      const userBalance = await ethers.provider.getBalance(user.address);
      console.log(`用户余额: ${ethers.formatEther(userBalance)} FLOW`);

      if (userBalance === 0n) {
        console.error("用户余额为0，无法创建金库");
        return;
      }

      // 获取bot地址
      let botAddress = process.env.BOT_ADDRESS;

      // 如果没有BOT_ADDRESS，尝试使用BOT_PRIVATE_KEY获取地址
      if (!botAddress) {
        const botPrivateKey = process.env.BOT_PRIVATE_KEY;
        if (botPrivateKey) {
          const botWallet = new ethers.Wallet(botPrivateKey);
          botAddress = botWallet.address;
          console.log(`使用BOT_PRIVATE_KEY生成的Bot地址: ${botAddress}`);
        } else {
          console.error(
            "缺少BOT_ADDRESS或BOT_PRIVATE_KEY环境变量，无法创建金库"
          );
          return;
        }
      }

      console.log(`尝试为用户 ${user.address} 创建金库...`);
      console.log(`使用SwapRouter: ${swapRouter}`);
      console.log(`使用WrappedNative: ${wrappedNative}`);
      console.log(`使用Bot地址: ${botAddress}`);

      // 创建金库
      try {
        const tx = await factory
          .connect(user)
          .createVault(swapRouter, wrappedNative, botAddress);
        console.log(`交易已提交: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`交易已确认，区块号: ${receipt.blockNumber}`);

        // 获取创建的金库地址
        const vaultAddr = await factory.userVaults(user.address);
        console.log(`成功创建金库，地址: ${vaultAddr}`);
      } catch (createError) {
        console.error(`创建金库失败: ${createError.message}`);
      }
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
