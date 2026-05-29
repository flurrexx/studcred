require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Переменные окружения берутся из файла .env (см. .env.example).
// НИКОГДА не коммитьте настоящий приватный ключ в git!
const AMOY_RPC_URL =
  process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const FACHAIN_RPC_URL =
  process.env.FACHAIN_RPC_URL || "https://rpc.finchainlab.ru";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Локальная сеть Hardhat для разработки и тестов.
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Тестовая сеть Polygon Amoy.
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    // Сеть FACHAIN.
    fachain: {
      url: FACHAIN_RPC_URL,
      chainId: 525,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
};
