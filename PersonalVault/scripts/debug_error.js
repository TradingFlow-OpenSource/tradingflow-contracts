const { ethers } = require("hardhat");

async function main() {
  // 错误签名
  const errorSignature = "0xe2517d3f";
  
  console.log("调试错误签名:", errorSignature);
  
  // 常见的错误签名
  console.log("标准错误签名:");
  console.log("- Error(string):", ethers.id("Error(string)").slice(0, 10));
  console.log("- Panic(uint256):", ethers.id("Panic(uint256)").slice(0, 10));
  
  // 检查可能的自定义错误
  const possibleErrors = [
    "InvalidAddress()",
    "Unauthorized()",
    "AlreadyInitialized()",
    "InvalidImplementation()",
    "AccessControlUnauthorizedAccount(address,bytes32)",
    "OwnableUnauthorizedAccount(address)",
    "InvalidInitialization()",
    "NotInitializing()",
  ];
  
  console.log("\n可能的自定义错误:");
  for (const error of possibleErrors) {
    const signature = ethers.id(error).slice(0, 10);
    console.log(`- ${error}: ${signature}`);
    if (signature === errorSignature) {
      console.log(`  *** 匹配! ***`);
    }
  }
  
  // 检查 AccessControl 相关错误
  console.log("\nAccessControl 相关错误:");
  const accessControlErrors = [
    "AccessControlUnauthorizedAccount(address,bytes32)",
    "AccessControlBadConfirmation()",
  ];
  
  for (const error of accessControlErrors) {
    const signature = ethers.id(error).slice(0, 10);
    console.log(`- ${error}: ${signature}`);
    if (signature === errorSignature) {
      console.log(`  *** 匹配! ***`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
