// 使用JavaScript而不是TypeScript来避免编译问题
const { expect } = require("chai");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("开始测试 PersonalVaultUpgradeableUniV2 合约...");

  // 获取环境变量
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const implAddress = process.env.PERSONAL_VAULT_IMPL;
  const swapRouter = process.env.SWAP_ROUTER;
  const wrappedNative = process.env.WRAPPED_NATIVE;

  if (!factoryAddress || !implAddress || !swapRouter || !wrappedNative) {
    console.error(
      "缺少必要的环境变量: FACTORY_ADDRESS, PERSONAL_VAULT_IMPL, SWAP_ROUTER, WRAPPED_NATIVE"
    );
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
    const Factory = await hre.ethers.getContractFactory(
      "PersonalVaultFactoryUniV2"
    );
    const factory = Factory.attach(factoryAddress);

    // 验证工厂合约
    const owner = await factory.owner();
    console.log(`工厂合约所有者: ${owner}`);
    console.log("✅ 工厂合约验证成功");

    // 检查是否有用户金库
    const vaultCount = await factory.getVaultCount();
    console.log(`已创建的金库数量: ${vaultCount}`);

    // 检查用户是否有金库
    const userVault = await factory.userVaults(user.address);
    console.log(`用户金库地址: ${userVault}`);

    let vaultAddress;

    if (userVault === hre.ethers.ZeroAddress) {
      console.log("用户没有金库，尝试创建一个新金库...");

      try {
        // 创建金库
        console.log(`尝试为用户 ${user.address} 创建金库...`);
        console.log(`使用SwapRouter: ${swapRouter}`);
        console.log(`使用WrappedNative: ${wrappedNative}`);
        console.log(`使用Bot地址: ${bot.address}`);

        const tx = await factory
          .connect(user)
          .createVault(swapRouter, wrappedNative, bot.address);
        console.log(`交易已提交: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`交易已确认，区块号: ${receipt.blockNumber}`);

        // 获取创建的金库地址
        vaultAddress = await factory.userVaults(user.address);
        console.log(`成功创建金库，地址: ${vaultAddress}`);
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
    } else {
      console.log(`用户已有金库，地址: ${userVault}`);
      vaultAddress = userVault;
    }

    // 获取金库合约
    const Vault = await hre.ethers.getContractFactory(
      "PersonalVaultUpgradeableUniV2"
    );
    const vault = Vault.attach(vaultAddress);

    // 获取金库信息
    const investor = await vault.investor();
    console.log(`金库投资者: ${investor}`);

    const vaultRouter = await vault.swapRouter();
    console.log(`金库SwapRouter: ${vaultRouter}`);

    const vaultWrappedNative = await vault.WRAPPED_NATIVE();
    console.log(`金库WRAPPED_NATIVE: ${vaultWrappedNative}`);

    // 检查bot权限
    const ORACLE_ROLE = await vault.ORACLE_ROLE();
    const hasOracleRole = await vault.hasRole(ORACLE_ROLE, bot.address);
    console.log(`Bot是否有ORACLE_ROLE: ${hasOracleRole}`);

    if (!hasOracleRole) {
      console.log("Bot没有ORACLE_ROLE权限，尝试授权...");

      // 获取金库的DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
      const adminRoleHolder = await vault.getRoleMember(DEFAULT_ADMIN_ROLE, 0);
      console.log(`金库管理员角色持有者: ${adminRoleHolder}`);

      // 如果当前用户是管理员，授权bot
      if (adminRoleHolder === user.address) {
        console.log("用户是金库管理员，尝试授权bot...");
        const tx = await vault
          .connect(user)
          .grantRole(ORACLE_ROLE, bot.address);
        await tx.wait();
        console.log("已授权Bot为ORACLE_ROLE");
      } else {
        console.log(`用户不是金库管理员，无法授权bot`);
      }
    }

    // 测试存入原生代币
    console.log("\n测试存入原生代币...");
    const NATIVE_TOKEN = await vault.NATIVE_TOKEN();
    console.log(`原生代币地址: ${NATIVE_TOKEN}`);

    // 获取当前余额
    let nativeBalance = await vault.getBalance(NATIVE_TOKEN);
    console.log(`当前原生代币余额: ${hre.ethers.formatEther(nativeBalance)}`);

    // 存入原生代币
    const depositAmount = hre.ethers.parseEther("0.01");
    console.log(
      `尝试存入 ${hre.ethers.formatEther(depositAmount)} 原生代币...`
    );

    try {
      const tx = await vault
        .connect(user)
        .depositNative({ value: depositAmount });
      await tx.wait();
      console.log("存入原生代币成功");

      // 检查余额
      nativeBalance = await vault.getBalance(NATIVE_TOKEN);
      console.log(
        `存入后原生代币余额: ${hre.ethers.formatEther(nativeBalance)}`
      );
    } catch (error) {
      console.error(`存入原生代币失败: ${error.message}`);
    }

    // 测试提取原生代币
    console.log("\n测试提取原生代币...");

    // 获取当前余额
    nativeBalance = await vault.getBalance(NATIVE_TOKEN);

    if (nativeBalance > 0) {
      const withdrawAmount = nativeBalance / 2n;
      console.log(
        `尝试提取 ${hre.ethers.formatEther(withdrawAmount)} 原生代币...`
      );

      try {
        const tx = await vault.connect(user).withdrawNative(withdrawAmount);
        await tx.wait();
        console.log("提取原生代币成功");

        // 检查余额
        nativeBalance = await vault.getBalance(NATIVE_TOKEN);
        console.log(
          `提取后原生代币余额: ${hre.ethers.formatEther(nativeBalance)}`
        );
      } catch (error) {
        console.error(`提取原生代币失败: ${error.message}`);
      }
    } else {
      console.log("金库中没有原生代币，跳过提取测试");
    }

    // 测试swap功能
    console.log("\n测试swap功能...");

    // 检查环境变量
    const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS;
    const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS;

    if (!TOKEN_A_ADDRESS || !TOKEN_B_ADDRESS) {
      console.log(
        "⚠️ 跳过swap测试: 缺少TOKEN_A_ADDRESS或TOKEN_B_ADDRESS环境变量"
      );
      return;
    }

    console.log(`TokenA地址: ${TOKEN_A_ADDRESS}`);
    console.log(`TokenB地址: ${TOKEN_B_ADDRESS}`);

    // 获取代币合约
    const tokenA = await hre.ethers.getContractAt("IERC20", TOKEN_A_ADDRESS);

    // 检查用户是否有足够的tokenA余额
    const userBalanceA = await tokenA.balanceOf(user.address);
    console.log(`用户TokenA余额: ${hre.ethers.formatEther(userBalanceA)}`);

    if (userBalanceA < hre.ethers.parseEther("0.01")) {
      console.log("⚠️ 跳过swap测试: 用户TokenA余额不足");
      return;
    }

    // 存入一些TokenA到金库
    const tokenDepositAmount = hre.ethers.parseEther("0.01");
    console.log(
      `尝试存入 ${hre.ethers.formatEther(tokenDepositAmount)} TokenA到金库...`
    );

    try {
      // 授权金库使用代币
      await tokenA.connect(user).approve(vaultAddress, tokenDepositAmount);
      console.log("已授权金库使用TokenA");

      // 存入代币
      const tx = await vault
        .connect(user)
        .deposit(TOKEN_A_ADDRESS, tokenDepositAmount);
      await tx.wait();
      console.log("存入TokenA成功");

      // 检查余额
      const tokenABalance = await vault.getBalance(TOKEN_A_ADDRESS);
      console.log(`金库TokenA余额: ${hre.ethers.formatEther(tokenABalance)}`);

      // 执行swap
      if (tokenABalance > 0) {
        console.log("\n尝试执行swap: TokenA -> TokenB...");

        // 记录swap前余额
        const balA_before = await vault.getBalance(TOKEN_A_ADDRESS);
        const balB_before = await vault.getBalance(TOKEN_B_ADDRESS);
        console.log(
          `Swap前余额: TokenA=${hre.ethers.formatEther(
            balA_before
          )}, TokenB=${hre.ethers.formatEther(balB_before)}`
        );

        // 执行swap
        try {
          const swapAmount = tokenABalance / 2n;
          const amountOutMinimum = 1n;

          console.log(
            `尝试swap: ${hre.ethers.formatEther(swapAmount)} TokenA -> TokenB`
          );

          const tx = await vault.connect(bot).swapExactInputSingle(
            TOKEN_A_ADDRESS,
            TOKEN_B_ADDRESS,
            swapAmount,
            amountOutMinimum,
            hre.ethers.ZeroAddress, // feeRecipient
            100 // feeRate 1/10000
          );

          await tx.wait();
          console.log("Swap交易成功");

          // 检查swap后余额
          const balA_after = await vault.getBalance(TOKEN_A_ADDRESS);
          const balB_after = await vault.getBalance(TOKEN_B_ADDRESS);
          console.log(
            `Swap后余额: TokenA=${hre.ethers.formatEther(
              balA_after
            )}, TokenB=${hre.ethers.formatEther(balB_after)}`
          );
        } catch (error) {
          console.error(`Swap失败: ${error.message}`);

          if (error.data) {
            console.error(`错误数据: ${error.data}`);
          }
        }
      }
    } catch (error) {
      console.error(`存入TokenA失败: ${error.message}`);
    }

    console.log("\n测试完成");
  } catch (error) {
    console.error(`测试失败: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
