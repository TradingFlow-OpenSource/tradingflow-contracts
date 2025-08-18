# TradingFlow PersonalVault Flow EVM

An advanced UUPS upgradeable personal vault system for Flow EVM network, enabling individual asset management and automated trading through PunchSwap V2 integration with gas-sponsored transactions.

## 🏗️ Architecture Overview

The PersonalVault Flow EVM implements a sophisticated individual vault model featuring:
- **UUPS Proxy Pattern**: Upgradeable smart contracts for seamless logic updates
- **Factory Deployment**: Efficient vault creation through factory pattern
- **Native FLOW Support**: Full support for FLOW and ERC20 tokens
- **PunchSwap Integration**: Direct integration with Flow's leading DEX
- **Gas Sponsorship**: Leverage Flow wallet's automatic gas fee sponsorship

## 🚀 Key Features

### 💰 **Individual Asset Management**
- **Personal Vaults**: Each user deploys their own isolated vault instance
- **Multi-Token Support**: Manage FLOW and various ERC20 tokens
- **Secure Custody**: User-controlled asset management with role-based access
- **Balance Tracking**: Real-time balance monitoring and transaction history

### 🤖 **Automated Trading**
- **PunchSwap V2 Integration**: Direct integration with Flow EVM's primary DEX
- **Oracle-Driven Signals**: Automated trade execution based on external signals
- **Fee Management**: Configurable fee structures with recipient management
- **Slippage Protection**: Advanced swap parameters for optimal execution

### 🔄 **Upgradeable Architecture**
- **UUPS Proxy Pattern**: Seamless contract upgrades without losing user data
- **Factory Pattern**: Gas-efficient vault deployment for all users
- **Backward Compatibility**: Maintain functionality across upgrades

### 🌊 **Flow EVM Benefits**
- **Gas Sponsorship**: Flow wallet automatically sponsors gas fees for users
- **High Performance**: Fast transaction finality and low costs
- **Developer Friendly**: Full EVM compatibility with enhanced user experience

## 📋 Contract Structure

```
contracts/
├── PersonalVaultUpgradeableUniV2.sol    # Core upgradeable vault logic
├── PersonalVaultFactoryUniV2.sol        # Factory for vault deployment
├── PersonalVaultUpgradeableUniV3.sol    # V3 backup implementation
├── TestToken.sol                         # Testing token contract
├── interfaces/                           # PunchSwap V2 interfaces
└── libraries/                            # PunchSwap V2 libraries
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
NETWORK=flow
FLOW_RPC_URL=https://mainnet.evm.nodes.onflow.org

# Contract addresses (auto-generated after deployment)
VAULT_ADDRESS=0x...             # User vault address

# PunchSwap V2 configuration
SWAP_ROUTER=0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d
WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
```

> ⚠️ **Security Warning**: Use separate development wallets and never commit private keys to repositories.

### Compilation & Deployment

```bash
# Compile contracts
npx hardhat compile

# Deploy to Flow EVM mainnet
npx hardhat run scripts/deploy.js --network flow

# One-click deployment script
./scripts/deploy_verify_create.sh

# Verify vault instance
./scripts/verifyVault.sh
```

## 📖 API Reference

### User Functions

#### `depositNative()`
Deposits native FLOW into the user's vault.
- **Access**: Vault owner only
- **Payment**: Requires sending FLOW with transaction
- **Events**: Native token deposit event
- **Gas**: Sponsored by Flow wallet

#### `withdrawNative(uint256 amount)`
Withdraws specified amount of native FLOW from vault.
- **Access**: Vault owner only
- **Parameters**: `amount` - Amount of FLOW to withdraw
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
Executes token swaps through PunchSwap V2.
- **Access**: `ORACLE_ROLE` only
- **Parameters**: Token addresses, amounts, fee recipient, fee rate
- **Features**: Supports native FLOW and ERC20 swaps with fee collection

## 🧪 Testing

### Comprehensive Test Suite

> ⚠️ **Important**: Swap functionality can only be tested on Flow EVM mainnet due to real PunchSwap V2 DEX integration requirements.

```bash
# Run all tests on Flow EVM mainnet
npx hardhat test --network flow

# Run specific test suites
npx hardhat test test/01_basic_functionality.test.js --network flow
npx hardhat test test/02_native_token.test.js --network flow
npx hardhat test test/03_swap.test.js --network flow  # Mainnet only
```

### Test Coverage Areas

#### Basic Functionality (`01_basic_functionality.test.js`)
- ✅ ERC20 token deposits and withdrawals
- ✅ Access control and permission management
- ✅ Contract upgrade mechanisms
- ✅ Factory vault creation

#### Native Token Support (`02_native_token.test.js`)
- ✅ Native FLOW deposits and withdrawals
- ✅ Permission validation for native operations
- ✅ Balance tracking and event emission

#### Swap Functionality (`03_swap.test.js`) - **Mainnet Only**
- ✅ Oracle permission validation for swaps
- ✅ Real PunchSwap V2 environment testing
- ✅ FLOW ↔ ERC20 token exchanges
- ✅ ERC20 ↔ ERC20 token exchanges
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
- **Native Token Handling**: Secure FLOW deposit/withdrawal mechanisms
- **Slippage Protection**: Configurable maximum slippage for all trades

## 🌐 PunchSwap Integration

### Supported Operations
- **Exact Input Swaps**: Specify input amount with minimum output protection
- **Native Token Swaps**: Automatic FLOW/WFLOW conversion handling
- **Multi-Hop Routing**: Optimal path finding through PunchSwap V2
- **Fee Integration**: Built-in fee collection on all swap operations

### Integration Example
```javascript
// Swap native FLOW for ERC20 token
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

### Native Token Support

The vault uses special address `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` to represent native FLOW:
- **Automatic Conversion**: Seamless FLOW/WFLOW handling during swaps
- **Direct Deposits**: Accept native FLOW through `depositNative()`
- **Secure Withdrawals**: Direct FLOW withdrawal through `withdrawNative()`
- **Receive Function**: Contract can accept direct FLOW transfers

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
npx hardhat run scripts/createVault.js --network flow
```

## 🌊 Flow Wallet Integration

### User Experience Benefits
1. **Setup Flow Wallet**: [https://wallet.flow.com/](https://wallet.flow.com/)
2. **Connect to Mainnet**: Automatic network detection
3. **Gas-Free Transactions**: Flow wallet sponsors gas fees automatically
4. **Seamless Interaction**: Standard EVM wallet interface

### Contract Verification
- **Flow EVM Explorer**: [https://evm.flowscan.io/](https://evm.flowscan.io/)
- **Real-time Monitoring**: Track all vault operations and transactions

## 📊 Production Deployment

### Flow EVM Mainnet Addresses
- **PersonalVault Implementation**: `0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a`
- **Factory Contract**: `0x486eDaD5bBbDC8eD5518172b48866cE747899D89`
- **PunchSwap Router**: `0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d`

### Recommended Environment Variables
```bash
PERSONAL_VAULT_IMPL_ADDRESS=0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a
FACTORY_ADDRESS=0x486eDaD5bBbDC8eD5518172b48866cE747899D89
SWAP_ROUTER=0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d
WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
```

### Network Information
- **Chain ID**: 747
- **RPC URL**: `https://mainnet.evm.nodes.onflow.org`
- **Explorer**: [https://evm.flowscan.io/](https://evm.flowscan.io/)

## 🔧 Configuration

### Hardhat Configuration
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    flow: {
      url: "https://mainnet.evm.nodes.onflow.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 747
    }
  },
  etherscan: {
    apiKey: {
      flow: "YOUR_FLOWSCAN_API_KEY"
    },
    customChains: [
      {
        network: "flow",
        chainId: 747,
        urls: {
          apiURL: "https://evm.flowscan.io/api",
          browserURL: "https://evm.flowscan.io"
        }
      }
    ]
  }
};
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-vault-feature`
3. Implement changes with comprehensive tests
4. Test on Flow EVM mainnet: `npx hardhat test --network flow`
5. Submit pull request with detailed description

### Code Standards
- Follow Solidity best practices and OpenZeppelin patterns
- Include comprehensive error handling and validation
- Add detailed NatSpec documentation for all functions
- Test all functionality on Flow EVM mainnet

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**TradingFlow PersonalVault Flow EVM** - Secure, upgradeable personal asset management on Flow EVM with gas-sponsored transactions.
