import { Aptos, AccountAddress } from "@aptos-labs/ts-sdk";
import { USER_PRIVATE_KEY } from "../config";
import { createAptosClient, createAccountFromPrivateKey, getContractAddress } from "../utils/common";

/**
 * 查询用户在金库中的余额
 * 
 * @param userAddress 用户地址，如果不提供则使用环境变量中的用户地址
 * @returns 用户在金库中的余额信息，格式为 { [coinType: string]: { amount: string, metadata?: TokenMetadata } }
 */
interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  supply?: string;
}

interface BalanceInfo {
  amount: string;
  metadata?: TokenMetadata;
  metadataObjectId?: string;
}

async function getBalances(userAddress?: string): Promise<Record<string, BalanceInfo>> {
  try {
    // 创建 Aptos 客户端
    const aptos = createAptosClient();
    
    // 如果没有提供用户地址，则使用环境变量中的用户地址
    let address: string;
    if (userAddress) {
      address = userAddress;
    } else {
      const user = createAccountFromPrivateKey(USER_PRIVATE_KEY);
      address = user.accountAddress.toString();
    }
    
    console.log(`查询用户地址: ${address} 的余额`);
    
    // 获取用户的 BalanceManager 资源
    const contractAddress = getContractAddress();
    // 使用类型断言来确保类型正确
    const balanceManagerType = `${contractAddress}::vault::BalanceManager` as `${string}::${string}::${string}`;
    
    try {
      const resource = await aptos.getAccountResource({
        accountAddress: address,
        resourceType: balanceManagerType,
      });
      
      console.log("余额管理器信息:");
      console.log(JSON.stringify(resource, null, 2));
      
      // 从资源中提取余额信息
      const data = resource as any;
      const result: Record<string, BalanceInfo> = {};
      
      if (data.balances && data.balances.data && Array.isArray(data.balances.data)) {
        console.log("\n用户余额:");
        console.log("----------------------------------------");
        
        // 遍历并打印每种代币的余额
        for (const entry of data.balances.data) {
          if (entry && entry.key && entry.value) {
            const metadataObjectId = entry.key.inner; // 注意这里需要访问 inner 属性
            const amount = entry.value;
            
            // 直接使用 metadataObjectId 作为键，简化处理
            console.log(`\n元数据对象ID: ${metadataObjectId}`);
            console.log(`余额: ${amount}`);
            console.log(`----------------------------------------`);
            
            result[metadataObjectId] = { 
              amount: amount.toString(),
              metadataObjectId: metadataObjectId 
            };
          }
        }
        
        console.log("\n使用说明:");
        console.log("存款命令: pnpm ts-node core/depositCoins.ts <代币类型> <金额>");
        console.log("提款命令: pnpm ts-node core/withdrawCoins.ts <代币类型> <金额>");
        console.log("例如: pnpm ts-node core/depositCoins.ts 0x1::aptos_coin::AptosCoin 1000000");
        
        return result;
      } else {
        console.log("无法解析余额管理器数据");
        return {};
      }
    } catch (error) {
      console.log(`用户 ${address} 没有初始化余额管理器`);
      return {};
    }
  } catch (error) {
    console.error("查询余额失败:", error);
    return {};
  }
}

// 如果直接运行脚本，从命令行参数获取参数
if (require.main === module) {
  const args = process.argv.slice(2);
  const userAddress = args[0]; // 可选参数
  
  getBalances(userAddress);
}

// 导出函数以便其他脚本使用
export { getBalances };
