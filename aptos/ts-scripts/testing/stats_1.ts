import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";
import { createAptosClient, createAccountFromPrivateKey } from "../utils";
import { CONTRACT_ADDRESS } from "../config";

/**
 * 统计数据结构
 */
interface FactoryStats {
  factoryAddress: string;
  balanceManagerCount: number;
  totalTransactions: number;
  totalVolumeAPT: number;
  totalVolumeUSDC: number;
  uniqueAddresses: Set<string>;
  transactionDetails: TransactionDetail[];
}

interface TransactionDetail {
  address: string;
  transactionHash: string;
  type: 'create_balance_manager' | 'deposit' | 'trade_signal' | 'withdraw';
  amount?: number;
  token?: string;
  timestamp: Date;
}

/**
 * 检查地址是否已创建余额管理器
 */
async function checkBalanceManagerExists(
  aptos: Aptos,
  userAddress: string,
  factoryAddress: string
): Promise<boolean> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: userAddress,
      resourceType: `${factoryAddress}::vault::BalanceManager`,
    });
    return !!resource;
  } catch (error) {
    return false;
  }
}

/**
 * 从链上获取所有与 factory 相关的交易
 */
async function getAllFactoryTransactions(
  aptos: Aptos,
  factoryAddress: string
): Promise<{ transactions: TransactionDetail[], uniqueAddresses: Set<string> }> {
  console.log(`正在从链上获取 factory ${factoryAddress} 的所有交易...`);
  
  const allTransactions: TransactionDetail[] = [];
  const uniqueAddresses = new Set<string>();
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`获取交易批次，偏移量: ${offset}`);
      
      // 使用 GraphQL 查询获取与 factory 相关的交易
      const query = `
        query GetFactoryTransactions($factory: String!, $limit: Int!, $offset: Int!) {
          user_transactions(
            where: {
              entry_function_id_str: { _like: $factory }
            }
            limit: $limit
            offset: $offset
            order_by: { version: desc }
          ) {
            version
            hash
            sender
            timestamp
            entry_function_id_str
            entry_function_id_str_short
            payload
          }
        }
      `;

      const variables = {
        factory: `${factoryAddress}::%`,
        limit,
        offset
      };

      try {
        // 使用 Aptos GraphQL API
        const response = await fetch('https://api.mainnet.aptoslabs.com/v1/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables
          })
        });

        if (!response.ok) {
          console.log(`GraphQL 请求失败: ${response.status}`);
          break;
        }

        const data = await response.json();
        const transactions = data.data?.user_transactions || [];

        if (transactions.length === 0) {
          hasMore = false;
          break;
        }

        // 处理每个交易
        for (const tx of transactions) {
          const senderAddress = tx.sender;
          uniqueAddresses.add(senderAddress);

          let transactionType: TransactionDetail['type'];
          let amount: number | undefined;
          let token: string | undefined;

          const functionName = tx.entry_function_id_str || '';

          if (functionName.includes("::vault::create_balance_manager")) {
            transactionType = 'create_balance_manager';
          } else if (functionName.includes("::vault::user_deposit")) {
            transactionType = 'deposit';
            // 尝试从 payload 中解析金额
            try {
              const payload = JSON.parse(tx.payload || '{}');
              if (payload.arguments && payload.arguments.length > 1) {
                amount = parseInt(payload.arguments[1]);
                const metadata = payload.arguments[0];
                token = metadata.includes("aptos_coin") ? "APT" : "USDC";
              }
            } catch (e) {
              // 解析失败，跳过金额信息
            }
          } else if (functionName.includes("::vault::trade_signal")) {
            transactionType = 'trade_signal';
          } else if (functionName.includes("::vault::user_withdraw")) {
            transactionType = 'withdraw';
            try {
              const payload = JSON.parse(tx.payload || '{}');
              if (payload.arguments && payload.arguments.length > 1) {
                amount = parseInt(payload.arguments[1]);
                const metadata = payload.arguments[0];
                token = metadata.includes("aptos_coin") ? "APT" : "USDC";
              }
            } catch (e) {
              // 解析失败，跳过金额信息
            }
          } else {
            continue; // 跳过不相关的交易
          }

          allTransactions.push({
            address: senderAddress,
            transactionHash: tx.hash,
            type: transactionType,
            amount,
            token,
            timestamp: new Date(parseInt(tx.timestamp) / 1000)
          });
        }

        offset += limit;
        
        // 添加延迟避免 API 限制
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.log(`GraphQL 查询失败: ${error}`);
        // 如果 GraphQL 失败，尝试使用 REST API 的替代方法
        console.log("尝试使用 REST API 获取交易...");
        
        try {
          // 使用 REST API 获取最近的交易
          const restResponse = await fetch(`https://api.mainnet.aptoslabs.com/v1/transactions?limit=${limit}&start=${offset}`);
          if (restResponse.ok) {
            const restTransactions = await restResponse.json();
            
            for (const tx of restTransactions) {
              if (tx.type !== "user_transaction" || !tx.payload) continue;
              
              const payload = tx.payload;
              if (payload.type !== "entry_function_payload") continue;
              
              const functionName = payload.function;
              if (!functionName.startsWith(factoryAddress)) continue;
              
              const senderAddress = tx.sender;
              uniqueAddresses.add(senderAddress);
              
              let transactionType: TransactionDetail['type'];
              let amount: number | undefined;
              let token: string | undefined;
              
              if (functionName.includes("::vault::create_balance_manager")) {
                transactionType = 'create_balance_manager';
              } else if (functionName.includes("::vault::user_deposit")) {
                transactionType = 'deposit';
                if (payload.arguments && payload.arguments.length > 1) {
                  amount = parseInt(payload.arguments[1]);
                  const metadata = payload.arguments[0];
                  token = metadata.includes("aptos_coin") ? "APT" : "USDC";
                }
              } else if (functionName.includes("::vault::trade_signal")) {
                transactionType = 'trade_signal';
              } else if (functionName.includes("::vault::user_withdraw")) {
                transactionType = 'withdraw';
                if (payload.arguments && payload.arguments.length > 1) {
                  amount = parseInt(payload.arguments[1]);
                  const metadata = payload.arguments[0];
                  token = metadata.includes("aptos_coin") ? "APT" : "USDC";
                }
              } else {
                continue;
              }
              
              allTransactions.push({
                address: senderAddress,
                transactionHash: tx.hash,
                type: transactionType,
                amount,
                token,
                timestamp: new Date(parseInt(tx.timestamp) / 1000)
              });
            }
            
            if (restTransactions.length < limit) {
              hasMore = false;
            }
          } else {
            console.log("REST API 也失败了，停止获取交易");
            hasMore = false;
          }
        } catch (restError) {
          console.log(`REST API 查询失败: ${restError}`);
          hasMore = false;
        }
        break;
      }
    }

    console.log(`总共发现 ${allTransactions.length} 笔相关交易，涉及 ${uniqueAddresses.size} 个唯一地址`);
    return { transactions: allTransactions, uniqueAddresses };

  } catch (error) {
    console.log(`获取 factory 交易失败: ${error}`);
    return { transactions: [], uniqueAddresses: new Set() };
  }
}

/**
 * 分析 factory 的统计数据
 */
async function analyzeFactory(
  factoryAddress: string
): Promise<FactoryStats> {
  const aptos = createAptosClient();
  
  // 从链上获取所有相关交易
  const { transactions, uniqueAddresses } = await getAllFactoryTransactions(aptos, factoryAddress);
  
  const stats: FactoryStats = {
    factoryAddress,
    balanceManagerCount: 0,
    totalTransactions: transactions.length,
    totalVolumeAPT: 0,
    totalVolumeUSDC: 0,
    uniqueAddresses,
    transactionDetails: transactions
  };

  console.log(`\n开始分析发现的 ${uniqueAddresses.size} 个地址的余额管理器状态...`);

  // 统计交易量
  for (const tx of transactions) {
    if (tx.amount && tx.token) {
      if (tx.token === 'APT') {
        stats.totalVolumeAPT += tx.amount;
      } else if (tx.token === 'USDC') {
        stats.totalVolumeUSDC += tx.amount;
      }
    }
  }

  // 检查每个地址是否创建了余额管理器
  let addressIndex = 0;
  for (const address of uniqueAddresses) {
    addressIndex++;
    console.log(`检查地址 ${addressIndex}/${uniqueAddresses.size}: ${address.slice(0, 10)}...${address.slice(-8)}`);
    
    try {
      const hasBalanceManager = await checkBalanceManagerExists(aptos, address, factoryAddress);
      if (hasBalanceManager) {
        stats.balanceManagerCount++;
        console.log(`  ✓ 已创建余额管理器`);
      } else {
        console.log(`  ✗ 未创建余额管理器`);
      }
      
      // 等待一段时间避免API限制
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`  - 检查失败: ${error}`);
    }
  }

  return stats;
}

/**
 * 打印统计报告
 */
function printStatsReport(stats: FactoryStats) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 APTOS VAULT 统计报告");
  console.log("=".repeat(60));
  
  console.log(`\n🏭 Factory 地址: ${stats.factoryAddress}`);
  console.log(`\n📈 总体统计:`);
  console.log(`  • 创建余额管理器的地址数: ${stats.balanceManagerCount}`);
  console.log(`  • 活跃地址总数: ${stats.uniqueAddresses.size}`);
  console.log(`  • 总交易笔数: ${stats.totalTransactions}`);
  console.log(`  • APT 总交易量: ${(stats.totalVolumeAPT / 100000000).toFixed(6)} APT`);
  console.log(`  • USDC 总交易量: ${(stats.totalVolumeUSDC / 1000000).toFixed(6)} USDC`);

  // 按交易类型统计
  const txTypeStats = new Map<string, number>();
  for (const tx of stats.transactionDetails) {
    txTypeStats.set(tx.type, (txTypeStats.get(tx.type) || 0) + 1);
  }

  console.log(`\n📋 交易类型分布:`);
  for (const [type, count] of txTypeStats.entries()) {
    console.log(`  • ${type}: ${count} 笔`);
  }

  // 按地址统计
  const addressStats = new Map<string, number>();
  for (const tx of stats.transactionDetails) {
    addressStats.set(tx.address, (addressStats.get(tx.address) || 0) + 1);
  }

  console.log(`\n👥 地址活跃度 (前10名):`);
  const sortedAddresses = Array.from(addressStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [address, count] of sortedAddresses) {
    console.log(`  • ${address.slice(0, 10)}...${address.slice(-8)}: ${count} 笔交易`);
  }

  console.log("\n" + "=".repeat(60));
}

/**
 * 主函数 - 分析 factory 的统计数据
 */
export async function runStatsAnalysis(
  factoryAddress?: string
): Promise<FactoryStats> {
  try {
    const factory = factoryAddress || CONTRACT_ADDRESS;
    console.log("开始执行 Aptos Vault 统计分析...");
    console.log(`Factory 地址: ${factory}`);
    
    const stats = await analyzeFactory(factory);
    printStatsReport(stats);
    
    return stats;
  } catch (error) {
    console.error("统计分析失败:", error);
    throw error;
  }
}

/**
 * 示例用法 - 分析 factory 的统计数据
 */
async function main() {
  // 可以指定特定的 factory 地址，或使用默认配置
  const customFactoryAddress = undefined; // 设置为具体地址或 undefined 使用默认
  
  await runStatsAnalysis(customFactoryAddress);
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}
