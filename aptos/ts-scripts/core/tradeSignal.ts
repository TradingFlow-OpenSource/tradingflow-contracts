import { Aptos, AccountAddress } from "@aptos-labs/ts-sdk";
import { ADMIN_PRIVATE_KEY } from "../config";
import {
    createAptosClient,
    createAccountFromPrivateKey,
    getContractAddress,
    waitForTransaction,
    TOKEN_METADATA,
} from "../utils/common";

/**
 * 交易信号脚本
 * 对应 Move 函数: send_trade_signal
 * 允许管理员代表用户在 Hyperion DEX 上执行交易
 *
 * @param userAddress 用户地址
 * @param fromTokenMetadataId 源代币元数据对象 ID，例如 "0x000000000000000000000000000000000000000000000000000000000000000a"
 * @param toTokenMetadataId 目标代币元数据对象 ID
 * @param feeTier 费率等级 (0-3)
 * @param amountIn 输入金额
 * @param amountOutMin 最小输出金额
 * @param sqrtPriceLimit 价格限制的平方根 (通常设为0表示无限制)
 * @param deadline 截止时间戳 (Unix 时间戳)
 * @param feeRecipient 手续费收款人地址
 * @param feeRate 手续费率 (百万分之一为单位，例如 1000 = 0.1%)
 */
async function tradeSignal(
    userAddress: string,
    fromTokenMetadataId: string,
    toTokenMetadataId: string,
    feeTier: number,
    amountIn: number,
    amountOutMin: number,
    sqrtPriceLimit: string,
    deadline: number,
    feeRecipient: string,
    feeRate: number
) {
    try {
        // 创建 Aptos 客户端
        const aptos = createAptosClient();

        // 创建管理员账户
        const admin = createAccountFromPrivateKey(ADMIN_PRIVATE_KEY);

        console.log(`管理员地址: ${admin.accountAddress}`);
        console.log(`用户地址: ${userAddress}`);
        console.log(`源代币元数据对象 ID: ${fromTokenMetadataId}`);
        console.log(`目标代币元数据对象 ID: ${toTokenMetadataId}`);
        console.log(`输入金额: ${amountIn}`);
        console.log(`最小输出金额: ${amountOutMin}`);
        console.log(`手续费收款人: ${feeRecipient}`);
        console.log(`手续费率: ${feeRate} (${feeRate / 10000}%)`);

        // 将用户地址转换为AccountAddress对象
        const userAccountAddress = AccountAddress.from(userAddress);
        const feeRecipientAddress = AccountAddress.from(feeRecipient);

        // 构建交易
        const transaction = await aptos.transaction.build.simple({
            sender: admin.accountAddress,
            data: {
                function: `${getContractAddress()}::vault::send_trade_signal`,
                functionArguments: [
                    userAccountAddress,
                    fromTokenMetadataId,
                    toTokenMetadataId,
                    feeTier,
                    amountIn,
                    amountOutMin,
                    sqrtPriceLimit,
                    deadline,
                    feeRecipientAddress,
                    feeRate,
                ],
            },
        });

        // 签名并提交交易
        console.log("正在发送交易信号...");
        const committedTxn = await aptos.signAndSubmitTransaction({
            signer: admin,
            transaction,
        });

        // 等待交易完成
        await waitForTransaction(aptos, committedTxn.hash);

        console.log(`交易信号发送成功！已在 Hyperion DEX 上执行交易。`);
        console.log(`交易哈希: ${committedTxn.hash}`);
    } catch (error) {
        console.error("发送交易信号失败:", error);
    }
}

// 如果直接运行脚本，从命令行参数获取参数
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 10) {
        console.error(
            "用法: pnpm ts-node core/tradeSignal.ts <用户地址> <源代币元数据对象ID> <目标代币元数据对象ID> <费率等级> <输入金额> <最小输出金额> <价格限制> <截止时间戳> <手续费收款人> <手续费率>"
        );
        console.error(
            "示例: pnpm ts-node core/tradeSignal.ts 0x123...abc " +
                TOKEN_METADATA.APT +
                " " +
                TOKEN_METADATA.USDC +
                " 1 100 95 0 " +
                Math.floor(Date.now() / 1000 + 3600) +
                " 0x456...def 1000"
        );
        console.error("常用代币元数据对象 ID:");
        console.error("  APT: " + TOKEN_METADATA.APT);
        console.error("  USDC: " + TOKEN_METADATA.USDC);
        console.error("  USDT: " + TOKEN_METADATA.USDT);
        console.error("手续费率说明:");
        console.error("  1000 = 0.1%");
        console.error("  5000 = 0.5%");
        console.error("  10000 = 1%");
        process.exit(1);
    }

    const userAddress = args[0];
    const fromTokenMetadataId = args[1];
    const toTokenMetadataId = args[2];
    const feeTier = parseInt(args[3], 10);
    const amountIn = parseInt(args[4], 10);
    const amountOutMin = parseInt(args[5], 10);
    const sqrtPriceLimit = args[6];
    const deadline = parseInt(args[7], 10);
    const feeRecipient = args[8];
    const feeRate = parseInt(args[9], 10);

    if (
        isNaN(feeTier) ||
        isNaN(amountIn) ||
        isNaN(amountOutMin) ||
        isNaN(deadline) ||
        isNaN(feeRate)
    ) {
        console.error(
            "费率等级、输入金额、最小输出金额、截止时间戳和手续费率必须是有效的数字"
        );
        process.exit(1);
    }

    tradeSignal(
        userAddress,
        fromTokenMetadataId,
        toTokenMetadataId,
        feeTier,
        amountIn,
        amountOutMin,
        sqrtPriceLimit,
        deadline,
        feeRecipient,
        feeRate
    );
}

// 导出函数以便其他脚本使用
export { tradeSignal };
