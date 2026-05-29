// Скрипт развёртывания контракта AchievementBadge.
// Запуск:
//   локально:  npm run deploy:local   (нужен запущенный `npm run node`)
//   в тестнет: npm run deploy:amoy     (нужен .env с PRIVATE_KEY)

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Деплой от адреса:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Баланс деплоера:", hre.ethers.formatEther(balance), "MATIC/ETH");

  const Badge = await hre.ethers.getContractFactory("AchievementBadge");
  // Администратором (и первым эмитентом) станет адрес деплоера.
  const badge = await Badge.deploy(deployer.address);
  await badge.waitForDeployment();

  const address = await badge.getAddress();
  console.log("AchievementBadge развёрнут по адресу:", address);

  // Сохраняем адрес контракта и ABI для фронтенда.
  saveFrontendFiles(address);
}

function saveFrontendFiles(address) {
  const frontendDir = path.join(__dirname, "..", "frontend", "src");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  // Адрес контракта.
  fs.writeFileSync(
    path.join(frontendDir, "contract-address.json"),
    JSON.stringify({ AchievementBadge: address }, null, 2)
  );

  // ABI контракта (нужен фронтенду для вызовов).
  const artifact = hre.artifacts.readArtifactSync("AchievementBadge");
  fs.writeFileSync(
    path.join(frontendDir, "AchievementBadge.json"),
    JSON.stringify(artifact.abi, null, 2)
  );

  console.log("Адрес и ABI сохранены в frontend/src/.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
