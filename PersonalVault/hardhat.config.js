require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
require("ts-node/register");

INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

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
    ],
  },
  networks: {
    hardhat: {
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 30000000,
      timeout: 1000000,
    },
    // Flow EVM 网络配置
    flow: {
      url: "https://mainnet.evm.nodes.onflow.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    flowTestnet: {
      url: "https://testnet.evm.nodes.onflow.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      // Flow EVM 不需要实际的 API 密钥
      flow: "abc",
      flowTestnet: "abc",
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
      {
        network: "flowTestnet",
        chainId: 545,
        urls: {
          apiURL: "https://evm-testnet.flowscan.io/api",
          browserURL: "https://evm-testnet.flowscan.io/",
        },
      },
    ],
  },
};
