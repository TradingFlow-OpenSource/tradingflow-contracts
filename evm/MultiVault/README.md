# TradingFlow MultiVault

An advanced ERC4626-compliant multi-user vault system enabling shared asset management and automated trading strategies across EVM-compatible networks.

## 🏗️ Architecture Overview

The MultiVault system implements a sophisticated shared liquidity model where multiple users can:
- **Pool Assets**: Contribute to shared liquidity pools with proportional ownership
- **Automated Trading**: Benefit from algorithmic trading strategies managed by oracles
- **Share-Based Accounting**: Receive vault tokens representing proportional ownership
- **Collective Benefits**: Leverage pooled capital for better trading opportunities

## 🚀 Key Features

### 💰 **ERC4626 Vault Standard**
- **Tokenized Shares**: Full compatibility with ERC4626 standard for vault tokens
- **Proportional Ownership**: Share-based accounting for fair asset distribution
- **Real-Time Valuation**: Continuous portfolio value calculation across multiple assets
- **Standardized Interface**: Compatible with DeFi protocols and yield aggregators

### 🤖 **Oracle-Guided Trading**
- **Automated Signals**: Execute buy/sell operations based on external oracle inputs
- **Multi-Pair Support**: Trade across multiple token pairs with configurable limits
- **Advanced Parameters**: Custom fee tiers, slippage protection, and price limits
- **Strategy Management**: Configurable trading strategies with activation controls

### 🔐 **Role-Based Security**
- **Platform Owner**: Manages oracle roles and emergency functions
- **Strategy Manager**: Controls trading pairs and strategy activation/deactivation
- **Oracle Role**: Executes trading signals with predetermined parameters
- **Users**: Deposit/withdraw assets and receive proportional vault shares

## 📋 Contract Structure

```
contracts/
├── UniswapVault.sol          # Core ERC4626 vault implementation
├── PriceOracle.sol           # Price feed and valuation oracle
└── MyToken.sol               # Example ERC20 token for testing
```

### Core Contract: `UniswapVault.sol`

```solidity
contract OracleGuidedVault is ERC4626, AccessControl, ReentrancyGuard {
    // Role definitions
    bytes32 public constant PLATFORM_OWNER_ROLE = keccak256("PLATFORM_OWNER_ROLE");
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Core functions
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function executeBuySignal(address tokenToBuy, uint256 amountIn, ...) external onlyRole(ORACLE_ROLE);
    function executeSellSignal(address tokenToSell, uint256 amountOut, ...) external onlyRole(ORACLE_ROLE);
}
```

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

```bash
# Copy environment template
cp .env.example .env

# Configure required variables
PRIVATE_KEY=0x...
INFURA_API_KEY=...
ETHERSCAN_API_KEY=...
```

### Compilation & Deployment

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deployVault.ts --network goerli

# Deploy to mainnet
npx hardhat run scripts/deployVault.ts --network mainnet

# Verify contracts
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
```

## 📖 API Reference

### User Functions

#### `deposit(uint256 assets, address receiver)`
Deposits assets into the vault and mints proportional shares.
- **Parameters**: `assets` - Amount to deposit, `receiver` - Share recipient
- **Returns**: Number of vault shares minted
- **Events**: `Deposit(caller, receiver, assets, shares)`

#### `withdraw(uint256 assets, address receiver, address owner)`
Withdraws assets from the vault by burning shares.
- **Parameters**: `assets` - Amount to withdraw, `receiver` - Asset recipient, `owner` - Share owner
- **Returns**: Number of shares burned
- **Events**: `Withdraw(caller, receiver, owner, assets, shares)`

### Oracle Functions

#### `executeBuySignal(address tokenToBuy, uint256 amountIn, ...)`
Executes automated buy orders based on oracle signals.
- **Access**: `ORACLE_ROLE` only
- **Parameters**: Target token, input amount, swap parameters
- **Events**: `SignalReceived`, `TradeExecuted`

#### `executeSellSignal(address tokenToSell, uint256 amountOut, ...)`
Executes automated sell orders for portfolio rebalancing.
- **Access**: `ORACLE_ROLE` only
- **Parameters**: Source token, output amount, swap parameters
- **Events**: `SignalReceived`, `TradeExecuted`

### Management Functions

#### `addTradingPair(address tokenA, address tokenB, uint256 maxAllocation)`
Adds new trading pairs to the vault strategy.
- **Access**: `STRATEGY_MANAGER_ROLE` only
- **Parameters**: Token pair addresses and maximum allocation percentage

#### `setStrategyStatus(bool active)`
Activates or deactivates automated trading strategies.
- **Access**: `STRATEGY_MANAGER_ROLE` only
- **Events**: `StrategyStatusChanged`

## 🧪 Testing

### Comprehensive Test Suite

```bash
# Run all tests
npx hardhat test

# Run specific test files
npx hardhat test test/MultiVault.test.js
npx hardhat test test/Oracle.test.js

# Run tests with coverage
npx hardhat coverage
```

### Test Coverage Areas
- ✅ **ERC4626 Compliance**: Standard vault operations and share calculations
- ✅ **Multi-User Operations**: Concurrent deposits, withdrawals, and share management
- ✅ **Oracle Integration**: Automated trading signal execution and validation
- ✅ **Access Control**: Role-based permission testing and security validation
- ✅ **Emergency Scenarios**: Circuit breakers and emergency exit mechanisms
- ✅ **Edge Cases**: Slippage protection, insufficient liquidity, and error handling

## 🔐 Security Features

### Access Control Matrix

| Function | Platform Owner | Strategy Manager | Oracle | Users |
|----------|---------------|------------------|---------|-------|
| `deposit/withdraw` | ✅ | ✅ | ✅ | ✅ |
| `executeBuySignal` | ❌ | ❌ | ✅ | ❌ |
| `executeSellSignal` | ❌ | ❌ | ✅ | ❌ |
| `addTradingPair` | ✅ | ✅ | ❌ | ❌ |
| `setStrategyStatus` | ✅ | ✅ | ❌ | ❌ |
| `emergencyExit` | ✅ | ❌ | ❌ | ❌ |

### Security Measures
- **Reentrancy Protection**: OpenZeppelin's ReentrancyGuard on all external calls
- **Role-Based Access**: Granular permissions with time-locked admin functions
- **Slippage Protection**: Configurable maximum slippage for all trades
- **Emergency Controls**: Circuit breakers and emergency asset recovery
- **Audit Trail**: Comprehensive event logging for all operations

## 🌐 Uniswap Integration

### Supported Operations
- **Exact Input Swaps**: Specify input amount with minimum output protection
- **Exact Output Swaps**: Specify desired output with maximum input limits
- **Multi-Hop Routing**: Automatic optimal path finding through Uniswap V3
- **Fee Tier Selection**: Support for 0.05%, 0.3%, and 1% fee tiers

### Integration Example
```solidity
// Execute swap through Uniswap V3
ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    fee: feeTier,
    recipient: address(this),
    deadline: block.timestamp + 300,
    amountIn: amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0
});

swapRouter.exactInputSingle(params);
```

## 📊 Event System

### Core Events

```solidity
event SignalReceived(
    address indexed oracle,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 timestamp
);

event TradeExecuted(
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 timestamp
);

event StrategyStatusChanged(
    bool indexed active,
    address indexed manager,
    uint256 timestamp
);
```

## 🚀 Deployment Scripts

The `scripts/` directory contains comprehensive deployment and management utilities:

### Deployment Scripts
- `deployVault.ts` - Deploy vault with initial configuration
- `setupRoles.ts` - Configure access control roles
- `addTradingPairs.ts` - Initialize supported trading pairs

### Management Scripts
- `executeTradeSignal.ts` - Manual trade signal execution
- `updateStrategy.ts` - Modify trading strategy parameters
- `emergencyExit.ts` - Emergency asset recovery procedures

### Usage Example
```bash
# Deploy complete vault system
npx hardhat run scripts/deployVault.ts --network mainnet

# Setup initial roles and permissions
npx hardhat run scripts/setupRoles.ts --network mainnet

# Add supported trading pairs
npx hardhat run scripts/addTradingPairs.ts --network mainnet
```

## 🔧 Configuration

### Hardhat Configuration
```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
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
- Include NatSpec documentation for all public functions
- Maintain test coverage above 95%
- Use consistent naming conventions and code formatting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**TradingFlow MultiVault** - Advanced shared asset management with automated trading strategies for the DeFi ecosystem.

