require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
require("ts-node/register");

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY || "";
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY || "";

// BSC keys - read from environment variables
// ADDR 1 - Deployer/Factory, ADDR 2 - Admin/Bot, ADDR 3 - User
// Set these in .env file:
//   BSC_PRIVATE_KEY_1=<deployer_key>
//   BSC_PRIVATE_KEY_2=<admin_bot_key>
//   BSC_PRIVATE_KEY_3=<user_key>
const BSC_DEPLOYER = process.env.BSC_PRIVATE_KEY_1?.replace(/^0x/, "") || "";
const BSC_ADMIN = process.env.BSC_PRIVATE_KEY_2?.replace(/^0x/, "") || "";
const BSC_USER = process.env.BSC_PRIVATE_KEY_3?.replace(/^0x/, "") || "";

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.22",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 30000000,
      timeout: 600000,
    },
    // BSC Mainnet Configuration
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
      // Use STG keys: [Deployer, Admin/Bot, User]
      accounts: [
        BSC_DEPLOYER,   // ADDR 1: 0xc4df7125afff69b732982F5DeCd657E1520216d5
        BSC_ADMIN,      // ADDR 2: 0x6dAd57C29d5958833c9b567ce1317eb7d53c27A0
        BSC_USER,       // ADDR 3: 0x3cd24175844C695ba6c6A7Dd21D831F19821DCce
      ],
      timeout: 300000, // 5 minutes timeout
      gasPrice: "auto",
      chainId: 56,
    },
    // BSC Testnet Configuration
    bscTestnet: {
      url:
        process.env.BSC_TESTNET_RPC_URL ||
        "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
      // Use STG keys: [Deployer, Admin/Bot, User]
      accounts: [
        BSC_DEPLOYER,   // ADDR 1: 0xc4df7125afff69b732982F5DeCd657E1520216d5
        BSC_ADMIN,      // ADDR 2: 0x6dAd57C29d5958833c9b567ce1317eb7d53c27A0
        BSC_USER,       // ADDR 3: 0x3cd24175844C695ba6c6A7Dd21D831F19821DCce
      ],
      timeout: 300000, // 5 minutes timeout
      gasPrice: 10000000000, // 10 gwei
      chainId: 97,
    },
    // Flow EVM 网络配置 (保留供参考)
    flow: {
      url: process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org",
      accounts: [
        DEPLOYER_PRIVATE_KEY,
        USER_PRIVATE_KEY,
        BOT_PRIVATE_KEY,
      ].filter((key) => key !== ""),
      timeout: 300000, // 5分钟超时
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      // BSC 网络验证需要 BSCScan API 密钥
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      // Flow EVM 不需要实际的 API 密钥 (保留供参考)
      flow: "abc",
    },
    customChains: [
      {
        network: "flow",
        chainId: 747,
        urls: {
          apiURL: "https://evm.flowscan.io/api",
          browserURL: "https://evm.flowscan.io/",
        },
      },
      // BSC 主网和测试网已内置到 Hardhat，无需自定义
    ],
  },
};
