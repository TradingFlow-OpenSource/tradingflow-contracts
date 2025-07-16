require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
require("ts-node/register");

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY || "";
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY || "";

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.22",
        settings: {
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
    // Flow EVM 网络配置
    flow: {
      url: process.env.FLOW_RPC_URL || "https://mainnet.evm.nodes.onflow.org",
      // 使用三个不同的私钥，一个用于部署，一个用于用户，一个用于机器人
      accounts: [DEPLOYER_PRIVATE_KEY, USER_PRIVATE_KEY, BOT_PRIVATE_KEY].filter(
        (key) => key !== ""
      ),
      timeout: 300000, // 5分钟超时
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      // Flow EVM 不需要实际的 API 密钥
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
    ],
  },
};
