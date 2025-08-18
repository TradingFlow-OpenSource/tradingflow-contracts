# TradingFlow Solana PersonalVault

A comprehensive Solana-based personal vault system built with Anchor framework, providing secure asset management and automated trading capabilities through Byreal CLMM DEX integration.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Contract Structure](#contract-structure)
- [Development Setup](#development-setup)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Security Features](#security-features)
- [Byreal CLMM Integration](#byreal-clmm-integration)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

## Overview

The Solana PersonalVault is an Anchor-based program that enables users to create and manage personal cryptocurrency vaults with automated trading capabilities. Unlike EVM-based solutions that require proxy patterns, Solana's account model allows for efficient, cost-effective vault management through Program Derived Addresses (PDAs).

### Why Solana?

**Cost Efficiency**: No need for proxy contracts - users only pay for account creation
**Simplicity**: Program logic is unified, eliminating implementation address management
**Security**: Program upgrades don't affect user data stored in separate accounts
**Performance**: Native parallel processing and low transaction costs

## Architecture

### Account Model

```rust
pub struct PersonalVault {
    pub investor: Pubkey,        // Vault owner
    pub admin: Pubkey,           // Administrator
    pub bot: Pubkey,             // Automated trading bot
    pub swap_router: Pubkey,     // DEX router address
    pub wrapped_native: Pubkey,  // Wrapped SOL token
    pub is_initialized: bool,    // Initialization status
    pub balances: Vec<TokenBalance>, // Token balances
}
```

### PDA (Program Derived Address)

Each user's vault is created using a deterministic PDA:

```rust
let (vault_pda, _bump) = Pubkey::find_program_address(
    &[b"vault", user.key().as_ref()],
    &program_id
);
```

## Key Features

### 🏦 **Personal Vault Management**
- Individual vault creation with PDA-based addressing
- Multi-token balance tracking and management
- Role-based access control (investor, admin, bot)

### 🤖 **Automated Trading**
- Bot-controlled trading signals and execution
- Integration with Byreal CLMM for optimal liquidity
- Configurable fee structures with parts-per-million precision

### 🔐 **Security & Access Control**
- Investor-only deposit and withdrawal operations
- Admin-controlled configuration management
- Bot-exclusive trading signal execution

### 💰 **Fee Management**
- Configurable trading fees (up to 100% with 0.0001% precision)
- Fee recipient management
- Transparent fee calculation and distribution

### 📊 **Event Tracking**
- Comprehensive event emission for all operations
- Timestamp tracking in microseconds
- Complete audit trail for compliance

## Contract Structure

### Core Functions

#### Vault Management
- `create_balance_manager()` - Initialize a new personal vault
- `set_bot()` - Update automated trading bot address
- `set_admin()` - Transfer administrative control

#### Asset Operations
- `user_deposit()` - Deposit tokens into vault
- `user_withdraw()` - Withdraw tokens from vault
- `get_balance()` - Query token balances

#### Trading Operations
- `send_trade_signal()` - Execute automated trades via bot

### Account Contexts

```rust
#[derive(Accounts)]
pub struct CreateBalanceManager<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 32 + 32 + 32 + 1 + 4 + 40 * 10,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, PersonalVault>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

## Development Setup

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# Install Anchor
npm install -g @coral-xyz/anchor-cli
```

### Project Setup

```bash
# Clone the repository
git clone <repository-url>
cd 4_weather_vault/solana/PersonalVault

# Install dependencies
npm install

# Build the program
anchor build

# Run tests
anchor test
```

### Configuration

Update `Anchor.toml` for your environment:

```toml
[features]
seeds = false
skip-lint = false

[programs.localnet]
personal_vault = "5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY"

[programs.devnet]
personal_vault = "5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY"

[programs.mainnet]
personal_vault = "5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

## API Reference

### create_balance_manager

Creates a new personal vault for the user.

```rust
pub fn create_balance_manager(
    ctx: Context<CreateBalanceManager>,
    bot_address: Pubkey,
    swap_router: Pubkey,
    wrapped_native: Pubkey,
) -> Result<()>
```

**Parameters:**
- `bot_address`: Automated trading bot public key
- `swap_router`: DEX router address (Raydium, Orca, etc.)
- `wrapped_native`: Wrapped SOL token address

**Events:** `BalanceManagerCreatedEvent`

### user_deposit

Deposits tokens into the user's vault.

```rust
pub fn user_deposit(
    ctx: Context<UserDeposit>,
    amount: u64,
) -> Result<()>
```

**Access:** Investor only
**Events:** `UserDepositEvent`

### user_withdraw

Withdraws tokens from the user's vault.

```rust
pub fn user_withdraw(
    ctx: Context<UserWithdraw>,
    amount: u64,
) -> Result<()>
```

**Access:** Investor only
**Events:** `UserWithdrawEvent`

### send_trade_signal

Executes automated trading through the bot.

```rust
pub fn send_trade_signal(
    ctx: Context<SendTradeSignal>,
    token_in: Pubkey,
    token_out: Pubkey,
    amount_in: u64,
    amount_out_minimum: u64,
    fee_rate: u64,
) -> Result<u64>
```

**Access:** Bot only
**Fee Rate:** Parts per million (1 = 0.0001%)
**Events:** `TradeSignalEvent`

## Testing

### Unit Tests

```bash
# Run all tests
anchor test

# Run specific test file
anchor test --skip-deploy tests/personal-vault.ts
```

### Test Coverage

The test suite covers:
- Vault creation and initialization
- Deposit and withdrawal operations
- Role-based access control
- Trading signal execution
- Fee calculation and distribution
- Error handling and edge cases

### Integration Tests

```bash
# Test with local validator
solana-test-validator &
anchor test --skip-deploy
```

## Security Features

### Access Control

- **Investor Role**: Can deposit, withdraw, and manage vault settings
- **Admin Role**: Can update bot and admin addresses
- **Bot Role**: Can execute trading signals exclusively

### Validation

- Amount validation (non-zero, sufficient balance)
- Address validation (non-default public keys)
- Initialization checks
- Fee rate limits (maximum 100%)

### Error Handling

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid bot address")]
    InvalidBotAddress,
    #[msg("Only investor can operate")]
    OnlyInvestor,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Vault not initialized")]
    VaultNotInitialized,
    // ... additional error codes
}
```

## Byreal CLMM Integration

### Overview

The vault integrates with Byreal CLMM (Concentrated Liquidity Market Maker) for optimal trading execution and liquidity provision.

### Program IDs

```rust
// Devnet
#[cfg(feature = "devnet")]
pub const BYREAL_CLMM_PROGRAM_ID: &str = "45iBNkaENereLKMjLm2LHkF3hpDapf6mnvrM5HWFg9cY";

// Mainnet
#[cfg(not(feature = "devnet"))]
pub const BYREAL_CLMM_PROGRAM_ID: &str = "REALQqNEomY6cQGZJUGwywTBD2UmDT32rZcNnfxQ5N2";
```

### Pool Address Calculation

```rust
fn get_byreal_pool_address(amm_config: Pubkey, token_a: Pubkey, token_b: Pubkey) -> Result<Pubkey> {
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
    
    Ok(pool_address)
}
```

### CPI Integration

The vault uses Cross-Program Invocation (CPI) to interact with Byreal CLMM:

```rust
pub fn execute_byreal_swap_cpi<'info>(
    ctx: &Context<SendTradeSignal<'info>>,
    amount_in: u64,
    amount_out_minimum: u64,
) -> Result<u64>
```

## Deployment

### Local Deployment

```bash
# Start local validator
solana-test-validator

# Deploy program
anchor deploy
```

### Devnet Deployment

```bash
# Configure for devnet
solana config set --url devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment

```bash
# Configure for mainnet
solana config set --url mainnet-beta

# Deploy to mainnet (requires sufficient SOL)
anchor deploy --provider.cluster mainnet-beta
```

## Environment Variables

### Required Configuration

```bash
# Solana Configuration
SOLANA_CLUSTER=devnet  # or mainnet-beta
ANCHOR_WALLET=~/.config/solana/id.json

# Program Configuration
PROGRAM_ID=5DSNTh2tDqJdH2MrvFAHMQxBMRmsbFVgE56JQ6fPqkaY

# Byreal CLMM Configuration
BYREAL_PROGRAM_ID_DEVNET=45iBNkaENereLKMjLm2LHkF3hpDapf6mnvrM5HWFg9cY
BYREAL_PROGRAM_ID_MAINNET=REALQqNEomY6cQGZJUGwywTBD2UmDT32rZcNnfxQ5N2

# Token Addresses
WRAPPED_SOL=So11111111111111111111111111111111111111112
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Fee Configuration
DEFAULT_FEE_RATE=2500  # 0.25% in parts per million
FEE_RECIPIENT=<fee_recipient_address>
```

### Development Environment

```bash
# Copy environment template
cp .env.example .env

# Update with your configuration
vim .env
```

## Contributing

### Development Guidelines

1. **Code Style**: Follow Rust and Anchor conventions
2. **Testing**: Ensure comprehensive test coverage
3. **Documentation**: Update docs for API changes
4. **Security**: Conduct thorough security reviews

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request

### Security Considerations

- Always validate input parameters
- Use proper access control modifiers
- Implement comprehensive error handling
- Conduct security audits before mainnet deployment

## License

This project is licensed under the MIT License - see the [LICENSE](../../../LICENSE) file for details.

## Support

For technical support and questions:
- Create an issue in the repository
- Join our Discord community
- Review the documentation and examples

---

**⚠️ Important Security Notice**

This software is provided as-is for educational and development purposes. Always conduct thorough testing and security audits before deploying to mainnet with real funds. The developers are not responsible for any financial losses incurred through the use of this software.