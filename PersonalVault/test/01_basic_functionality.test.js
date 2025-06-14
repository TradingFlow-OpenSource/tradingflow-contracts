// 基本功能测试：创建金库、代币存取、角色管理
const { expect } = require("chai");
const { ZeroAddress } = require("ethers");

// 使用 require 方式获取 hardhat 和 ethers
const hre = require("hardhat");
const ethers = hre.ethers;

// 环境变量
require("dotenv").config();

describe("PersonalVaultUpgradeableUniV2 - 基本功能测试", function () {
  // 增加超时时间到 10 分钟，适应Flow网络
  this.timeout(600000);

  let Vault;
  let Factory;
  let factory;
  let admin;
  let user;
  let bot;
  let token;
  let tokenAddress;
  let factoryAddress;
  let vaultImplAddress;
  let swapRouter;
  let wrappedNative;

  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
  const VAULT_IMPL_ADDRESS = process.env.VAULT_IMPL_ADDRESS;
  const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS;
  const SWAP_ROUTER = process.env.SWAP_ROUTER;
  const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE;

  before(async function () {
    console.log("开始测试设置...");
    // 获取签名者
    const signers = await ethers.getSigners();
    if (signers.length < 3) {
      console.log("警告: 签名者数量不足，需要至少3个账户");
      admin = signers[0];
      user = signers[0];
      bot = signers[0];
    } else {
      admin = signers[0];
      user = signers[1];
      bot = signers[2];
    }
    console.log("管理员地址:", admin.address);
    console.log("用户地址:", user.address);
    console.log("机器人地址:", bot.address);

    // 判断是否使用.env配置的合约/币地址
    let deployMode = !(FACTORY_ADDRESS && VAULT_IMPL_ADDRESS && TEST_TOKEN_ADDRESS);
    if (deployMode) {
      // 自动部署模式
      console.log("[自动部署模式] 部署测试代币和合约...");
      const Token = await ethers.getContractFactory("TestToken");
      // 使用足够大的初始供应量：1,000,000 tokens
      token = await Token.deploy("Test Token", "TST", ethers.parseEther("1000000"));
      await token.waitForDeployment();
      tokenAddress = await token.getAddress();
      console.log("测试代币部署成功:", tokenAddress);
      
      // 给用户转移一些代币用于测试
      const userTokenAmount = ethers.parseEther("1000");
      await token.transfer(user.address, userTokenAmount);
      console.log(`给用户转移了 ${ethers.formatEther(userTokenAmount)} 代币`);

      // 部署Vault实现合约
      Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      const vaultImpl = await Vault.deploy();
      await vaultImpl.waitForDeployment();
      vaultImplAddress = await vaultImpl.getAddress();
      console.log("Vault 实现合约部署成功:", vaultImplAddress);

      // 部署Factory合约（admin, 实现合约, bot）
      Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
      factory = await Factory.deploy(admin.address, vaultImplAddress, bot.address);
      await factory.waitForDeployment();
      factoryAddress = await factory.getAddress();
      console.log("Factory 合约部署成功:", factoryAddress);
    } else {
      // 直接用.env指定的地址
      tokenAddress = TEST_TOKEN_ADDRESS;
      vaultImplAddress = VAULT_IMPL_ADDRESS;
      factoryAddress = FACTORY_ADDRESS;
      console.log("[地址复用模式] 使用.env中的合约和币地址:");
      console.log("测试代币:", tokenAddress);
      console.log("Vault实现:", vaultImplAddress);
      console.log("Factory:", factoryAddress);
      // 连接合约实例
      Token = await ethers.getContractFactory("TestToken");
      token = Token.attach(tokenAddress);
      Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
      factory = Factory.attach(factoryAddress);
    }

    // swapRouter和wrappedNative始终用env
    swapRouter = SWAP_ROUTER;
    wrappedNative = WRAPPED_NATIVE;
    if (!swapRouter || !wrappedNative || swapRouter === ZeroAddress || wrappedNative === ZeroAddress) {
      throw new Error("请在.env中配置SWAP_ROUTER和WRAPPED_NATIVE地址");
    }
    console.log("swapRouter:", swapRouter);
    console.log("wrappedNative:", wrappedNative);

    // 检查用户是否已有 vault，若有直接 attach，否则 create
    let vaultAddress = await factory.getVault(user.address);
    if (vaultAddress === ZeroAddress) {
      await factory.connect(user).createVault(wrappedNative, swapRouter);
      vaultAddress = await factory.getVault(user.address);
    }
    vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
    console.log("用户金库地址:", vaultAddress);

    console.log("测试设置完成");
  });

  it("Should create a vault for user", async function () {
    console.log("创建金库测试开始...");
    
    // 获取金库地址
    const vaultAddress = await factory.getVault(user.address);
    console.log("用户金库地址:", vaultAddress);
    
    // 验证金库地址不为零
    expect(vaultAddress).to.not.equal(ZeroAddress);
    
    // 验证金库实例已初始化
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
    expect(await vault.hasRole(await vault.ORACLE_ROLE(), bot.address)).to.be.true;
    
    console.log("创建金库测试通过");
  });

  it("Should prevent duplicate vault creation", async function () {
    console.log("防止重复创建金库测试开始...");
    
    // 尝试再次创建金库，应该失败
    await expect(
      factory.connect(user).createVault(swapRouter, wrappedNative)
    ).to.be.revertedWith("User already has a vault");
    
    console.log("防止重复创建金库测试通过");
  });

  it("Should deposit tokens to vault", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
    
    // 获取存入前的代币余额
    const tokenAddress = await token.getAddress();
    const initialBalance = await vault.getBalance(tokenAddress);
    console.log(`存入前金库中的代币余额: ${ethers.formatEther(initialBalance)}`);
    
    // 转账一些代币给用户
    const amount = ethers.parseEther("100");
    await token.transfer(user.address, amount);
    
    // 用户授权金库使用代币
    await token.connect(user).approve(vaultAddress, amount);
    
    // 存入代币
    await vault.connect(user).deposit(tokenAddress, amount);
    
    // 检查金库中的代币余额
    const finalBalance = await vault.getBalance(tokenAddress);
    console.log(`存入后金库中的代币余额: ${ethers.formatEther(finalBalance)}`);
    
    // 验证余额增加了指定的数量
    expect(finalBalance).to.equal(initialBalance + amount);
    
    console.log("代币存入测试通过，余额增加了:", ethers.formatEther(amount));
  });

  it("Should withdraw tokens from vault", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
    
    // 获取当前余额
    const tokenAddress = await token.getAddress();
    const initialBalance = await vault.getBalance(tokenAddress);
    const withdrawAmount = initialBalance / 2n;
    
    // 提取代币
    await vault.connect(user).withdraw(tokenAddress, withdrawAmount);
    
    // 检查金库中的代币余额
    const finalBalance = await vault.getBalance(tokenAddress);
    expect(finalBalance).to.equal(initialBalance - withdrawAmount);
    
    console.log("代币提取测试通过，剩余余额:", ethers.formatEther(finalBalance));
  });

  it("Should manage bot role correctly", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    // 检查bot是否有ORACLE_ROLE
    const ORACLE_ROLE = await vault.ORACLE_ROLE();
    const hasOracleRole = await vault.hasRole(ORACLE_ROLE, bot.address);
    expect(hasOracleRole).to.be.true;
    
    console.log("Bot角色管理测试通过");
  });

  it("Should enforce investor-only access for deposits and withdrawals", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
    const tokenAddress = await token.getAddress();
    
    // 确保admin和investor不是同一个地址
    const adminAddress = await admin.getAddress();
    const userAddress = await user.getAddress();
    console.log(`Admin地址: ${adminAddress}`);
    console.log(`Investor地址: ${userAddress}`);
    
    // 如果admin和investor是同一个地址，跳过测试
    if (adminAddress === userAddress) {
      console.log('跳过此测试，因为admin和investor是同一个地址');
      this.skip();
      return;
    }
    
    // 使用admin账户调用deposit函数，应该失败
    try {
      await vault.connect(admin).deposit(tokenAddress, ethers.parseEther("1"));
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含“Only investor”
      expect(error.message).to.include("Only investor");
    }

    // 使用admin账户调用withdraw函数，应该失败
    try {
      await vault.connect(admin).withdraw(tokenAddress, ethers.parseEther("1"));
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含“Only investor”
      expect(error.message).to.include("Only investor");
    }
    
    console.log("访问控制测试通过");
  });
});
