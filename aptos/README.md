# TradingFlow Aptos Vault

A sophisticated Move-based vault system for the Aptos blockchain, enabling secure asset management and automated trading through Hyperion DEX integration.

## 🏗️ Architecture Overview

The TradingFlow Aptos Vault leverages Move's resource-oriented programming model to provide:
- **Resource Account Pattern**: Secure asset custody through dedicated resource accounts
- **Fungible Asset Framework**: Native integration with Aptos FA standards
- **Event-Driven Architecture**: Comprehensive transaction tracking and monitoring
- **Oracle Integration**: Automated trading signal execution

## 🚀 Key Features

### 💰 **Asset Management**
- **Multi-Token Support**: Manage various fungible assets within a single vault
- **Balance Tracking**: Real-time balance management with SimpleMap data structures
- **Secure Custody**: Assets stored in resource accounts with capability-based access

### 🤖 **Automated Trading**
- **Hyperion DEX Integration**: Direct integration with Aptos's leading DEX
- **Trading Signals**: Admin-controlled automated trade execution
- **Fee Management**: Configurable fee structures with recipient management
- **Slippage Protection**: Advanced swap parameters for optimal execution

### 🛡️ **Security & Access Control**
- **Role-Based Permissions**: Admin, user, and resource account separation
- **Capability Management**: Move's native capability system for secure operations
- **Error Handling**: Comprehensive error codes for debugging and monitoring

## 📋 Contract Structure

### Core Module: `vault_v1.move`

```move
module tradingflow_vault::vault {
    // Core data structures
    struct BalanceManager has key { ... }
    struct AdminCap has key { ... }
    struct ResourceSignerCapability has key { ... }
    
    // Main functions
    public entry fun create_balance_manager(user: &signer)
    public entry fun user_deposit(user: &signer, metadata: Object<Metadata>, amount: u64)
    public entry fun user_withdraw(user: &signer, metadata: Object<Metadata>, amount: u64)
    public entry fun send_trade_signal(admin: &signer, ...)
}
```

### Key Components

| Component | Purpose | Access Level |
|-----------|---------|--------------|
| **BalanceManager** | User asset tracking | User-owned resource |
| **AdminCap** | Administrative privileges | Admin-only |
| **ResourceSignerCapability** | Asset custody management | Module-internal |
| **Record** | User registry tracking | Global state |

## 🛠️ Development Setup

### Prerequisites

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Verify installation
aptos --version

# Install Node.js dependencies
npm install
```

### Environment Configuration

```bash
# Create .aptos/config.yaml
aptos init

# Set up named addresses in Move.toml
[addresses]
tradingflow_vault = "0x[YOUR_ADDRESS]"
hyperion = "0x[HYPERION_ADDRESS]"
```

### Compilation & Deployment

```bash
# Compile the contract
aptos move compile --named-addresses tradingflow_vault=default

# Run tests
aptos move test --named-addresses tradingflow_vault=default

# Deploy to testnet
aptos move publish --named-addresses tradingflow_vault=default --profile testnet

# Deploy to mainnet
aptos move publish --named-addresses tradingflow_vault=default --profile mainnet
```

## 📖 API Reference

### User Functions

#### `create_balance_manager(user: &signer)`
Creates a new balance manager for first-time users.
- **Access**: Public entry
- **Events**: `BalanceManagerCreatedEvent`

#### `user_deposit(user: &signer, metadata: Object<Metadata>, amount: u64)`
Deposits fungible assets into the user's vault.
- **Access**: Vault owner only
- **Events**: `UserDepositEvent`
- **Errors**: `ENOT_VAULT_OWNER`, `EINSUFFICIENT_BALANCE`

#### `user_withdraw(user: &signer, metadata: Object<Metadata>, amount: u64)`
Withdraws fungible assets from the user's vault.
- **Access**: Vault owner only
- **Events**: `UserWithdrawEvent`
- **Errors**: `ENOT_VAULT_OWNER`, `EINSUFFICIENT_BALANCE`

### Admin Functions

#### `send_trade_signal(...)`
Executes automated trades on behalf of users through Hyperion DEX.
- **Access**: Admin only
- **Parameters**:
  - `user_addr`: Target user address
  - `from_token_metadata`: Source token metadata
  - `to_token_metadata`: Destination token metadata
  - `amount_in`: Input amount
  - `fee_recipient`: Fee collection address
  - `fee_rate`: Fee rate in parts per million
- **Events**: `TradeSignalEvent`

## 🧪 Testing

### Test Coverage

```bash
# Run all tests
aptos move test

# Run specific test with coverage
aptos move test --coverage

# Generate coverage report
aptos move coverage summary
```

### Test Scenarios
- ✅ Balance manager creation and initialization
- ✅ Multi-token deposit and withdrawal operations
- ✅ Admin-controlled trading signal execution
- ✅ Fee calculation and distribution
- ✅ Access control and permission validation
- ✅ Error handling and edge cases

## 🔐 Security Features

### Access Control Matrix

| Function | Admin | User | Resource Account |
|----------|-------|------|------------------|
| `create_balance_manager` | ❌ | ✅ | ❌ |
| `user_deposit` | ❌ | ✅ (owner) | ❌ |
| `user_withdraw` | ❌ | ✅ (owner) | ❌ |
| `send_trade_signal` | ✅ | ❌ | ❌ |

### Security Measures
- **Capability-Based Access**: Move's native capability system prevents unauthorized access
- **Resource Safety**: Move's resource model ensures assets cannot be duplicated or lost
- **Integer Safety**: Built-in overflow protection in Move language
- **Event Auditing**: All operations emit events for monitoring and compliance

## 🌐 Hyperion DEX Integration

### Supported Operations
- **Exact Input Swaps**: Specify input amount with minimum output protection
- **Multi-Hop Routing**: Automatic optimal path finding
- **Fee Tier Selection**: Configurable fee tiers for different trading pairs

### Integration Example
```move
// Execute swap through Hyperion
router_v3::exact_input_swap_entry(
    &resource_signer,
    fee_tier,
    amount_in,
    amount_out_min,
    sqrt_price_limit,
    from_token_metadata,
    to_token_metadata,
    resource_addr,
    deadline
);
```

## 📊 Event System

### Event Types

```move
#[event]
struct BalanceManagerCreatedEvent has drop, store {
    user: address,
    timestamp_microseconds: u64,
}

#[event]
struct UserDepositEvent has drop, store {
    user: address,
    asset_metadata: Object<Metadata>,
    amount: u64,
    timestamp_microseconds: u64,
}

#[event]
struct TradeSignalEvent has drop, store {
    user: address,
    from_asset_metadata: Object<Metadata>,
    to_asset_metadata: Object<Metadata>,
    amount_in: u64,
    amount_out: u64,
    fee_recipient: address,
    fee_amount: u64,
    timestamp_microseconds: u64,
}
```

## 🚀 TypeScript Integration

The `ts-scripts/` directory contains comprehensive TypeScript utilities for:
- Contract deployment and initialization
- User interaction scripts
- Admin management tools
- Trading signal automation
- Event monitoring and analytics

### Usage Example
```typescript
import { AptosVault } from './ts-scripts/vault-client';

const vault = new AptosVault(aptosConfig);
await vault.createBalanceManager(userAccount);
await vault.deposit(userAccount, tokenMetadata, amount);
```

## 🔧 Configuration

### Move.toml Configuration
```toml
[package]
name = "TradingFlowVault"
version = "1.0.0"

[addresses]
tradingflow_vault = "_"
hyperion = "0x[HYPERION_ADDRESS]"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework/", rev = "mainnet" }
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-vault-feature`
3. Write comprehensive tests for new functionality
4. Ensure all tests pass: `aptos move test`
5. Submit pull request with detailed description

### Code Standards
- Follow Move language best practices
- Include comprehensive error handling
- Add detailed documentation for all public functions
- Maintain test coverage above 90%

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**TradingFlow Aptos Vault** - Secure, efficient, and automated asset management on the Aptos blockchain.