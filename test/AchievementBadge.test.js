const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AchievementBadge", function () {
  let badge, admin, university, employer, student, outsider;

  const URI = "ipfs://bafkreidemoexamplecid/metadata.json";

  beforeEach(async function () {
    [admin, university, employer, student, outsider] = await ethers.getSigners();
    const Badge = await ethers.getContractFactory("AchievementBadge");
    badge = await Badge.deploy(admin.address);
    await badge.waitForDeployment();
  });

  describe("Развёртывание", function () {
    it("задаёт имя и символ токена", async function () {
      expect(await badge.name()).to.equal("StudCred Achievement Badge");
      expect(await badge.symbol()).to.equal("BADGE");
    });

    it("делает администратора эмитентом по умолчанию", async function () {
      expect(await badge.issuers(admin.address)).to.equal(true);
    });

    it("в начале ни одного бейджа не выпущено", async function () {
      expect(await badge.totalIssued()).to.equal(0n);
    });
  });

  describe("Управление эмитентами", function () {
    it("админ может добавить организацию-эмитента", async function () {
      await expect(badge.addIssuer(university.address))
        .to.emit(badge, "IssuerAdded")
        .withArgs(university.address);
      expect(await badge.issuers(university.address)).to.equal(true);
    });

    it("не-админ не может добавлять эмитентов", async function () {
      await expect(
        badge.connect(outsider).addIssuer(university.address)
      ).to.be.revertedWithCustomError(badge, "OwnableUnauthorizedAccount");
    });

    it("админ может отозвать право выпуска", async function () {
      await badge.addIssuer(university.address);
      await expect(badge.removeIssuer(university.address))
        .to.emit(badge, "IssuerRemoved")
        .withArgs(university.address);
      expect(await badge.issuers(university.address)).to.equal(false);
    });
  });

  describe("Выпуск бейджей", function () {
    beforeEach(async function () {
      await badge.addIssuer(university.address);
    });

    it("авторизованная организация выпускает бейдж студенту", async function () {
      await expect(
        badge.connect(university).issueBadge(student.address, URI, "course")
      )
        .to.emit(badge, "BadgeIssued")
        .withArgs(0, student.address, university.address, "course", URI);

      expect(await badge.ownerOf(0)).to.equal(student.address);
      expect(await badge.tokenURI(0)).to.equal(URI);
      expect(await badge.totalIssued()).to.equal(1n);
    });

    it("сохраняет он-чейн данные бейджа (кто выдал, категория)", async function () {
      await badge.connect(university).issueBadge(student.address, URI, "internship");
      const info = await badge.badgeInfo(0);
      expect(info.issuer).to.equal(university.address);
      expect(info.category).to.equal("internship");
      expect(info.issuedAt).to.be.greaterThan(0n);
    });

    it("неавторизованный адрес не может выпустить бейдж", async function () {
      await expect(
        badge.connect(outsider).issueBadge(student.address, URI, "course")
      ).to.be.revertedWith("Caller is not an authorized issuer");
    });

    it("нельзя выпустить бейдж с пустым URI", async function () {
      await expect(
        badge.connect(university).issueBadge(student.address, "", "course")
      ).to.be.revertedWith("Empty tokenURI");
    });

    it("tokenId увеличивается с каждым выпуском", async function () {
      await badge.connect(university).issueBadge(student.address, URI, "course");
      await badge.connect(university).issueBadge(student.address, URI, "event");
      expect(await badge.totalIssued()).to.equal(2n);
      expect(await badge.ownerOf(1)).to.equal(student.address);
    });
  });

  describe("Публичная проверка (verifyBadge)", function () {
    beforeEach(async function () {
      await badge.addIssuer(university.address);
      await badge.connect(university).issueBadge(student.address, URI, "course");
    });

    it("возвращает корректные данные для существующего бейджа", async function () {
      const [valid, owner_, issuer, issuedAt, category, uri] =
        await badge.verifyBadge(0);
      expect(valid).to.equal(true);
      expect(owner_).to.equal(student.address);
      expect(issuer).to.equal(university.address);
      expect(issuedAt).to.be.greaterThan(0n);
      expect(category).to.equal("course");
      expect(uri).to.equal(URI);
    });

    it("возвращает valid=false для несуществующего бейджа", async function () {
      const [valid, owner_] = await badge.verifyBadge(999);
      expect(valid).to.equal(false);
      expect(owner_).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Soulbound: непередаваемость", function () {
    beforeEach(async function () {
      await badge.addIssuer(university.address);
      await badge.connect(university).issueBadge(student.address, URI, "course");
    });

    it("студент не может передать бейдж другому адресу", async function () {
      await expect(
        badge
          .connect(student)
          .transferFrom(student.address, outsider.address, 0)
      ).to.be.revertedWith("Soulbound: badge is non-transferable");
    });
  });

  describe("Отзыв бейджа", function () {
    beforeEach(async function () {
      await badge.addIssuer(university.address);
      await badge.connect(university).issueBadge(student.address, URI, "course");
    });

    it("выпустившая организация может отозвать бейдж", async function () {
      await expect(badge.connect(university).revokeBadge(0))
        .to.emit(badge, "BadgeRevoked")
        .withArgs(0);
      const [valid] = await badge.verifyBadge(0);
      expect(valid).to.equal(false);
    });

    it("админ может отозвать любой бейдж", async function () {
      await expect(badge.connect(admin).revokeBadge(0)).to.emit(
        badge,
        "BadgeRevoked"
      );
    });

    it("посторонний не может отозвать бейдж", async function () {
      await expect(
        badge.connect(outsider).revokeBadge(0)
      ).to.be.revertedWith("Only admin or original issuer can revoke");
    });
  });
});
