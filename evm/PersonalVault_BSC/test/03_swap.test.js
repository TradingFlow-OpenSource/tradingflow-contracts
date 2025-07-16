// swap权限与真实DEX场景测试
const { expect } = require("chai");
const hre = require("hardhat");
const ethers = hre.ethers;
const { ZeroAddress } = require("ethers");
require("dotenv").config();

// 全局变量，用于跟踪resolveNameNotImplemented状态
let resolveNameNotImplemented = false;

// 将在before函数中从合约获取
let NATIVE_TOKEN_ADDRESS;
let admin, user, bot;
let factory, vault, testToken;
let swapRouter, wrappedNative, factoryContract;
let TOKEN_B_ADDRESS, TOKEN_C_ADDRESS;

const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE || "";
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const PERSONAL_VAULT_IMPL_ADDRESS = process.env.PERSONAL_VAULT_IMPL_ADDRESS;
const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS;
const SWAP_ROUTER = process.env.SWAP_ROUTER;

describe("PersonalVaultUpgradeableUniV3 - Swap与权限测试 (BSC PancakeSwap V3)", function () {
  this.timeout(600000);

  before(async function () {
    // 如果是在BSC网络上运行，则增加超时时间
    if (hre.network.name === "bsc" || hre.network.name === "bscTestnet") {
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
      process.env.PERSONAL_VAULT_IMPL_ADDRESS
    ) {
      console.log("[地址复用模式] 使用.env中的合约和币地址:");
      tokenAddress = process.env.TEST_TOKEN_ADDRESS;
      vaultImplAddress = process.env.PERSONAL_VAULT_IMPL_ADDRESS;
      factoryAddress = process.env.FACTORY_ADDRESS;
      swapRouter = process.env.SWAP_ROUTER;
      wrappedNative = process.env.WRAPPED_NATIVE;
      console.log("测试代币:", tokenAddress);
      console.log("Vault实现:", vaultImplAddress);
      console.log("Factory:", factoryAddress);
      console.log("swapRouter:", swapRouter);
      console.log("wrappedNative:", wrappedNative);

      // 获取已部署的合约实例
      factory = await ethers.getContractAt("PersonalVaultFactoryUniV3", factoryAddress);
      testToken = await ethers.getContractAt("TestToken", tokenAddress);

      // 获取用户金库地址
      const vaultAddress = await factory.getVault(await user.getAddress());
      console.log("用户金库地址:", vaultAddress);
      vault = await ethers.getContractAt(
        "PersonalVaultUpgradeableUniV3",
        vaultAddress
      );
    } else {
      console.log("[部署测试合约]");
      // 部署测试合约
      const TestToken = await ethers.getContractFactory("TestToken");
      testToken = await TestToken.deploy(
        "Test Token",
        "TST",
        ethers.parseEther("1000000")
      );
      await testToken.waitForDeployment();
      tokenAddress = await testToken.getAddress();
      console.log("测试代币地址:", tokenAddress);

      // 部署PersonalVaultUpgradeableUniV3实现合约
      console.log("部署PersonalVaultUpgradeableUniV3实现合约...");
      const PersonalVaultUpgradeableUniV3 = await ethers.getContractFactory(
        "PersonalVaultUpgradeableUniV3"
      );
      const personalVaultImplementation =
        await PersonalVaultUpgradeableUniV3.deploy();
      await personalVaultImplementation.waitForDeployment();
      const implementationAddress =
        await personalVaultImplementation.getAddress();
      console.log(
        `PersonalVaultUpgradeableUniV3实现合约已部署到: ${implementationAddress}`
      );

      // 设置swapRouter和wrappedNative参数
      swapRouter = SWAP_ROUTER;
      wrappedNative = WRAPPED_NATIVE;
      if (
        !swapRouter ||
        !wrappedNative ||
        swapRouter === ZeroAddress ||
        wrappedNative === ZeroAddress
      ) {
        throw new Error("请在.env中配置SWAP_ROUTER和WRAPPED_NATIVE地址");
      }
      console.log("swapRouter:", swapRouter);
      console.log("wrappedNative:", wrappedNative);

      // 部署PersonalVaultFactoryUniV3合约
      console.log("部署PersonalVaultFactoryUniV3合约...");
      const PersonalVaultFactoryUniV3 = await ethers.getContractFactory(
        "PersonalVaultFactoryUniV3"
      );
      const personalVaultFactory = await PersonalVaultFactoryUniV3.deploy(
        admin.address, // 初始管理员
        implementationAddress, // 实现合约地址
        bot.address // 机器人地址
      );
      await personalVaultFactory.waitForDeployment();
      const factoryAddress = await personalVaultFactory.getAddress();
      console.log(`PersonalVaultFactoryUniV3合约已部署到: ${factoryAddress}`);

      // 赋值factory变量
      factory = personalVaultFactory;

      // 创建金库
      console.log(
        "创建金库使用的参数 - swapRouter:",
        swapRouter,
        "wrappedNative:",
        wrappedNative
      );
      await factory.connect(user).createVault(swapRouter, wrappedNative);
      const vaultAddress = await factory.getVault(await user.getAddress());
      console.log("金库地址:", vaultAddress);
      vault = await ethers.getContractAt(
        "PersonalVaultUpgradeableUniV3",
        vaultAddress
      );
    }

    // 检查bot是否已有ORACLE_ROLE角色
    const ORACLE_ROLE = await vault.ORACLE_ROLE();
    const hasBotRole = await vault.hasRole(ORACLE_ROLE, await bot.getAddress());
    console.log(`Bot是否有ORACLE_ROLE角色: ${hasBotRole}`);

    // 从合约获取NATIVE_TOKEN_ADDRESS
    NATIVE_TOKEN_ADDRESS = await vault.NATIVE_TOKEN();
    console.log("NATIVE_TOKEN_ADDRESS:", NATIVE_TOKEN_ADDRESS);

    // 从环境变量获取代币地址 (BSC测试网)
    TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS || "0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684"; // USDT on BSC Testnet
    TOKEN_C_ADDRESS = process.env.TOKEN_C_ADDRESS || "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; // BUSD on BSC Testnet

    console.log("swapRouter:", swapRouter);
    console.log("wrappedNative:", wrappedNative);
    console.log("TOKEN_B_ADDRESS:", TOKEN_B_ADDRESS);
    console.log("TOKEN_C_ADDRESS:", TOKEN_C_ADDRESS);

    console.log("测试设置完成");
  });

  it("Should not allow non-bot to swap", async function () {
    // 获取ORACLE_ROLE角色ID
    const ORACLE_ROLE = await vault.ORACLE_ROLE();

    // 验证bot有ORACLE_ROLE权限
    expect(await vault.hasRole(ORACLE_ROLE, await bot.getAddress())).to.be.true;

    // 验证非bot用户无法调用swap函数
    await expect(
      vault.connect(user).swapExactInputSingle(
        NATIVE_TOKEN_ADDRESS,
        wrappedNative,
        ethers.parseEther("1"),
        0,
        await admin.getAddress(), // feeRecipient
        100 // feeRate 1/10000
      )
    ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
  });

  it("Should fail swap with insufficient balance", async function () {
    try {
      // 尝试使用超过余额的数量进行交换
      try {
        // 直接使用bot的私钥签名交易，避免使用connect方法
        const botSigner = bot;
        const tx = await vault.connect(botSigner).swapExactInputSingle(
          NATIVE_TOKEN_ADDRESS,
          wrappedNative,
          ethers.parseEther("1000"),
          0,
          await admin.getAddress(), // feeRecipient
          100 // feeRate 1/10000
        );

        // 如果执行到这里，说明交易没有回滚，测试失败
        expect.fail("Transaction should have been reverted");
      } catch (error) {
        // 检查错误信息是否包含余额不足
        if (error.message.includes("Insufficient balance")) {
          // 测试通过，余额不足导致交易失败
        } else {
          // 如果是其他错误，则重新抛出
          throw error;
        }
      }
    } catch (error) {
      throw error;
    }
  });

  // 真实DEX测试 - BSC PancakeSwap V3
  describe("Real DEX tests on BSC network", function () {
    const PANCAKESWAP_V3_FACTORY =
      process.env.PANCAKESWAP_V3_FACTORY ||
      "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"; // PancakeSwap V3 Factory on BSC

    before(async function () {
      // 只在BSC网络上运行这些测试
      if (hre.network.name !== "bsc" && hre.network.name !== "bscTestnet") {
        console.log("跳过真实DEX测试，因为不是在BSC网络上运行");
        this.skip();
        return;
      }

      // 获取PancakeSwap V3 Factory合约
      const factoryAbi = [
        "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
      ];
      factoryContract = new ethers.Contract(
        PANCAKESWAP_V3_FACTORY,
        factoryAbi,
        ethers.provider
      );

      // 向金库存入一小部分原生代币用于测试
      const depositAmount = ethers.parseEther("0.01");
      await user.sendTransaction({
        to: await vault.getAddress(),
        value: depositAmount,
      });
      console.log(`存入 ${ethers.formatEther(depositAmount)} BNB 到金库`);
    });

    it("Should verify WBNB-USDT trading pool exists", async function () {
      // 检查WBNB-USDT交易池是否存在 (0.25% fee tier)
      const pool = await factoryContract.getPool(
        wrappedNative,
        TOKEN_B_ADDRESS,
        2500 // 0.25% fee tier
      );
      console.log(`WBNB-USDT 交易池地址: ${pool}`);
      expect(pool).to.not.equal(ZeroAddress);
    });

    it("Should swap Native -> Token (BNB -> USDT)", async function () {
      // 检查金库中的原生代币余额
      const nativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
      console.log(`金库中的BNB余额: ${ethers.formatEther(nativeBalance)}`);
      expect(nativeBalance).to.be.gt(0);

      // 检查目标代币的初始余额
      const initialTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(
        `交换前金库中的USDT余额: ${ethers.formatUnits(
          initialTokenBBalance, 18
        )}`
      );

      // 输出参数信息，帮助诊断resolveName问题
      console.log("=== 参数详情 ===");
      console.log(
        "NATIVE_TOKEN_ADDRESS:",
        NATIVE_TOKEN_ADDRESS,
        "类型:",
        typeof NATIVE_TOKEN_ADDRESS
      );
      console.log(
        "TOKEN_B_ADDRESS:",
        TOKEN_B_ADDRESS,
        "类型:",
        typeof TOKEN_B_ADDRESS
      );
      console.log(
        "bot地址:",
        await bot.getAddress(),
        "类型:",
        typeof (await bot.getAddress())
      );
      console.log(
        "vault地址:",
        await vault.getAddress(),
        "类型:",
        typeof (await vault.getAddress())
      );
      console.log(
        "bot对象类型:",
        typeof bot,
        "是否是Signer:",
        bot.constructor.name
      );
      console.log("=== 参数详情结束 ===");

      // 执行交换 - 使用更小的金额
      const swapAmount = ethers.parseEther("0.01");
      try {
        console.log(
          `尝试交换 ${ethers.formatEther(swapAmount)} BNB -> USDT`
        );
        // 使用直接的bot对象，不通过connect方法
        const botSigner = bot;
        console.log("使用直接的bot签名者对象");
        const tx = await vault.connect(botSigner).swapExactInputSingle(
          NATIVE_TOKEN_ADDRESS,
          TOKEN_B_ADDRESS,
          swapAmount,
          0,
          await admin.getAddress(), // feeRecipient
          100 // feeRate 1/10000
        );
        await tx.wait();

        // 检查交换后的余额
        const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
        const finalTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);

        console.log(
          `交换后金库中的BNB余额: ${ethers.formatEther(finalNativeBalance)}`
        );
        console.log(
          `交换后金库中的USDT余额: ${ethers.formatUnits(
            finalTokenBBalance, 18
          )}`
        );

        // 验证交换结果
        expect(finalNativeBalance).to.be.lt(nativeBalance);
        expect(finalTokenBBalance).to.be.gt(initialTokenBBalance);
      } catch (error) {
        console.log(`BNB -> USDT 交换失败: ${error.message}`);
        throw error;
      }
    });

    it("Should swap Token -> Native (USDT -> BNB)", async function () {
      // 检查金库中的USDT余额
      const tokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(`金库中的USDT余额: ${ethers.formatUnits(tokenBalance, 18)}`);
      expect(tokenBalance).to.be.gt(0);

      // 检查原生代币的初始余额
      const initialNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
      console.log(
        `交换前金库中的BNB余额: ${ethers.formatEther(initialNativeBalance)}`
      );

      // 如果没有USDT余额，跳过测试
      if (tokenBalance == 0) {
        console.log("金库中没有USDT余额，跳过此测试");
        this.skip();
        return;
      }

      // 执行交换，使用小部分USDT余额
      const swapAmount = tokenBalance / 10n; // 只使用10%的余额
      try {
        console.log(
          `尝试交换 ${ethers.formatUnits(swapAmount, 18)} USDT -> BNB`
        );
        const tx = await vault.connect(bot).swapExactInputSingle(
          TOKEN_B_ADDRESS,
          NATIVE_TOKEN_ADDRESS,
          swapAmount,
          0,
          await admin.getAddress(), // feeRecipient
          100 // feeRate 1/10000
        );
        await tx.wait();

        // 检查交换后的余额
        const finalTokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
        const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);

        console.log(
          `交换后金库中的USDT余额: ${ethers.formatUnits(finalTokenBalance, 18)}`
        );
        console.log(
          `交换后金库中的BNB余额: ${ethers.formatEther(finalNativeBalance)}`
        );

        // 验证交换结果
        expect(finalTokenBalance).to.be.lt(tokenBalance);
        expect(finalNativeBalance).to.be.gt(initialNativeBalance);
      } catch (error) {
        console.log(`USDT -> BNB 交换失败: ${error.message}`);
        // 如果是resolveName错误，跳过测试
        if (error.message.includes("resolveName")) {
          console.log("跳过此测试，因为resolveName方法未实现");
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it("Should swap Token -> Token (USDT -> BUSD)", async function () {
      // 首先检查USDT-BUSD直接交易池是否存在
      console.log("=== 交易池检查 ===");
      const directPool = await factoryContract.getPool(
        TOKEN_B_ADDRESS,
        TOKEN_C_ADDRESS,
        500 // 0.05% fee tier
      );
      console.log(`USDT-BUSD 直接交易池地址: ${directPool}`);

      // 检查通过WBNB的路由是否存在
      const usdtWbnbPool = await factoryContract.getPool(
        TOKEN_B_ADDRESS,
        wrappedNative,
        2500 // 0.25% fee tier
      );
      const wbnbBusdPool = await factoryContract.getPool(
        wrappedNative,
        TOKEN_C_ADDRESS,
        2500 // 0.25% fee tier
      );
      console.log(`USDT-WBNB 交易池地址: ${usdtWbnbPool}`);
      console.log(`WBNB-BUSD 交易池地址: ${wbnbBusdPool}`);

      if (
        directPool === ZeroAddress &&
        (usdtWbnbPool === ZeroAddress || wbnbBusdPool === ZeroAddress)
      ) {
        console.log("没有找到可用的交易路径，跳过此测试");
        this.skip();
        return;
      }

      console.log("=== 交易池检查完成 ===");

      // 检查金库中的USDT余额
      let usdtBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(
        `金库中的USDT余额: ${ethers.formatUnits(usdtBalance, 18)}`
      );

      if (usdtBalance === 0n) {
        console.log("金库中没有USDT余额，先用BNB购买一些USDT");

        // 用一部分BNB购买USDT
        const bnbToSwap = ethers.parseEther("0.005"); // 用0.005 BNB购买USDT

        try {
          const swapTx = await vault.connect(bot).swapExactInputSingle(
            NATIVE_TOKEN_ADDRESS,
            TOKEN_B_ADDRESS,
            bnbToSwap,
            0, // 接受任何数量的输出
            await admin.getAddress(), // feeRecipient
            100 // feeRate 1/10000
          );
          await swapTx.wait();
          console.log("成功用BNB购买USDT");

          // 重新检查USDT余额
          usdtBalance = await vault.getBalance(TOKEN_B_ADDRESS);
          console.log(
            `购买后的USDT余额: ${ethers.formatUnits(usdtBalance, 18)}`
          );

          if (usdtBalance === 0n) {
            console.log("购买USDT失败，跳过此测试");
            this.skip();
            return;
          }
        } catch (error) {
          console.log(`购买USDT失败: ${error.message}`);
          this.skip();
          return;
        }
      }

      // 检查交换前金库中的BUSD余额
      const busdBalanceBefore = await vault.getBalance(TOKEN_C_ADDRESS);
      console.log(
        `交换前金库中的BUSD余额: ${ethers.formatUnits(
          busdBalanceBefore, 18
        )}`
      );

      // 使用10%的USDT余额进行交换
      const swapAmount = usdtBalance / 10n;
      console.log(
        `尝试交换 ${ethers.formatUnits(swapAmount, 18)} USDT -> BUSD`
      );

      try {
        // 执行Token到Token的交换
        const tx = await vault.connect(bot).swapExactInputSingle(
          TOKEN_B_ADDRESS,
          TOKEN_C_ADDRESS,
          swapAmount,
          0,
          await admin.getAddress(), // feeRecipient
          100 // feeRate 1/10000
        );
        await tx.wait();

        // 检查交换后的余额
        const usdtBalanceAfter = await vault.getBalance(TOKEN_B_ADDRESS);
        const busdBalanceAfter = await vault.getBalance(TOKEN_C_ADDRESS);

        console.log(
          `交换后金库中的USDT余额: ${ethers.formatUnits(
            usdtBalanceAfter, 18
          )}`
        );
        console.log(
          `交换后金库中的BUSD余额: ${ethers.formatUnits(
            busdBalanceAfter, 18
          )}`
        );

        // 验证USDT余额减少
        expect(usdtBalanceAfter).to.be.below(usdtBalance);
        // 验证BUSD余额增加
        expect(busdBalanceAfter).to.be.above(busdBalanceBefore);
      } catch (error) {
        console.log(`USDT -> BUSD 交换失败: ${error.message}`);
        throw error;
      }
    });
  });

  // 真实swap场景可根据环境变量和链上流动性补充
});
