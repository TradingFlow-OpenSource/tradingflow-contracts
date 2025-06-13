# PersonalVault 模块（UUPS 可升级 Proxy 版）

本模块基于 EVM，采用 UUPS Proxy 可升级模式，每个用户独立部署自己的金库（Vault），便于后续合约逻辑升级。支持标准 EVM 链和 Flow EVM 部署。

---

## 目录结构
- contracts/
  - PersonalVaultUpgradeable.sol  // 可升级逻辑合约
  - PersonalVaultFactory.sol      // 工厂合约
- scripts/
  - deployFactory.ts              // 部署逻辑合约和工厂合约脚本
  - createVault.ts                // 用户创建个人金库脚本
  - deposit.ts                    // 用户存款脚本（模板）
  - withdraw.ts                   // 用户取款脚本（模板）
  - botSwap.ts                    // BOT 发起交易脚本（模板）
  - batchUpgrade.ts               // 批量升级脚本（模板）
- test/
  - personalVault.proxy.test.ts   // Proxy测试用例
  - personalVault.test.ts         // 工厂批量创建与交互测试
- README.md

---

## 二、合约架构

### 1. 合约关系

```
PersonalVaultFactory ----创建----> ERC1967Proxy(PersonalVaultUpgradeable) <---- 用户交互
                      |                                                    |
                      |                                                    |
                      |                                                    |
                      v                                                    |
                  PersonalVaultUpgradeable实现合约 <---------------------升级
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

### 1. 一键部署实现合约和工厂合约
```javascript
// deployFactory.ts 脚本会自动完成以下流程

// 1. 部署 PersonalVaultUpgradeable 实现合约
const VaultImpl = await ethers.getContractFactory("PersonalVaultUpgradeable");
const implementation = await VaultImpl.deploy();
await implementation.deployed();
console.log("Implementation address:", implementation.address);

// 2. 部署工厂合约
const Factory = await ethers.getContractFactory("PersonalVaultFactory");
const factory = await Factory.deploy(adminAddress, implementation.address);
await factory.deployed();
console.log("Factory address:", factory.address);
```

### 2. 部署脚本
```shell
npx hardhat run scripts/deployFactory.ts --network localhost
```
- 此脚本会自动部署 PersonalVaultUpgradeable 逻辑合约和 PersonalVaultFactory 工厂合约
- 输出将包含实现合约与工厂合约地址，并提供环境变量设置指南
- 请记录输出的合约地址，用于后续脚本

---

## 四、环境准备与本地模拟流程

### 1. 启动 Hardhat 本地链
```shell
npx hardhat node
```

### 2. 部署实现合约与工厂合约
```shell
npx hardhat run scripts/deployFactory.ts --network localhost
```
- 此脚本会自动部署 PersonalVaultUpgradeable 逻辑合约和 PersonalVaultFactory 工厂合约
- 输出将包含实现合约与工厂合约地址，并提供环境变量设置指南
- 请记录输出的合约地址，用于后续脚本

### 3. 用户模拟创建个人金库
```shell
# 先设置环境变量
export FACTORY_ADDRESS=0x... # 从上一步输出中获取
export SWAP_ROUTER=0x... # UniswapV3或PunchSwapV3路由地址

npx hardhat run scripts/createVault.ts --network localhost
```
- 可切换不同私钥模拟多用户

### 4. 模拟存款
```shell
npx hardhat run scripts/deposit.ts --network localhost
```
- 需先用 ERC20 的 `approve` 授权金库合约。

### 5. 模拟取款
```shell
npx hardhat run scripts/withdraw.ts --network localhost
```

### 6. 模拟 BOT 发起交易
```shell
npx hardhat run scripts/botSwap.ts --network localhost
```

---

## 五、Flow EVM 部署流程

### 1. 环境准备

#### 1.1 安装依赖
```shell
npm install --save-dev @openzeppelin/hardhat-upgrades
```

#### 1.2 设置环境变量
创建或编辑 `.env` 文件，添加以下内容：
```
DEPLOY_WALLET_1=<部署钱包私钥>
```

> ⚠️ 警告：私钥与助记词具有相同功能，任何拥有私钥的人都可以随时操作钱包！请使用单独的开发钱包，切勿将私钥提交到代码库。

### 2. 获取测试网代币

访问 [Flow Faucet](https://testnet.flowscan.io/faucet) 并按照说明添加测试网代币。与其他网络相比，Flow Faucet 提供了大量代币，足够支付数百万笔交易的 gas 费用。

### 3. 部署到 Flow EVM 测试网

```shell
npx hardhat run scripts/deployFactory.ts --network flowTestnet
```

### 4. 验证合约

```shell
npx hardhat verify --network flowTestnet <工厂合约地址> <管理员地址> <实现合约地址>
```

### 5. 在 Flow EVM 测试网上创建金库

```shell
# 先设置环境变量
export FACTORY_ADDRESS=0x... # 从部署步骤输出中获取
export SWAP_ROUTER=0x... # Flow EVM 上的交换路由地址

npx hardhat run scripts/createVault.ts --network flowTestnet
```

### 6. 使用 Flow 钱包与合约交互

1. 设置 [Flow 钱包](https://wallet.flow.com/)
2. 连接到测试网
3. 与合约交互（存款、取款等）
4. Flow 钱包会自动赞助 gas 费用

### 7. 在 Flowscan 上查看合约

- 测试网: [https://evm-testnet.flowscan.io/](https://evm-testnet.flowscan.io/)
- 主网: [https://evm.flowscan.io/](https://evm.flowscan.io/)

### 8. 部署到 Flow EVM 主网

```shell
npx hardhat run scripts/deployFactory.ts --network flow
```
- 需先将 BOT 地址添加到工厂的 BOT_ROLE。

### 7. 批量升级所有用户金库（如 owner 为平台）
```shell
npx hardhat run scripts/batchUpgrade.ts --network localhost
```

---

## 五、脚本模板

### 1. deposit.ts（用户存款脚本模板）
```typescript
import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  const amount = ethers.utils.parseUnits("100", 18); // 100 Token

  // 1. 先授权
  const ERC20 = await ethers.getContractAt("IERC20", tokenAddress);
  await ERC20.connect(user).approve(vaultAddress, amount);

  // 2. 存款
  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  const tx = await Vault.connect(user).deposit(tokenAddress, amount);
  await tx.wait();
  console.log("Deposit success");
}
main();
```

### 2. withdraw.ts（用户取款脚本模板）
```typescript
import { ethers } from "hardhat";

async function main() {
  const [user] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;
  const amount = ethers.utils.parseUnits("10", 18); // 10 Token

  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  const tx = await Vault.connect(user).withdraw(tokenAddress, amount);
  await tx.wait();
  console.log("Withdraw success");
}
main();
```

### 3. botSwap.ts（BOT 发起 swap 脚本模板）
```typescript
import { ethers } from "hardhat";

async function main() {
  const [bot] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS!;
  const Vault = await ethers.getContractAt("PersonalVaultUpgradeable", vaultAddress);
  // 示例参数
  const tokenIn = process.env.TOKEN_IN!;
  const tokenOut = process.env.TOKEN_OUT!;
  const fee = 3000; // 0.3%
  const amountIn = ethers.utils.parseUnits("1", 18);
  const amountOutMin = 0;
  const tx = await Vault.connect(bot).swapExactInputSingle(tokenIn, tokenOut, fee, amountIn, amountOutMin);
  await tx.wait();
  console.log("Swap success");
}
main();
```

### 4. batchUpgrade.ts（批量升级脚本模板，需平台为 owner）
```typescript
import { ethers } from "hardhat";

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS!;
  const newImpl = process.env.NEW_IMPLEMENTATION!;
  const Factory = await ethers.getContractAt("PersonalVaultFactory", factoryAddress);
  const vaultCount = await Factory.allVaults.length;
  const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
  for (let i = 0; i < vaultCount; i++) {
    const proxyAddr = await Factory.allVaults(i);
    const proxy = Vault.attach(proxyAddr);
    const tx = await proxy.upgradeTo(newImpl);
    await tx.wait();
    console.log(`Upgraded vault ${proxyAddr} to ${newImpl}`);
  }
}
main();
```

---

## 五、测试
建议使用 Hardhat+@openzeppelin/hardhat-upgrades 编写测试用例，覆盖存取款、升级、权限管理等核心场景。

---

如需定制脚本或有特殊业务需求，请联系开发者。
