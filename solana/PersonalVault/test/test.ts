// Solana devnet 测试代码
import { Connection, PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// 程序 ID
const PROGRAM_ID = new PublicKey("5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY");

console.log("程序 ID 创建成功:", PROGRAM_ID.toString());

// 测试地址
const TEST_ADDRESSES = {
  bot: new PublicKey("11111111111111111111111111111111"),
  swapRouter: new PublicKey("11111111111111111111111111111111"),
  wrappedSol: new PublicKey("So11111111111111111111111111111111111111112"),
  testToken: new PublicKey("11111111111111111111111111111111")
};

console.log("测试地址创建成功");

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
            { pubkey: botAddress, isSigner: false, isWritable: false },
            { pubkey: swapRouter, isSigner: false, isWritable: false },
            { pubkey: wrappedNative, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]), // Placeholder for instruction data
        })
      ),
      [walletKeypair]
    );

    console.log("✅ 初始化成功!");
    console.log("  交易签名:", tx);
    console.log("  金库地址:", vaultPda.toString());
    
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
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]), // Placeholder for instruction data
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

// 查询余额函数
async function getBalance(vaultPda: PublicKey, token: PublicKey): Promise<BN> {
  try {
    console.log("\n📊 查询余额...");
    console.log("  代币地址:", token.toString());
    
    const connection = await checkConnection();
    if (!connection) {
      throw new Error("网络连接失败");
    }
    
    const balance = await connection.getTokenAccountBalance(token);

    console.log("✅ 余额查询成功!");
    console.log("  余额:", balance.value.uiAmount);
    
    return new BN(balance.value.uiAmount);

  } catch (error) {
    console.error("❌ 查询余额失败:", error);
    throw error;
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
    
    console.log("✅ 金库信息:");
    console.log("  投资者:", vaultAccount?.owner.toString());
    console.log("  管理员:", vaultAccount?.owner.toString()); // Placeholder, needs actual admin logic
    console.log("  机器人:", vaultAccount?.owner.toString()); // Placeholder, needs actual bot logic
    console.log("  交换路由器:", vaultAccount?.owner.toString()); // Placeholder, needs actual swapRouter logic
    console.log("  包装原生代币:", vaultAccount?.owner.toString()); // Placeholder, needs actual wrappedNative logic
    console.log("  已初始化:", vaultAccount?.owner.toString() === PROGRAM_ID.toString()); // Placeholder, needs actual isInitialized logic
    console.log("  代币余额数量:", vaultAccount?.data.length); // Placeholder, needs actual balance logic
    
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
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: newBotAddress, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([2, 0, 0, 0, 0, 0, 0, 0]), // Placeholder for instruction data
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
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: newAdmin, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([3, 0, 0, 0, 0, 0, 0, 0]), // Placeholder for instruction data
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

// 测试初始化
async function testInitialize() {
  try {
    console.log("🎯 测试初始化金库...\n");
    
    const { vaultPda } = await initializeVault(
      TEST_ADDRESSES.bot,
      TEST_ADDRESSES.swapRouter,
      TEST_ADDRESSES.wrappedSol
    );
    
    console.log("\n✅ 初始化测试完成!");
    console.log("金库地址:", vaultPda.toString());
    
    // 获取金库信息
    await getVaultInfo(vaultPda);
    
  } catch (error) {
    console.error("❌ 初始化测试失败:", error);
  }
}

// 导出函数
export {
  generateVaultPDA,
  initializeVault,
  depositToken,
  getBalance,
  getVaultInfo,
  setBot,
  setAdmin,
  testInitialize,
  TEST_ADDRESSES
};

// 运行测试
testInitialize(); 