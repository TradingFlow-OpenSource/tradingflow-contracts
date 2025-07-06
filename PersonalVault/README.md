# PersonalVault 模块（UUPS 可升级 Proxy 版 - Uniswap V2）

本模块基于 EVM，采用 UUPS Proxy 可升级模式，每个用户独立部署自己的金库（Vault），便于后续合约逻辑升级。支持标准 EVM 链和 Flow EVM 部署。支持原生代币（ETH/FLOW）和 ERC20 代币的存取和交换。使用 Uniswap V2/PunchSwap V2 进行代币交换操作。

---

## 目录结构

-   contracts/
    -   PersonalVaultUpgradeableUniV2.sol // 可升级逻辑合约（Uniswap V2/PunchSwap V2 版本）
    -   PersonalVaultFactoryUniV2.sol // 工厂合约（Uniswap V2/PunchSwap V2 版本）
    -   PersonalVaultUpgradeableUniV3.sol // 可升级逻辑合约（Uniswap V3 版本备份）
    -   PersonalVaultUpgradeable.sol // 兼容性备份（已迁移到 UniV2 版本）
    -   PersonalVaultFactory.sol // 兼容性备份（已迁移到 UniV2 版本）
-   scripts/
    -   deployFactory.ts // 部署逻辑合约和工厂合约脚本
    -   createVault.ts // 用户创建个人金库脚本
    -   deposit.ts // 用户存款脚本（模板）
    -   withdraw.ts // 用户取款脚本（模板）
    -   botSwap.ts // BOT 发起交易脚本（模板）
    -   batchUpgrade.ts // 批量升级脚本（模板）
-   test/
    -   personalVault.proxy.test.ts // Proxy 测试用例
    -   personalVault.test.ts // 工厂批量创建与交互测试（已更新为 UniV2 版本）
-   README.md

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

-   **工厂合约角色**

    -   `DEFAULT_ADMIN_ROLE`: 可以添加/移除 BOT，设置新的实现合约
    -   `ADMIN_ROLE`: 可以添加/移除 BOT
    -   `BOT_ROLE`: 自动获得所有金库的 ORACLE_ROLE

-   **金库合约角色**
    -   `DEFAULT_ADMIN_ROLE`: 用户和工厂合约，可以管理所有权限
    -   `ADMIN_ROLE`: 可以执行管理操作
    -   `ORACLE_ROLE`: 可以执行交易操作（由工厂合约授予给 BOT）

---

## 三、部署流程

### 1. 一键部署实现合约和工厂合约

```javascript
// deployFactory.ts 脚本会自动完成以下流程

// 1. 部署 PersonalVaultUpgradeableUniV2 实现合约
const VaultImpl = await ethers.getContractFactory(
    "PersonalVaultUpgradeableUniV2"
);
const implementation = await VaultImpl.deploy();
await implementation.deployed();
console.log("Implementation address:", implementation.address);

// 2. 部署工厂合约
const Factory = await ethers.getContractFactory("PersonalVaultFactoryUniV2");
const factory = await Factory.deploy(adminAddress, implementation.address);
await factory.deployed();
console.log("Factory address:", factory.address);
```

### 2. 部署脚本

```shell
npx hardhat run scripts/deployFactory.ts --network localhost
```

-   此脚本会自动部署 PersonalVaultUpgradeable 逻辑合约和 PersonalVaultFactory 工厂合约
-   输出将包含实现合约与工厂合约地址，并提供环境变量设置指南
-   请记录输出的合约地址，用于后续脚本

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

-   此脚本会自动部署 PersonalVaultUpgradeable 逻辑合约和 PersonalVaultFactory 工厂合约
-   输出将包含实现合约与工厂合约地址，并提供环境变量设置指南
-   请记录输出的合约地址，用于后续脚本

### 3. 用户模拟创建个人金库

```shell
# 先设置环境变量
export FACTORY_ADDRESS=0x... # 从上一步输出中获取
export SWAP_ROUTER=0x... # UniswapV3或PunchSwapV3路由地址

npx hardhat run scripts/createVault.ts --network localhost
```

-   可切换不同私钥模拟多用户

### 4. 模拟存款

```shell
npx hardhat run scripts/deposit.ts --network localhost
```

-   需先用 ERC20 的 `approve` 授权金库合约。

### 5. 模拟取款

```shell
npx hardhat run scripts/withdraw.ts --network localhost
```

### 6. 模拟 BOT 发起交易

```shell
npx hardhat run scripts/botSwap.ts --network localhost
```

---

## 五、Flow EVM 主网部署流程

### 1. 环境准备

#### 1.1 安装依赖

```shell
npm install --save-dev @openzeppelin/hardhat-upgrades
```

#### 1.2 设置环境变量

创建或编辑 `.env` 文件，添加以下内容：

```
DEPLOYER_PRIVATE_KEY=0x...      # 用于部署合约
USER_PRIVATE_KEY=0x...         # 用于创建金库（不同于部署者）
```

> ⚠️ 警告：私钥与助记词具有相同功能，任何拥有私钥的人都可以随时操作钱包！请使用单独的开发钱包，切勿将私钥提交到代码库。

### 2. 部署到 Flow EVM 主网

```shell
npx hardhat run scripts/deployFactory.ts --network flow
```

### 3. 验证合约

```shell
npx hardhat verify --network flow <工厂合约地址> <管理员地址> <实现合约地址>
```

### 4. 在 Flow EVM 主网上创建金库

```shell
# 先设置环境变量
export FACTORY_ADDRESS=0x... # 从部署输出获取
export SWAP_ROUTER=0x...    # Flow EVM 主网 DEX 路由地址
export WRAPPED_NATIVE=0x5c147e74d63b1d31aa3fd78eb229b65161983b2b # Flow EVM 主网 WFLOW 地址

# 用第二个账号（USER_PRIVATE_KEY）创建金库
npx hardhat run scripts/createVaultUser.ts --network flow
```

-   可多次更换 `USER_PRIVATE_KEY`，模拟多用户创建金库。

### 5. 使用 Flow 钱包与合约交互

1. 设置 [Flow 钱包](https://wallet.flow.com/)
2. 连接到主网
3. 与合约交互（存款、取款等）
4. Flow 钱包会自动赞助 gas 费用

### 6. 在 Flowscan 上查看合约

-   主网: [https://evm.flowscan.io/](https://evm.flowscan.io/)

### 7. 批量升级所有用户金库（如 owner 为平台）

```shell
npx hardhat run scripts/batchUpgrade.ts --network flow
```

-   需先将 BOT 地址添加到工厂的 BOT_ROLE。

---

## 六、脚本模板

### 1. deposit.ts（用户存款脚本模板）

```typescript
import { ethers } from "hardhat";

async function main() {
    const [user] = await ethers.getSigners();
    const vaultAddress = process.env.VAULT_ADDRESS!;
    const tokenAddress = process.env.TOKEN_ADDRESS!;
    const amount = ethers.utils.parseUnits("100", 18); // 100 Token

    const Vault = await ethers.getContractAt(
        "PersonalVaultUpgradeable",
        vaultAddress
    );

    // 选项 1: 存入 ERC20 代币
    if (tokenAddress) {
        // 1. 先授权
        const ERC20 = await ethers.getContractAt("IERC20", tokenAddress);
        await ERC20.connect(user).approve(vaultAddress, amount);

        // 2. 存款
        const tx = await Vault.connect(user).deposit(tokenAddress, amount);
        await tx.wait();
        console.log(`Deposited ${ethers.formatEther(amount)} ERC20 tokens`);
    }
    // 选项 2: 存入原生代币
    else {
        const nativeAmount = ethers.parseEther("0.01"); // 0.01 ETH/FLOW
        const tx = await Vault.connect(user).depositNative({
            value: nativeAmount,
        });
        await tx.wait();
        console.log(
            `Deposited ${ethers.formatEther(nativeAmount)} native tokens`
        );
    }
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

    const Vault = await ethers.getContractAt(
        "PersonalVaultUpgradeable",
        vaultAddress
    );

    // 选项 1: 提取 ERC20 代币
    if (tokenAddress) {
        const tx = await Vault.connect(user).withdraw(tokenAddress, amount);
        await tx.wait();
        console.log(`Withdrawn ${ethers.formatEther(amount)} ERC20 tokens`);
    }
    // 选项 2: 提取原生代币
    else {
        const nativeAmount = ethers.parseEther("0.005"); // 0.005 ETH/FLOW
        const tx = await Vault.connect(user).withdrawNative(nativeAmount);
        await tx.wait();
        console.log(
            `Withdrawn ${ethers.formatEther(nativeAmount)} native tokens`
        );
    }
}
main();
```

### 3. botSwap.ts（BOT 发起 swap 脚本模板）

```typescript
import { ethers } from "hardhat";

async function main() {
    const [bot] = await ethers.getSigners();
    const vaultAddress = process.env.VAULT_ADDRESS!;
    const Vault = await ethers.getContractAt(
        "PersonalVaultUpgradeable",
        vaultAddress
    );

    // 获取原生代币地址常量
    const NATIVE_TOKEN = await Vault.NATIVE_TOKEN();
    const wrappedNative = await Vault.WRAPPED_NATIVE();

    // 选择交换类型
    const swapType = process.env.SWAP_TYPE || "erc20";
    const amountOutMin = 0;

    // 费用参数
    const feeRecipient = process.env.FEE_RECIPIENT || ethers.ZeroAddress;
    const feeRate = Number(process.env.FEE_RATE) || 0; // 按百万分之一为单位

    let tokenIn, tokenOut, amountIn, tx;

    switch (swapType) {
        case "native_to_erc20":
            // 交换原生代币为 ERC20 代币
            tokenIn = NATIVE_TOKEN;
            tokenOut = process.env.TOKEN_OUT!;
            amountIn = ethers.parseEther("0.01");
            tx = await Vault.connect(bot).swapExactInputSingle(
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                feeRecipient,
                feeRate
            );
            break;

        case "erc20_to_native":
            // 交换 ERC20 代币为原生代币
            tokenIn = process.env.TOKEN_IN!;
            tokenOut = NATIVE_TOKEN;
            amountIn = ethers.parseUnits("1", 18);
            tx = await Vault.connect(bot).swapExactInputSingle(
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                feeRecipient,
                feeRate
            );
            break;

        default:
            // 标准 ERC20 代币交换
            tokenIn = process.env.TOKEN_IN!;
            tokenOut = process.env.TOKEN_OUT!;
            amountIn = ethers.parseUnits("1", 18);
            tx = await Vault.connect(bot).swapExactInputSingle(
                tokenIn,
                tokenOut,
                amountIn,
                amountOutMin,
                feeRecipient,
                feeRate
            );
    }

    await tx.wait();
    console.log(`Swap from ${tokenIn} to ${tokenOut} successful`);
}
main();
```

### 4. batchUpgrade.ts（批量升级脚本模板，需平台为 owner）

```typescript
import { ethers } from "hardhat";

async function main() {
    const factoryAddress = process.env.FACTORY_ADDRESS!;
    const newImpl = process.env.NEW_IMPLEMENTATION!;
    const Factory = await ethers.getContractAt(
        "PersonalVaultFactory",
        factoryAddress
    );
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

## 七、原生代币支持

### 1. 原生代币功能概述

PersonalVaultUpgradeable 合约现已支持原生代币（如 ETH 或 FLOW）的存取和交换功能：

-   使用特殊地址 `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` 表示原生代币
-   支持原生代币的存入和提取
-   支持原生代币与 ERC20 代币之间的交换
-   自动处理原生代币与包装原生代币（如 WETH 或 WFLOW）的转换

### 2. 原生代币相关函数

-   `depositNative()`: 存入原生代币（需要发送相应数量的 ETH/FLOW）
-   `withdrawNative(uint256 amount)`: 提取指定数量的原生代币
-   `receive()`: 允许合约接收原生代币转账

### 3. 原生代币交换

原生代币交换使用 `swapExactInputSingle` 函数，与 ERC20 代币交换使用相同的接口：

-   当 `tokenIn` 为原生代币地址时，使用金库中的原生代币余额进行交换
-   当 `tokenOut` 为原生代币地址时，交换结果会自动转换为原生代币并更新金库余额

### 4. 使用示例

```typescript
// 存入原生代币
const depositAmount = ethers.parseEther("0.1");
await vault.connect(user).depositNative({ value: depositAmount });

// 提取原生代币
const withdrawAmount = ethers.parseEther("0.05");
await vault.connect(user).withdrawNative(withdrawAmount);

// 交换原生代币为 ERC20 代币（带费用）
const NATIVE_TOKEN = await vault.NATIVE_TOKEN();
const feeRecipient = "0x..."; // 费用收取人地址
const feeRate = 1000; // 0.1% 费率
await vault.connect(bot).swapExactInputSingle(
    NATIVE_TOKEN,
    TOKEN_ADDRESS,
    ethers.parseEther("0.01"),
    1, // 最小输出金额
    feeRecipient,
    feeRate
);
```

## 八、费用机制

### 1. 费用参数

-   `feeRecipient`: 费用收取人地址
-   `feeRate`: 费率，按百万分之一为基本单位
    -   1 = 0.0001%
    -   1000 = 0.1%
    -   10000 = 1%

### 2. 费用计算

费用从交换输出中扣除：

-   用户最终获得：`amountOut - feeAmount`
-   费用金额：`feeAmount = (amountOut * feeRate) / 1000000`

### 3. 环境变量设置

```shell
export FEE_RECIPIENT=0x... # 费用收取人地址
export FEE_RATE=1000       # 费率，1000 = 0.1%
```

## 九、测试

建议使用 Hardhat+@openzeppelin/hardhat-upgrades 编写测试用例，覆盖存取款、升级、权限管理等核心场景。

---

### 【2025-06-13 Flow 主网部署信息】

-   PersonalVaultUpgradeable implementation 地址：
    `0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a`
-   PersonalVaultFactory 地址：
    `0x486eDaD5bBbDC8eD5518172b48866cE747899D89`

**推荐环境变量设置：**

```shell
PERSONAL_VAULT_IMPL=0x2E3b9Bb10a643DaDEDe356049e0bfdF0B6aDcd8a
FACTORY_ADDRESS=0x486eDaD5bBbDC8eD5518172b48866cE747899D89
```

可直接用于本地或主网脚本测试。

如需定制脚本或有特殊业务需求，请联系开发者。
