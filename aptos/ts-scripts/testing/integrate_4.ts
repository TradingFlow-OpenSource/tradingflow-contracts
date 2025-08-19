import { Aptos, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import {
  createAptosClient,
  createAccountFromPrivateKey,
  waitForTransaction,
} from "../utils";
import { USER_PRIVATE_KEY } from "../config";
import * as fs from "fs";
import * as path from "path";

/**
 * 资金回收脚本 - integrate_4
 * 从 generated_accounts.json 中读取所有生成的账户
 * 将剩余的 APT 和 USDC 全部转回基础账户
 */

interface SavedAccount {
  address: string;
  privateKey: string;
}

interface GeneratedAccount {
  account: Account;
  address: string;
  privateKey: string;
}

// 账户文件路径
const ACCOUNTS_FILE_PATH = path.join(__dirname, "generated_accounts.json");

// Gas 费用预留 (APT) - 增加到0.1以确保有足够的gas费用
const GAS_RESERVE = 0.1;

/**
 * 获取账户的原生代币余额
 */
async function getNativeBalances(
  address: string
): Promise<{ apt: number; usdc: number }> {
  try {
    const aptos = createAptosClient();

    // 获取 APT 余额
    const aptBalance = await aptos.getAccountAPTAmount({
      accountAddress: address,
    });

    // 获取 USDC 余额 (使用 primary fungible store)
    const usdcAddress =
      "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";
    let usdcBalance = 0;

    try {
      const usdcResource = await aptos.getCurrentFungibleAssetBalances({
        options: {
          where: {
            owner_address: { _eq: address },
            asset_type: { _eq: usdcAddress },
          },
        },
      });

      if (usdcResource && usdcResource.length > 0) {
        usdcBalance = parseInt(usdcResource[0].amount) / 1000000; // USDC has 6 decimals
      }
    } catch (error) {
      // USDC balance query failed, assume 0
      usdcBalance = 0;
    }

    return {
      apt: aptBalance / 100000000, // APT has 8 decimals
      usdc: usdcBalance,
    };
  } catch (error) {
    console.error(`获取余额失败 (${address}):`, error);
    return { apt: 0, usdc: 0 };
  }
}

/**
 * 从文件加载已保存的账户
 */
function loadSavedAccounts(): GeneratedAccount[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE_PATH)) {
      console.log("账户文件不存在，无法进行资金回收");
      return [];
    }

    const fileContent = fs.readFileSync(ACCOUNTS_FILE_PATH, "utf-8");
    const savedAccounts: SavedAccount[] = JSON.parse(fileContent);

    console.log(`从文件加载了 ${savedAccounts.length} 个账户`);

    return savedAccounts.map((saved) => {
      const privateKey = new Ed25519PrivateKey(saved.privateKey);
      const account = Account.fromPrivateKey({ privateKey });

      return {
        account,
        address: saved.address,
        privateKey: saved.privateKey,
      };
    });
  } catch (error) {
    console.error("加载账户文件失败:", error);
    return [];
  }
}

/**
 * 转移 APT 到基础账户
 */
async function transferAPT(
  fromAccount: Account,
  toAddress: string,
  amount: number
): Promise<boolean> {
  try {
    const aptos = createAptosClient();

    console.log(
      `转移 ${amount} APT 从 ${fromAccount.accountAddress.toString()} 到 ${toAddress}`
    );

    const transaction = await aptos.transaction.build.simple({
      sender: fromAccount.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [toAddress, Math.floor(amount * 100000000)], // 转换为 octas
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: fromAccount,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    console.log(`✅ APT 转移成功，交易哈希: ${pendingTxn.hash}`);
    return true;
  } catch (error) {
    console.error(`❌ APT 转移失败:`, error);
    return false;
  }
}

/**
 * 转移 USDC 到基础账户
 */
async function transferUSDC(
  fromAccount: Account,
  toAddress: string,
  amount: number
): Promise<boolean> {
  try {
    const aptos = createAptosClient();
    const usdcAddress =
      "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

    console.log(
      `转移 ${amount} USDC 从 ${fromAccount.accountAddress.toString()} 到 ${toAddress}`
    );

    const transaction = await aptos.transaction.build.simple({
      sender: fromAccount.accountAddress,
      data: {
        function: "0x1::primary_fungible_store::transfer",
        functionArguments: [
          usdcAddress,
          toAddress,
          Math.floor(amount * 1000000),
        ], // USDC 6位小数
        typeArguments: ["0x1::fungible_asset::Metadata"],
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: fromAccount,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    console.log(`✅ USDC 转移成功，交易哈希: ${pendingTxn.hash}`);
    return true;
  } catch (error) {
    console.error(`❌ USDC 转移失败:`, error);
    return false;
  }
}

/**
 * 主要的资金回收函数
 */
async function recoverFunds() {
  try {
    console.log("🚀 开始执行资金回收...");

    // 加载生成的账户
    const generatedAccounts = loadSavedAccounts();
    if (generatedAccounts.length === 0) {
      console.log("没有找到需要回收的账户");
      return;
    }

    // 创建基础账户
    const baseAccount = createAccountFromPrivateKey(USER_PRIVATE_KEY);
    const baseAddress = baseAccount.accountAddress.toString();
    console.log(`基础账户地址: ${baseAddress}`);

    // 检查基础账户初始余额
    console.log("\n📊 基础账户初始余额:");
    const initialBaseBalances = await getNativeBalances(baseAddress);
    console.log(
      `APT: ${initialBaseBalances.apt}, USDC: ${initialBaseBalances.usdc}`
    );

    let totalRecoveredAPT = 0;
    let totalRecoveredUSDC = 0;
    let successfulTransfers = 0;

    // 遍历每个生成的账户进行资金回收
    for (let i = 0; i < generatedAccounts.length; i++) {
      const genAccount = generatedAccounts[i];
      console.log(`\n💰 处理账户 ${i + 1}: ${genAccount.address}`);

      // 检查账户余额
      const balances = await getNativeBalances(genAccount.address);
      console.log(`当前余额 - APT: ${balances.apt}, USDC: ${balances.usdc}`);

      // 转移 APT (保留 Gas 费用)
      if (balances.apt > GAS_RESERVE) {
        const transferAmount = balances.apt - GAS_RESERVE;
        const success = await transferAPT(
          genAccount.account,
          baseAddress,
          transferAmount
        );
        if (success) {
          totalRecoveredAPT += transferAmount;
          successfulTransfers++;
        }

        // 等待一下再处理下一个转账
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.log(
          `⚠️  APT 余额不足，跳过转移 (余额: ${balances.apt}, 需要保留: ${GAS_RESERVE})`
        );
      }

      // 转移 USDC
      if (balances.usdc > 0) {
        const success = await transferUSDC(
          genAccount.account,
          baseAddress,
          balances.usdc
        );
        if (success) {
          totalRecoveredUSDC += balances.usdc;
        }

        // 等待一下再处理下一个转账
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 检查基础账户最终余额
    console.log("\n📊 基础账户最终余额:");
    const finalBaseBalances = await getNativeBalances(baseAddress);
    console.log(
      `APT: ${finalBaseBalances.apt}, USDC: ${finalBaseBalances.usdc}`
    );

    // 统计报告
    console.log("\n📈 资金回收统计报告:");
    console.log(`处理账户数量: ${generatedAccounts.length}`);
    console.log(`成功转账次数: ${successfulTransfers}`);
    console.log(`总回收 APT: ${totalRecoveredAPT.toFixed(6)}`);
    console.log(`总回收 USDC: ${totalRecoveredUSDC.toFixed(6)}`);
    console.log(
      `APT 余额增加: ${(
        finalBaseBalances.apt - initialBaseBalances.apt
      ).toFixed(6)}`
    );
    console.log(
      `USDC 余额增加: ${(
        finalBaseBalances.usdc - initialBaseBalances.usdc
      ).toFixed(6)}`
    );

    console.log("\n✅ 资金回收完成!");
  } catch (error) {
    console.error("❌ 资金回收过程中出现错误:", error);
  }
}

// 执行资金回收
if (require.main === module) {
  recoverFunds().catch(console.error);
}

export { recoverFunds };
