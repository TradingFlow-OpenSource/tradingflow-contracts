import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

describe("PersonalVaultUpgradeable (Proxy)", function () {
  it("should deploy proxy and initialize", async function () {
    const [admin, user] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
    const proxy = await upgrades.deployProxy(Vault, [user.address, admin.address], { initializer: "initialize" });
    await proxy.deployed();
    expect(await proxy.investor()).to.equal(user.address);
    expect(await proxy.hasRole(await proxy.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
  });

  it("should allow deposit and withdraw", async function () {
    const [admin, user] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("PersonalVaultUpgradeable");
    const proxy = await upgrades.deployProxy(Vault, [user.address, admin.address], { initializer: "initialize" });
    await proxy.deployed();
    // 这里可以补充ERC20模拟和存取款测试
  });
});
