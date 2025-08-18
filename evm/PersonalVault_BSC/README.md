# TradingFlow PersonalVault BSC

An advanced UUPS upgradeable personal vault system for BSC network, enabling individual asset management and automated trading through PancakeSwap V2 integration.

## 🏗️ Architecture Overview

The PersonalVault BSC implements a sophisticated individual vault model featuring:
- **UUPS Proxy Pattern**: Upgradeable smart contracts for seamless logic updates
- **Factory Deployment**: Efficient vault creation through factory pattern
- **Native Token Support**: Full support for BNB and ERC20 tokens
- **PancakeSwap Integration**: Direct integration with BSC's leading DEX

## 🚀 Key Features

### 💰 **Individual Asset Management**
- **Personal Vaults**: Each user deploys their own isolated vault instance
- **Multi-Token Support**: Manage BNB and various BEP20 tokens
- **Secure Custody**: User-controlled asset management with role-based access
- **Balance Tracking**: Real-time balance monitoring and transaction history

### 🤖 **Automated Trading**
- **PancakeSwap V2 Integration**: Direct integration with BSC's primary DEX
- **Oracle-Driven Signals**: Automated trade execution based on external signals
- **Fee Management**: Configurable fee structures with recipient management
- **Slippage Protection**: Advanced swap parameters for optimal execution

### 🔄 **Upgradeable Architecture**
- **UUPS Proxy Pattern**: Seamless contract upgrades without losing user data
- **Factory Pattern**: Gas-efficient vault deployment for all users
- **Backward Compatibility**: Maintain functionality across upgrades

## 📋 Contract Structure

```
contracts/
├── PersonalVaultUpgradeableUniV2.sol    # Core upgradeable vault logic
├── PersonalVaultFactoryUniV2.sol        # Factory for vault deployment
├── PersonalVaultUpgradeableUniV3.sol    # V3 backup implementation
├── TestToken.sol                         # Testing token contract
├── interfaces/                           # PancakeSwap V2 interfaces
└── libraries/                            # PancakeSwap V2 libraries
```

### Contract Architecture

```
PersonalVaultFactoryUniV2 ----creates----> ERC1967Proxy(PersonalVaultUpgradeableUniV2) <---- User Interaction
                          |                                                                |
                          |                                                                |
                          v                                                                |
                      Implementation Contract <-----------------------------------------upgrade
```

### Role-Based Access Control

#### Factory Contract Roles
- **`DEFAULT_ADMIN_ROLE`**: Add/remove BOTs, set new implementation contracts
- **`ADMIN_ROLE`**: Add/remove BOT roles
- **`BOT_ROLE`**: Automatically granted ORACLE_ROLE on all vaults

#### Vault Contract Roles
- **`DEFAULT_ADMIN_ROLE`**: User and factory contract, manage all permissions
- **`ADMIN_ROLE`**: Execute management operations
- **`ORACLE_ROLE`**: Execute trading operations (granted by factory to BOTs)

## 🛠️ Development Setup

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Install Hardhat
npm install --save-dev hardhat

# Verify installation
npx hardhat --version
```

### Environment Configuration

Create `.env` file:

```env
# Private key configuration
DEPLOYER_PRIVATE_KEY=0x...      # Deployer private key
USER_PRIVATE_KEY=0x...          # User private key

# Network configuration
NETWORK=bsc
BSC_RPC_URL=https://bsc-dataseed.binance.org/

# Contract addresses (auto-generated after deployment)
VAULT_ADDRESS=0x...             # User vault address

# PancakeSwap V2 configuration
SWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
WRAPPED_NATIVE=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

> ⚠️ **Security Warning**: Use separate development wallets and never commit private keys to repositories.

### Compilation & Deployment

```bash
# Compile contracts
npx hardhat compile

# Deploy to BSC testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# Deploy to BSC mainnet
npx hardhat run scripts/deploy.js --network bsc

# One-click deployment script
./scripts/deploy_verify_create.sh

# Verify vault instance
./scripts/verifyVault.sh
```

## 📖 API Reference

### User Functions

#### `depositNative()`
Deposits native BNB into the user's vault.
- **Access**: Vault owner only
- **Payment**: Requires sending BNB with transaction
- **Events**: Native token deposit event

#### `withdrawNative(uint256 amount)`
Withdraws specified amount of native BNB from vault.
- **Access**: Vault owner only
- **Parameters**: `amount` - Amount of BNB to withdraw
- **Events**: Native token withdrawal event

#### `depositToken(address token, uint256 amount)`
Deposits ERC20 tokens into the vault.
- **Access**: Vault owner only
- **Parameters**: `token` - Token contract address, `amount` - Amount to deposit
- **Events**: Token deposit event

#### `withdrawToken(address token, uint256 amount)`
Withdraws ERC20 tokens from the vault.
- **Access**: Vault owner only
- **Parameters**: `token` - Token contract address, `amount` - Amount to withdraw
- **Events**: Token withdrawal event

### Oracle Functions

#### `swapExactInputSingle(...)`
Executes token swaps through PancakeSwap V2.
- **Access**: `ORACLE_ROLE` only
- **Parameters**: Token addresses, amounts, fee recipient, fee rate
- **Features**: Supports native token and ERC20 swaps with fee collection

## 🧪 Testing

### Comprehensive Test Suite

```bash
# Run all tests
npx hardhat test --network bsc

# Run specific test suites
npx hardhat test test/01_basic_functionality.test.js --network bsc
npx hardhat test test/02_native_token.test.js --network bsc
npx hardhat test test/03_swap.test.js --network bsc
```

### Test Coverage Areas

#### Basic Functionality (`01_basic_functionality.test.js`)
- ✅ ERC20 token deposits and withdrawals
- ✅ Access control and permission management
- ✅ Contract upgrade mechanisms
- ✅ Factory vault creation

#### Native Token Support (`02_native_token.test.js`)
- ✅ Native BNB deposits and withdrawals
- ✅ Permission validation for native operations
- ✅ Balance tracking and event emission

#### Swap Functionality (`03_swap.test.js`) - **Mainnet Only**
- ✅ Oracle permission validation for swaps
- ✅ Real PancakeSwap V2 environment testing
- ✅ BNB ↔ BEP20 token exchanges
- ✅ BEP20 ↔ BEP20 token exchanges
- ✅ Fee calculation and distribution

## 🔐 Security Features

### Access Control Matrix

| Function | Vault Owner | Admin | Oracle/Bot | Factory |
|----------|-------------|-------|------------|---------|
| `depositNative/Token` | ✅ | ✅ | ❌ | ❌ |
| `withdrawNative/Token` | ✅ | ✅ | ❌ | ❌ |
| `swapExactInputSingle` | ❌ | ❌ | ✅ | ❌ |
| `upgradeToAndCall` | ✅ | ❌ | ❌ | ✅ |

### Security Measures
- **UUPS Proxy Security**: Secure upgrade mechanism with admin controls
- **Role-Based Access**: Granular permissions with factory-managed bot roles
- **Reentrancy Protection**: OpenZeppelin's security patterns
- **Native Token Handling**: Secure BNB deposit/withdrawal mechanisms
- **Slippage Protection**: Configurable maximum slippage for all trades

## 🌐 PancakeSwap Integration

### Supported Operations
- **Exact Input Swaps**: Specify input amount with minimum output protection
- **Native Token Swaps**: Automatic BNB/WBNB conversion handling
- **Multi-Hop Routing**: Optimal path finding through PancakeSwap V2
- **Fee Integration**: Built-in fee collection on all swap operations

### Integration Example
```javascript
// Swap native BNB for BEP20 token
const NATIVE_TOKEN = await vault.NATIVE_TOKEN();
await vault.connect(bot).swapExactInputSingle(
  NATIVE_TOKEN,
  TOKEN_ADDRESS,
  ethers.parseEther("0.01"),
  0, // Minimum output amount
  feeRecipient,
  feeRate
);
```

## 💰 Fee Mechanism

### Fee Structure
- **Fee Recipient**: Configurable address for fee collection
- **Fee Rate**: Parts per million (PPM) basis
  - `1` = 0.0001%
  - `1000` = 0.1%
  - `10000` = 1%

### Fee Calculation
Fees are deducted from swap outputs:
- **User Receives**: `amountOut - feeAmount`
- **Fee Amount**: `feeAmount = (amountOut * feeRate) / 1000000`

### Configuration
```bash
export FEE_RECIPIENT=0x... # Fee collection address
export FEE_RATE=1000       # Fee rate, 1000 = 0.1%
```

## 🚀 Deployment Scripts

The `scripts/` directory contains comprehensive deployment utilities:

### Core Scripts
- `deploy.js` - Deploy implementation and factory contracts
- `createVault.js` - Create personal vault for users
- `deploy_verify_create.sh` - One-click deployment and verification
- `verifyVault.sh` - Verify vault instance contracts

### Usage Examples
```bash
# Complete deployment pipeline
./scripts/deploy_verify_create.sh

# Verify existing vault
./scripts/verifyVault.sh

# Create new user vault
npx hardhat run scripts/createVault.js --network bsc
```

## 📊 Production Deployment

### BSC Mainnet Addresses
- **PersonalVault Implementation**: `0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a`
- **Factory Contract**: `0x486eDaD5bBbDC8eD5518172b48866cE747899D89`
- **PancakeSwap Router**: `0x10ED43C718714eb63d5aA57B78B54704E256024E`

### Recommended Environment Variables
```bash
PERSONAL_VAULT_IMPL_ADDRESS=0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a
FACTORY_ADDRESS=0x486eDaD5bBbDC8eD5518172b48866cE747899D89
SWAP_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
WRAPPED_NATIVE=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### Network Explorers
- **BSC Mainnet**: [https://bscscan.com/](https://bscscan.com/)
- **BSC Testnet**: [https://testnet.bscscan.com/](https://testnet.bscscan.com/)

## 🔧 Configuration

### Hardhat Configuration
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  }
};
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-vault-feature`
3. Implement changes with comprehensive tests
4. Ensure all tests pass: `npx hardhat test`
5. Submit pull request with detailed description

### Code Standards
- Follow Solidity best practices and OpenZeppelin patterns
- Include comprehensive error handling and validation
- Add detailed NatSpec documentation for all functions
- Maintain test coverage above 90%

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**TradingFlow PersonalVault BSC** - Secure, upgradeable personal asset management on Binance Smart Chain.
