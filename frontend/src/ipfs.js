// Модуль для работы с IPFS через сервис Pinata.
//
// Перед использованием получите бесплатный JWT-токен на https://app.pinata.cloud
// (раздел API Keys) и положите его в файл frontend/.env:
//   VITE_PINATA_JWT=ваш_токен
//
// В блокчейне хранится только ссылка ipfs://<CID>, а сами метаданные
// (включая название достижения, дату, описание) лежат в IPFS.
// Персональные данные студента в метаданные не кладём.

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// Публичный шлюз для чтения данных из IPFS.
export const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/**
 * Сформировать стандартные метаданные бейджа.
 * Формат совместим с тем, как метаданные читают обозреватели NFT.
 */
export function buildBadgeMetadata({ title, description, category, issuerName, image }) {
  return {
    name: title,
    description: description || "",
    image: image || "", // ссылка на картинку бейджа (тоже может быть в IPFS)
    attributes: [
      { trait_type: "Категория", value: category },
      { trait_type: "Выдал", value: issuerName || "" },
      { trait_type: "Дата выпуска", value: new Date().toISOString().slice(0, 10) },
    ],
  };
}

/**
 * Загрузить JSON-метаданные в IPFS и вернуть ссылку ipfs://<CID>.
 */
export async function uploadMetadataToIPFS(metadata) {
  if (!PINATA_JWT) {
    throw new Error(
      "Не задан VITE_PINATA_JWT. Добавьте токен Pinata в frontend/.env"
    );
  }

  const response = await fetch(PINATA_PIN_JSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.name}.json` },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка загрузки в IPFS: ${response.status} ${text}`);
  }

  const data = await response.json();
  return `ipfs://${data.IpfsHash}`;
}

/**
 * Превратить ссылку ipfs://<CID>/file в HTTP-ссылку для браузера.
 */
export function ipfsToHttp(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAY + uri.slice("ipfs://".length);
  }
  return uri;
}

/**
 * Прочитать метаданные бейджа из IPFS по ссылке tokenURI.
 */
export async function fetchMetadata(uri) {
  const httpUrl = ipfsToHttp(uri);
  if (!httpUrl) return null;
  try {
    const res = await fetch(httpUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
