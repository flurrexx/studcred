import { BrowserProvider, Contract } from "ethers";
import addressData from "./contract-address.json";

// Адрес задеплоенного контракта (берётся из contract-address.json).
export const CONTRACT_ADDRESS = addressData.AchievementBadge;

// ABI контракта AchievementBadge (полностью on-chain версия, без IPFS).
const abi = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "student", "type": "address" }, { "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }, { "indexed": false, "internalType": "string", "name": "title", "type": "string" }, { "indexed": false, "internalType": "string", "name": "category", "type": "string" }], "name": "BadgeIssued", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "BadgeRevoked", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }], "name": "IssuerAdded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }], "name": "IssuerRemoved", "type": "event" },
  { "inputs": [{ "internalType": "address", "name": "a", "type": "address" }], "name": "addIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "badges", "outputs": [{ "internalType": "address", "name": "student", "type": "address" }, { "internalType": "address", "name": "issuer", "type": "address" }, { "internalType": "uint64", "name": "issuedAt", "type": "uint64" }, { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string", "name": "category", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "student", "type": "address" }, { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string", "name": "category", "type": "string" }], "name": "issueBadge", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "issuers", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "a", "type": "address" }], "name": "removeIssuer", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "revokeBadge", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "totalIssued", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "verifyBadge", "outputs": [{ "internalType": "bool", "name": "valid", "type": "bool" }, { "internalType": "address", "name": "student", "type": "address" }, { "internalType": "address", "name": "issuer", "type": "address" }, { "internalType": "uint64", "name": "issuedAt", "type": "uint64" }, { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string", "name": "category", "type": "string" }], "stateMutability": "view", "type": "function" }
];

// Параметры сети FACHAIN для добавления в MetaMask.
export const FACHAIN_PARAMS = {
  chainId: "0x20D", // 525 в шестнадцатеричном виде
  chainName: "FACHAIN",
  nativeCurrency: { name: "FA", symbol: "FA", decimals: 18 },
  rpcUrls: ["https://rpc.finchainlab.ru"],
  blockExplorerUrls: ["https://explorer.finchainlab.ru"],
};

export function hasMetaMask() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

// Подключение кошелька + переключение на сеть FACHAIN.
export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error("MetaMask не найден. Установите расширение MetaMask.");
  }
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  await ensureNetwork();
  return accounts[0];
}

// Убедиться, что в MetaMask выбрана сеть FACHAIN (или добавить её).
export async function ensureNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: FACHAIN_PARAMS.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [FACHAIN_PARAMS],
      });
    } else {
      throw switchError;
    }
  }
}

export async function getContract(withSigner = false) {
  const provider = new BrowserProvider(window.ethereum);
  if (withSigner) {
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, abi, signer);
  }
  return new Contract(CONTRACT_ADDRESS, abi, provider);
}
