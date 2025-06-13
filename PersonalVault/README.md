# PersonalVault 模块（UUPS 可升级 Proxy 版）

本模块基于 EVM，采用 UUPS Proxy 可升级模式，每个用户独立部署自己的金库（Vault），便于后续合约逻辑升级。

---

## 目录结构
- contracts/
  - PersonalVaultUpgradeable.sol  // 可升级逻辑合约
  - PersonalVaultFactory.sol      // 工厂合约
- scripts/
  - deployFactory.ts              // 部署工厂合约脚本
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

## 一、环境准备与本地模拟流程

### 1. 启动 Hardhat 本地链
```shell
npx hardhat node
```

### 2. 部署实现合约（PersonalVaultUpgradeable）与工厂合约
```shell
npx hardhat run scripts/deployFactory.ts --network localhost
```
- 输出将包含实现合约与工厂合约地址。

### 3. 用户模拟创建个人金库
```shell
npx hardhat run scripts/createVault.ts --network localhost
```
- 可切换不同私钥模拟多用户。

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
- 需先将 BOT 地址添加到工厂的 BOT_ROLE。

### 7. 批量升级所有用户金库（如 owner 为平台）
```shell
npx hardhat run scripts/batchUpgrade.ts --network localhost
```

---

## 二、权限说明
- 仅金库拥有者可存取款
- 仅 Factory 管理员可添加/移除 Bot
- Bot 可发起 swap 交易
- 仅合约 owner 可升级逻辑合约

---

## 三、事件
- VaultInitialized
- UserDeposit
- UserWithdraw
- TradeSignal

---

## 四、脚本模板

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
