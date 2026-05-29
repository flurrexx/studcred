import { BrowserProvider, Contract } from "ethers";
import addressData from "./contract-address.json";

export const CONTRACT_ADDRESS = addressData.AchievementBadge;

const abi = [
  {"inputs":[{"internalType":"address","name":"initialOwner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"student","type":"address"},{"indexed":true,"internalType":"address","name":"issuer","type":"address"},{"internalType":"string","name":"category","type":"string"},{"internalType":"string","name":"tokenURI","type":"string"}],"name":"BadgeIssued","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"BadgeRevoked","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"issuer","type":"address"}],"name":"IssuerAdded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"issuer","type":"address"}],"name":"IssuerRemoved","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"issuer","type":"address"}],"name":"addIssuer","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"badgeInfo","outputs":[{"internalType":"address","name":"issuer","type":"address"},{"internalType":"uint256","name":"issuedAt","type":"uint256"},{"internalType":"string","name":"category","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"student","type":"address"},{"internalType":"string","name":"uri","type":"string"},{"internalType":"string","name":"category","type":"string"}],"name":"issueBadge","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"issuers","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"issuer","type":"address"}],"name":"removeIssuer","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"revokeBadge","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalIssued","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"verifyBadge","outputs":[{"internalType":"bool","name":"valid","type":"bool"},{"internalType":"address","name":"owner_","type":"address"},{"internalType":"address","name":"issuer","type":"address"},{"internalType":"uint256","name":"issuedAt","type":"uint256"},{"internalType":"string","name":"category","type":"string"},{"internalType":"string","name":"uri","type":"string"}],"stateMutability":"view","type":"function"}
];

export const AMOY_PARAMS = {
  chainId: "0x20D",
  chainName: "FACHAIN",
  nativeCurrency: { name: "FA", symbol: "FA", decimals: 18 },
  rpcUrls: ["https://rpc.finchainlab.ru"],
  blockExplorerUrls: ["https://explorer.finchainlab.ru"],
};

export function hasMetaMask() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error("MetaMask не найден. Установите расширение MetaMask.");
  }
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  await ensureAmoyNetwork();
  return accounts[0];
}

export async function ensureAmoyNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_PARAMS.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [AMOY_PARAMS],
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
