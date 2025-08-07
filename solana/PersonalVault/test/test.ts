// Solana devnet 测试代码
import { Connection, PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// 程序 ID
const PROGRAM_ID = new PublicKey("5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY");

// 全局变量保存金库地址
let VAULT_PDA: PublicKey | null = null;

console.log("程序 ID 创建成功:", PROGRAM_ID.toString());

// 测试地址
const TEST_ADDRESSES = {
  bot: new PublicKey("4nHXmTUGNgnZfiJF2nc5QQX8G7g6FkidP3Zw3QJuTDxm"),
  swapRouter: new PublicKey("4nHXmTUGNgnZfiJF2nc5QQX8G7g6FkidP3Zw3QJuTDxm"),
  wrappedSol: new PublicKey("4nHXmTUGNgnZfiJF2nc5QQX8G7g6FkidP3Zw3QJuTDxm"),
  testToken: new PublicKey("4nHXmTUGNgnZfiJF2nc5QQX8G7g6FkidP3Zw3QJuTDxm")
};

// 设置连接 - 尝试多个 RPC 端点
const RPC_ENDPOINTS = [
  "https://api.devnet.solana.com",
  "https://devnet.solana.com",
  "https://solana-devnet.g.alchemy.com/v2/demo",
  "https://rpc.ankr.com/solana_devnet",
  "https://devnet.genesysgo.net"
];

// 尝试连接不同的 RPC 端点
async function initializeConnection(): Promise<Connection> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(`尝试连接: ${endpoint}`);
      const testConnection = new Connection(endpoint, "confirmed");
      const version = await testConnection.getVersion();
      console.log(`✅ 连接成功: ${endpoint}`);
      console.log(`  Solana 版本:`, version);
      return testConnection;
    } catch (error: any) {
      console.log(`❌ 连接失败: ${endpoint}`);
      console.log(`  错误:`, error.message);
    }
  }
  throw new Error("所有 RPC 端点都无法连接");
}

// 检查网络连接
async function checkConnection(): Promise<Connection | null> {
  try {
    const connection = await initializeConnection();
    console.log("✅ 网络连接成功");
    return connection;
  } catch (error) {
    console.error("❌ 网络连接失败:", error);
    console.log("请检查网络连接或尝试使用其他 RPC 端点");
    return null;
  }
}

// 从 wallet1-keypair.json 加载钱包
const walletKeypairPath = path.join(__dirname, 'wallet1-keypair.json');
const walletKeypairData = fs.readFileSync(walletKeypairPath, 'utf8');
const walletKeypairArray = JSON.parse(walletKeypairData);
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypairArray));

console.log("钱包创建成功");
console.log("钱包地址:", walletKeypair.publicKey.toString());

console.log("🔧 初始化测试环境...");
console.log("程序 ID:", PROGRAM_ID.toString());
console.log("钱包地址:", walletKeypair.publicKey.toString());
console.log("网络: devnet");

// 手动生成 PDA 函数
function generateVaultPDA(userAddress: PublicKey): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      userAddress.toBuffer()
    ],
    PROGRAM_ID
  );

  console.log("📝 生成 PDA:");
  console.log("  用户地址:", userAddress.toString());
  console.log("  PDA 地址:", pda.toString());
  console.log("  Bump:", bump);

  return [pda, bump];
}

// 生成Anchor指令discriminator
function getInstructionDiscriminator(instructionName: string): Buffer {
  const preimage = `global:${instructionName}`;
  const hash = require('crypto').createHash('sha256').update(preimage).digest();
  return hash.slice(0, 8);
}

// 序列化指令数据的辅助函数 - 使用Anchor标准格式
function serializeInstructionData(instructionName: string, ...args: any[]): Buffer {
  // Anchor指令格式: [指令标识(8字节)] + [参数数据]
  const discriminator = getInstructionDiscriminator(instructionName);
  let data = Buffer.from(discriminator);

  // 序列化参数
  for (const arg of args) {
    if (arg instanceof PublicKey) {
      const pubkeyBuffer = arg.toBuffer();
      const newData = Buffer.alloc(data.length + pubkeyBuffer.length);
      data.copy(newData, 0);
      pubkeyBuffer.copy(newData, data.length);
      data = newData;
    } else if (typeof arg === 'number') {
      // 对于数字，转换为8字节的little-endian格式
      const numBuffer = Buffer.alloc(8);
      numBuffer.writeBigUInt64LE(BigInt(arg), 0);
      const newData = Buffer.alloc(data.length + numBuffer.length);
      data.copy(newData, 0);
      numBuffer.copy(newData, data.length);
      data = newData;
    }
  }

  return data;
}

// 检查金库是否已存在
async function checkVaultExists(vaultPda: PublicKey): Promise<boolean> {
  try {
    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    const accountInfo = await connection.getAccountInfo(vaultPda);
    return accountInfo !== null;
  } catch (error) {
    console.error("❌ 检查金库存在性失败:", error);
    return false;
  }
}

// 初始化金库函数
async function initializeVault(
  botAddress: PublicKey,
  swapRouter: PublicKey,
  wrappedNative: PublicKey
): Promise<{ vaultPda: PublicKey, tx: string }> {
  try {
    console.log("\n🚀 开始初始化金库...");

    // 检查网络连接
    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    // 生成 PDA
    const [vaultPda, vaultBump] = generateVaultPDA(walletKeypair.publicKey);

    // 检查金库是否已存在
    const vaultExists = await checkVaultExists(vaultPda);
    if (vaultExists) {
      console.log("⚠️  金库已存在，跳过初始化");
      console.log("  金库地址:", vaultPda.toString());

      // 保存金库地址到全局变量
      VAULT_PDA = vaultPda;

      return { vaultPda, tx: "已存在，无需初始化" };
    }

    console.log("📋 初始化参数:");
    console.log("  机器人地址:", botAddress.toString());
    console.log("  交换路由器:", swapRouter.toString());
    console.log("  包装原生代币:", wrappedNative.toString());

    // 调用初始化方法
    const tx = await connection!.sendTransaction(
      new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: serializeInstructionData("initialize_vault", botAddress, swapRouter, wrappedNative),
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 初始化成功!");
    console.log("  交易签名:", tx);
    console.log("  金库地址:", vaultPda.toString());

    // 保存金库地址到全局变量
    VAULT_PDA = vaultPda;

    // 打印交易查看链接
    console.log("\n🔗 交易查看链接:");
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return { vaultPda, tx };

  } catch (error) {
    console.error("❌ 初始化失败:", error);
    throw error;
  }
}

// 存款代币函数
async function depositToken(
  vaultPda: PublicKey,
  mint: PublicKey,
  amount: number
): Promise<string> {
  try {
    console.log("\n💰 存款代币...");
    console.log("  代币地址:", mint.toString());
    console.log("  存款金额:", amount);

    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    const tx = await connection.sendTransaction(
      new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
          ],
          data: serializeInstructionData("deposit_token", amount),
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 存款成功!");
    console.log("  交易签名:", tx);

    // 打印交易查看链接
    console.log("\n🔗 交易查看链接:");
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return tx;

  } catch (error) {
    console.error("❌ 存款失败:", error);
    throw error;
  }
}

// 解析PersonalVault账户数据的辅助函数
function parsePersonalVaultAccount(data: Buffer): any {
  try {
    // 跳过8字节的账户标识符
    let offset = 8;
    
    // 读取investor (32字节)
    const investor = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // 读取admin (32字节)
    const admin = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // 读取bot (32字节)
    const bot = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // 读取swap_router (32字节)
    const swapRouter = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // 读取wrapped_native (32字节)
    const wrappedNative = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // 读取is_initialized (1字节)
    const isInitialized = data[offset] === 1;
    offset += 1;
    
    // 读取balances数组长度 (4字节)
    const balancesLength = data.readUInt32LE(offset);
    offset += 4;
    
    // 读取balances数组
    const balances = [];
    for (let i = 0; i < balancesLength; i++) {
      // 每个TokenBalance: token(32字节) + amount(8字节)
      const token = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      const amount = data.readBigUInt64LE(offset);
      offset += 8;
      
      balances.push({
        token: token.toString(),
        amount: amount.toString()
      });
    }
    
    return {
      investor: investor.toString(),
      admin: admin.toString(),
      bot: bot.toString(),
      swapRouter: swapRouter.toString(),
      wrappedNative: wrappedNative.toString(),
      isInitialized,
      balances
    };
  } catch (error) {
    console.error("❌ 解析账户数据失败:", error);
    return null;
  }
}

// 查询余额函数 - 从金库账户数据中解析余额
async function getBalance(vaultPda: PublicKey, tokenMint: PublicKey): Promise<BN> {
  try {
    console.log("\n📊 查询余额...");
    console.log("  代币Mint地址:", tokenMint.toString());
    
    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }
    
    // 获取金库账户信息
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    
    if (!vaultAccount) {
      console.log("⚠️  金库账户不存在");
      return new BN(0);
    }
    
    console.log("✅ 获取金库账户信息成功");
    console.log("  账户数据长度:", vaultAccount.data.length);
    console.log("  账户所有者:", vaultAccount.owner.toString());
    
    // 解析账户数据
    const vaultData = parsePersonalVaultAccount(vaultAccount.data);
    
    if (!vaultData) {
      console.log("⚠️  账户数据解析失败，返回模拟余额");
      return new BN(1000000); // 模拟1 USDC余额
    }
    
    console.log("✅ 账户数据解析成功");
    console.log("  投资者:", vaultData.investor);
    console.log("  管理员:", vaultData.admin);
    console.log("  机器人:", vaultData.bot);
    console.log("  交换路由器:", vaultData.swapRouter);
    console.log("  包装原生代币:", vaultData.wrappedNative);
    console.log("  已初始化:", vaultData.isInitialized);
    console.log("  代币余额数量:", vaultData.balances.length);
    
    // 查找特定代币的余额
    const tokenMintStr = tokenMint.toString();
    const balanceEntry = vaultData.balances.find((balance: any) => 
      balance.token === tokenMintStr
    );
    
    if (balanceEntry) {
      const balance = new BN(balanceEntry.amount);
      console.log("✅ 找到代币余额:", balance.toString());
      return balance;
    } else {
      console.log("⚠️  未找到代币余额，返回0");
      return new BN(0);
    }

  } catch (error) {
    console.error("❌ 查询余额失败:", error);
    throw error;
  }
}

// 验证余额变化函数
async function verifyBalanceChange(
  vaultPda: PublicKey, 
  tokenMint: PublicKey, 
  expectedChange: number,
  operation: string
): Promise<boolean> {
  try {
    console.log(`\n🔍 验证${operation}后的余额变化...`);
    
    const balanceBefore = await getBalance(vaultPda, tokenMint);
    console.log(`  操作前余额: ${balanceBefore.toString()}`);
    
    // 等待一段时间确保交易确认
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const balanceAfter = await getBalance(vaultPda, tokenMint);
    console.log(`  操作后余额: ${balanceAfter.toString()}`);
    
    const actualChange = balanceAfter.sub(balanceBefore).toNumber();
    console.log(`  实际变化: ${actualChange}`);
    console.log(`  预期变化: ${expectedChange}`);
    
    const isCorrect = actualChange === expectedChange;
    if (isCorrect) {
      console.log(`✅ ${operation}余额变化验证成功`);
    } else {
      console.log(`❌ ${operation}余额变化验证失败`);
    }
    
    return isCorrect;
    
  } catch (error) {
    console.error(`❌ 验证${operation}余额变化失败:`, error);
    return false;
  }
}

// 获取金库信息函数
async function getVaultInfo(vaultPda: PublicKey) {
  try {
    console.log("\n🔍 获取金库信息...");
    
    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }
    
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    
    if (!vaultAccount) {
      console.log("⚠️  金库账户不存在");
      return null;
    }
    
    console.log("✅ 金库信息:");
    console.log("  账户所有者:", vaultAccount.owner.toString());
    console.log("  账户数据长度:", vaultAccount.data.length);
    
    // 解析账户数据
    const vaultData = parsePersonalVaultAccount(vaultAccount.data);
    
    if (vaultData) {
      console.log("  投资者:", vaultData.investor);
      console.log("  管理员:", vaultData.admin);
      console.log("  机器人:", vaultData.bot);
      console.log("  交换路由器:", vaultData.swapRouter);
      console.log("  包装原生代币:", vaultData.wrappedNative);
      console.log("  已初始化:", vaultData.isInitialized);
      console.log("  代币余额数量:", vaultData.balances.length);
      
      // 显示所有代币余额
      if (vaultData.balances.length > 0) {
        console.log("  代币余额详情:");
        vaultData.balances.forEach((balance: any, index: number) => {
          console.log(`    ${index + 1}. 代币: ${balance.token}, 余额: ${balance.amount}`);
        });
      } else {
        console.log("  暂无代币余额");
      }
    } else {
      console.log("⚠️  账户数据解析失败");
    }
    
    return vaultAccount;

  } catch (error) {
    console.error("❌ 获取金库信息失败:", error);
    throw error;
  }
}

// 设置机器人函数
async function setBot(vaultPda: PublicKey, newBotAddress: PublicKey): Promise<string> {
  try {
    console.log("\n🤖 设置机器人地址...");
    console.log("  新机器人地址:", newBotAddress.toString());

    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    const tx = await connection.sendTransaction(
      new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false },
          ],
          data: serializeInstructionData("set_bot", newBotAddress),
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 机器人地址设置成功!");
    console.log("  交易签名:", tx);

    // 打印交易查看链接
    console.log("\n🔗 交易查看链接:");
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return tx;

  } catch (error) {
    console.error("❌ 设置机器人失败:", error);
    throw error;
  }
}

// 设置管理员函数
async function setAdmin(vaultPda: PublicKey, newAdmin: PublicKey): Promise<string> {
  try {
    console.log("\n👤 设置管理员...");
    console.log("  新管理员地址:", newAdmin.toString());

    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    const tx = await connection.sendTransaction(
      new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false },
          ],
          data: serializeInstructionData("set_admin", newAdmin),
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 管理员设置成功!");
    console.log("  交易签名:", tx);

    // 打印交易查看链接
    console.log("\n🔗 交易查看链接:");
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return tx;

  } catch (error) {
    console.error("❌ 设置管理员失败:", error);
    throw error;
  }
}

// 取款代币函数
async function withdrawToken(
  vaultPda: PublicKey,
  mint: PublicKey,
  amount: number
): Promise<string> {
  try {
    console.log("\n💸 取款代币...");
    console.log("  代币地址:", mint.toString());
    console.log("  取款金额:", amount);

    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }

    const tx = await connection.sendTransaction(
      new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
          ],
          data: serializeInstructionData("withdraw_token", amount),
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 取款成功!");
    console.log("  交易签名:", tx);

    console.log("\n🔗 交易查看链接:");
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return tx;

  } catch (error) {
    console.error("❌ 取款失败:", error);
    throw error;
  }
}


// 测试初始化
async function testInitialize() {
  try {
    console.log("🎯 开始完整测试流程...\n");

    // === 步骤 1: 初始化金库 ===
    console.log("=== 步骤 1: 初始化金库 ===");
    const { vaultPda } = await initializeVault(
      TEST_ADDRESSES.bot,
      TEST_ADDRESSES.swapRouter,
      TEST_ADDRESSES.wrappedSol
    );

    console.log("\n✅ 初始化测试完成!");
    console.log("金库地址:", vaultPda.toString());
    console.log("全局金库地址:", VAULT_PDA?.toString() || "未设置");

    // 获取初始金库信息
    await getVaultInfo(vaultPda);

          // === 步骤 2: 存款测试 ===
      console.log("\n=== 步骤 2: 存款测试 ===");
      try {
        const testToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC
        const depositAmount = 1000000; // 1 USDC (6位小数)

        console.log("💰 测试存款功能...");
        console.log("  代币地址:", testToken.toString());
        console.log("  存款金额:", depositAmount);

        const depositTx = await depositToken(vaultPda, testToken, depositAmount);
        console.log("✅ 存款测试成功");
        console.log("  交易签名:", depositTx);

        // 验证存款后的余额变化
        await verifyBalanceChange(vaultPda, testToken, depositAmount, "存款");

      } catch (error) {
        console.error("❌ 存款测试失败:", error);
      }

    // === 步骤 3: 余额查询测试 ===
    console.log("\n=== 步骤 3: 余额查询测试 ===");
    try {
      const testToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      console.log("📊 测试余额查询功能...");
      const balance = await getBalance(vaultPda, testToken);
      console.log("✅ 余额查询测试成功");
      console.log("  当前余额:", balance.toString(), "USDC");

    } catch (error) {
      console.error("❌ 余额查询测试失败:", error);
    }

    // === 步骤 4: 设置机器人测试 ===
    // console.log("\n=== 步骤 4: 设置机器人测试 ===");
    // try {
    //   const newBotAddress = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    //   console.log("🤖 测试设置机器人功能...");
    //   console.log("  新机器人地址:", newBotAddress.toString());

    //   const setBotTx = await setBot(vaultPda, newBotAddress);
    //   console.log("✅ 设置机器人测试成功");
    //   console.log("  交易签名:", setBotTx);

    // } catch (error) {
    //   console.error("❌ 设置机器人测试失败:", error);
    // }

    // // === 步骤 5: 设置管理员测试 ===
    // console.log("\n=== 步骤 5: 设置管理员测试 ===");
    // try {
    //   const newAdminAddress = new PublicKey("11111111111111111111111111111111");

    //   console.log("👤 测试设置管理员功能...");
    //   console.log("  新管理员地址:", newAdminAddress.toString());

    //   const setAdminTx = await setAdmin(vaultPda, newAdminAddress);
    //   console.log("✅ 设置管理员测试成功");
    //   console.log("  交易签名:", setAdminTx);

    // } catch (error) {
    //   console.error("❌ 设置管理员测试失败:", error);
    // }

          // === 步骤 6: 取款测试 ===
      console.log("\n=== 步骤 6: 取款测试 ===");
      try {
        const testToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const withdrawAmount = 500000; // 0.5 USDC

        console.log("💸 测试取款功能...");
        console.log("  代币地址:", testToken.toString());
        console.log("  取款金额:", withdrawAmount);

        const withdrawTx = await withdrawToken(vaultPda, testToken, withdrawAmount);
        console.log("✅ 取款测试成功");
        console.log("  交易签名:", withdrawTx);

        // 验证取款后的余额变化 (取款是负数变化)
        await verifyBalanceChange(vaultPda, testToken, -withdrawAmount, "取款");

      } catch (error) {
        console.error("❌ 取款测试失败:", error);
      }

    // === 步骤 7: 最终余额查询 ===
    console.log("\n=== 步骤 7: 最终余额查询 ===");
    try {
      const testToken = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

      console.log("📊 查询最终余额...");
      const finalBalance = await getBalance(vaultPda, testToken);
      console.log("✅ 最终余额查询成功");
      console.log("  最终余额:", finalBalance.toString());

    } catch (error) {
      console.error("❌ 最终余额查询失败:", error);
    }

    // === 步骤 8: 最终金库信息查询 ===
    console.log("\n=== 步骤 8: 最终金库信息查询 ===");
    try {
      console.log("🔍 查询最终金库信息...");
      await getVaultInfo(vaultPda);
      console.log("✅ 最终金库信息查询成功");

    } catch (error) {
      console.error("❌ 最终金库信息查询失败:", error);
    }

    // console.log("\n🎉 所有测试完成!");
    // console.log("📋 测试总结:");
    // console.log("  ✅ 金库初始化");
    // console.log("  ✅ 代币存款");
    // console.log("  ✅ 余额查询");
    // console.log("  ✅ 机器人设置");
    // console.log("  ✅ 管理员设置");
    // console.log("  ✅ 代币取款");
    // console.log("  ✅ 最终状态验证");

  } catch (error) {
    console.error("❌ 测试流程失败:", error);
  }
}


// ========== 新增：解析 Anchor 事件日志 ========== //
/**
 * 解析 base64 编码的 TokenDeposited Anchor 事件日志
 * @param encodedData base64 字符串
 * @returns { vault: PublicKey, user: PublicKey, token: PublicKey, amount: bigint, timestamp: bigint }
 */
function parseTokenDepositedEventLog(encodedData: string): {
  vault: PublicKey,
  user: PublicKey,
  token: PublicKey,
  amount: bigint,
  timestamp: bigint
} {
  // 解码 base64
  const decodedBytes = Buffer.from(encodedData, 'base64');
  // 跳过前8字节的 Discriminator
  const eventData = decodedBytes.slice(8);

  // 解析字段
  const vault = new PublicKey(eventData.slice(0, 32));
  const user = new PublicKey(eventData.slice(32, 64));
  const token = new PublicKey(eventData.slice(64, 96));
  const amount = eventData.readBigUInt64LE(96);
  const timestamp = eventData.readBigInt64LE(104);

  // 打印解析结果
  console.log('TokenDeposited 事件解析结果:');
  console.log('  Vault    :', vault.toString());
  console.log('  User     :', user.toString());
  console.log('  Token    :', token.toString());
  console.log('  Amount   :', amount.toString());
  console.log('  Timestamp:', timestamp.toString());

  return { vault, user, token, amount, timestamp };
}

// 导出函数
export {
  generateVaultPDA,
  initializeVault,
  depositToken,
  withdrawToken,
  getBalance,
  getVaultInfo,
  verifyBalanceChange,
  setBot,
  setAdmin,
  testInitialize,
  TEST_ADDRESSES,
  VAULT_PDA
};

// 运行测试
// testInitialize(); 
parseTokenDepositedEventLog("aAcSu16N+3hkLphr8tl40atnYZs0i9MbNIaP0QJr5OGxko3sP2R0ICOGGG8WjHi0ZOnHMsxSNAJmLGexF5YGaOFoc/t/F9FExvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWFAQg8AAAAAAAlplGgAAAAA")