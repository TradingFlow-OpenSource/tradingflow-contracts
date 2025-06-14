// swap权限与真实DEX场景测试
const { expect } = require("chai");
const hre = require("hardhat");
const ethers = hre.ethers;
const { ZeroAddress } = require("ethers");
require("dotenv").config();

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE || "";
const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS || "";
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const VAULT_IMPL_ADDRESS = process.env.VAULT_IMPL_ADDRESS;
const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS;
const SWAP_ROUTER = process.env.SWAP_ROUTER;

describe("PersonalVaultUpgradeableUniV2 - Swap与权限测试", function () {
  this.timeout(600000);

  let factory, user, bot, vault, token, tokenAddress, factoryAddress, vaultImplAddress, swapRouter, wrappedNative, admin;

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

    let deployMode = !(FACTORY_ADDRESS && VAULT_IMPL_ADDRESS && TEST_TOKEN_ADDRESS);
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
      factory = await Factory.deploy(admin.address, vaultImplAddress, bot.address);
      await factory.waitForDeployment();
      factoryAddress = await factory.getAddress();
    } else {
      tokenAddress = TEST_TOKEN_ADDRESS;
      vaultImplAddress = VAULT_IMPL_ADDRESS;
      factoryAddress = FACTORY_ADDRESS;
      const Token = await ethers.getContractFactory("TestToken");
      token = Token.attach(tokenAddress);
      const Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
      const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
      factory = Factory.attach(factoryAddress);
    }
    swapRouter = SWAP_ROUTER;
    wrappedNative = WRAPPED_NATIVE;
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

  it("Should not allow non-bot to swap", async function () {
    
    // 获取ORACLE_ROLE角色ID
    const ORACLE_ROLE = await vault.ORACLE_ROLE();
    
    // 验证bot有ORACLE_ROLE权限
    expect(await vault.hasRole(ORACLE_ROLE, bot.address)).to.be.true;
    
    // 验证非bot用户无法豽用swap函数
    try {
      await vault.connect(user).swapExactInputSingle(
        NATIVE_TOKEN_ADDRESS, wrappedNative, ethers.parseEther("1"), 0
      );
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含权限错误
      expect(error.message).to.include("AccessControl");
    }
  });

  it("Should fail swap with insufficient balance", async function () {
    
    // 尝试使用超过余额的数量进行交换
    try {
      await vault.connect(bot).swapExactInputSingle(
        NATIVE_TOKEN_ADDRESS, wrappedNative, ethers.parseEther("1000"), 0
      );
      // 如果执行到这里，说明交易没有回滚，测试失败
      expect.fail("Transaction should have been reverted");
    } catch (error) {
      // 检查错误信息是否包含余额不足
      expect(error.message).to.include("Insufficient balance");
    }
  });
  
  // 真实DEX测试
  describe("Real DEX tests on Flow network", function() {
    const PUNCHSWAP_V2_FACTORY = process.env.PUNCHSWAP_V2_FACTORY || "0x29372c22459a4e373851798bFd6808e71EA34A71";
    const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS || "0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590"; // WETH
    
    let factoryContract;
    
    before(async function() {
      // 只在Flow网络上运行这些测试
      if (hre.network.name !== 'flow') {
        console.log('跳过真实DEX测试，因为不是在Flow网络上运行');
        this.skip();
        return;
      }
      
      // 获取PunchSwap V2 Factory合约
      const factoryAbi = [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)"
      ];
      factoryContract = new ethers.Contract(PUNCHSWAP_V2_FACTORY, factoryAbi, ethers.provider);
      
      // 向金库存入一些原生代币用于测试
      const depositAmount = ethers.parseEther("0.25");
      await user.sendTransaction({
        to: vault.getAddress(),
        value: depositAmount
      });
      console.log(`存入 ${ethers.formatEther(depositAmount)} FLOW 到金库`);
    });
    
    it("Should verify WFLOW-WETH trading pair exists", async function() {
      // 检查WFLOW-WETH交易对是否存在
      const pair = await factoryContract.getPair(wrappedNative, TOKEN_B_ADDRESS);
      console.log(`WFLOW-WETH 交易对地址: ${pair}`);
      expect(pair).to.not.equal(ZeroAddress);
    });
    
    it("Should swap Native -> Token (FLOW -> WETH)", async function() {
      // 检查金库中的原生代币余额
      const nativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
      console.log(`金库中的FLOW余额: ${ethers.formatEther(nativeBalance)}`);
      expect(nativeBalance).to.be.gt(0);
      
      // 检查目标代币的初始余额
      const initialTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(`交换前金库中的WETH余额: ${ethers.formatEther(initialTokenBBalance)}`);
      
      // 执行交换
      const swapAmount = ethers.parseEther("0.1");
      try {
        console.log(`尝试交换 ${ethers.formatEther(swapAmount)} FLOW -> WETH`);
        const tx = await vault.connect(bot).swapExactInputSingle(
          NATIVE_TOKEN_ADDRESS, TOKEN_B_ADDRESS, swapAmount, 0
        );
        await tx.wait();
        
        // 检查交换后的余额
        const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
        const finalTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
        
        console.log(`交换后金库中的FLOW余额: ${ethers.formatEther(finalNativeBalance)}`);
        console.log(`交换后金库中的WETH余额: ${ethers.formatEther(finalTokenBBalance)}`);
        
        // 验证交换结果
        expect(finalNativeBalance).to.be.lt(nativeBalance);
        expect(finalTokenBBalance).to.be.gt(initialTokenBBalance);
      } catch (error) {
        console.log(`FLOW -> WETH 交换失败: ${error.message}`);
        // 如果是resolveName错误，跳过测试
        if (error.message.includes('resolveName')) {
          console.log('跳过此测试，因为resolveName方法未实现');
          this.skip();
        } else {
          throw error;
        }
      }
    });
    
    it("Should swap Token -> Native (WETH -> FLOW)", async function() {
      // 检查金库中的WETH余额
      const tokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(`金库中的WETH余额: ${ethers.formatEther(tokenBalance)}`);
      expect(tokenBalance).to.be.gt(0);
      
      // 检查原生代币的初始余额
      const initialNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
      console.log(`交换前金库中的FLOW余额: ${ethers.formatEther(initialNativeBalance)}`);
      
      // 如果没有WETH余额，先获取一些
      if (tokenBalance == 0) {
        console.log('金库中没有WETH余额，跳过此测试');
        this.skip();
        return;
      }
      
      // 执行交换，使用一半的WETH余额
      const swapAmount = tokenBalance / 2n;
      try {
        console.log(`尝试交换 ${ethers.formatEther(swapAmount)} WETH -> FLOW`);
        const tx = await vault.connect(bot).swapExactInputSingle(
          TOKEN_B_ADDRESS, NATIVE_TOKEN_ADDRESS, swapAmount, 0
        );
        await tx.wait();
        
        // 检查交换后的余额
        const finalTokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
        const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
        
        console.log(`交换后金库中的WETH余额: ${ethers.formatEther(finalTokenBalance)}`);
        console.log(`交换后金库中的FLOW余额: ${ethers.formatEther(finalNativeBalance)}`);
        
        // 验证交换结果
        expect(finalTokenBalance).to.be.lt(tokenBalance);
        expect(finalNativeBalance).to.be.gt(initialNativeBalance);
      } catch (error) {
        console.log(`WETH -> FLOW 交换失败: ${error.message}`);
        // 如果是resolveName错误，跳过测试
        if (error.message.includes('resolveName')) {
          console.log('跳过此测试，因为resolveName方法未实现');
          this.skip();
        } else {
          throw error;
        }
      }
    });
    
    it("Should swap Token -> Token (WETH -> TestToken)", async function() {
      // 检查金库中的WETH余额
      const tokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(`金库中的WETH余额: ${ethers.formatEther(tokenBBalance)}`);
      
      // 如果没有WETH余额，跳过测试
      if (tokenBBalance == 0) {
        console.log('金库中没有WETH余额，跳过此测试');
        this.skip();
        return;
      }
      
      // 检查测试代币的初始余额
      const initialTestTokenBalance = await vault.getBalance(tokenAddress);
      console.log(`交换前金库中的TestToken余额: ${ethers.formatEther(initialTestTokenBalance)}`);
      
      // 尝试交换，使用一小部分WETH
      try {
        const swapAmount = tokenBBalance / 10n;
        console.log(`尝试交换 ${ethers.formatEther(swapAmount)} WETH -> TestToken`);
        const tx = await vault.connect(bot).swapExactInputSingle(
          TOKEN_B_ADDRESS, tokenAddress, swapAmount, 0
        );
        await tx.wait();
        
        // 检查交换后的余额
        const finalTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
        const finalTestTokenBalance = await vault.getBalance(tokenAddress);
        
        console.log(`交换后金库中的WETH余额: ${ethers.formatEther(finalTokenBBalance)}`);
        console.log(`交换后金库中的TestToken余额: ${ethers.formatEther(finalTestTokenBalance)}`);
        
        // 验证交换结果
        expect(finalTokenBBalance).to.be.lt(tokenBBalance);
        expect(finalTestTokenBalance).to.be.gt(initialTestTokenBalance);
      } catch (error) {
        console.log(`WETH -> TestToken 交换失败: ${error.message}`);
        // 如果是resolveName错误或交易对不存在，跳过测试
        if (error.message.includes('resolveName') || error.message.includes('liquidity')) {
          console.log('跳过此测试，因为resolveName方法未实现或流动性池不存在');
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  // 真实swap场景可根据环境变量和链上流动性补充
});
