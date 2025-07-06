# MultiVault 模块

本模块为“多人金库”系统，支持多个用户共同存取和管理资产，基于 EVM 合约实现，适合团队、DAO 或多签场景。

## 目录结构
- contracts/
  - UniswapVault.sol  // 多人金库核心合约
  - PriceOracle.sol   // 价格预言机合约
  - MyToken.sol       // 示例代币合约
- scripts/
  - 各类金库/交易/管理相关脚本
- test/
  - 单元测试（推荐 Hardhat/Foundry）
- README.md

## 主要功能
- 多用户可共同存入、赎回资产
- 支持多种 ERC20 资产
- 支持策略管理、交易信号、Uniswap 路由集成
- 事件追踪、资产配置查询

## 快速开始
### 1. 部署合约
```shell
npx hardhat run scripts/deployVault.ts --network <your_network>
```

### 2. 存款/赎回/交易
见 scripts/ 目录下示例脚本。

## 权限说明
- 管理员可配置策略、添加/禁用交易对
- 预言机/Bot 可发起交易信号
- 用户可存取资产

## 事件
- SignalReceived
- TradeExecuted
- StrategyStatusChanged
- UserDeposit/UserWithdraw

## 测试
建议使用 Hardhat/Foundry 编写测试用例，覆盖多用户存取、策略执行、权限管理等核心场景。

---
如需定制脚本或有特殊业务需求，请联系开发者。
