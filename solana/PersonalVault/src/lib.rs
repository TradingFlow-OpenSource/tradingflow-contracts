use anchor_lang::prelude::*;

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

    /// 初始化个人金库
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        bot_address: Pubkey,      // 机器人合约地址，用于执行自动交易
        swap_router: Pubkey,      // DEX 路由器地址（如 Raydium、Orca）
        wrapped_native: Pubkey,   // 包装 SOL 代币地址
    ) -> Result<()> {
        msg!("开始初始化个人金库...");
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

        msg!("金库初始化完成!");
        msg!("金库地址: {}", ctx.accounts.vault.key());

        emit!(VaultInitialized {
            user: ctx.accounts.user.key(),
            vault: ctx.accounts.vault.key(),
            bot_address,
            timestamp: Clock::get()?.unix_timestamp,
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

        emit!(BotUpdated {
            vault: ctx.accounts.vault.key(),
            old_bot: old_bot_address,
            new_bot: new_bot_address,
            timestamp: Clock::get()?.unix_timestamp,
        });

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

        emit!(AdminUpdated {
            vault: ctx.accounts.vault.key(),
            old_admin,
            new_admin,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// 存款代币（简化版本）
    pub fn deposit_token(
        ctx: Context<DepositToken>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        msg!("开始存款操作...");
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

        emit!(TokenDeposited {
            vault: ctx.accounts.vault.key(),
            user: ctx.accounts.user.key(),
            token: ctx.accounts.mint.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("存款操作完成!");
        Ok(())
    }

    /// 取款代币（简化版本）
    pub fn withdraw_token(
        ctx: Context<WithdrawToken>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        msg!("开始取款操作...");
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

        emit!(TokenWithdrawn {
            vault: ctx.accounts.vault.key(),
            user: ctx.accounts.user.key(),
            token: ctx.accounts.mint.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("取款操作完成!");
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
}

/// 初始化金库上下文
#[derive(Accounts)]
pub struct InitializeVault<'info> {
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

/// 存款代币上下文
#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub vault: Account<'info, PersonalVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub mint: AccountInfo<'info>,
}

/// 取款代币上下文
#[derive(Accounts)]
pub struct WithdrawToken<'info> {
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

/// 事件定义
#[event]
pub struct VaultInitialized {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub bot_address: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BotUpdated {
    pub vault: Pubkey,
    pub old_bot: Pubkey,
    pub new_bot: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminUpdated {
    pub vault: Pubkey,
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokenDeposited {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenWithdrawn {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
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
} 