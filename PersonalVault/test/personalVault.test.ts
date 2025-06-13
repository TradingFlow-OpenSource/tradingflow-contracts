import { ethers as hardhatEthers } from "hardhat";
const ethers = hardhatEthers;
import { expect } from "chai";

describe("PersonalVault", function () {
  it("should deploy factory and create a vault", async function () {
    const [admin, user] = await ethers.getSigners();
    // 部署实现合约
    const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
    const implementation = await Vault.deploy();
    await implementation.deployed();

    // 部署工厂合约
    const Factory = await ethers.getContractFactory("PersonalVaultFactory");
    const factory = await Factory.deploy(admin.address, implementation.address);
    await factory.deployed();

    // 测试通过工厂创建金库（Proxy）
    const swapRouter = admin.address; // 这里用地址占位，实际应为DEX Router地址
    const tx = await factory.connect(user).createVault(swapRouter);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    // 检查vault已注册
    const vaultAddr = await factory.userVaults(user.address);
    expect(vaultAddr).to.not.equal(ethers.constants.AddressZero);
    // 检查Proxy初始化正确
    const proxyVault = Vault.attach(vaultAddr);
    expect(await proxyVault.investor()).to.equal(user.address);
  });
});
