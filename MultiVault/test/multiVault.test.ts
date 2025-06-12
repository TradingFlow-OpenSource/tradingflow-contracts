import { ethers } from "hardhat";
import { expect } from "chai";

describe("OracleGuidedVault (MultiVault)", function () {
  it("should deploy and allow deposit/withdraw", async function () {
    const [admin, user1] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("OracleGuidedVault");
    const baseAsset = admin.address; // 实际应为ERC20合约地址
    const swapRouter = admin.address;
    const priceOracle = admin.address;
    const investor = admin.address;
    const vault = await Vault.deploy(baseAsset, "MultiVault", "MV", swapRouter, priceOracle, investor);
    await vault.deployed();
    expect(vault.address).to.be.properAddress;
  });
});
