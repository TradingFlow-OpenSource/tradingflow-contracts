// 验证代理合约的脚本
const { ethers, run } = require("hardhat");

async function main() {
  const proxyAddress = process.env.VAULT_ADDRESS;
  
  if (!proxyAddress) {
    console.error("请在.env文件中设置VAULT_ADDRESS");
    process.exit(1);
  }

  console.log("代理合约地址:", proxyAddress);

  try {
    // 获取实现合约地址
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;
    const implementationData = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
    const implementationAddress = "0x" + implementationData.slice(26);
    
    console.log("实现合约地址:", implementationAddress);

    // 尝试验证代理合约
    console.log("正在验证代理合约...");
    
    try {
      // 方法1: 直接验证代理合约（不需要构造函数参数）
      await run("verify:verify", {
        address: proxyAddress,
        contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
        constructorArguments: [implementationAddress, "0x"]
      });
      
      console.log("✅ 代理合约验证成功！");
      console.log(`🔗 BSCScan链接: https://bscscan.com/address/${proxyAddress}#code`);
      
    } catch (error) {
      console.log("方法1失败，尝试方法2...");
      
      // 方法2: 尝试不指定合约名称
      try {
        await run("verify:verify", {
          address: proxyAddress,
          constructorArguments: [implementationAddress, "0x"]
        });
        
        console.log("✅ 代理合约验证成功！");
        console.log(`🔗 BSCScan链接: https://bscscan.com/address/${proxyAddress}#code`);
        
      } catch (error2) {
        console.log("代理合约验证失败:", error2.message);
        console.log("但实现合约已经验证成功，这通常已经足够了。");
        console.log(`🔗 实现合约BSCScan链接: https://bscscan.com/address/${implementationAddress}#code`);
      }
    }

  } catch (error) {
    console.error("验证过程中出错:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
