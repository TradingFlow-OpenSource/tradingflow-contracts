// 原生代币存取与权限测试
const { expect } = require("chai");
const hre = require("hardhat");
const ethers = hre.ethers;
require("dotenv").config();

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZeroAddress = "0x0000000000000000000000000000000000000000";

describe("PersonalVaultUpgradeableUniV2 - 原生代币测试", function () {
  this.timeout(600000);

  let admin;
  let user;
  let bot;
  let token;
  let tokenAddress;
  let factory;
  let factoryAddress;
  let vaultImplAddress;
  let swapRouter;
  let wrappedNative;
  let vault;

  before(async function () {
    // 如果是在Flow网络上运行，则增加超时时间
    if (hre.network.name === "flow") {
      this.timeout(600000); // 10分钟超时
    }

    // 获取签名者
    [admin, user, bot] = await ethers.getSigners();
    console.log("管理员地址:", await admin.getAddress());
    console.log("用户地址:", await user.getAddress());
    console.log("机器人地址:", await bot.getAddress());

    // 检查是否在地址复用模式
    if (
      process.env.FACTORY_ADDRESS &&
      process.env.VAULT_IMPLEMENTATION_ADDRESS
    ) {
      console.log("[地址复用模式] 使用.env中的合约和币地址:");
      tokenAddress = process.env.TEST_TOKEN_ADDRESS;
      vaultImplAddress = process.env.VAULT_IMPLEMENTATION_ADDRESS;
      factoryAddress = process.env.FACTORY_ADDRESS;
      swapRouter = process.env.SWAP_ROUTER;
      wrappedNative = process.env.WRAPPED_NATIVE;
      console.log("测试代币:", tokenAddress);
      console.log("Vault实现:", vaultImplAddress);
      console.log("Factory:", factoryAddress);
      console.log("swapRouter:", swapRouter);
      console.log("wrappedNative:", wrappedNative);

      // 获取已部署的合约实例
      factory = await ethers.getContractAt(
        "PersonalVaultFactoryUniV2",
        factoryAddress
      );
      token = await ethers.getContractAt("TestToken", tokenAddress);

      // 获取用户金库地址
      const vaultAddress = await factory.getVault(await user.getAddress());
      console.log("用户金库地址:", vaultAddress);
      vault = await ethers.getContractAt(
        "PersonalVaultUpgradeableUniV2",
        vaultAddress
      );
    } else {
      // 部署测试合约
      const TestToken = await ethers.getContractFactory("TestToken");
      token = await TestToken.deploy(
        "Test Token",
        "TST",
        ethers.parseEther("1000000")
      );
      await token.waitForDeployment();
      tokenAddress = await token.getAddress();
      console.log("测试代币地址:", tokenAddress);

      // 部署金库实现合约
      const Vault = await ethers.getContractFactory(
        "PersonalVaultUpgradeableUniV2"
      );
      const vaultImplementation = await Vault.deploy();
      await vaultImplementation.waitForDeployment();
      vaultImplAddress = await vaultImplementation.getAddress();
      console.log("金库实现地址:", vaultImplAddress);

      // 部署工厂合约
      const Factory = await ethers.getContractFactory(
        "PersonalVaultFactoryUniV2"
      );
      const adminAddress = await admin.getAddress();
      const botAddress = await bot.getAddress();
      factory = await Factory.deploy(
        adminAddress,
        vaultImplAddress,
        botAddress
      );
      await factory.waitForDeployment();
      factoryAddress = await factory.getAddress();
      console.log("工厂合约地址:", factoryAddress);

      // 设置测试环境的测试参数
      swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // 测试网络上的模拟地址
      wrappedNative = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // 测试网络上的模拟地址

      // 创建金库
      await factory.createVault(swapRouter, wrappedNative);
      const vaultAddress = await factory.getVault(await admin.getAddress());
      console.log("金库地址:", vaultAddress);
      vault = await ethers.getContractAt(
        "PersonalVaultUpgradeableUniV2",
        vaultAddress
      );
    }

    console.log("测试设置完成");
  });

  it("Should deposit native tokens to vault", async function () {
    // 使用全局vault对象
    if (!vault) {
      console.log("没有发现金库对象，跳过测试");
      this.skip();
      return;
    }

    // 获取当前金库的投资者地址
    const investorAddress = await vault.investor();
    console.log(`当前金库投资者地址: ${investorAddress}`);

    // 获取投资者签名者
    let investor;
    if ((await admin.getAddress()) === investorAddress) {
      investor = admin;
      console.log("使用admin作为投资者");
    } else if ((await user.getAddress()) === investorAddress) {
      investor = user;
      console.log("使用user作为投资者");
    } else {
      console.log("无法找到匹配的投资者签名者，跳过测试");
      this.skip();
      return;
    }

    // 获取初始余额
    const initialBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    console.log(`原生代币初始余额: ${ethers.formatEther(initialBalance)}`);

    // 存入原生代币
    const depositAmount = ethers.parseEther("0.1");
    await vault.connect(investor).depositNative({ value: depositAmount });

    // 检查金库中的原生代币余额
    const finalBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    console.log(`存入后原生代币余额: ${ethers.formatEther(finalBalance)}`);

    // 验证余额增加了
    expect(finalBalance).to.be.gt(initialBalance);
    const balanceIncrease = finalBalance - initialBalance;
    console.log(`原生代币余额增加了: ${ethers.formatEther(balanceIncrease)}`);
    // 验证余额增加接近所存入的数量（允许小误差）
    const diff =
      balanceIncrease > depositAmount
        ? balanceIncrease - depositAmount
        : depositAmount - balanceIncrease;
    expect(diff).to.be.lt(ethers.parseEther("0.01")); // 允许0.01的误差
  });

  it("Should withdraw native tokens from vault", async function () {
    // 使用全局vault对象
    if (!vault) {
      console.log("没有发现金库对象，跳过测试");
      this.skip();
      return;
    }

    // 获取当前金库的投资者地址
    const investorAddress = await vault.investor();
    console.log(`当前金库投资者地址: ${investorAddress}`);

    // 获取投资者签名者
    let investor;
    if ((await admin.getAddress()) === investorAddress) {
      investor = admin;
      console.log("使用admin作为投资者");
    } else if ((await user.getAddress()) === investorAddress) {
      investor = user;
      console.log("使用user作为投资者");
    } else {
      console.log("无法找到匹配的投资者签名者，跳过测试");
      this.skip();
      return;
    }

    // 获取初始余额
    const initialBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    console.log(`原生代币初始余额: ${ethers.formatEther(initialBalance)}`);

    // 如果金库中没有足够的原生代币，先存入一些
    if (initialBalance < ethers.parseEther("0.05")) {
      console.log("金库中原生代币不足，先存入一些");
      const depositAmount = ethers.parseEther("0.2");
      await vault.connect(investor).depositNative({ value: depositAmount });
      console.log(`存入了 ${ethers.formatEther(depositAmount)} FLOW`);
    }

    // 获取存入后的余额
    const balanceAfterDeposit = await vault.getBalance(NATIVE_TOKEN_ADDRESS);

    // 提取原生代币
    const withdrawAmount = ethers.parseEther("0.05");
    console.log(`准备提取: ${ethers.formatEther(withdrawAmount)} FLOW`);
    await vault.connect(investor).withdrawNative(withdrawAmount);

    // 检查金库中的原生代币余额
    const finalBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    console.log(`提取后原生代币余额: ${ethers.formatEther(finalBalance)}`);

    // 验证余额减少了
    expect(finalBalance).to.be.lt(initialBalance);
    const balanceDecrease = initialBalance - finalBalance;
    console.log(`原生代币余额减少了: ${ethers.formatEther(balanceDecrease)}`);
    // 验证余额减少接近所提取的数量（允许小误差）
    const diff =
      balanceDecrease > withdrawAmount
        ? balanceDecrease - withdrawAmount
        : withdrawAmount - balanceDecrease;
    expect(diff).to.be.lt(ethers.parseEther("0.01")); // 允许0.01的误差
  });

  it("Should enforce investor-only access for native token operations", async function () {
    // 使用全局vault对象
    if (!vault) {
      console.log("没有发现金库对象，跳过测试");
      this.skip();
      return;
    }

    // 获取当前金库的投资者地址
    const investorAddress = await vault.investor();
    console.log(`当前金库投资者地址: ${investorAddress}`);

    // 获取非投资者签名者
    let nonInvestorSigner = null;
    if ((await admin.getAddress()) !== investorAddress) {
      nonInvestorSigner = admin;
      console.log(`使用admin作为非投资者: ${await admin.getAddress()}`);
    } else if ((await bot.getAddress()) !== investorAddress) {
      nonInvestorSigner = bot;
      console.log(`使用bot作为非投资者: ${await bot.getAddress()}`);
    }

    // 如果没有找到非投资者签名者，跳过测试
    if (!nonInvestorSigner) {
      console.log("无法找到非投资者签名者，跳过测试");
      this.skip();
      return;
    }

    // 测试非投资者用户无法存入原生代币
    try {
      await vault
        .connect(nonInvestorSigner)
        .depositNative({ value: ethers.parseEther("0.01") });
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含"Only investor"
      expect(error.message).to.include("Only investor");
    }

    // 测试非投资者用户无法提取原生代币
    try {
      await vault
        .connect(nonInvestorSigner)
        .withdrawNative(ethers.parseEther("0.01"));
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含"Only investor"
      expect(error.message).to.include("Only investor");
    }
  });
});
