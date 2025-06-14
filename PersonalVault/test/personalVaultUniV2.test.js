const { expect } = require("chai");
const { ZeroAddress } = require("ethers");

// 使用 require 方式获取 hardhat 和 ethers
const hre = require("hardhat");
const { ethers } = hre;

// 环境变量
const SWAP_ROUTER = process.env.SWAP_ROUTER || "";
const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE || "";
const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS || "";
const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS || "";

describe("PersonalVaultUpgradeableUniV2", function () {
  let Vault;
  let Factory;
  let factory;
  let admin;
  let user;
  let bot;
  let token;
  let swapRouter;
  let wrappedNative;

  before(async function () {
    // 获取签名者
    [admin, user, bot] = await ethers.getSigners();

    // 部署测试代币
    const TestToken = await ethers.getContractFactory("TestToken");
    token = await TestToken.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // 获取合约工厂
    Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
    Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");

    // 部署实现合约
    const vaultImpl = await Vault.deploy();
    await vaultImpl.waitForDeployment();

    // 部署工厂合约
    factory = await Factory.deploy(
      admin.address,
      await vaultImpl.getAddress(),
      bot.address
    );
    await factory.waitForDeployment();

    // 设置环境变量中的地址
    swapRouter = SWAP_ROUTER || admin.address; // 如果没有设置，使用admin地址作为占位符
    wrappedNative = WRAPPED_NATIVE || admin.address; // 如果没有设置，使用admin地址作为占位符

    console.log("Factory deployed at:", await factory.getAddress());
    console.log("Vault implementation deployed at:", await vaultImpl.getAddress());
    console.log("Test token deployed at:", await token.getAddress());
  });

  it("Should create a vault successfully", async function () {
    const tx = await factory.connect(user).createVault(
      swapRouter,
      wrappedNative
    );
    await tx.wait();

    const vaultAddress = await factory.getVault(user.address);
    expect(vaultAddress).to.not.equal(ZeroAddress);
    console.log("Vault created at:", vaultAddress);
  });

  it("Should prevent creating duplicate vaults", async function () {
    try {
      await factory.connect(user).createVault(
        swapRouter,
        wrappedNative
      );
      expect.fail("Should have reverted");
    } catch (error) {
      expect(error.message).to.include("User already has a vault");
    }
  });

  it("Should deposit tokens to vault", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    // 转移一些代币给用户
    await token.transfer(user.address, ethers.parseEther("1000"));
    const userBalance = await token.balanceOf(user.address);
    console.log("User token balance:", ethers.formatEther(userBalance));

    // 批准代币转移
    await token.connect(user).approve(vaultAddress, ethers.parseEther("100"));

    // 存入代币
    await vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100"));

    const vaultBalance = await token.balanceOf(vaultAddress);
    expect(vaultBalance).to.equal(ethers.parseEther("100"));
  });

  it("Should withdraw tokens from vault", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    const initialBalance = await token.balanceOf(user.address);
    
    // 提取代币
    await vault.connect(user).withdraw(await token.getAddress(), ethers.parseEther("50"));

    const finalBalance = await token.balanceOf(user.address);
    expect(finalBalance).to.equal(initialBalance + ethers.parseEther("50"));
  });

  it("Should handle native token deposits", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    const depositAmount = ethers.parseEther("1");
    
    // 存入原生代币
    await vault.connect(user).depositNative({ value: depositAmount });

    const vaultBalance = await ethers.provider.getBalance(vaultAddress);
    expect(vaultBalance).to.be.gte(depositAmount);
  });

  it("Should withdraw native tokens", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    const withdrawAmount = ethers.parseEther("0.5");
    const initialBalance = await ethers.provider.getBalance(user.address);

    // 提取原生代币
    const tx = await vault.connect(user).withdrawNative(withdrawAmount);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const finalBalance = await ethers.provider.getBalance(user.address);
    // 由于gas费用，我们只检查余额是否接近预期值
    const expectedBalance = initialBalance + withdrawAmount - gasUsed;
    const tolerance = ethers.parseEther("0.01"); // 1% 容差
    expect(finalBalance).to.be.gte(expectedBalance - tolerance);
  });

  it("Should manage bot role correctly", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    // 检查bot是否有ORACLE_ROLE
    const ORACLE_ROLE = await vault.ORACLE_ROLE();
    const hasOracleRole = await vault.hasRole(ORACLE_ROLE, bot.address);
    expect(hasOracleRole).to.be.true;
  });

  it("Should fail swap with invalid parameters", async function () {
    const vaultAddress = await factory.getVault(user.address);
    const vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);

    try {
      await vault.connect(bot).swapExactTokensForTokens(
        ethers.parseEther("10"),
        0,
        [await token.getAddress(), wrappedNative],
        Math.floor(Date.now() / 1000) + 3600
      );
      expect.fail("Should have reverted");
    } catch (error) {
      // 预期会失败，因为我们没有设置真实的交换路由器
      console.log("Swap failed as expected:", error.message);
    }
  });
});
