# MultiVault 模块

本模块为“多人金库”系统，支持多个用户共同存取和管理资产，基于 EVM 合约实现，适合团队、DAO 或多签场景。

## 目录结构

-   contracts/
    -   UniswapVault.sol // 多人金库核心合约
    -   PriceOracle.sol // 价格预言机合约
    -   MyToken.sol // 示例代币合约
-   scripts/
    -   各类金库/交易/管理相关脚本
-   test/
    -   单元测试（推荐 Hardhat/Foundry）
-   README.md

## 主要功能

-   多用户可共同存入、赎回资产
-   支持多种 ERC20 资产
-   支持策略管理、交易信号、Uniswap 路由集成
-   事件追踪、资产配置查询

## 快速开始

### 1. 部署合约

```shell
npx hardhat run scripts/deployVault.ts --network <your_network>
```

### 2. 存款/赎回/交易

见 scripts/ 目录下示例脚本。

## 权限说明

-   管理员可配置策略、添加/禁用交易对
-   预言机/Bot 可发起交易信号
-   用户可存取资产

## 事件

-   SignalReceived
-   TradeExecuted
-   StrategyStatusChanged
-   UserDeposit/UserWithdraw

## 测试

建议使用 Hardhat/Foundry 编写测试用例，覆盖多用户存取、策略执行、权限管理等核心场景。

---

如需定制脚本或有特殊业务需求，请联系开发者。

# OracleGuidedVault - Automated Uniswap V3 Trading Vault

## Overview

The **OracleGuidedVault** is a sophisticated ERC4626-compliant vault contract that automates cryptocurrency trading on Uniswap V3 based on oracle-driven signals. This contract combines traditional vault functionality with algorithmic trading capabilities, enabling users to deposit assets and have them automatically managed through strategic trading operations.

## Key Features

### 🏦 **ERC4626 Vault Standard**

-   Full compatibility with the ERC4626 tokenized vault standard
-   Secure deposit/withdrawal mechanisms with share-based accounting
-   Real-time asset valuation across multiple token holdings

### 🤖 **Oracle-Driven Trading**

-   Automated buy/sell signal execution based on external oracle inputs
-   Support for multiple trading pairs with configurable allocation limits
-   Advanced swap parameters including fee tiers and slippage protection

### 🔐 **Role-Based Access Control**

-   **Platform Owner**: Manages oracle roles and emergency functions
-   **Strategy Manager**: Controls trading pairs and strategy activation
-   **Oracle Role**: Executes trading signals with predetermined parameters

## Core Functionality

### Trading Operations

-   **Buy Signals**: Automatically purchase tokens when favorable conditions are detected
-   **Sell Signals**: Execute strategic exits based on market conditions or portfolio rebalancing needs
-   **Advanced Swaps**: Support for custom fee tiers, price limits, and complex trading parameters

### Portfolio Management

-   **Multi-Asset Support**: Manage diverse cryptocurrency portfolios within a single vault
-   **Intelligent Liquidity Management**: Automatically rebalance assets to ensure sufficient liquidity for withdrawals
-   **Real-Time Valuation**: Continuous portfolio value calculation using integrated price oracles

### Risk Management

-   **Allocation Limits**: Configurable maximum allocation percentages per trading pair
-   **Emergency Exit**: Owner-controlled function to liquidate all positions in crisis situations
-   **Reentrancy Protection**: Comprehensive security measures against common smart contract vulnerabilities

## Technical Architecture

Built on **Solidity 0.8.20** with integration to:

-   **OpenZeppelin**: Security-audited base contracts for access control and reentrancy protection
-   **Uniswap V3**: Direct integration with SwapRouter for optimal trading execution
-   **Custom Price Oracle**: Real-time asset valuation and portfolio management

## Use Cases

-   **Algorithmic Trading**: Automated execution of predefined trading strategies
-   **Portfolio Management**: Hands-off cryptocurrency portfolio management
-   **Yield Optimization**: Strategic rebalancing to maximize returns
-   **Risk Mitigation**: Automated stop-loss and take-profit mechanisms

The OracleGuidedVault represents a new generation of DeFi infrastructure, bridging traditional finance concepts with cutting-edge blockchain technology to deliver sophisticated, automated investment management solutions.
