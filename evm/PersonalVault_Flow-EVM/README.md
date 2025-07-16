# PersonalVault 模块（UUPS 可升级 Proxy 版 - Uniswap V2）

本模块基于 EVM，采用 UUPS Proxy 可升级模式，每个用户独立部署自己的金库（Vault），便于后续合约逻辑升级。支持标准 EVM 链和 Flow EVM 部署。支持原生代币（ETH/FLOW）和 ERC20 代币的存取和交换。使用 Uniswap V2/PunchSwap V2 进行代币交换操作。

---

## 目录结构

- contracts/
  - PersonalVaultUpgradeableUniV2.sol // 可升级逻辑合约（Uniswap V2/PunchSwap V2 版本）
  - PersonalVaultFactoryUniV2.sol // 工厂合约（Uniswap V2/PunchSwap V2 版本）
  - PersonalVaultUpgradeableUniV3.sol // 可升级逻辑合约（Uniswap V3 版本备份）
  - TestToken.sol // 测试代币合约
  - interfaces/ // Uniswap V2 接口文件
  - libraries/ // Uniswap V2 库文件
- scripts/
  - deploy.js // 部署逻辑合约和工厂合约脚本
  - createVault.js // 用户创建个人金库脚本
  - deploy_verify_create.sh // 一键部署验证脚本
  - verifyVault.sh // 验证金库实例脚本
  - backup/ // 备份脚本
- test/
  - 01_basic_functionality.test.js // 基本功能测试（存取款、权限管理）
  - 02_native_token.test.js // 原生代币功能测试
  - 03_swap.test.js // 交换功能和权限测试（真实 DEX 环境）
- abi/ // 合约 ABI 文件
- README.md

---

## 二、合约架构

### 1. 合约关系

```
PersonalVaultFactoryUniV2 ----创建----> ERC1967Proxy(PersonalVaultUpgradeableUniV2) <---- 用户交互
                          |                                                        |
                          |                                                        |
                          |                                                        |
                          v                                                        |
                      PersonalVaultUpgradeableUniV2实现合约 <---------------------升级
```

### 2. 合约角色

- **工厂合约角色**

  - `DEFAULT_ADMIN_ROLE`: 可以添加/移除 BOT，设置新的实现合约
  - `ADMIN_ROLE`: 可以添加/移除 BOT
  - `BOT_ROLE`: 自动获得所有金库的 ORACLE_ROLE

- **金库合约角色**
  - `DEFAULT_ADMIN_ROLE`: 用户和工厂合约，可以管理所有权限
  - `ADMIN_ROLE`: 可以执行管理操作
  - `ORACLE_ROLE`: 可以执行交易操作（由工厂合约授予给 BOT）

---

## 三、部署流程

### 1. 环境变量设置

创建 `.env` 文件：

```env
# 私钥配置
DEPLOYER_PRIVATE_KEY=0x...      # 部署者私钥
USER_PRIVATE_KEY=0x...         # 用户私钥

# 网络配置
NETWORK=flow
FLOW_RPC_URL=https://mainnet.evm.nodes.onflow.org

# 合约地址（部署后自动生成）
VAULT_ADDRESS=0x...            # 用户金库地址

# PunchSwap V2 配置
SWAP_ROUTER=0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d
WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
```

> ⚠️ 警告：请使用单独的开发钱包，切勿将私钥提交到代码库。

### 2. 一键部署到 Flow EVM 主网

```bash
# 一键部署实现合约、工厂合约和创建金库
./scripts/deploy_verify_create.sh
```

### 3. 验证金库实例

```bash
# 验证.env中VAULT_ADDRESS的合约实例
./scripts/verifyVault.sh
```

---

## 四、测试流程

> ⚠️ **重要说明**：swap 交换功能只能在 Flow EVM 主网上测试，因为需要连接真实的 PunchSwap V2 DEX。

### 1. 验证金库实例（可选）

```bash
# 验证.env中VAULT_ADDRESS的合约实例
./scripts/verifyVault.sh
```

### 2. 运行基本功能测试

```bash
# 运行所有测试
npx hardhat test --network flow

# 运行特定测试
npx hardhat test test/01_basic_functionality.test.js --network flow # 基本功能测试
npx hardhat test test/02_native_token.test.js --network flow       # 原生代币测试
npx hardhat test test/03_swap.test.js --network flow               # 交换功能测试（仅主网）
```

### 3. 测试覆盖范围

- **基本功能测试** (`01_basic_functionality.test.js`)：
  - ERC20 代币存取款
  - 权限管理
  - 合约升级
- **原生代币测试** (`02_native_token.test.js`)：
  - 原生代币（FLOW）存取款
  - 权限验证
- **交换功能测试** (`03_swap.test.js`)：⚠️ **仅主网可用**
  - Swap 权限验证
  - 真实 PunchSwap V2 环境下的代币交换
  - FLOW ↔ ERC20 代币交换
  - ERC20 ↔ ERC20 代币交换

### 4. 使用 Flow 钱包交互

1. 设置 [Flow 钱包](https://wallet.flow.com/)
2. 连接到主网
3. 与合约交互（存款、取款等）
4. Flow 钱包会自动赞助 gas 费用

### 5. 在 Flowscan 上查看合约

- 主网: [https://evm.flowscan.io/](https://evm.flowscan.io/)

---

## 五、Flow EVM 主网部署流程

### 1. 部署到 Flow EVM 主网

```shell
# 一键部署到主网
./scripts/deploy_verify_create.sh
```

### 2. 在主网环境下运行测试

```bash
# 在 Flow EVM 主网运行真实交换测试
npx hardhat test test/03_swap.test.js --network flow
```

### 3. 使用 Flow 钱包与合约交互

1. 设置 [Flow 钱包](https://wallet.flow.com/)
2. 连接到主网
3. 与合约交互（存款、取款等）
4. Flow 钱包会自动赞助 gas 费用

### 4. 在 Flowscan 上查看合约

- 主网: [https://evm.flowscan.io/](https://evm.flowscan.io/)

---

## 六、原生代币支持

### 1. 原生代币功能概述

PersonalVaultUpgradeableUniV2 合约现已支持原生代币（如 ETH 或 FLOW）的存取和交换功能：

- 使用特殊地址 `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` 表示原生代币
- 支持原生代币的存入和提取
- 支持原生代币与 ERC20 代币之间的交换
- 自动处理原生代币与包装原生代币（如 WETH 或 WFLOW）的转换

### 2. 原生代币相关函数

- `depositNative()`: 存入原生代币（需要发送相应数量的 ETH/FLOW）
- `withdrawNative(uint256 amount)`: 提取指定数量的原生代币
- `receive()`: 允许合约接收原生代币转账

### 3. 原生代币交换

原生代币交换使用 `swapExactInputSingle` 函数，与 ERC20 代币交换使用相同的接口：

- 当 `tokenIn` 为原生代币地址时，使用金库中的原生代币余额进行交换
- 当 `tokenOut` 为原生代币地址时，交换结果会自动转换为原生代币并更新金库余额

### 4. 在测试中的使用示例

参考 `test/02_native_token.test.js` 和 `test/03_swap.test.js` 文件中的测试用例：

```javascript
// 存入原生代币
await vault.connect(user).depositNative({ value: ethers.parseEther("0.1") });

// 提取原生代币
await vault.connect(user).withdrawNative(ethers.parseEther("0.05"));

// 交换原生代币为 ERC20 代币（带费用）
const NATIVE_TOKEN = await vault.NATIVE_TOKEN();
await vault.connect(bot).swapExactInputSingle(
  NATIVE_TOKEN,
  TOKEN_ADDRESS,
  ethers.parseEther("0.01"),
  0, // 最小输出金额
  feeRecipient,
  feeRate
);
```

## 七、费用机制

### 1. 费用参数

- `feeRecipient`: 费用收取人地址
- `feeRate`: 费率，按百万分之一为基本单位
  - 1 = 0.0001%
  - 1000 = 0.1%
  - 10000 = 1%

### 2. 费用计算

费用从交换输出中扣除：

- 用户最终获得：`amountOut - feeAmount`
- 费用金额：`feeAmount = (amountOut * feeRate) / 1000000`

### 3. 环境变量设置

```shell
export FEE_RECIPIENT=0x... # 费用收取人地址
export FEE_RATE=1000       # 费率，1000 = 0.1%
```

## 八、测试

项目使用 Hardhat+JavaScript 编写了完整的测试用例，覆盖存取款、升级、权限管理、原生代币操作和真实 DEX 交换等核心场景。测试文件位于 `test/` 目录下，可以在本地网络和 Flow EVM 主网上运行。

### 测试覆盖范围

1. **基本功能测试**：用户创建、ERC20 存取款、权限管理
2. **原生代币测试**：原生代币存取款、权限验证
3. **交换功能测试**：DEX 交换权限、真实环境交换测试

---

### 【Flow EVM 主网部署信息】

- PersonalVaultUpgradeableUniV2 implementation 地址：
  `0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a`
- PersonalVaultFactoryUniV2 地址：
  `0x486eDaD5bBbDC8eD5518172b48866cE747899D89`

**推荐环境变量设置：**

```shell
PERSONAL_VAULT_IMPL_ADDRESS=0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a
FACTORY_ADDRESS=0x486eDaD5bBbDC8eD5518172b48866cE747899D89
SWAP_ROUTER=0xf45AFe28fd5519d5f8C1d4787a4D5f724C0eFa4d
WRAPPED_NATIVE=0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e
```

可直接用于本地或主网脚本测试。

如需定制脚本或有特殊业务需求，请联系开发者。
