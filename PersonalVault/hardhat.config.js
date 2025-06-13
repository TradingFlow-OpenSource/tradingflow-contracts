require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

INFURA_API_KEY = process.env.INFURA_API_KEY || "";
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
  },
};
