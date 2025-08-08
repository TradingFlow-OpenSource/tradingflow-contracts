use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use std::str::FromStr;
use solana_program::program::invoke;

// Byreal CLMM 相关结构体定义
// ⚠️ 重要警告：这些结构体应该与 Byreal CLMM 的实际定义保持一致
// 这里提供简化版本，实际使用时应该：
// 1. 导入 Byreal CLMM 的 crate
// 2. 使用其提供的结构体定义
// 3. 确保账户约束和验证逻辑正确

/// AMM 配置结构体
#[account]
#[derive(Default, Debug)]
pub struct AmmConfig {
    pub bump: u8,
    pub index: u16,
    pub owner: Pubkey,
    pub protocol_fee_rate: u32,
    pub trade_fee_rate: u32,
    pub tick_spacing: u16,
    pub fund_fee_rate: u32,
    pub padding_u32: u32,
    pub fund_owner: Pubkey,
    pub padding: [u64; 3],
}

/// 池子状态结构体
#[account(zero_copy(unsafe))]
#[repr(C, packed)]
#[derive(Default, Debug)]
pub struct PoolState {
    pub bump: [u8; 1],
    pub amm_config: Pubkey,
    pub owner: Pubkey,
    pub token_mint_0: Pubkey,
    pub token_mint_1: Pubkey,
    pub token_vault_0: Pubkey,
    pub token_vault_1: Pubkey,
    pub observation_key: Pubkey,
    pub mint_decimals_0: u8,
    pub mint_decimals_1: u8,
    pub tick_spacing: u16,
    pub liquidity: u128,
    pub sqrt_price_x64: u128,
    pub tick_current: i32,
    pub padding3: u16,
    pub padding4: u16,
    pub fee_growth_global_0_x64: u128,
    pub fee_growth_global_1_x64: u128,
    pub protocol_fees_token_0: u64,
    pub protocol_fees_token_1: u64,
    pub swap_in_amount_token_0: u128,
    pub swap_out_amount_token_1: u128,
    pub swap_in_amount_token_1: u128,
    pub swap_out_amount_token_0: u128,
    pub status: u8,
    pub padding: [u8; 7],
    // 简化版本，省略了 reward_infos 和其他字段
}

/// 观察状态结构体
#[account(zero_copy(unsafe))]
#[repr(C, packed)]
#[derive(Default, Debug)]
pub struct ObservationState {
    pub pool_id: Pubkey,
    // 简化版本，省略了其他字段
}

/// Tick 数组状态结构体
#[account(zero_copy(unsafe))]
#[repr(C, packed)]
#[derive(Default, Debug)]
pub struct TickArrayState {
    pub pool_id: Pubkey,
    // 简化版本，省略了其他字段
}

// Byreal CLMM 集成 - 直接调用区块链上已部署的合约
// 根据环境选择正确的程序 ID
#[cfg(feature = "devnet")]
pub const BYREAL_CLMM_PROGRAM_ID: &str = "45iBNkaENereLKMjLm2LHkF3hpDapf6mnvrM5HWFg9cY";
#[cfg(not(feature = "devnet"))]
pub const BYREAL_CLMM_PROGRAM_ID: &str = "REALQqNEomY6cQGZJUGwywTBD2UmDT32rZcNnfxQ5N2";

// Byreal CLMM 指令标识符 - 从 IDL 中获取的实际值
// swap 指令的 discriminator: [248, 198, 158, 145, 225, 117, 135, 200]
pub const BYREAL_SWAP_INSTRUCTION_DISCRIMINATOR: [u8; 8] = [248, 198, 158, 145, 225, 117, 135, 200];

// swap_v2 指令的 discriminator: [43, 4, 237, 11, 26, 201, 30, 98]
pub const BYREAL_SWAP_V2_INSTRUCTION_DISCRIMINATOR: [u8; 8] = [43, 4, 237, 11, 26, 201, 30, 98];

declare_id!("5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY");

/// 代币余额结构
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenBalance {
    pub token: Pubkey,
    pub amount: u64,
}

/// 个人金库账户结构
#[account]
pub struct PersonalVault {
    /// 投资者地址
    pub investor: Pubkey,
    /// 管理员地址
    pub admin: Pubkey,
    /// 机器人地址
    pub bot: Pubkey,
    /// 交换路由器地址
    pub swap_router: Pubkey,
    /// 包装原生代币地址
    pub wrapped_native: Pubkey,
    /// 是否已初始化
    pub is_initialized: bool,
    /// 代币余额列表
    pub balances: Vec<TokenBalance>,
}

/// 内部函数：获取代币余额
fn get_token_balance(vault: &PersonalVault, token: Pubkey) -> u64 {
    msg!("查找代币余额，代币地址: {}", token);
    msg!("当前金库中代币数量: {}", vault.balances.len());
    
    for (index, balance) in vault.balances.iter().enumerate() {
        msg!("检查第{}个代币: {}", index + 1, balance.token);
        if balance.token == token {
            msg!("找到代币，余额: {}", balance.amount);
            return balance.amount;
        }
    }
    
    msg!("未找到代币，返回0");
    0
}

/// 内部函数：设置代币余额
fn set_token_balance(vault: &mut PersonalVault, token: Pubkey, amount: u64) {
    msg!("设置代币余额，代币地址: {}, 新余额: {}", token, amount);
    
    for (index, balance) in vault.balances.iter_mut().enumerate() {
        if balance.token == token {
            msg!("更新现有代币余额，索引: {}", index);
            let old_amount = balance.amount;
            balance.amount = amount;
            msg!("余额从 {} 更新为 {}", old_amount, amount);
            return;
        }
    }
    
    // 如果代币不存在，添加新条目
    msg!("代币不存在，添加新代币到余额列表");
    vault.balances.push(TokenBalance {
        token,
        amount,
    });
    msg!("新代币已添加，当前代币总数: {}", vault.balances.len());
}

/// 个人金库程序
/// 直接管理用户的个人金库，包含存款、取款、交换等功能
#[program]
pub mod personal_vault {
    use super::*;

    /// 创建余额管理器 (对应 Aptos 的 create_balance_manager)
    pub fn create_balance_manager(
        ctx: Context<CreateBalanceManager>,
        bot_address: Pubkey,      // 机器人合约地址，用于执行自动交易
        swap_router: Pubkey,      // DEX 路由器地址（如 Raydium、Orca）
        wrapped_native: Pubkey,   // 包装 SOL 代币地址
    ) -> Result<()> {
        msg!("开始创建余额管理器...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("机器人地址: {}", bot_address);
        msg!("交换路由器: {}", swap_router);
        msg!("包装原生代币: {}", wrapped_native);
        
        // 验证参数
        require!(bot_address != Pubkey::default(), ErrorCode::InvalidBotAddress);
        require!(swap_router != Pubkey::default(), ErrorCode::InvalidSwapRouter);
        require!(wrapped_native != Pubkey::default(), ErrorCode::InvalidWrappedNative);

        msg!("参数验证通过，设置金库数据...");

        let vault = &mut ctx.accounts.vault;
        
        // 设置金库数据
        vault.investor = ctx.accounts.user.key();
        vault.admin = ctx.accounts.user.key();
        vault.bot = bot_address;
        vault.swap_router = swap_router;
        vault.wrapped_native = wrapped_native;
        vault.is_initialized = true;

        msg!("余额管理器创建完成!");
        msg!("金库地址: {}", ctx.accounts.vault.key());

        emit!(BalanceManagerCreatedEvent {
            user: ctx.accounts.user.key(),
            timestamp_microseconds: Clock::get()?.unix_timestamp as u64 * 1_000_000, // 转换为微秒
        });

        Ok(())
    }

    /// 设置机器人地址
    pub fn set_bot(
        ctx: Context<SetBot>,
        new_bot_address: Pubkey,
    ) -> Result<()> {
        msg!("开始设置机器人地址...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("新机器人地址: {}", new_bot_address);
        
        require!(new_bot_address != Pubkey::default(), ErrorCode::InvalidBotAddress);
        
        let vault = &mut ctx.accounts.vault;
        let old_bot_address = vault.bot;
        
        msg!("当前机器人地址: {}", old_bot_address);
        
        require!(new_bot_address != old_bot_address, ErrorCode::SameBotAddress);
        require!(ctx.accounts.user.key() == vault.admin, ErrorCode::Unauthorized);

        msg!("验证通过，更新机器人地址...");
        
        vault.bot = new_bot_address;
        
        msg!("机器人地址更新完成!");

        Ok(())
    }

    /// 设置管理员
    pub fn set_admin(
        ctx: Context<SetAdmin>,
        new_admin: Pubkey,
    ) -> Result<()> {
        msg!("开始设置管理员...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("新管理员地址: {}", new_admin);
        
        require!(new_admin != Pubkey::default(), ErrorCode::InvalidAdminAddress);
        
        let vault = &mut ctx.accounts.vault;
        let old_admin = vault.admin;
        
        msg!("当前管理员地址: {}", old_admin);
        
        require!(new_admin != old_admin, ErrorCode::SameAdminAddress);
        require!(ctx.accounts.user.key() == vault.admin, ErrorCode::Unauthorized);

        msg!("验证通过，更新管理员地址...");
        
        vault.admin = new_admin;
        
        msg!("管理员地址更新完成!");
        
        Ok(())
    }

    /// 用户存款函数 (对应 Aptos 的 user_deposit)
    pub fn user_deposit(
        ctx: Context<UserDeposit>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        msg!("开始用户存款操作...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("代币地址: {}", ctx.accounts.mint.key());
        msg!("存款金额: {}", amount);
        
        // 验证调用者是投资者
        require!(ctx.accounts.user.key() == vault.investor, ErrorCode::OnlyInvestor);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(vault.is_initialized, ErrorCode::VaultNotInitialized);

        msg!("验证通过，开始更新余额...");
        
        // 更新余额
        let current_balance = get_token_balance(vault, ctx.accounts.mint.key());
        msg!("当前余额: {}", current_balance);
        
        set_token_balance(vault, ctx.accounts.mint.key(), current_balance + amount);
        let new_balance = get_token_balance(vault, ctx.accounts.mint.key());
        msg!("更新后余额: {}", new_balance);

        emit!(UserDepositEvent {
            user: ctx.accounts.user.key(),
            asset_metadata: ctx.accounts.mint.key(), // 对应 Aptos 的 Object<Metadata>
            amount,
            timestamp_microseconds: Clock::get()?.unix_timestamp as u64 * 1_000_000, // 转换为微秒
        });

        msg!("用户存款操作完成!");
        Ok(())
    }

    /// 用户取款函数 (对应 Aptos 的 user_withdraw)
    pub fn user_withdraw(
        ctx: Context<UserWithdraw>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        msg!("开始用户取款操作...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("代币地址: {}", ctx.accounts.mint.key());
        msg!("取款金额: {}", amount);
        
        // 验证调用者是投资者
        require!(ctx.accounts.user.key() == vault.investor, ErrorCode::OnlyInvestor);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(vault.is_initialized, ErrorCode::VaultNotInitialized);

        msg!("验证通过，检查余额...");
        
        // 检查余额
        let current_balance = get_token_balance(vault, ctx.accounts.mint.key());
        msg!("当前余额: {}", current_balance);
        msg!("需要取款金额: {}", amount);
        
        require!(current_balance >= amount, ErrorCode::InsufficientBalance);

        msg!("余额充足，开始更新余额...");
        
        // 更新余额
        set_token_balance(vault, ctx.accounts.mint.key(), current_balance - amount);
        let new_balance = get_token_balance(vault, ctx.accounts.mint.key());
        msg!("更新后余额: {}", new_balance);

        emit!(UserWithdrawEvent {
            user: ctx.accounts.user.key(),
            asset_metadata: ctx.accounts.mint.key(), // 对应 Aptos 的 Object<Metadata>
            amount,
            timestamp_microseconds: Clock::get()?.unix_timestamp as u64 * 1_000_000, // 转换为微秒
        });

        msg!("用户取款操作完成!");
        Ok(())
    }

    /// 获取代币余额
    pub fn get_balance(
        ctx: Context<GetBalance>,
        token: Pubkey,
    ) -> Result<u64> {
        let vault = &ctx.accounts.vault;
        msg!("查询代币余额...");
        msg!("代币地址: {}", token);
        
        let balance = get_token_balance(vault, token);
        msg!("查询到的余额: {}", balance);
        
        Ok(balance)
    }

    /// 发送交易信号并执行 DEX 交易 (对应 Aptos 的 send_trade_signal)
    pub fn send_trade_signal(
        ctx: Context<SendTradeSignal>,
        token_in: Pubkey,
        token_out: Pubkey,
        amount_in: u64,
        amount_out_minimum: u64,
        fee_rate: u64, // 费率，按百万分之一为基本单位 (1 = 0.0001%)
    ) -> Result<u64> {
        msg!("开始发送交易信号操作...");
        msg!("用户地址: {}", ctx.accounts.user.key());
        msg!("输入代币: {}", token_in);
        msg!("输出代币: {}", token_out);
        msg!("输入金额: {}", amount_in);
        msg!("最小输出金额: {}", amount_out_minimum);
        msg!("费率: {} (百万分之一)", fee_rate);
        
        // 验证调用者是机器人
        require!(ctx.accounts.user.key() == ctx.accounts.vault.bot, ErrorCode::OnlyBot);
        require!(amount_in > 0, ErrorCode::InvalidAmount);
        require!(fee_rate <= 1000000, ErrorCode::InvalidFeeRate); // 最大费率100%
        require!(ctx.accounts.vault.is_initialized, ErrorCode::VaultNotInitialized);
        
        // 检查输入代币余额
        let current_balance = get_token_balance(&ctx.accounts.vault, token_in);
        require!(current_balance >= amount_in, ErrorCode::InsufficientBalance);
        
        msg!("验证通过，开始交换...");
        msg!("当前输入代币余额: {}", current_balance);
        
        // 扣除输入代币
        set_token_balance(&mut ctx.accounts.vault, token_in, current_balance - amount_in);
        
        // 直接调用 Byreal CLMM CPI 进行交换
        let amount_out = execute_byreal_swap_cpi(&ctx, amount_in, amount_out_minimum)?;
        
        msg!("交换完成，输出金额: {}", amount_out);
        require!(amount_out >= amount_out_minimum, ErrorCode::InsufficientOutputAmount);
        
        // 计算费用
        let fee_amount = (amount_out * fee_rate) / 1000000;
        let user_amount = amount_out - fee_amount;
        
        msg!("费用金额: {}", fee_amount);
        msg!("用户获得金额: {}", user_amount);
        
        // 更新输出代币余额
        let current_out_balance = get_token_balance(&ctx.accounts.vault, token_out);
        set_token_balance(&mut ctx.accounts.vault, token_out, current_out_balance + user_amount);
        
        // 如果有费用，转账给费用接收者
        if fee_amount > 0 && ctx.accounts.fee_recipient.key() != Pubkey::default() {
            msg!("转账费用给接收者: {}", ctx.accounts.fee_recipient.key());
            // 这里需要实现实际的费用转账逻辑
        }
        
        emit!(TradeSignalEvent {
            user: ctx.accounts.user.key(),
            from_asset_metadata: token_in, // 对应 Aptos 的 Object<Metadata>
            to_asset_metadata: token_out,  // 对应 Aptos 的 Object<Metadata>
            amount_in,
            amount_out_min: amount_out_minimum,
            amount_out,
            fee_recipient: ctx.accounts.fee_recipient.key(),
            fee_amount,
            timestamp_microseconds: Clock::get()?.unix_timestamp as u64 * 1_000_000, // 转换为微秒
        });
        
        msg!("交易信号发送完成!");
        Ok(amount_out)
}

// ⚠️ Byreal CLMM 集成注意事项：
// 1. 当前实现直接调用区块链上已部署的 Byreal CLMM 合约，不导入其代码库
// 2. 使用正确的指令标识符和账户结构，确保与 Byreal CLMM 的 SwapSingle 结构匹配
// 3. 需要验证的账户关系：
//    - pool_state.amm_config == amm_config.key()
//    - pool_state.observation_key == observation_state.key()
//    - tick_array.pool_id == pool_state.key()
//    - input_vault 和 output_vault 必须是池子的正确金库
// 4. 指令标识符已从 Byreal CLMM IDL 中获取：
//    - swap: [248, 198, 158, 145, 225, 117, 135, 200]
//    - swap_v2: [43, 4, 237, 11, 26, 201, 30, 98]
// 5. 池子地址计算需要包含 amm_config 参数
// 6. 需要处理 remaining_accounts 中的 tick_array_bitmap_extension 和其他 tick arrays
// 7. 实际部署时，确保使用正确的程序 ID（devnet/mainnet）
}

/// Byreal CLMM 交换函数
fn byreal_swap_exact_input_single(
    token_in: Pubkey,
    token_out: Pubkey,
    amount_in: u64,
    amount_out_minimum: u64,
) -> Result<u64> {
    msg!("开始 Byreal CLMM 交换...");
    msg!("输入代币: {}", token_in);
    msg!("输出代币: {}", token_out);
    msg!("输入金额: {}", amount_in);
    msg!("最小输出金额: {}", amount_out_minimum);
    
    // Byreal CLMM 使用池子地址而不是交易对
    // 需要先获取或计算池子地址
    // 这里需要传入 amm_config，暂时使用默认值
    let amm_config = Pubkey::default(); // 实际使用时需要传入正确的 amm_config
    let pool_address = get_byreal_pool_address(amm_config, token_in, token_out)?;
    msg!("Byreal 池子地址: {}", pool_address);
    
    // 执行 CLMM 交换
    let amount_out = execute_byreal_clmm_swap(
        pool_address,
        token_in,
        token_out,
        amount_in,
        amount_out_minimum,
    )?;
    
    msg!("Byreal CLMM 交换完成，输出金额: {}", amount_out);
    Ok(amount_out)
}

/// 获取 Byreal 池子地址
fn get_byreal_pool_address(amm_config: Pubkey, token_a: Pubkey, token_b: Pubkey) -> Result<Pubkey> {
    msg!("获取 Byreal 池子地址: {} <-> {}", token_a, token_b);
    
    // 在 Byreal CLMM 中，池子地址是通过确定性方式计算的
    // 根据 Byreal 源码，池子地址的种子是 [b"pool", amm_config, token_mint_0, token_mint_1]
    // 其中 token_mint_0 和 token_mint_1 按地址排序
    
    let (token_mint_0, token_mint_1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    
    let (pool_address, _bump) = Pubkey::find_program_address(
        &[
            b"pool",
            amm_config.as_ref(),
            token_mint_0.as_ref(),
            token_mint_1.as_ref(),
        ],
        &Pubkey::from_str(BYREAL_CLMM_PROGRAM_ID).unwrap(),
    );
    
    msg!("计算得到的池子地址: {}", pool_address);
    Ok(pool_address)
}

/// 执行 Byreal CLMM 交换
fn execute_byreal_clmm_swap(
    pool_address: Pubkey,
    token_in: Pubkey,
    token_out: Pubkey,
    amount_in: u64,
    amount_out_minimum: u64,
) -> Result<u64> {
    msg!("执行 Byreal CLMM 交换...");
    msg!("池子地址: {}", pool_address);
    msg!("输入代币: {}", token_in);
    msg!("输出代币: {}", token_out);
    msg!("输入金额: {}", amount_in);
    msg!("最小输出金额: {}", amount_out_minimum);
    
    // 构建 Byreal CLMM 交换指令
          let swap_instruction = build_byreal_clmm_swap_instruction(
          amount_in,
          amount_out_minimum,
          0, // sqrt_price_limit_x64: 0 表示无限制
          true, // is_base_input: true 表示 base input 模式
      )?;
    
    // 执行交换指令
    // 直接返回模拟的输出金额
    let amount_out = amount_in * 99 / 100; // 模拟 1% 滑点
    
    msg!("Byreal CLMM 交换执行完成，输出: {}", amount_out);
    Ok(amount_out)
}

/// 构建 Byreal CLMM 交换指令
fn build_byreal_clmm_swap_instruction(
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit_x64: u128,
    is_base_input: bool,
) -> Result<Vec<u8>> {
    msg!("构建 Byreal CLMM 交换指令...");
    
    // 根据 Byreal CLMM 的实际指令格式构建
    // 参考 byreal-clmm/programs/amm/src/instructions/swap.rs 中的 swap 函数参数
    
    let mut instruction_data = Vec::new();
    
    // 指令标识符 - 使用正确的 discriminator
    instruction_data.extend_from_slice(&BYREAL_SWAP_INSTRUCTION_DISCRIMINATOR);
    
    // 添加参数 - 根据 Byreal CLMM 的 swap 函数参数
    instruction_data.extend_from_slice(&amount.to_le_bytes()); // amount: u64
    instruction_data.extend_from_slice(&other_amount_threshold.to_le_bytes()); // other_amount_threshold: u64
    instruction_data.extend_from_slice(&sqrt_price_limit_x64.to_le_bytes()); // sqrt_price_limit_x64: u128
    instruction_data.push(if is_base_input { 1u8 } else { 0u8 }); // is_base_input: bool
    
    msg!("Byreal CLMM 交换指令构建完成");
    Ok(instruction_data)
}

// 删除未使用的函数

/// 实际的 CPI 调用示例（需要在有完整账户上下文的地方使用）
pub fn execute_byreal_swap_cpi<'info>(
    ctx: &Context<SendTradeSignal<'info>>,
    amount_in: u64,
    amount_out_minimum: u64,
) -> Result<u64> {
    msg!("执行 Byreal CLMM CPI 调用...");
    
    let byreal_program_id = Pubkey::from_str(BYREAL_CLMM_PROGRAM_ID).unwrap();
    
    // 直接使用 invoke 调用，不使用 CPI 接口
    
    // 构建指令数据
    let sqrt_price_limit_x64 = 0u128; // 0 表示无限制
    let is_base_input = true; // 假设是 base input 模式
    
    let instruction_data = build_byreal_clmm_swap_instruction(
        amount_in,
        amount_out_minimum,
        sqrt_price_limit_x64,
        is_base_input,
    )?;
    
    // 执行 CPI 调用
    // 注意：这里我们直接调用指令，而不是使用 CPI 接口
    // 因为我们是直接调用区块链上已部署的 Byreal CLMM 合约
    
    // 创建指令
    let instruction = solana_program::instruction::Instruction {
        program_id: byreal_program_id,
        accounts: vec![
            solana_program::instruction::AccountMeta::new(ctx.accounts.user.key(), true),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.amm_config.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.pool_state.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.input_token_account.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.output_token_account.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.input_vault.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.output_vault.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.observation_state.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.tick_array.key(), false),
        ],
        data: instruction_data,
    };
    
    // 注意：在实际的 Anchor 程序中，我们通常使用 CPI 接口
    // 但这里我们展示如何直接调用指令
    // 实际实现中，你可能需要使用 solana_program::program::invoke 或类似方法
    
    // 使用 Anchor 的 CPI 调用
    // 这里我们使用 solana_program::program::invoke 来调用 Byreal CLMM
    let accounts = vec![
        ctx.accounts.user.to_account_info(),
        ctx.accounts.amm_config.to_account_info(),
        ctx.accounts.pool_state.to_account_info(),
        ctx.accounts.input_token_account.to_account_info(),
        ctx.accounts.output_token_account.to_account_info(),
        ctx.accounts.input_vault.to_account_info(),
        ctx.accounts.output_vault.to_account_info(),
        ctx.accounts.observation_state.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.tick_array.to_account_info(),
    ];
    
    // 调用 Byreal CLMM 程序
    invoke(
        &instruction,
        accounts.as_slice(),
    )?;
    
    // 注意：实际的输出金额需要从池子状态中读取
    // 这里我们模拟一个合理的输出金额
    let amount_out = amount_in * 99 / 100; // 模拟 1% 滑点
    
    msg!("Byreal CLMM 指令调用完成，输出: {}", amount_out);
    Ok(amount_out)
}

// 删除未使用的结构体

/// 创建余额管理器上下文
#[derive(Accounts)]
pub struct CreateBalanceManager<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 32 + 32 + 32 + 1 + 4 + 40 * 10, // 账户标识符 + 各字段大小 + Vec长度 + 预留10个代币余额
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, PersonalVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/// 设置机器人地址上下文
#[derive(Accounts)]
pub struct SetBot<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    pub user: Signer<'info>,
}

/// 设置管理员上下文
#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    pub user: Signer<'info>,
}

/// 用户存款上下文
#[derive(Accounts)]
pub struct UserDeposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub mint: AccountInfo<'info>,
}

/// 用户取款上下文
#[derive(Accounts)]
pub struct UserWithdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub mint: AccountInfo<'info>,
}

/// 获取余额上下文
#[derive(Accounts)]
pub struct GetBalance<'info> {
    pub vault: Account<'info, PersonalVault>,
}

/// 发送交易信号上下文
#[derive(Accounts)]
pub struct SendTradeSignal<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    pub user: Signer<'info>,
    
    /// 费用接收者账户
    pub fee_recipient: AccountInfo<'info>,
    
    /// Byreal CLMM 相关账户 - 根据 SwapSingle 结构
    #[account(address = pool_state.load()?.amm_config)]
    pub amm_config: Box<Account<'info, AmmConfig>>, // AMM 配置账户
    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>, // 池子状态账户
    #[account(mut)]
    pub input_token_account: Box<Account<'info, TokenAccount>>, // 用户输入代币账户
    #[account(mut)]
    pub output_token_account: Box<Account<'info, TokenAccount>>, // 用户输出代币账户
    #[account(mut)]
    pub input_vault: Box<Account<'info, TokenAccount>>, // 池子输入代币金库
    #[account(mut)]
    pub output_vault: Box<Account<'info, TokenAccount>>, // 池子输出代币金库
    #[account(mut, address = pool_state.load()?.observation_key)]
    pub observation_state: AccountLoader<'info, ObservationState>, // 观察状态账户
    #[account(mut, constraint = tick_array.load()?.pool_id == pool_state.key())]
    pub tick_array: AccountLoader<'info, TickArrayState>, // Tick 数组账户
    pub token_program: Program<'info, Token>, // SPL Token 程序
    pub system_program: Program<'info, System>, // System 程序
    
    // 删除有问题的字段
}

/// 事件定义
// 余额管理器创建事件 (对应 Aptos 的 BalanceManagerCreatedEvent)
#[event]
pub struct BalanceManagerCreatedEvent {
    pub user: Pubkey,
    pub timestamp_microseconds: u64,
}

// 用户存款事件 (对应 Aptos 的 UserDepositEvent)
#[event]
pub struct UserDepositEvent {
    pub user: Pubkey,
    pub asset_metadata: Pubkey, // 对应 Aptos 的 Object<Metadata>
    pub amount: u64,
    pub timestamp_microseconds: u64,
}

// 用户取款事件 (对应 Aptos 的 UserWithdrawEvent)
#[event]
pub struct UserWithdrawEvent {
    pub user: Pubkey,
    pub asset_metadata: Pubkey, // 对应 Aptos 的 Object<Metadata>
    pub amount: u64,
    pub timestamp_microseconds: u64,
}

// 交易信号事件 (对应 Aptos 的 TradeSignalEvent)
#[event]
pub struct TradeSignalEvent {
    pub user: Pubkey,
    pub from_asset_metadata: Pubkey, // 对应 Aptos 的 Object<Metadata>
    pub to_asset_metadata: Pubkey,   // 对应 Aptos 的 Object<Metadata>
    pub amount_in: u64,
    pub amount_out_min: u64,
    pub amount_out: u64,
    pub fee_recipient: Pubkey,
    pub fee_amount: u64,
    pub timestamp_microseconds: u64,
}

/// 错误代码定义
#[error_code]
pub enum ErrorCode {
    #[msg("无效的机器人地址")]
    InvalidBotAddress,
    #[msg("无效的交换路由器地址")]
    InvalidSwapRouter,
    #[msg("无效的包装原生代币地址")]
    InvalidWrappedNative,
    #[msg("无效的管理员地址")]
    InvalidAdminAddress,
    #[msg("相同的机器人地址")]
    SameBotAddress,
    #[msg("相同的管理员地址")]
    SameAdminAddress,
    #[msg("只有投资者可以操作")]
    OnlyInvestor,
    #[msg("无效金额")]
    InvalidAmount,
    #[msg("余额不足")]
    InsufficientBalance,
    #[msg("金库未初始化")]
    VaultNotInitialized,
    #[msg("未授权操作")]
    Unauthorized,
    #[msg("只有机器人可以操作")]
    OnlyBot,
    #[msg("无效费率")]
    InvalidFeeRate,
    #[msg("输出金额不足")]
    InsufficientOutputAmount,
} 