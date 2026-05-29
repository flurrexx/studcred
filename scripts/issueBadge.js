// Демонстрационный скрипт: выпускает один бейдж после деплоя.
// Удобно для быстрой проверки локально.
// Запуск: npm run issue:local

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addressFile = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "contract-address.json"
  );
  if (!fs.existsSync(addressFile)) {
    throw new Error(
      "Сначала разверните контракт (npm run deploy:local) — нет contract-address.json"
    );
  }
  const { AchievementBadge: contractAddress } = JSON.parse(
    fs.readFileSync(addressFile, "utf8")
  );

  const [admin, , , student] = await hre.ethers.getSigners();
  const badge = await hre.ethers.getContractAt(
    "AchievementBadge",
    contractAddress
  );

  // Пример метаданных. В реальном проекте JSON загружается в IPFS,
  // а сюда подставляется полученный CID (см. frontend/src/ipfs.js).
  const demoURI = "ipfs://bafkreidemoexamplecid/metadata.json";

  console.log("Выпускаем бейдж студенту:", student.address);
  const tx = await badge.issueBadge(student.address, demoURI, "course");
  const receipt = await tx.wait();
  console.log("Бейдж выпущен. tx hash:", receipt.hash);

  const total = await badge.totalIssued();
  console.log("Всего бейджей выпущено:", total.toString());

  const [valid, owner_, issuer, issuedAt, category, uri] =
    await badge.verifyBadge(0);
  console.log("Проверка бейджа #0:", {
    valid,
    owner: owner_,
    issuer,
    issuedAt: issuedAt.toString(),
    category,
    uri,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
