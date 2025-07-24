# Vault Debug Scripts Collection

这个文件夹包含了在 TradingFlow Vault 合约开发和调试过程中创建的各种调试脚本。

## 📁 文件结构

### 🔗 BSC 链调试脚本 (`BSC/`)
- **`debugCreateVault.js`** - 调试 BSC 链上 Vault 创建功能
- **`debugFactory.js`** - 调试 BSC Vault Factory 合约交互
- **`debug_error.js`** - BSC 链错误调试和问题排查

### 🌊 Flow EVM 链调试脚本 (`Flow-EVM/`)
- **`debugCreateVault.js`** - 调试 Flow EVM 链上 Vault 创建功能
- **`debugFactory.js`** - 调试 Flow EVM Vault Factory 合约交互
- **`debug_error.js`** - Flow EVM 链错误调试和问题排查

## 🚀 使用方法

这些脚本通常需要在对应的合约项目目录下运行：

```bash
# BSC 调试脚本
cd /path/to/PersonalVault_BSC
node ../../../debug_scripts/BSC/debugCreateVault.js

# Flow EVM 调试脚本
cd /path/to/PersonalVault_Flow-EVM
node ../../../debug_scripts/Flow-EVM/debugCreateVault.js
```

## ⚙️ 环境要求

1. **Node.js 环境**：需要 Node.js 和相关依赖包
2. **网络连接**：需要连接到对应的区块链网络（BSC 或 Flow EVM）
3. **私钥配置**：部分脚本需要配置钱包私钥进行交易
4. **合约地址**：确保脚本中的合约地址是正确的

## ⚠️ 安全注意事项

1. **私钥安全**：这些调试脚本可能包含测试私钥，请勿在生产环境使用
2. **网络选择**：确保连接到正确的测试网络，避免在主网上执行调试操作
3. **Gas 费用**：调试脚本可能会消耗 Gas 费用，请确保测试账户有足够余额

## 📝 开发历史

这些脚本是在以下开发阶段创建的：
- Vault 合约部署和测试
- Factory 合约功能验证
- 跨链功能调试
- 错误处理和异常情况测试

## 🔗 相关资源

- [BSC Vault 合约](../evm/PersonalVault_BSC/)
- [Flow EVM Vault 合约](../evm/PersonalVault_Flow-EVM/)
- [合约部署文档](../README.md)
