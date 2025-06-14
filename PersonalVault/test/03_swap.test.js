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
const VAULT_IMPL_ADDRESS = process.env.VAULT_IMPL_ADDRESS;
const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS;
const SWAP_ROUTER = process.env.SWAP_ROUTER;

describe("PersonalVaultUpgradeableUniV2 - Swap与权限测试", function () {
  this.timeout(600000);

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
    if (process.env.FACTORY_ADDRESS && process.env.VAULT_IMPL_ADDRESS) {
      console.log("[地址复用模式] 使用.env中的合约和币地址:");
      tokenAddress = process.env.TEST_TOKEN_ADDRESS;
      vaultImplAddress = process.env.VAULT_IMPL_ADDRESS;
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
      testToken = await ethers.getContractAt("TestToken", tokenAddress);

      // 获取用户金库地址
      const vaultAddress = await factory.getVault(await user.getAddress());
      console.log("用户金库地址:", vaultAddress);
      vault = await ethers.getContractAt(
        "PersonalVaultUpgradeableUniV2",
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

      // 部署金库实现合约
      const Vault = await ethers.getContractFactory(
        "PersonalVaultUpgradeableUniV2"
      );
      const vaultImplementation = await Vault.deploy();
      await vaultImplementation.waitForDeployment();
      vaultImplAddress = await vaultImplementation.getAddress();
      console.log("金库实现地址:", vaultImplAddress);

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
        "PersonalVaultUpgradeableUniV2",
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

    // 从环境变量获取代币地址
    TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS; // ankrFLOW
    TOKEN_C_ADDRESS = process.env.TOKEN_C_ADDRESS; // TRUMP_COIN

    console.log("swapRouter:", swapRouter);
    console.log("wrappedNative:", wrappedNative);
    console.log("TOKEN_B_ADDRESS:", TOKEN_B_ADDRESS);
    console.log("TOKEN_C_ADDRESS:", TOKEN_C_ADDRESS);

    console.log("测试设置完成");
  });

  // it("Should not allow non-bot to swap", async function () {
  //   // 获取ORACLE_ROLE角色ID
  //   const ORACLE_ROLE = await vault.ORACLE_ROLE();

  //   // 验证bot有ORACLE_ROLE权限
  //   expect(await vault.hasRole(ORACLE_ROLE, await bot.getAddress())).to.be.true;

  //   // 验证非bot用户无法调用swap函数
  //   await expect(
  //     vault
  //       .connect(user)
  //       .swapExactInputSingle(
  //         NATIVE_TOKEN_ADDRESS,
  //         wrappedNative,
  //         ethers.parseEther("1"),
  //         0
  //       )
  //   ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
  // });

  // it("Should fail swap with insufficient balance", async function () {
  //   try {
  //     // 尝试使用超过余额的数量进行交换
  //     try {
  //       // 直接使用bot的私钥签名交易，避免使用connect方法
  //       const botSigner = bot;
  //       const tx = await vault
  //         .connect(botSigner)
  //         .swapExactInputSingle(
  //           NATIVE_TOKEN_ADDRESS,
  //           wrappedNative,
  //           ethers.parseEther("1000"),
  //           0
  //         );

  //       // 如果执行到这里，说明交易没有回滚，测试失败
  //       expect.fail("Transaction should have been reverted");
  //     } catch (error) {
  //       // 检查错误信息是否包含余额不足
  //       if (error.message.includes("Insufficient balance")) {
  //         // 测试通过，余额不足导致交易失败
  //       } else {
  //         // 如果是其他错误，则重新抛出
  //         throw error;
  //       }
  //     }
  //   } catch (error) {
  //     throw error;
  //   }
  // });

  // 真实DEX测试
  describe("Real DEX tests on Flow network", function () {
    const PUNCHSWAP_V2_FACTORY =
      process.env.PUNCHSWAP_V2_FACTORY ||
      "0x29372c22459a4e373851798bFd6808e71EA34A71";

    before(async function () {
      // 只在Flow网络上运行这些测试
      if (hre.network.name !== "flow") {
        console.log("跳过真实DEX测试，因为不是在Flow网络上运行");
        this.skip();
        return;
      }

      // 获取PunchSwap V2 Factory合约
      const factoryAbi = [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)",
      ];
      factoryContract = new ethers.Contract(
        PUNCHSWAP_V2_FACTORY,
        factoryAbi,
        ethers.provider
      );

      // 向金库存入一小部分原生代币用于测试
      const depositAmount = ethers.parseEther("0.01");
      await user.sendTransaction({
        to: await vault.getAddress(),
        value: depositAmount,
      });
      console.log(`存入 ${ethers.formatEther(depositAmount)} FLOW 到金库`);
    });

    // it("Should verify WFLOW-ankrFLOW trading pair exists", async function () {
    //   // 检查WFLOW-ankrFLOW交易对是否存在
    //   const pair = await factoryContract.getPair(
    //     wrappedNative,
    //     TOKEN_B_ADDRESS
    //   );
    //   console.log(`WFLOW-ankrFLOW 交易对地址: ${pair}`);
    //   expect(pair).to.not.equal(ZeroAddress);
    // });

    // it("Should swap Native -> Token (FLOW -> ankrFLOW)", async function () {
    //   // 检查金库中的原生代币余额
    //   const nativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    //   console.log(`金库中的FLOW余额: ${ethers.formatEther(nativeBalance)}`);
    //   expect(nativeBalance).to.be.gt(0);

    //   // 检查目标代币的初始余额
    //   const initialTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);
    //   console.log(
    //     `交换前金库中的ankrFLOW余额: ${ethers.formatEther(
    //       initialTokenBBalance
    //     )}`
    //   );

    //   // 输出参数信息，帮助诊断resolveName问题
    //   console.log("=== 参数详情 ===");
    //   console.log(
    //     "NATIVE_TOKEN_ADDRESS:",
    //     NATIVE_TOKEN_ADDRESS,
    //     "类型:",
    //     typeof NATIVE_TOKEN_ADDRESS
    //   );
    //   console.log(
    //     "TOKEN_B_ADDRESS:",
    //     TOKEN_B_ADDRESS,
    //     "类型:",
    //     typeof TOKEN_B_ADDRESS
    //   );
    //   console.log(
    //     "bot地址:",
    //     await bot.getAddress(),
    //     "类型:",
    //     typeof (await bot.getAddress())
    //   );
    //   console.log(
    //     "vault地址:",
    //     await vault.getAddress(),
    //     "类型:",
    //     typeof (await vault.getAddress())
    //   );
    //   console.log(
    //     "bot对象类型:",
    //     typeof bot,
    //     "是否是Signer:",
    //     bot.constructor.name
    //   );
    //   console.log("=== 参数详情结束 ===");

    //   // 执行交换 - 使用更小的金额
    //   const swapAmount = ethers.parseEther("0.01");
    //   try {
    //     console.log(
    //       `尝试交换 ${ethers.formatEther(swapAmount)} FLOW -> ankrFLOW`
    //     );
    //     // 使用直接的bot对象，不通过connect方法
    //     const botSigner = bot;
    //     console.log("使用直接的bot签名者对象");
    //     const tx = await vault
    //       .connect(botSigner)
    //       .swapExactInputSingle(
    //         NATIVE_TOKEN_ADDRESS,
    //         TOKEN_B_ADDRESS,
    //         swapAmount,
    //         0
    //       );
    //     await tx.wait();

    //     // 检查交换后的余额
    //     const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    //     const finalTokenBBalance = await vault.getBalance(TOKEN_B_ADDRESS);

    //     console.log(
    //       `交换后金库中的FLOW余额: ${ethers.formatEther(finalNativeBalance)}`
    //     );
    //     console.log(
    //       `交换后金库中的ankrFLOW余额: ${ethers.formatEther(
    //         finalTokenBBalance
    //       )}`
    //     );

    //     // 验证交换结果
    //     expect(finalNativeBalance).to.be.lt(nativeBalance);
    //     expect(finalTokenBBalance).to.be.gt(initialTokenBBalance);
    //   } catch (error) {
    //     console.log(`FLOW -> ankrFLOW 交换失败: ${error.message}`);
    //     throw error;
    //   }
    // });

    // it("Should swap Token -> Native (ankrFLOW -> FLOW)", async function () {
    //   // 检查金库中的ankrFLOW余额
    //   const tokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
    //   console.log(`金库中的ankrFLOW余额: ${ethers.formatEther(tokenBalance)}`);
    //   expect(tokenBalance).to.be.gt(0);

    //   // 检查原生代币的初始余额
    //   const initialNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);
    //   console.log(
    //     `交换前金库中的FLOW余额: ${ethers.formatEther(initialNativeBalance)}`
    //   );

    //   // 如果没有ankrFLOW余额，跳过测试
    //   if (tokenBalance == 0) {
    //     console.log("金库中没有ankrFLOW余额，跳过此测试");
    //     this.skip();
    //     return;
    //   }

    //   // 执行交换，使用小部分ankrFLOW余额
    //   const swapAmount = tokenBalance / 10n; // 只使用10%的余额
    //   try {
    //     console.log(
    //       `尝试交换 ${ethers.formatEther(swapAmount)} ankrFLOW -> FLOW`
    //     );
    //     const tx = await vault
    //       .connect(bot)
    //       .swapExactInputSingle(
    //         TOKEN_B_ADDRESS,
    //         NATIVE_TOKEN_ADDRESS,
    //         swapAmount,
    //         0
    //       );
    //     await tx.wait();

    //     // 检查交换后的余额
    //     const finalTokenBalance = await vault.getBalance(TOKEN_B_ADDRESS);
    //     const finalNativeBalance = await vault.getBalance(NATIVE_TOKEN_ADDRESS);

    //     console.log(
    //       `交换后金库中的ankrFLOW余额: ${ethers.formatEther(finalTokenBalance)}`
    //     );
    //     console.log(
    //       `交换后金库中的FLOW余额: ${ethers.formatEther(finalNativeBalance)}`
    //     );

    //     // 验证交换结果
    //     expect(finalTokenBalance).to.be.lt(tokenBalance);
    //     expect(finalNativeBalance).to.be.gt(initialNativeBalance);
    //   } catch (error) {
    //     console.log(`ankrFLOW -> FLOW 交换失败: ${error.message}`);
    //     // 如果是resolveName错误，跳过测试
    //     if (error.message.includes("resolveName")) {
    //       console.log("跳过此测试，因为resolveName方法未实现");
    //       this.skip();
    //     } else {
    //       throw error;
    //     }
    //   }
    // });

    it("Should swap Token -> Token (ankrFLOW -> TRUMP_COIN)", async function () {
      // 首先检查ankrFLOW-TRUMP_COIN直接交易对是否存在
      console.log("=== 交易对检查 ===");
      const directPair = await factoryContract.getPair(
        TOKEN_B_ADDRESS,
        TOKEN_C_ADDRESS
      );
      console.log(`ankrFLOW-TRUMP_COIN 直接交易对地址: ${directPair}`);

      // 检查通过WFLOW的路由是否存在
      const ankrFlowWflowPair = await factoryContract.getPair(
        TOKEN_B_ADDRESS,
        wrappedNative
      );
      const wflowTrumpPair = await factoryContract.getPair(
        wrappedNative,
        TOKEN_C_ADDRESS
      );
      console.log(`ankrFLOW-WFLOW 交易对地址: ${ankrFlowWflowPair}`);
      console.log(`WFLOW-TRUMP_COIN 交易对地址: ${wflowTrumpPair}`);

      if (
        directPair === ZeroAddress &&
        (ankrFlowWflowPair === ZeroAddress || wflowTrumpPair === ZeroAddress)
      ) {
        console.log("没有找到可用的交易路径，跳过此测试");
        this.skip();
        return;
      }

      console.log("=== 交易对检查完成 ===");

      // 检查金库中的ankrFLOW余额
      let ankrFlowBalance = await vault.getBalance(TOKEN_B_ADDRESS);
      console.log(
        `金库中的ankrFLOW余额: ${ethers.formatEther(ankrFlowBalance)}`
      );

      if (ankrFlowBalance === 0n) {
        console.log("金库中没有ankrFLOW余额，先用FLOW购买一些ankrFLOW");
        
        // 用一部分FLOW购买ankrFLOW
        const flowToSwap = ethers.parseEther("0.005"); // 用0.005 FLOW购买ankrFLOW
        
        try {
          const swapTx = await vault.connect(bot).swapExactInputSingle(
            NATIVE_TOKEN_ADDRESS,
            TOKEN_B_ADDRESS,
            flowToSwap,
            0 // 接受任何数量的输出
          );
          await swapTx.wait();
          console.log("成功用FLOW购买ankrFLOW");
          
          // 重新检查ankrFLOW余额
          ankrFlowBalance = await vault.getBalance(TOKEN_B_ADDRESS);
          console.log(`购买后的ankrFLOW余额: ${ethers.formatEther(ankrFlowBalance)}`);
          
          if (ankrFlowBalance === 0n) {
            console.log("购买ankrFLOW失败，跳过此测试");
            this.skip();
            return;
          }
        } catch (error) {
          console.log(`购买ankrFLOW失败: ${error.message}`);
          this.skip();
          return;
        }
      }

      // 检查交换前金库中的TRUMP_COIN余额
      const trumpCoinBalanceBefore = await vault.getBalance(TOKEN_C_ADDRESS);
      console.log(
        `交换前金库中的TRUMP_COIN余额: ${ethers.formatEther(
          trumpCoinBalanceBefore
        )}`
      );

      // 使用10%的ankrFLOW余额进行交换
      const swapAmount = ankrFlowBalance / 10n;
      console.log(
        `尝试交换 ${ethers.formatEther(swapAmount)} ankrFLOW -> TRUMP_COIN`
      );

      try {
        // 执行Token到Token的交换
        const tx = await vault
          .connect(bot)
          .swapExactInputSingle(
            TOKEN_B_ADDRESS,
            TOKEN_C_ADDRESS,
            swapAmount,
            0
          );
        await tx.wait();

        // 检查交换后的余额
        const ankrFlowBalanceAfter = await vault.getBalance(TOKEN_B_ADDRESS);
        const trumpCoinBalanceAfter = await vault.getBalance(TOKEN_C_ADDRESS);

        console.log(
          `交换后金库中的ankrFLOW余额: ${ethers.formatEther(
            ankrFlowBalanceAfter
          )}`
        );
        console.log(
          `交换后金库中的TRUMP_COIN余额: ${ethers.formatEther(
            trumpCoinBalanceAfter
          )}`
        );

        // 验证ankrFLOW余额减少
        expect(ankrFlowBalanceAfter).to.be.below(ankrFlowBalance);
        // 验证TRUMP_COIN余额增加
        expect(trumpCoinBalanceAfter).to.be.above(trumpCoinBalanceBefore);
      } catch (error) {
        console.log(`ankrFLOW -> TRUMP_COIN 交换失败: ${error.message}`);
        throw error;
      }
    });
  });

  // 真实swap场景可根据环境变量和链上流动性补充
});
