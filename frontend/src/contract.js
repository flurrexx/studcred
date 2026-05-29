// Модуль работы с блокчейном через ethers.js v6 и кошелёк MetaMask.

import { BrowserProvider, Contract } from "ethers";
import abi from "./AchievementBadge.json";
import addressData from "./contract-address.json";

export const CONTRACT_ADDRESS = addressData.AchievementBadge;

// Параметры сети FACHAIN (для добавления в MetaMask).
export const AMOY_PARAMS = {
  chainId: "0x20D", // 525 в hex
  chainName: "FACHAIN",
  nativeCurrency: { name: "FA", symbol: "FA", decimals: 18 },
  rpcUrls: ["https://rpc.finchainlab.ru"],
  blockExplorerUrls: ["https://explorer.finchainlab.ru"],
};

/** Проверка, что MetaMask установлен. */
export function hasMetaMask() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** Запросить подключение кошелька и вернуть адрес пользователя. */
export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error("MetaMask не найден. Установите расширение MetaMask.");
  }
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  await ensureAmoyNetwork();
  return accounts[0];
}

/** Переключить MetaMask на сеть Amoy (добавить, если её нет). */
export async function ensureAmoyNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_PARAMS.chainId }],
    });
  } catch (switchError) {
    // 4902 — сеть не добавлена в кошелёк.
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

/** Получить экземпляр контракта (для чтения — provider, для записи — signer). */
export async function getContract(withSigner = false) {
  const provider = new BrowserProvider(window.ethereum);
  if (withSigner) {
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, abi, signer);
  }
  return new Contract(CONTRACT_ADDRESS, abi, provider);
}
