// 原生代币存取与权限测试
const { expect } = require("chai");
const hre = require("hardhat");
const ethers = hre.ethers;
require("dotenv").config();

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
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
    // 获取签名者
    const signers = await ethers.getSigners();
    if (signers.length < 3) {
      admin = signers[0];
      user = signers[0];
      bot = signers[0];
    } else {
      admin = signers[0];
      user = signers[1];
      bot = signers[2];
    }

    let deployMode = !(process.env.FACTORY_ADDRESS && process.env.VAULT_IMPL_ADDRESS && process.env.TEST_TOKEN_ADDRESS);
    if (deployMode) {
      // 自动部署
      const Token = await ethers.getContractFactory("TestToken");
      token = await Token.deploy("Test Token", "TST", 18);
      await token.waitForDeployment();
      tokenAddress = await token.getAddress();
      const Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      const vaultImpl = await Vault.deploy();
      await vaultImpl.waitForDeployment();
      vaultImplAddress = await vaultImpl.getAddress();
      const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
      factory = await Factory.deploy(admin.address, vaultImplAddress, admin.address);
      await factory.waitForDeployment();
      factoryAddress = await factory.getAddress();
    } else {
      tokenAddress = process.env.TEST_TOKEN_ADDRESS;
      vaultImplAddress = process.env.VAULT_IMPL_ADDRESS;
      factoryAddress = process.env.FACTORY_ADDRESS;
      const Token = await ethers.getContractFactory("TestToken");
      token = Token.attach(tokenAddress);
      const Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
      factory = Factory.attach(factoryAddress);
    }
    swapRouter = process.env.SWAP_ROUTER;
    wrappedNative = process.env.WRAPPED_NATIVE;
    if (!swapRouter || !wrappedNative || swapRouter === ZeroAddress || wrappedNative === ZeroAddress) {
      throw new Error("请在.env中配置SWAP_ROUTER和WRAPPED_NATIVE地址");
    }
    let vaultAddress = await factory.getVault(user.address);
    if (vaultAddress === ZeroAddress) {
      await factory.connect(user).createVault(wrappedNative, swapRouter);
      vaultAddress = await factory.getVault(user.address);
    }
    vault = await ethers.getContractAt("PersonalVaultUpgradeableUniV2", vaultAddress);
  });

  it("Should deposit native tokens to vault", async function () {
    const depositAmount = ethers.parseEther("0.1");
    await vault.connect(user).depositNative({ value: depositAmount });
    const balance = await vault.getBalance(NATIVE_TOKEN);
    expect(balance).to.equal(depositAmount);
  });

  it("Should withdraw native tokens from vault", async function () {
    const withdrawAmount = ethers.parseEther("0.05");
    await vault.connect(user).withdrawNative(withdrawAmount);
    const balance = await vault.getBalance(NATIVE_TOKEN);
    expect(balance).to.equal(ethers.parseEther("0.05"));
  });

  it("Should enforce investor-only access for native token operations", async function () {
    // 获取所有可用的签名者
    const signers = await ethers.getSigners();
    
    // 获取当前investor地址
    const investorAddress = await user.getAddress();
    console.log(`当前investor地址: ${investorAddress}`);
    
    // 找到一个非investor的签名者
    let nonInvestorSigner = null;
    for (const signer of signers) {
      const signerAddress = await signer.getAddress();
      if (signerAddress !== investorAddress) {
        nonInvestorSigner = signer;
        console.log(`找到非investor签名者: ${signerAddress}`);
        break;
      }
    }
    
    // 如果没有找到非investor签名者，跳过测试
    if (!nonInvestorSigner) {
      console.log('无法找到非investor签名者，跳过测试');
      this.skip();
      return;
    }
    
    // 测试非investor用户无法存入原生代币
    try {
      await vault.connect(nonInvestorSigner).depositNative({ value: ethers.parseEther("0.1") });
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含"Only investor"
      expect(error.message).to.include("Only investor");
    }
    
    // 测试非investor用户无法提取原生代币
    try {
      await vault.connect(nonInvestorSigner).withdrawNative(ethers.parseEther("0.1"));
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含"Only investor"
      expect(error.message).to.include("Only investor");
    }
  });
});
