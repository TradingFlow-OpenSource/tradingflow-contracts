import { Aptos, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { createAptosClient, createAccountFromPrivateKey, waitForTransaction } from "../utils";
import { CONTRACT_ADDRESS, USER_PRIVATE_KEY, ADMIN_PRIVATE_KEY } from "../config";
import { getBalances } from "../core/getBalances";
import { tradeSignal } from "../core/tradeSignal";
import * as fs from "fs";
import * as path from "path";

// 常量定义
const TOKEN_METADATA = {
  APT: "0xa",
  USDC: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
};

// 账户文件路径
const ACCOUNTS_FILE_PATH = path.join(__dirname, "generated_accounts.json");

/**
 * 综合测试脚本 3 - Aptos Camp 交易生成
 * 这个脚本为 Aptos 全球 camp 生成初始交易：
 * 1. 生成 12 个新的 Aptos 地址
 * 2. 从 USER_PRIVATE_KEY 给每个地址分配 0.1 APT
 * 3. 每个地址随机进行 1-2 笔 APT->USDC 的 Hyperion swap 交易
 */

interface GeneratedAccount {
  account: Account;
  address: string;
  privateKey: string;
}

interface SavedAccount {
  address: string;
  privateKey: string;
}

/**
 * 从文件加载已保存的账户
 */
function loadSavedAccounts(): GeneratedAccount[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE_PATH)) {
      console.log("账户文件不存在，将生成新账户");
      return [];
    }

    const fileContent = fs.readFileSync(ACCOUNTS_FILE_PATH, 'utf-8');
    const savedAccounts: SavedAccount[] = JSON.parse(fileContent);
    
    console.log(`从文件加载了 ${savedAccounts.length} 个账户`);
    
    return savedAccounts.map(saved => {
      const privateKey = new Ed25519PrivateKey(saved.privateKey);
      const account = Account.fromPrivateKey({ privateKey });
      
      return {
        account,
        address: saved.address,
        privateKey: saved.privateKey
      };
    });
  } catch (error) {
    console.error("加载账户文件失败:", error);
    return [];
  }
}

/**
 * 保存账户到文件（追加模式）
 */
function saveAccountsToFile(accounts: GeneratedAccount[], append: boolean = true): void {
  try {
    let existingAccounts: SavedAccount[] = [];
    
    // 如果是追加模式且文件存在，先读取现有账户
    if (append && fs.existsSync(ACCOUNTS_FILE_PATH)) {
      const fileContent = fs.readFileSync(ACCOUNTS_FILE_PATH, 'utf-8');
      existingAccounts = JSON.parse(fileContent);
    }
    
    // 转换新账户为保存格式
    const newSavedAccounts: SavedAccount[] = accounts.map(acc => ({
      address: acc.address,
      privateKey: acc.privateKey
    }));
    
    // 合并账户（去重）
    const allAccounts = [...existingAccounts];
    for (const newAcc of newSavedAccounts) {
      if (!existingAccounts.some(existing => existing.address === newAcc.address)) {
        allAccounts.push(newAcc);
      }
    }
    
    // 保存到文件
    fs.writeFileSync(ACCOUNTS_FILE_PATH, JSON.stringify(allAccounts, null, 2));
    console.log(`已保存 ${allAccounts.length} 个账户到文件: ${ACCOUNTS_FILE_PATH}`);
    
  } catch (error) {
    console.error("保存账户文件失败:", error);
  }
}

/**
 * 生成指定数量的 Aptos 账户
 */
function generateAptosAccounts(count: number): GeneratedAccount[] {
  const accounts: GeneratedAccount[] = [];

  for (let i = 0; i < count; i++) {
    // 生成新的私钥和账户
    const privateKey = new Ed25519PrivateKey(
      Ed25519PrivateKey.generate().toString()
    );
    const account = Account.fromPrivateKey({ privateKey });

    accounts.push({
      account,
      address: account.accountAddress.toString(),
      privateKey: privateKey.toString(),
    });
  }

  return accounts;
}

/**
 * 检查账户余额
 */
async function checkAccountBalance(
  aptos: Aptos,
  address: string
): Promise<number> {
  try {
    const balance = await aptos.getAccountCoinAmount({
      accountAddress: address,
      coinType: "0x1::aptos_coin::AptosCoin",
    });
    return Number(balance);
  } catch (error) {
    console.log(`查询地址 ${address} 余额失败:`, error);
    return 0;
  }
}

/**
 * 转账 APT 到指定地址
 */
async function transferAPT(
  aptos: Aptos,
  fromAccount: Account,
  toAddress: string,
  amount: number
): Promise<boolean> {
  try {
    console.log(`转账 ${amount / 100000000} APT 到 ${toAddress}`);

    const transaction = await aptos.transferCoinTransaction({
      sender: fromAccount.accountAddress,
      recipient: toAddress,
      amount: amount,
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: fromAccount,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    console.log(`转账成功，交易哈希: ${pendingTxn.hash}`);
    return true;
  } catch (error) {
    console.error(`转账失败:`, error);
    return false;
  }
}

/**
 * 检查用户是否已创建余额管理器
 */
async function checkBalanceManagerExists(
  aptos: Aptos,
  userAddress: string
): Promise<boolean> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: userAddress,
      resourceType: `${CONTRACT_ADDRESS}::vault::BalanceManager`,
    });
    return !!resource;
  } catch (error) {
    return false;
  }
}

/**
 * 为指定账户创建余额管理器
 */
async function createBalanceManagerForAccount(
  account: Account
): Promise<boolean> {
  try {
    console.log(`为地址 ${account.accountAddress.toString()} 创建余额管理器`);

    // 直接调用余额管理器创建逻辑
    const aptos = createAptosClient();

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::vault::create_balance_manager`,
        functionArguments: [],
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    console.log(`余额管理器创建成功，交易哈希: ${pendingTxn.hash}`);
    return true;
  } catch (error) {
    console.log(`余额管理器创建失败: ${error}`);
    return false;
  }
}

/**
 * 为指定账户执行存款操作
 */
async function depositCoinsForAccount(
  account: Account,
  tokenSymbol: string,
  amount: number
): Promise<boolean> {
  try {
    const aptos = createAptosClient();
    const metadataId =
      TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::vault::user_deposit`,
        functionArguments: [metadataId, amount],
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    return true;
  } catch (error) {
    console.log(`存款失败: ${error}`);
    return false;
  }
}

/**
 * 为指定账户执行提款操作
 */
async function withdrawCoinsForAccount(
  account: Account,
  tokenSymbol: string,
  amount: number
): Promise<boolean> {
  try {
    const aptos = createAptosClient();
    const metadataId =
      TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];

    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::vault::user_withdraw`,
        functionArguments: [metadataId, amount],
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    return true;
  } catch (error) {
    console.log(`提款失败: ${error}`);
    return false;
  }
}

/**
 * 管理员为指定用户执行交换信号
 */
async function tradeSignalForUser(
  userAddress: string,
  fromToken: string,
  toToken: string,
  amount: number
): Promise<boolean> {
  try {
    const aptos = createAptosClient();
    const adminAccount = createAccountFromPrivateKey(ADMIN_PRIVATE_KEY);

    const fromTokenMetadataId =
      TOKEN_METADATA[fromToken as keyof typeof TOKEN_METADATA];
    const toTokenMetadataId =
      TOKEN_METADATA[toToken as keyof typeof TOKEN_METADATA];

    // 设置交换参数
    const feeTier = 1; // 费率等级
    const amountOutMin = 0; // 最小输出金额 (无滑点保护，仅用于测试)
    const sqrtPriceLimit = "4295128740";
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
    const feeRecipient = adminAccount.accountAddress.toString(); // 手续费收款人
    const feeRate = 1000; // 0.1% 手续费

    const transaction = await aptos.transaction.build.simple({
      sender: adminAccount.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::vault::send_trade_signal`,
        functionArguments: [
          userAddress,
          fromTokenMetadataId,
          toTokenMetadataId,
          feeTier,
          amount,
          amountOutMin,
          sqrtPriceLimit,
          deadline,
          feeRecipient,
          feeRate,
        ],
      },
    });

    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: adminAccount,
      transaction,
    });

    await waitForTransaction(aptos, pendingTxn.hash);
    return true;
  } catch (error) {
    console.log(`交换信号失败: ${error}`);
    return false;
  }
}

/**
 * 执行完整的 balance manager 操作流程: 存款 → 交换 → 提款
 */
async function executeTestTransaction(
  aptos: Aptos,
  account: Account,
  amountIn: number
): Promise<boolean> {
  try {
    const address = account.accountAddress.toString();
    console.log(
      `地址 ${address} 开始 balance manager 操作流程，存款金额: ${
        amountIn / 100000000
      } APT`
    );

    // 步骤 1: 存款到 balance manager
    console.log(`步骤 1: 存款 ${amountIn / 100000000} APT 到 balance manager`);
    const depositSuccess = await depositCoinsForAccount(
      account,
      "APT",
      amountIn
    );
    if (!depositSuccess) {
      console.log(`存款失败，跳过后续操作`);
      return false;
    }
    console.log(`存款成功`);

    // 等待一段时间
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 步骤 2: 执行交换信号 (APT -> USDC)
    console.log(`步骤 2: 执行交换信号 APT -> USDC`);
    const tradeSuccess = await tradeSignalForUser(
      address,
      "APT",
      "USDC",
      amountIn
    );
    if (!tradeSuccess) {
      console.log(`交换信号失败，继续尝试提款`);
    } else {
      console.log(`交换信号成功`);
    }

    // 等待一段时间
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 步骤 3: 提款 (使用 getBalances 精准提取所有余额)
    console.log(`步骤 3: 提款所有余额`);

    try {
      const address = account.accountAddress.toString();
      console.log(`查询地址 ${address} 的余额管理器状态`);

      // 使用 getBalances 查询精确余额
      const balances = await getBalances(address);

      // 提取所有非零余额
      for (const [tokenId, balanceInfo] of Object.entries(balances)) {
        const amount = Number(balanceInfo.amount);
        if (amount > 0) {
          let tokenSymbol = "Unknown";

          // 根据 metadataObjectId 识别代币类型
          if (balanceInfo.metadataObjectId === TOKEN_METADATA.APT) {
            tokenSymbol = "APT";
          } else if (balanceInfo.metadataObjectId === TOKEN_METADATA.USDC) {
            tokenSymbol = "USDC";
          }

          console.log(
            `尝试提取 ${tokenSymbol}: ${amount} (${
              amount / (tokenSymbol === "USDC" ? 1000000 : 100000000)
            })`
          );

          try {
            await withdrawCoinsForAccount(account, tokenSymbol, amount);
            console.log(`${tokenSymbol} 提款成功`);
          } catch (error) {
            console.log(`${tokenSymbol} 提款失败: ${error}`);
          }
        }
      }
    } catch (error) {
      console.log(`查询余额失败，使用备用提款方式: ${error}`);

      // 备用方案：尝试提取常见代币
      if (tradeSuccess) {
        try {
          console.log(`尝试提取 USDC`);
          await withdrawCoinsForAccount(account, "USDC", 0);
          console.log(`USDC 提款成功`);
        } catch (error) {
          console.log(`USDC 提款失败: ${error}`);
        }
      }

      try {
        console.log(`尝试提取剩余 APT`);
        await withdrawCoinsForAccount(account, "APT", 0);
        console.log(`APT 提款成功`);
      } catch (error) {
        console.log(`APT 提款失败: ${error}`);
      }
    }

    console.log(`balance manager 操作流程完成`);
    return true;
  } catch (error) {
    console.error(`balance manager 操作失败:`, error);
    return false;
  }
}

/**
 * 为单个账户执行随机测试交易
 */
async function executeRandomTransactionsForAccount(
  aptos: Aptos,
  generatedAccount: GeneratedAccount
): Promise<void> {
  const { account, address } = generatedAccount;

  // 检查账户余额
  const balance = await checkAccountBalance(aptos, address);
  if (balance < 10000) {
    // 少于 0.0001 APT
    console.log(`地址 ${address} 余额不足，跳过交易`);
    return;
  }

  // 步骤 1: 检查并创建余额管理器
  console.log(`\n检查地址 ${address} 的余额管理器状态`);
  const hasBalanceManager = await checkBalanceManagerExists(aptos, address);

  if (!hasBalanceManager) {
    console.log(`余额管理器不存在，正在创建...`);
    const created = await createBalanceManagerForAccount(account);
    if (!created) {
      console.log(`余额管理器创建失败，跳过后续操作`);
      return;
    }
    // 等待一段时间确保创建完成
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } else {
    console.log(`余额管理器已存在`);
  }

  // 步骤 2: 执行随机测试交易
  const numTransactions = Math.floor(Math.random() * 2) + 1; // 1 或 2

  for (let i = 0; i < numTransactions; i++) {
    // 使用较大的金额进行测试，确保swap能够成功执行
    const randomAmount = Math.floor(Math.random() * 50000000) + 10000000; // 10000000-60000000 octa (0.1-0.6 APT)
    console.log(
      `第 ${i + 1} 笔测试交易，金额: ${randomAmount / 100000000} APT`
    );

    const success = await executeTestTransaction(aptos, account, randomAmount);
    if (!success) {
      console.log(`测试交易失败，停止后续交易`);
      break;
    }

    // 等待一段时间再进行下一笔交易
    if (i < numTransactions - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * 主函数
 */
async function runIntegrationTest3() {
  try {
    console.log("开始执行 Aptos Camp 交易生成测试...");

    // 创建 Aptos 客户端
    const aptos = createAptosClient();

    // 创建用户账户 (资金来源)
    const userAccount = createAccountFromPrivateKey(USER_PRIVATE_KEY);
    const userAddress = userAccount.accountAddress.toString();

    console.log(`资金来源地址: ${userAddress}`);

    // 最近一次生成的地址和私钥（避免重新生成丢失余额）
    // const EXISTING_ACCOUNTS = [
    //   {
    //     address:
    //       "",
    //     privateKey:
    //       "ed25519-priv-",
    //   },
    // ];

    // 步骤 1: 使用现有地址或生成新地址
    console.log("\n步骤 1: 生成3个全新的测试地址");
    
    // 尝试加载现有账户，如果没有则生成新账户
    let generatedAccounts: GeneratedAccount[] = loadSavedAccounts();
    
    if (generatedAccounts.length === 0) {
      console.log("没有找到现有账户，生成3个新账户...");
      generatedAccounts = generateAptosAccounts(3);
      // 保存新生成的账户
      saveAccountsToFile(generatedAccounts, true);
    } else {
      console.log(`使用现有的 ${generatedAccounts.length} 个账户`);
      // 如果现有账户少于3个，可以选择生成更多
      if (generatedAccounts.length < 3) {
        const additionalCount = 3 - generatedAccounts.length;
        console.log(`生成额外的 ${additionalCount} 个账户...`);
        const newAccounts = generateAptosAccounts(additionalCount);
        generatedAccounts.push(...newAccounts);
        // 追加保存新账户
        saveAccountsToFile(newAccounts, true);
      }
    }

    console.log("\n生成的地址信息:");
    generatedAccounts.forEach((acc, index) => {
      console.log(`地址 ${index + 1}: ${acc.address}`);
      console.log(`私钥 ${index + 1}: ${acc.privateKey}`);
      console.log("---");
    });

    // 步骤 2: 检查用户余额
    console.log("\n步骤 2: 检查资金来源余额");
    const userBalance = await checkAccountBalance(aptos, userAddress);
    console.log(`用户余额: ${userBalance / 100000000} APT`);

    const totalNeeded = 1 * 110000000; // 1 * 1.1 APT (包含缓冲)
    if (userBalance < totalNeeded) {
      console.error(
        `余额不足！需要 ${totalNeeded / 100000000} APT，但只有 ${
          userBalance / 100000000
        } APT`
      );
      return;
    }

    // 步骤 3: 资金分配（确保测试地址有足够余额）
    console.log("\n步骤 3: 资金分配");

    for (let i = 0; i < generatedAccounts.length; i++) {
      const targetAccount = generatedAccounts[i];
      const targetAddress = targetAccount.address;

      // 检查目标地址当前余额
      const currentBalance = await checkAccountBalance(aptos, targetAddress);
      console.log(`地址 ${i + 1} 当前余额: ${currentBalance / 100000000} APT`);

      // 如果余额不足1 APT，则转入1 APT
      const requiredBalance = 100000000; // 1 APT
      if (currentBalance < requiredBalance) {
        const transferAmount = requiredBalance - currentBalance + 10000000; // 额外加0.1 APT作为缓冲
        console.log(`向地址 ${i + 1} 转入 ${transferAmount / 100000000} APT`);

        try {
          const transaction = await aptos.transferCoinTransaction({
            sender: userAccount.accountAddress,
            recipient: targetAddress,
            amount: transferAmount,
          });

          const pendingTxn = await aptos.signAndSubmitTransaction({
            signer: userAccount,
            transaction,
          });

          await waitForTransaction(aptos, pendingTxn.hash);
          console.log(`转账成功，交易哈希: ${pendingTxn.hash}`);

          // 验证转账后余额
          const newBalance = await checkAccountBalance(aptos, targetAddress);
          console.log(`转账后余额: ${newBalance / 100000000} APT`);
        } catch (error) {
          console.error(`转账失败: ${error}`);
          return;
        }
      } else {
        console.log(`地址 ${i + 1} 余额充足，无需转账`);
      }
    }

    // 步骤 4: 为每个地址执行随机测试交易
    console.log("\n步骤 4: 为每个地址执行随机测试交易");

    for (let i = 0; i < generatedAccounts.length; i++) {
      const account = generatedAccounts[i];
      console.log(`\n=== 处理地址 ${i + 1} ===`);

      await executeRandomTransactionsForAccount(aptos, account);

      // 等待一段时间再处理下一个账户
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // 步骤 5: 资金回收 - 将剩余资金转回原始账户
    console.log("\n步骤 5: 资金回收");
    const gasReserve = 10000000; // 0.1 APT 作为 gas 费用预留（增加预留）

    for (let i = 0; i < generatedAccounts.length; i++) {
      const account = createAccountFromPrivateKey(
        generatedAccounts[i].privateKey
      );
      const address = account.accountAddress.toString();

      try {
        // 先回收 USDC (使用 Fungible Asset 转账)
        console.log(`检查地址 ${i + 1} 的 USDC 余额`);
        try {
          // 查询 USDC 余额 (使用 primary fungible store)
          const usdcAmount = await aptos.getCurrentFungibleAssetBalances({
            options: {
              where: {
                owner_address: { _eq: address },
                asset_type: { _eq: TOKEN_METADATA.USDC },
              },
            },
          });

          let currentUsdcBalance = 0;
          if (usdcAmount && usdcAmount.length > 0) {
            currentUsdcBalance = Number(usdcAmount[0].amount);
          }

          if (currentUsdcBalance > 0) {
            console.log(
              `发现 USDC 余额: ${
                currentUsdcBalance / 1000000
              } USDC，转回原始账户`
            );

            // 使用 Fungible Asset 转账
            const usdcTransaction = await aptos.transaction.build.simple({
              sender: account.accountAddress,
              data: {
                function: "0x1::primary_fungible_store::transfer",
                typeArguments: ["0x1::fungible_asset::Metadata"],
                functionArguments: [
                  TOKEN_METADATA.USDC,
                  userAddress,
                  currentUsdcBalance,
                ],
              },
            });

            const usdcPendingTxn = await aptos.signAndSubmitTransaction({
              signer: account,
              transaction: usdcTransaction,
            });

            await waitForTransaction(aptos, usdcPendingTxn.hash);
            console.log(`USDC 回收成功，交易哈希: ${usdcPendingTxn.hash}`);
          } else {
            console.log(`地址 ${i + 1} 没有 USDC 余额`);
          }
        } catch (error) {
          console.log(`地址 ${i + 1} USDC 回收失败: ${error}`);
        }

        // 等待一段时间再处理 APT
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 回收 APT
        const currentBalance = await aptos.getAccountAPTAmount({
          accountAddress: account.accountAddress,
        });

        console.log(
          `地址 ${i + 1} 当前 APT 余额: ${currentBalance / 100000000} APT`
        );

        if (currentBalance > gasReserve) {
          const transferAmount = currentBalance - gasReserve;
          console.log(`回收 ${transferAmount / 100000000} APT 到原始账户`);

          // 转账回原始账户
          const transaction = await aptos.transferCoinTransaction({
            sender: account.accountAddress,
            recipient: userAddress,
            amount: transferAmount,
          });

          const pendingTxn = await aptos.signAndSubmitTransaction({
            signer: account,
            transaction,
          });

          await waitForTransaction(aptos, pendingTxn.hash);
          console.log(`APT 回收成功，交易哈希: ${pendingTxn.hash}`);
        } else {
          console.log(
            `APT 余额不足，跳过回收 (余额: ${
              currentBalance / 100000000
            } APT < 预留: ${gasReserve / 100000000} APT)`
          );
        }
      } catch (error) {
        console.log(`地址 ${i + 1} 资金回收失败: ${error}`);
      }
    }

    // 步骤 6: 显示最终余额统计
    console.log("\n=== Aptos Camp 交易生成测试完成! ===");
    console.log("\n最终余额统计:");
    for (let i = 0; i < generatedAccounts.length; i++) {
      const account = createAccountFromPrivateKey(
        generatedAccounts[i].privateKey
      );
      const aptBalance = await aptos.getAccountAPTAmount({
        accountAddress: account.accountAddress,
      });

      // 检查 USDC 余额
      let usdcBalance = 0;
      try {
        const usdcAmount = await aptos.getCurrentFungibleAssetBalances({
          options: {
            where: {
              owner_address: { _eq: account.accountAddress.toString() },
              asset_type: { _eq: TOKEN_METADATA.USDC },
            },
          },
        });
        if (usdcAmount && usdcAmount.length > 0) {
          usdcBalance = Number(usdcAmount[0].amount);
        }
      } catch (error) {
        // USDC 余额为 0 或不存在
      }

      console.log(
        `地址 ${i + 1}: ${aptBalance / 100000000} APT, ${
          usdcBalance / 1000000
        } USDC`
      );
    }

    // 显示原始账户最终余额
    const finalUserBalance = await aptos.getAccountAPTAmount({
      accountAddress: userAccount.accountAddress,
    });

    // 检查原始账户的 USDC 余额
    let finalUsdcBalance = 0;
    try {
      const balance = await aptos.getAccountCoinAmount({
        accountAddress: userAccount.accountAddress,
        coinType:
          "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::usdc::USDC",
      });
      finalUsdcBalance = Number(balance);
    } catch (error) {
      // USDC 余额为 0 或不存在
    }

    console.log(
      `原始账户最终余额: ${finalUserBalance / 100000000} APT, ${
        finalUsdcBalance / 1000000
      } USDC`
    );
  } catch (error) {
    console.error("Aptos Camp 交易生成测试失败:", error);
  }
}

// 如果直接运行脚本
if (require.main === module) {
  runIntegrationTest3();
}

// 导出函数以便其他脚本使用
export { runIntegrationTest3 };
