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

    // 检查是否有用户金库
    try {
      const vaultCount = await factory.vaultCount();
      console.log(`已创建的金库数量: ${vaultCount}`);

      if (vaultCount > 0) {
        console.log("尝试获取第一个金库地址...");
        // 获取第一个金库的地址
        const vaultAddress = await factory.vaults(0);
        console.log(`第一个金库地址: ${vaultAddress}`);

        // 获取金库合约
        const Vault = await ethers.getContractFactory(
          "PersonalVaultUpgradeableUniV2"
        );
        const vault = Vault.attach(vaultAddress);

        // 获取金库信息
        const investor = await vault.investor();
        console.log(`金库投资者: ${investor}`);
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
