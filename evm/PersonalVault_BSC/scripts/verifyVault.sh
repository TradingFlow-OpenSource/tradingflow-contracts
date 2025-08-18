#!/bin/bash

# 验证.env中VAULT_ADDRESS的合约源码
# 用法: ./scripts/verifyVault.sh

set -e

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== PersonalVault 合约源码验证工具 ===${NC}"
echo ""

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 错误：未找到.env文件${NC}"
    echo "请确保在项目根目录下有.env文件，并包含VAULT_ADDRESS配置"
    exit 1
fi

# 读取.env文件中的配置
source .env

# 检查必要的环境变量
if [ -z "$VAULT_ADDRESS" ]; then
    echo -e "${RED}❌ 错误：.env文件中未设置VAULT_ADDRESS${NC}"
    echo "请在.env文件中添加：VAULT_ADDRESS=0x..."
    exit 1
fi

if [ -z "$NETWORK" ]; then
    echo -e "${YELLOW}⚠️  警告：未设置NETWORK，使用默认值 'bsc'${NC}"
    export NETWORK="bsc"
fi

echo -e "${GREEN}📋 配置信息：${NC}"
echo "   网络: $NETWORK"
echo "   金库地址: $VAULT_ADDRESS"
echo ""

echo -e "${GREEN}🚀 开始验证合约源码...${NC}"
echo ""

# 验证合约
echo "正在验证 PersonalVaultUpgradeableUniV3 合约源码..."
echo "合约地址: $VAULT_ADDRESS"
echo ""

# 首先获取实现合约地址
echo "正在获取实现合约地址..."
# 创建临时脚本
cat > temp_script.js << EOL
const { ethers } = require("hardhat");

async function main() {
  const proxyAddress = "$VAULT_ADDRESS";
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  // 获取网络连接 - ethers v6 API
  const [signer] = await ethers.getSigners();
  const provider = signer.provider;
  
  // 获取存储槽位的数据
  const implementationData = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  
  // 解析地址
  const implementationAddress = "0x" + implementationData.slice(26);
  console.log(implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
EOL

IMPL_ADDRESS=$(npx hardhat run --network $NETWORK temp_script.js)
rm temp_script.js

if [ -z "$IMPL_ADDRESS" ]; then
    echo -e "${RED}✖ 无法获取实现合约地址${NC}"
    exit 1
fi

echo "实现合约地址: $IMPL_ADDRESS"

# 首先验证实现合约
echo "正在验证实现合约..."
echo "强制重新编译合约..."
npx hardhat compile --force

echo "验证实现合约: $IMPL_ADDRESS"
npx hardhat verify --network $NETWORK $IMPL_ADDRESS

# 然后验证代理合约
echo "验证代理合约: $VAULT_ADDRESS"
echo "实现合约已验证，现在验证代理合约..."

# 使用专门的代理验证脚本
npx hardhat run --network $NETWORK scripts/verifyProxy.js

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 合约源码验证完成！${NC}"
    echo -e "${GREEN}🔗 BSCScan链接: https://bscscan.com/address/${VAULT_ADDRESS}${NC}"
else
    echo ""
    echo -e "${RED}❌ 合约源码验证失败${NC}"
    echo -e "${YELLOW}💡 提示：${NC}"
    echo "   - 确认合约地址是否正确"
    echo "   - 确认合约是否为 PersonalVaultUpgradeableUniV3"
    echo "   - 合约可能已经验证过了"
    echo "   - 网络配置是否正确"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== 验证完成 ===${NC}"
