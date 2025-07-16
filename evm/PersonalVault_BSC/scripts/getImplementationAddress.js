// 获取可升级合约的实现地址
// 用法: npx hardhat run scripts/getImplementationAddress.js --network bsc <代理合约地址>

const { ethers } = require("hardhat");

async function main() {
  // 获取命令行参数
  const proxyAddress = process.argv[2];
  
  if (!proxyAddress) {
    console.error("错误: 请提供代理合约地址");
    process.exit(1);
  }

  try {
    // ERC1967代理的实现合约存储槽位置
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    
    // 获取实现合约地址
    const implementationData = await ethers.provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
    
    // 解析地址（去掉前12个字节的0填充）
    const implementationAddress = "0x" + implementationData.slice(26);
    
    // 输出实现合约地址
    console.log(implementationAddress);
    
    return implementationAddress;
  } catch (error) {
    console.error("获取实现合约地址失败:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
