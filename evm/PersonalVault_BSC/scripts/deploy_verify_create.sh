#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========== 个人金库部署、验证和创建脚本 (bsc) ==========${NC}"

# 1. 部署合约
echo -e "${GREEN}步骤 1: 部署合约${NC}"
echo "正在部署 PersonalVaultUpgradeableUniV3 和 PersonalVaultFactoryUniV3 合约到bsc..."
npx hardhat run scripts/deploy.js --network bsc

# 等待部署完成，给用户时间查看输出
echo -e "${YELLOW}部署完成。请确认上面显示的合约地址，然后按回车继续...${NC}"
read -p ""

# 从.env文件读取合约地址
source .env
FACTORY_ADDRESS=${FACTORY_ADDRESS}
PERSONAL_VAULT_IMPL_ADDRESS=${PERSONAL_VAULT_IMPL_ADDRESS}
DEPLOYER_ADDRESS=${DEPLOYER_ADDRESS}
BOT_ADDRESS=${BOT_ADDRESS}

# 检查合约地址是否已设置
if [ -z "$FACTORY_ADDRESS" ] || [ -z "$PERSONAL_VAULT_IMPL_ADDRESS" ]; then
    echo -e "${RED}错误: FACTORY_ADDRESS 或 PERSONAL_VAULT_IMPL_ADDRESS 未在.env文件中设置${NC}"
    echo -e "请确保在部署后将这些地址添加到.env文件中"
    exit 1
fi

# 使用实际的部署者地址
# 从.env文件读取或者手动设置
echo -e "${YELLOW}使用部署者地址: $DEPLOYER_ADDRESS${NC}"

# 2. 验证合约
echo -e "${GREEN}步骤 2: 验证合约${NC}"
echo "正在验证 PersonalVaultFactoryUniV3 合约..."
echo "使用的参数: $DEPLOYER_ADDRESS $PERSONAL_VAULT_IMPL_ADDRESS $BOT_ADDRESS"

# 显示将要验证的地址和参数
echo -e "${YELLOW}工厂合约地址: $FACTORY_ADDRESS${NC}"
echo -e "${YELLOW}实现合约地址: $PERSONAL_VAULT_IMPL_ADDRESS${NC}"
echo -e "${YELLOW}部署者地址: $DEPLOYER_ADDRESS${NC}"

# 验证工厂合约（添加重试机制）
echo -e "${YELLOW}正在验证合约，最多尝试3次...${NC}"

MAX_RETRIES=3
RETRY_COUNT=0
VERIFY_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$VERIFY_SUCCESS" = "false" ]; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo -e "${YELLOW}尝试 $RETRY_COUNT/$MAX_RETRIES${NC}"

    if npx hardhat verify --network bsc $FACTORY_ADDRESS $DEPLOYER_ADDRESS $PERSONAL_VAULT_IMPL_ADDRESS $BOT_ADDRESS; then
        VERIFY_SUCCESS=true
        echo -e "${GREEN}验证成功!${NC}"
    else
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}验证失败，等待10秒后重试...${NC}"
            sleep 10
        else
            echo -e "${RED}验证失败，已达到最大重试次数。${NC}"
            echo -e "${YELLOW}提示: 请确认您的.env文件中包含有效的BSCSCAN_API_KEY${NC}"
            echo -e "${YELLOW}您也可以稍后手动验证合约:${NC}"
            echo -e "${YELLOW}1. 访问 https://testnet.bscscan.com/verifyContract${NC}"
            echo -e "${YELLOW}2. 输入合约地址: $FACTORY_ADDRESS${NC}"
            echo -e "${YELLOW}3. 按照网站指示完成验证${NC}"

            echo -e "${YELLOW}是否继续创建金库? (y/n)${NC}"
            read -p "" continue_choice
            if [[ "$continue_choice" != "y" && "$continue_choice" != "Y" ]]; then
                echo -e "${RED}脚本已终止${NC}"
                exit 1
            fi
        fi
    fi
done

# 等待验证完成
echo -e "${YELLOW}验证完成。请按回车继续创建金库...${NC}"
read -p ""

# 3. 创建金库
echo -e "${GREEN}步骤 3: 创建金库${NC}"
echo -e "${YELLOW}开始创建金库...${NC}"
npx hardhat run scripts/createVault.js --network bsc

echo -e "${YELLOW}========== 脚本执行完成 ==========${NC}"
