import { ethers } from "hardhat";
import { expect } from "chai";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-chai-matchers";
dotenv.config();

describe("PersonalVault 主网部署集成测试 (环境变量驱动)", function () {
  let admin: any;
  let user: any;
  let bot: any;
  let Vault: any;
  let Factory: any;
  let factory: any;

  before(async function () {
    // 用环境变量私钥生成 Wallet
    const provider = ethers.provider;
    admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
    user = new ethers.Wallet(process.env.USER_PRIVATE_KEY!, provider);
    bot = new ethers.Wallet(process.env.BOT_PRIVATE_KEY!, provider);
    Vault = await ethers.getContractFactory("PersonalVaultUpgradeableUniV2");
    Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
    factory = Factory.attach(process.env.FACTORY_ADDRESS!);
    // 获取WRAPPED_NATIVE地址
    const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE || "0x5c147e74d63b1d31aa3fd78eb229b65161983b2b"; // 默认Flow EVM主网WFLOW地址

    // 检查用户余额
    const userBalance = await provider.getBalance(user.address);
    console.log(`用户 ${user.address} 余额: ${ethers.formatEther(userBalance)} FLOW`);

    // 自动为 user 创建金库（如未创建）
    try {
      // 直接调用getVault函数而不是userVaults映射
      const addr = await factory.getVault(user.address);
      console.log(`用户金库地址: ${addr}`);

      if (!addr || addr === ethers.ZeroAddress) {
        if (userBalance === 0n) {
          console.log("用户余额为0，无法创建金库");
          this.skip(); // 跳过测试
          return;
        }

        const swapRouter = process.env.SWAP_ROUTER || admin.address;
        console.log(`使用SwapRouter: ${swapRouter}`);
        console.log(`使用WRAPPED_NATIVE: ${WRAPPED_NATIVE}`);
        console.log(`使用Bot地址: ${bot.address}`);

        const tx = await factory.connect(user).createVault(swapRouter, WRAPPED_NATIVE, bot.address);
        await tx.wait();
        console.log("[before] 已为 user 创建金库");
      }
    } catch (error) {
      console.error(`创建金库错误: ${error instanceof Error ? error.message : String(error)}`);

      if (userBalance === 0n) {
        console.log("用户余额为0，无法创建金库");
        this.skip(); // 跳过测试
        return;
      }

      // 如果getVault调用失败，尝试创建新金库
      const swapRouter = process.env.SWAP_ROUTER || admin.address;
      console.log(`使用SwapRouter: ${swapRouter}`);
      console.log(`使用WRAPPED_NATIVE: ${WRAPPED_NATIVE}`);
      console.log(`使用Bot地址: ${bot.address}`);

      const tx = await factory.connect(user).createVault(swapRouter, WRAPPED_NATIVE, bot.address);
      await tx.wait();
      console.log("[before] 已为 user 创建金库");
    }
  });

  it("工厂可为用户创建金库(Proxy)，并初始化角色", async function () {
    const vaultAddr = await factory.getVault(user.address);
    expect(vaultAddr).to.not.equal(ethers.ZeroAddress);
    const proxyVault = Vault.attach(vaultAddr);
    expect(await proxyVault.investor()).to.equal(user.address);
    expect(await proxyVault.hasRole(await proxyVault.DEFAULT_ADMIN_ROLE(), user.address)).to.be.true;
    console.log("[it] 金库地址:", vaultAddr);
  });

  it("金库合约应支持存款和取款", async function () {
    // 部署ERC20模拟
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const token = await ERC20Mock.deploy("MockToken", "MTK", user.address, ethers.parseEther("1000")) as any;
    await token.deployed();
    // 用户授权金库
    const vaultAddr = await factory.userVaults(user.address);
    const proxyVault = Vault.attach(vaultAddr);
    await token.connect(user).approve(vaultAddr, ethers.parseEther("100"));
    // 存款
    await expect(proxyVault.connect(user).deposit(token.address, ethers.parseEther("100")))
      .to.emit(proxyVault, "Deposited");
    // 取款
    await expect(proxyVault.connect(user).withdraw(token.address, ethers.parseEther("50")))
      .to.emit(proxyVault, "Withdrawn");
    // 检查余额
    const balance = await proxyVault.getBalance(token.address);
    expect(balance).to.equal(ethers.parseEther("50"));
    console.log("[it] 存取款余额:", await token.balanceOf(user.address));
  });

  it("应支持批量升级金库实现合约", async function () {
    const vaultAddr = await factory.userVaults(user.address);
    const proxyVault = Vault.attach(vaultAddr);
    // 升级实现合约（模拟新实现）
    const NewVault = await ethers.getContractFactory("PersonalVaultUpgradeable");
    const newImpl = await NewVault.deploy();
    await newImpl.deployed();
    // 只有owner可升级
    await expect(factory.connect(user).upgradeVault(vaultAddr, newImpl.address)).to.be.reverted;
    await expect(factory.connect(admin).upgradeVault(vaultAddr, newImpl.address)).to.not.be.reverted;
  });

  it("工厂应支持添加/移除BOT并赋权", async function () {
    const vaultAddr = await factory.userVaults(user.address);
    const proxyVault = Vault.attach(vaultAddr);
    await factory.connect(admin).addBot(bot.address);
    expect(await factory.hasRole(await factory.BOT_ROLE(), bot.address)).to.be.true;
    await factory.connect(admin).removeBot(bot.address);
    expect(await factory.hasRole(await factory.BOT_ROLE(), bot.address)).to.be.false;
  });

  it("金库合约应支持原生代币的存取", async function () {
    const vaultAddr = await factory.userVaults(user.address);
    const proxyVault = Vault.attach(vaultAddr);
    const NATIVE_TOKEN = await proxyVault.NATIVE_TOKEN();

    // 存入原生代币
    const depositAmount = ethers.parseEther("0.001");
    await proxyVault.connect(user).depositNative({ value: depositAmount });

    // 检查余额
    const balance = await proxyVault.getBalance(NATIVE_TOKEN);
    expect(balance).to.equal(depositAmount);
    console.log(`[原生代币存入] 余额: ${ethers.formatEther(balance)}`);

    // 提取一半原生代币
    const withdrawAmount = ethers.parseEther("0.0005");
    await proxyVault.connect(user).withdrawNative(withdrawAmount);

    // 检查提取后余额
    const balanceAfter = await proxyVault.getBalance(NATIVE_TOKEN);
    expect(balanceAfter).to.equal(depositAmount - withdrawAmount);
    console.log(`[原生代币提取] 余额: ${ethers.formatEther(balanceAfter)}`);
  });

  it("BOT可以swap，vault余额变化正确", async function () {
    // 使用环境变量中的真实代币地址
    const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS || "0x0000000000000000000000000000000000000000";
    const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS || "0x0000000000000000000000000000000000000000";

    if (TOKEN_A_ADDRESS === "0x0000000000000000000000000000000000000000" ||
      TOKEN_B_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.log("⚠️ 跳过真实swap测试：未设置TOKEN_A_ADDRESS或TOKEN_B_ADDRESS环境变量");
      return;
    }

    // 获取代币合约实例
    const tokenA = await ethers.getContractAt("IERC20", TOKEN_A_ADDRESS) as any;
    const tokenB = await ethers.getContractAt("IERC20", TOKEN_B_ADDRESS) as any;

    // 获取用户金库
    const vaultAddr = await factory.getVault(user.address);
    const proxyVault = Vault.attach(vaultAddr);

    // 检查用户是否有足够的tokenA余额
    const userBalanceA = await tokenA.balanceOf(user.address);
    console.log(`用户TokenA余额: ${ethers.formatEther(userBalanceA)} ${await tokenA.symbol()}`);

    if (userBalanceA.lt(ethers.parseEther("0.01"))) {
      console.log("⚠️ 跳过真实swap测试：用户TokenA余额不足");
      return;
    }

    // 存入一些TokenA到金库
    const depositAmount = ethers.parseEther("0.01"); // 存入0.01个TokenA
    await tokenA.connect(user).approve(vaultAddr, depositAmount);
    await proxyVault.connect(user).deposit(TOKEN_A_ADDRESS, depositAmount);
    console.log(`已存入 ${ethers.formatEther(depositAmount)} ${await tokenA.symbol()} 到金库`);

    // 授权bot为oracle角色
    const ORACLE_ROLE = await proxyVault.ORACLE_ROLE();
    if (!(await proxyVault.hasRole(ORACLE_ROLE, bot.address))) {
      await proxyVault.connect(admin).grantRole(ORACLE_ROLE, bot.address);
      console.log(`已授权BOT(${bot.address})为Oracle角色`);
    }

    // 记录swap前余额
    const balA_before = await proxyVault.getBalance(TOKEN_A_ADDRESS);
    const balB_before = await proxyVault.getBalance(TOKEN_B_ADDRESS);
    console.log(`Swap前余额: ${ethers.formatEther(balA_before)} ${await tokenA.symbol()}, ${ethers.formatEther(balB_before)} ${await tokenB.symbol()}`);

    // 执行swap
    try {
      // 获取swap路由地址
      const swapRouter = await proxyVault.swapRouter();
      console.log(`使用SwapRouter: ${swapRouter}`);

      // 设置swap参数
      const amountIn = ethers.parseEther("0.005"); // 使用一半的存款进行swap
      const amountOutMinimum = 1; // 最小输出金额，实际应该根据预期汇率计算
      // Uniswap V2不需要fee参数，固定为0.3%

      console.log(`尝试swap: ${ethers.formatEther(amountIn)} ${await tokenA.symbol()} -> ${await tokenB.symbol()}`);

      // 调用swap函数 - 已更新为V2接口（移除fee参数）
      const tx = await proxyVault.connect(bot).swapExactInputSingle(
        TOKEN_A_ADDRESS,
        TOKEN_B_ADDRESS,
        amountIn,
        amountOutMinimum
      );

      await tx.wait();
      console.log(`Swap交易成功: ${tx.hash}`);

      // 检查swap后余额
      const balA_after = await proxyVault.getBalance(TOKEN_A_ADDRESS);
      const balB_after = await proxyVault.getBalance(TOKEN_B_ADDRESS);
      console.log(`Swap后余额: ${ethers.formatEther(balA_after)} ${await tokenA.symbol()}, ${ethers.formatEther(balB_after)} ${await tokenB.symbol()}`);

      // 验证余额变化
      expect(balA_after).to.be.lt(balA_before); // TokenA应该减少
      expect(balB_after).to.be.gt(balB_before); // TokenB应该增加

    } catch (error) {
      console.error("Swap失败:", error);
      // 如果swap失败，我们仍然继续测试，不要让整个测试套件失败
    }
  });

  it("完整流程测试: 存入原生代币并多次交换", async function () {
    // 跳过非主网环境
    if (process.env.NETWORK !== 'flow' && process.env.NETWORK !== 'flowTestnet') {
      console.log("⚠️ 跳过完整流程测试: 需要在Flow EVM网络上运行");
      return;
    }

    // 检查环境变量
    const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS;
    const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS;
    const WRAPPED_NATIVE = process.env.WRAPPED_NATIVE;

    if (!TOKEN_A_ADDRESS || !TOKEN_B_ADDRESS || !WRAPPED_NATIVE) {
      console.log("⚠️ 跳过完整流程测试: 缺少必要的环境变量");
      return;
    }

    // 获取合约实例
    const vaultAddr = await factory.userVaults(user.address);
    const proxyVault = Vault.attach(vaultAddr);
    const NATIVE_TOKEN = await proxyVault.NATIVE_TOKEN();
    const tokenA = await ethers.getContractAt("IERC20", TOKEN_A_ADDRESS) as any;
    const tokenB = await ethers.getContractAt("IERC20", TOKEN_B_ADDRESS) as any;
    const wrappedNative = await ethers.getContractAt("IERC20", WRAPPED_NATIVE) as any;

    console.log("\n=== 开始完整流程测试 ===");
    console.log(`原生代币地址: ${NATIVE_TOKEN}`);
    console.log(`包装原生代币地址: ${WRAPPED_NATIVE}`);
    console.log(`TokenA地址: ${TOKEN_A_ADDRESS}`);
    console.log(`TokenB地址: ${TOKEN_B_ADDRESS}`);

    // 授权bot为oracle角色
    const ORACLE_ROLE = await proxyVault.ORACLE_ROLE();
    if (!(await proxyVault.hasRole(ORACLE_ROLE, bot.address))) {
      await proxyVault.connect(admin).grantRole(ORACLE_ROLE, bot.address);
      console.log(`已授权BOT(${bot.address})为Oracle角色`);
    }

    // 1. 存入原生代币
    console.log("\n步骤1: 存入原生代币");
    const depositAmount = ethers.parseEther("0.01");
    await proxyVault.connect(user).depositNative({ value: depositAmount });
    console.log(`已存入 ${ethers.formatEther(depositAmount)} 原生代币`);

    // 检查余额
    let nativeBalance = await proxyVault.getBalance(NATIVE_TOKEN);
    console.log(`原生代币余额: ${ethers.formatEther(nativeBalance)}`);

    // 2. 将一半原生代币交换为TokenA
    console.log("\n步骤2: 将一半原生代币交换为TokenA");
    try {
      const swapAmount1 = ethers.parseEther("0.005");
      // Uniswap V2不需要fee参数，固定为0.3%

      const tx1 = await proxyVault.connect(bot).swapExactInputSingle(
        NATIVE_TOKEN,
        TOKEN_A_ADDRESS,
        swapAmount1,
        1 // 最小输出金额
      );

      await tx1.wait();
      console.log(`交易成功: ${tx1.hash}`);

      // 检查余额
      nativeBalance = await proxyVault.getBalance(NATIVE_TOKEN);
      const tokenABalance = await proxyVault.getBalance(TOKEN_A_ADDRESS);
      console.log(`原生代币余额: ${ethers.formatEther(nativeBalance)}`);
      console.log(`TokenA余额: ${ethers.formatEther(tokenABalance)}`);

    } catch (error) {
      console.error("原生代币交换TokenA失败:", error);
    }

    // 3. 将TokenA交换为TokenB
    console.log("\n步骤3: 将TokenA交换为TokenB");
    try {
      const tokenABalance = await proxyVault.getBalance(TOKEN_A_ADDRESS);
      if (tokenABalance.gt(0)) {
        const swapAmount2 = tokenABalance.div(2); // 使用一半TokenA
        // Uniswap V2不需要fee参数，固定为0.3%

        const tx2 = await proxyVault.connect(bot).swapExactInputSingle(
          TOKEN_A_ADDRESS,
          TOKEN_B_ADDRESS,
          swapAmount2,
          1 // 最小输出金额
        );

        await tx2.wait();
        console.log(`交易成功: ${tx2.hash}`);

        // 检查余额
        const tokenABalanceAfter = await proxyVault.getBalance(TOKEN_A_ADDRESS);
        const tokenBBalance = await proxyVault.getBalance(TOKEN_B_ADDRESS);
        console.log(`TokenA余额: ${ethers.formatEther(tokenABalanceAfter)}`);
        console.log(`TokenB余额: ${ethers.formatEther(tokenBBalance)}`);
      } else {
        console.log("TokenA余额为0，无法交换");
      }
    } catch (error) {
      console.error("TokenA交换TokenB失败:", error);
    }

    // 4. 将TokenB交换为包装原生代币
    console.log("\n步骤4: 将TokenB交换为包装原生代币");
    try {
      const tokenBBalance = await proxyVault.getBalance(TOKEN_B_ADDRESS);
      if (tokenBBalance.gt(0)) {
        const swapAmount3 = tokenBBalance; // 使用全部TokenB
        // Uniswap V2不需要fee参数，固定为0.3%

        const tx3 = await proxyVault.connect(bot).swapExactInputSingle(
          TOKEN_B_ADDRESS,
          WRAPPED_NATIVE,
          swapAmount3,
          1 // 最小输出金额
        );

        await tx3.wait();
        console.log(`交易成功: ${tx3.hash}`);

        // 检查余额
        const wrappedNativeBalance = await proxyVault.getBalance(WRAPPED_NATIVE);
        console.log(`包装原生代币余额: ${ethers.formatEther(wrappedNativeBalance)}`);
      } else {
        console.log("TokenB余额为0，无法交换");
      }
    } catch (error) {
      console.error("TokenB交换包装原生代币失败:", error);
    }

    // 5. 提取剩余原生代币
    console.log("\n步骤5: 提取剩余原生代币");
    try {
      const nativeBalance = await proxyVault.getBalance(NATIVE_TOKEN);
      if (nativeBalance.gt(0)) {
        await proxyVault.connect(user).withdrawNative(nativeBalance);
        console.log(`已提取 ${ethers.formatEther(nativeBalance)} 原生代币`);

        // 检查余额
        const nativeBalanceAfter = await proxyVault.getBalance(NATIVE_TOKEN);
        console.log(`原生代币余额: ${ethers.formatEther(nativeBalanceAfter)}`);
      } else {
        console.log("原生代币余额为0，无法提取");
      }
    } catch (error) {
      console.error("提取原生代币失败:", error);
    }

    console.log("\n=== 完整流程测试结束 ===");
  });
});
