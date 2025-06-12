import { ethers } from "hardhat";
import { expect } from "chai";

describe("PersonalVault", function () {
  it("should deploy factory and create a vault", async function () {
    const [admin, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PersonalVaultFactory");
    const factory = await Factory.deploy(admin.address);
    await factory.deployed();

    // 测试创建金库
    const baseAsset = admin.address; // 这里用地址占位，实际应为ERC20合约地址
    const swapRouter = admin.address;
    const priceOracle = admin.address;
    const tx = await factory.connect(user).createVault(baseAsset, "TestVault", "TVT", swapRouter, priceOracle);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });
});
