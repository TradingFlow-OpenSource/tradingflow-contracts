# BSC PancakeSwap V3 迁移总结

## 迁移概述

本次迁移将 PersonalVault 合约从 Flow EVM (PunchSwap V2) 迁移到 BSC (PancakeSwap V3)，主要变更包括：

### 1. 合约文件变更

#### 已删除的文件：
- `PersonalVaultUpgradeableUniV2.sol` - 旧的 V2 金库合约

#### 重命名的文件：
- `PersonalVaultFactoryUniV2.sol` → `PersonalVaultFactoryUniV3.sol`

#### 更新的合约：
- `PersonalVaultFactoryUniV3.sol` - 工厂合约，适配 PancakeSwap V3
- `PersonalVaultUpgradeableUniV3.sol` - 金库合约，使用 PancakeSwap V3 SwapRouter

### 2. 主要技术变更

#### PancakeSwap V3 集成：
- 使用 `ISwapRouter` 接口进行代币交换
- 支持 V3 的精确输入单笔交换 (`exactInputSingle`)
- 集成费用池选择机制（0.05%, 0.25%, 1%）

#### BSC 网络适配：
- 原生代币从 FLOW 改为 BNB
- 包装代币从 WFLOW 改为 WBNB
- 网络配置从 Flow EVM 改为 BSC

### 3. PancakeSwap V3 合约地址 (BSC 主网)

```
SwapRouter:                0x1b81D678ffb9C0263b24A97847620C99d213eB14
Factory:                   0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865
NonfungiblePositionManager: 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364
QuoterV2:                  0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
SmartRouter:               0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
WBNB:                      0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### 4. 脚本和配置更新

#### 部署脚本：
- `scripts/deploy.js` - 更新为部署 V3 合约到 BSC
- `scripts/createVault.js` - 适配 V3 工厂合约
- `scripts/deploy_verify_create.sh` - 网络从 flow 改为 bsc
- `scripts/verifyVault.sh` - 验证链接改为 BSCScan

#### 测试文件：
- `test/03_swap.test.js` - 更新所有合约引用为 V3 版本

#### 环境配置：
- `.env.example` - 更新为 BSC 和 PancakeSwap V3 配置

### 5. 关键功能保持

以下核心功能在迁移后保持不变：
- UUPS 可升级代理模式
- 基于角色的访问控制 (RBAC)
- 费用扣除和转账机制
- 原生代币包装/解包装
- 事件日志记录

### 6. 部署步骤

1. **环境配置**：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，设置 BSC 相关配置
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **编译合约**：
   ```bash
   npx hardhat compile
   ```

4. **部署到 BSC 测试网**：
   ```bash
   # 设置 NETWORK=bscTestnet
   npx hardhat run scripts/deploy.js --network bscTestnet
   ```

5. **验证合约**：
   ```bash
   ./scripts/deploy_verify_create.sh
   ```

### 7. 测试建议

1. **本地测试**：
   ```bash
   npx hardhat test test/03_swap.test.js
   ```

2. **BSC 测试网测试**：
   - 部署到 BSC 测试网
   - 使用测试网 BNB 进行交换测试
   - 验证费用计算和转账

3. **主网部署前检查**：
   - 确认所有合约地址正确
   - 验证 gas 费用设置
   - 测试升级功能

### 8. 风险提示

- **Gas 费用**：BSC 的 gas 费用结构与 Flow EVM 不同
- **流动性**：确认目标代币对在 PancakeSwap V3 上有足够流动性
- **滑点设置**：V3 的价格影响可能与 V2 不同
- **费用层级**：V3 支持多个费用层级，需要选择合适的池子

### 9. 监控和维护

- 监控合约在 BSCScan 上的交易
- 关注 PancakeSwap V3 的协议更新
- 定期检查费用收取和转账功能
- 备份重要的私钥和配置

## 联系信息

如有问题或需要支持，请联系开发团队。
