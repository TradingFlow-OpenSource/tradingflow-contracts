#!/bin/bash

# 部署、验证和创建金库的自动化脚本

echo "=== PersonalVault UniV2 部署、验证和创建脚本 ==="

# 加载环境变量
source .env

# 步骤1：部署合约
echo "步骤1：部署合约..."
npx hardhat run scripts/deployUniV2.js --network flow

if [ $? -ne 0 ]; then
    echo "❌ 部署失败"
    exit 1
fi

echo "✅ 部署完成"
echo "按任意键继续验证..."
read -n 1 -s

# 步骤2：验证合约
echo "步骤2：验证合约..."

# 从.env文件读取合约地址
FACTORY_ADDRESS=$(grep "^FACTORY_ADDRESS=" .env | cut -d'=' -f2)
IMPLEMENTATION_ADDRESS=$(grep "^IMPLEMENTATION_ADDRESS=" .env | cut -d'=' -f2)
ADMIN_ADDRESS=$(grep "^ADMIN_ADDRESS=" .env | cut -d'=' -f2)
BOT_ADDRESS=$(grep "^BOT_ADDRESS=" .env | cut -d'=' -f2)

if [ -z "$FACTORY_ADDRESS" ] || [ -z "$IMPLEMENTATION_ADDRESS" ]; then
    echo "❌ 无法从.env文件读取合约地址"
    exit 1
fi

echo "验证实现合约: $IMPLEMENTATION_ADDRESS"
npx hardhat verify --network flow $IMPLEMENTATION_ADDRESS

echo "验证工厂合约: $FACTORY_ADDRESS"
npx hardhat verify --network flow $FACTORY_ADDRESS $ADMIN_ADDRESS $IMPLEMENTATION_ADDRESS $BOT_ADDRESS

if [ $? -ne 0 ]; then
    echo "⚠️ 验证可能失败，但继续执行..."
fi

echo "✅ 验证完成"
echo "按任意键继续创建金库..."
read -n 1 -s

# 步骤3：创建金库
echo "步骤3：创建金库..."
node scripts/createVault.js

if [ $? -ne 0 ]; then
    echo "❌ 创建金库失败"
    exit 1
fi

echo "✅ 金库创建完成"
echo "🎉 所有步骤完成！"
