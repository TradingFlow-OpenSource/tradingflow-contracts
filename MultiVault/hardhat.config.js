require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

INFURA_API_KEY = process.env.INFURA_API_KEY || "";
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC_URL || "https://mainnet.infura.io/v3/" + INFURA_API_KEY,
      },
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 30000000,
      timeout: 1000000
    }
  }
};
