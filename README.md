# TradingFlow Smart Contracts

A comprehensive multi-chain smart contract suite providing decentralized vault services and automated trading capabilities across Aptos, EVM-compatible chains, and Solana ecosystems.

## 🏗️ Architecture Overview

```
4_weather_vault/
├── aptos/                    # Aptos blockchain smart contracts
│   ├── sources/             # Move language contract source code
│   └── ts-scripts/          # TypeScript deployment and testing scripts
├── evm/                     # EVM-compatible chain smart contracts
│   ├── MultiVault/          # Multi-user shared vault contracts
│   ├── PersonalVault_BSC/   # Personal vault for BSC network
│   └── PersonalVault_Flow-EVM/ # Personal vault for Flow EVM network
├── solana/                  # Solana blockchain smart contracts
│   └── PersonalVault/       # Personal vault for Solana network
└── debug_scripts/           # Network-specific debugging utilities
```

## 🚀 Key Features

### 💰 **Multi-Chain Asset Management**
- Support for multiple token standards across different blockchains
- Unified vault interface for seamless cross-chain operations
- Real-time asset valuation and portfolio tracking

### 🤖 **Automated Trading**
- Oracle-driven trading signals and execution
- Integration with major DEX protocols (Uniswap V2/V3, PunchSwap, Hyperion)
- Advanced swap parameters with slippage protection

### 🛡️ **Security & Access Control**
- Role-based permission system (Admin, Oracle, Bot roles)
- Multi-signature support for critical operations
- Comprehensive audit trail and event logging

### 🔄 **Upgradeable Architecture**
- UUPS proxy pattern for seamless contract upgrades
- Factory pattern for efficient vault deployment
- Backward compatibility maintenance

## 📋 Supported Networks

| Network | Contract Type | DEX Integration | Status |
|---------|---------------|-----------------|---------|
| **Aptos** | Move-based Vault | Hyperion DEX | ✅ Production |
| **Flow EVM** | Personal/Multi Vault | PunchSwap V2 | ✅ Production |
| **BSC** | Personal Vault | PancakeSwap V2 | ✅ Production |
| **Ethereum** | Multi Vault | Uniswap V2/V3 | ✅ Production |
| **Solana** | Personal Vault | Jupiter/Raydium | 🚧 Development |

## 🏛️ Contract Architecture

### Aptos Vault (`aptos/`)
- **Language**: Move
- **Core Contract**: `vault_v1.move`
- **Features**: 
  - Fungible asset management with Aptos standards
  - Hyperion DEX integration for automated trading
  - Event-driven architecture for transaction tracking
  - Resource account pattern for secure asset custody

### EVM Vaults (`evm/`)

#### Personal Vault
- **Pattern**: UUPS Upgradeable Proxy
- **Networks**: Flow EVM, BSC
- **Features**:
  - Individual user vault deployment
  - Native token support (ETH, FLOW, BNB)
  - ERC20 token management
  - Automated trading with fee mechanisms

#### Multi Vault
- **Pattern**: ERC4626 Tokenized Vault Standard
- **Features**:
  - Shared liquidity pools
  - Proportional share-based accounting
  - Oracle-guided trading strategies
  - Emergency exit mechanisms

### Solana Vault (`solana/`)
- **Language**: Rust
- **Architecture**: Program Derived Addresses (PDA)
- **Features**:
  - Account-based data storage
  - SPL token support
  - Cross-program invocations for DEX integration

## 🛠️ Development Setup

### Prerequisites
```bash
# Node.js and npm/yarn
node --version  # v18+
npm --version

# Blockchain-specific tools
# For Aptos
aptos --version

# For EVM chains
npx hardhat --version

# For Solana
solana --version
cargo --version
```

### Quick Start

1. **Clone and Install Dependencies**
```bash
cd 4_weather_vault
npm install
```

2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Configure network-specific variables
# DEPLOYER_PRIVATE_KEY, RPC_URLs, etc.
```

3. **Deploy Contracts**
```bash
# Aptos
cd aptos && npm run deploy

# EVM (Flow/BSC)
cd evm/PersonalVault_Flow-EVM && ./scripts/deploy_verify_create.sh

# Solana
cd solana && cargo build-bpf && solana program deploy
```

## 📖 Documentation

### Network-Specific Guides
- **Aptos**: [`aptos/README.md`](./aptos/README.md) - Move contract deployment and testing
- **Flow EVM**: [`evm/PersonalVault_Flow-EVM/README.md`](./evm/PersonalVault_Flow-EVM/README.md) - UUPS proxy deployment
- **BSC**: [`evm/PersonalVault_BSC/README.md`](./evm/PersonalVault_BSC/README.md) - PancakeSwap integration
- **Multi Vault**: [`evm/MultiVault/README.md`](./evm/MultiVault/README.md) - ERC4626 vault standard
- **Solana**: [`solana/README.md`](./solana/README.md) - Account model vs EVM comparison

### API References
Each contract directory contains comprehensive API documentation with:
- Function signatures and parameters
- Event definitions and data structures
- Integration examples and best practices
- Security considerations and access controls

## 🧪 Testing

### Comprehensive Test Suite
```bash
# Run all tests
npm test

# Network-specific testing
cd aptos && npm test                    # Move contract tests
cd evm/PersonalVault_BSC && npm test   # Hardhat tests with real DEX
cd solana && cargo test                 # Rust unit tests
```

### Test Coverage
- **Unit Tests**: Individual function testing
- **Integration Tests**: Cross-contract interactions
- **End-to-End Tests**: Real DEX environment testing
- **Security Tests**: Access control and edge cases

## 🔐 Security Features

### Access Control Matrix
| Role | Personal Vault | Multi Vault | Factory Contract |
|------|---------------|-------------|------------------|
| **Owner** | Full control | Share management | N/A |
| **Admin** | Management ops | Strategy control | Bot management |
| **Oracle/Bot** | Trading signals | Trade execution | Vault creation |
| **User** | Deposit/Withdraw | Deposit/Withdraw | N/A |

### Security Measures
- **Reentrancy Protection**: OpenZeppelin's ReentrancyGuard
- **Integer Overflow**: Solidity 0.8+ built-in protection
- **Access Control**: Role-based permissions with time locks
- **Emergency Mechanisms**: Circuit breakers and emergency exits
- **Audit Trail**: Comprehensive event logging for all operations

## 🌐 Integration Examples

### Trading Signal Integration
```solidity
// Oracle sends trading signal
function sendTradeSignal(
    address user,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    address feeRecipient,
    uint256 feeRate
) external onlyRole(ORACLE_ROLE);
```

### Multi-Chain Asset Transfer
```javascript
// Cross-chain vault interaction
const vaultAptos = new AptosVault(aptosConfig);
const vaultEVM = new EVMVault(evmConfig);

// Transfer assets between chains
await vaultAptos.withdraw(tokenA, amount);
await bridgeProtocol.transfer(tokenA, evmChain);
await vaultEVM.deposit(tokenA, amount);
```

## 📊 Production Deployments

### Mainnet Addresses

#### Flow EVM Mainnet
- **PersonalVault Implementation**: `0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a`
- **Factory Contract**: `0x486eDaD5bBbDC8eD5518172b48866cE747899D89`
- **PunchSwap Router**: `0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d`

#### Aptos Mainnet
- **Module Address**: `0x[MODULE_ADDRESS]::vault`
- **Resource Account**: Auto-generated during deployment

### Network Explorers
- **Flow EVM**: [https://evm.flowscan.io/](https://evm.flowscan.io/)
- **Aptos**: [https://explorer.aptoslabs.com/](https://explorer.aptoslabs.com/)
- **BSC**: [https://bscscan.com/](https://bscscan.com/)

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-vault-type`
3. Implement changes with comprehensive tests
4. Submit pull request with detailed description

### Code Standards
- **Solidity**: Follow OpenZeppelin patterns and NatSpec documentation
- **Move**: Adhere to Aptos Move style guide
- **Rust**: Use standard Rust conventions with comprehensive error handling
- **TypeScript**: ESLint configuration with strict type checking

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

For technical support, integration questions, or custom development needs:
- **Documentation**: Check network-specific README files
- **Issues**: GitHub Issues for bug reports and feature requests
- **Community**: Join our developer Discord for real-time support

---

**TradingFlow Smart Contracts** - Powering the next generation of decentralized trading infrastructure across multiple blockchain ecosystems.
