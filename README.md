# TradingFlow 智能合约

## 目录结构

```
contracts/
├── aptos/          # Aptos区块链智能合约
│   ├── sources/    # Move语言合约源码
│   └── ts-scripts/ # TypeScript部署和测试脚本
└── evm/           # EVM兼容链智能合约
    ├── MultiVault/     # 多用户共享金库合约
    └── PersonalVault/  # 个人专属金库合约
```

## 合约概述

### Aptos 合约

- **语言**: Move
- **功能**: 提供 Aptos 生态系统的 DeFi 金库服务
- **特点**: 利用 Move 语言的安全性和资源管理特性

### EVM 合约

- **语言**: Solidity
- **支持网络**: Flow EVM, Ethereum 及其他 EVM 兼容链
- **合约类型**:
  - **PersonalVault**: 个人专属金库，支持资产管理和自动化交易
  - **MultiVault**: 多用户共享金库，实现资金池管理

## 部署说明

每个子目录都包含各自的 README 文件，提供详细的部署和使用说明：

- `aptos/README.zh-CN.md` - Aptos 合约文档
- `evm/PersonalVault/README.md` - 个人金库合约文档
- `evm/MultiVault/README.md` - 多用户金库合约文档

## 主要功能

- 💰 **资产管理**: 支持多种代币的存储和管理
- 🔄 **自动交易**: 智能合约执行的自动化交易策略
- 🛡️ **安全保障**: 多层权限控制和安全机制
- 🌐 **跨链支持**: 支持多个区块链网络
