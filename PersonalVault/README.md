# PersonalVault 模块

本模块基于 EVM，支持每个用户独立部署自己的金库（Vault），由 PersonalVaultFactory 管理。

## 目录结构

- contracts/
  - PersonalVault.sol  // 单用户金库合约
  - PersonalVaultFactory.sol // 工厂合约
- scripts/
  - 示例脚本（如一键部署、存款、取款、交易等）
- test/
  - 单元测试（推荐 Hardhat/Foundry）
- README.md

## 主要功能
- 用户通过 Factory 创建属于自己的 Vault
- 支持多资产（ERC20）存取
- 支持 Bot/Admin 触发的交易信号（与 DEX 路由合约交互）
- 事件追踪与余额查询接口

## 快速开始

### 1. 部署工厂合约
```shell
npx hardhat run scripts/deployFactory.ts --network <your_network>
```

### 2. 创建个人金库
```shell
npx hardhat run scripts/createVault.ts --network <your_network>
```

### 3. 存款/取款/交易信号
见 scripts/ 目录下示例脚本。

## 权限说明
- 仅金库拥有者可存取款
- 仅 Factory 管理员可添加/移除 Bot
- Bot 可发起 tradeSignal

## 事件
- VaultInitialized
- UserDeposit
- UserWithdraw
- TradeSignal

## 测试
建议使用 Hardhat/Foundry 编写测试用例，覆盖存取款、交易、权限管理等核心场景。

---
如需定制脚本或有特殊业务需求，请联系开发者。
