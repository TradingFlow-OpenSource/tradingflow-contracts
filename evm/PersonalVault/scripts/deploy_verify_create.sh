#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========== 个人金库部署、验证和创建脚本 ==========${NC}"

# 1. 部署合约
echo -e "${GREEN}步骤 1: 部署合约${NC}"
echo "正在部署 PersonalVaultUpgradeableUniV2 和 PersonalVaultFactoryUniV2 合约..."
npx hardhat run scripts/deploy.js --network flow

# 等待部署完成，给用户时间查看输出
echo -e "${YELLOW}部署完成。请确认上面显示的合约地址，然后按回车继续...${NC}"
read -p ""

# 从.env文件读取合约地址
source .env
FACTORY_ADDRESS=${FACTORY_ADDRESS}
VAULT_IMPL_ADDRESS=${VAULT_IMPL_ADDRESS}

# 获取部署者地址（第一个账户）
DEPLOYER_ADDRESS=$(node -e "
const { ethers } = require('hardhat');
async function getDeployer() {
  const [deployer] = await ethers.getSigners();
  console.log(deployer.address);
}
getDeployer();
" 2>/dev/null)

# 2. 验证合约
echo -e "${GREEN}步骤 2: 验证合约${NC}"
echo "正在验证 PersonalVaultFactoryUniV2 合约..."
echo "使用的参数: $DEPLOYER_ADDRESS $VAULT_IMPL_ADDRESS $DEPLOYER_ADDRESS"

# 验证工厂合约
npx hardhat verify --network flow $FACTORY_ADDRESS $DEPLOYER_ADDRESS $VAULT_IMPL_ADDRESS $DEPLOYER_ADDRESS

# 等待验证完成
echo -e "${YELLOW}验证完成。请按回车继续创建金库...${NC}"
read -p ""

# 3. 创建金库
echo -e "${GREEN}步骤 3: 创建金库${NC}"
echo "正在创建个人金库..."
npx hardhat run scripts/createVault.js --network flow

echo -e "${YELLOW}========== 脚本执行完成 ==========${NC}"
