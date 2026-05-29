// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AchievementBadge
 * @notice NFT-бейджи достижений студентов (проект StudCred).
 *         Каждый бейдж — это запись о достижении, выпущенная доверенной
 *         организацией (вузом, работодателем, организатором мероприятия).
 *
 *         Бейджи являются "soulbound" (непередаваемыми): их нельзя продать
 *         или передать другому адресу, потому что достижение принадлежит
 *         конкретному человеку. Это ключевое отличие от обычных NFT.
 *
 *         Метаданные (кто выдал, за что, когда) хранятся в IPFS, а в
 *         блокчейне фиксируется только ссылка (tokenURI) и адрес владельца.
 *         Персональные данные в блокчейн не записываются.
 */
contract AchievementBadge is ERC721URIStorage, Ownable {
    // Счётчик выпущенных бейджей — используется как следующий tokenId.
    uint256 private _nextTokenId;

    // Реестр организаций, которым разрешено выпускать бейджи.
    // address => может ли выпускать.
    mapping(address => bool) public issuers;

    // Дополнительные он-чейн данные бейджа (помимо tokenURI в IPFS).
    struct BadgeInfo {
        address issuer;      // кто выпустил бейдж
        uint256 issuedAt;    // момент выпуска (timestamp блока)
        string category;     // короткая категория: "course", "event", "internship" и т.п.
    }

    // tokenId => информация о бейдже.
    mapping(uint256 => BadgeInfo) public badgeInfo;

    // --- События (нужны фронтенду для чтения истории) ---
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event BadgeIssued(
        uint256 indexed tokenId,
        address indexed student,
        address indexed issuer,
        string category,
        string tokenURI
    );
    event BadgeRevoked(uint256 indexed tokenId);

    /**
     * @param initialOwner адрес администратора контракта (он же первый issuer).
     */
    constructor(address initialOwner)
        ERC721("StudCred Achievement Badge", "BADGE")
        Ownable(initialOwner)
    {
        // Администратор по умолчанию может выпускать бейджи.
        issuers[initialOwner] = true;
        emit IssuerAdded(initialOwner);
    }

    // --- Управление организациями-эмитентами ---

    /// @notice Добавить организацию, которой разрешено выпускать бейджи.
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Issuer is zero address");
        require(!issuers[issuer], "Already an issuer");
        issuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Отозвать у организации право выпуска бейджей.
    function removeIssuer(address issuer) external onlyOwner {
        require(issuers[issuer], "Not an issuer");
        issuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    // --- Выпуск и отзыв бейджей ---

    /**
     * @notice Выпустить бейдж достижения студенту.
     * @param student   адрес-получатель (кошелёк студента).
     * @param uri       ссылка на метаданные в IPFS (ipfs://...).
     * @param category  короткая категория достижения.
     * @return tokenId  идентификатор выпущенного бейджа.
     */
    function issueBadge(
        address student,
        string memory uri,
        string memory category
    ) external returns (uint256) {
        require(issuers[msg.sender], "Caller is not an authorized issuer");
        require(student != address(0), "Student is zero address");
        require(bytes(uri).length > 0, "Empty tokenURI");

        uint256 tokenId = _nextTokenId++;
        _safeMint(student, tokenId);
        _setTokenURI(tokenId, uri);

        badgeInfo[tokenId] = BadgeInfo({
            issuer: msg.sender,
            issuedAt: block.timestamp,
            category: category
        });

        emit BadgeIssued(tokenId, student, msg.sender, category, uri);
        return tokenId;
    }

    /**
     * @notice Отозвать (аннулировать) ранее выпущенный бейдж.
     *         Отозвать может либо администратор, либо выпустившая организация.
     *         Нужно на случай ошибки или мошенничества.
     */
    function revokeBadge(uint256 tokenId) external {
        _requireOwned(tokenId);
        address issuer = badgeInfo[tokenId].issuer;
        require(
            msg.sender == owner() || msg.sender == issuer,
            "Only admin or original issuer can revoke"
        );
        _burn(tokenId);
        delete badgeInfo[tokenId];
        emit BadgeRevoked(tokenId);
    }

    // --- Публичная проверка ---

    /**
     * @notice Проверить бейдж по его идентификатору.
     *         Используется страницей публичной проверки.
     * @return valid     существует ли бейдж.
     * @return owner_    текущий владелец (студент).
     * @return issuer    организация, выпустившая бейдж.
     * @return issuedAt  момент выпуска.
     * @return category  категория достижения.
     * @return uri       ссылка на метаданные в IPFS.
     */
    function verifyBadge(uint256 tokenId)
        external
        view
        returns (
            bool valid,
            address owner_,
            address issuer,
            uint256 issuedAt,
            string memory category,
            string memory uri
        )
    {
        // _ownerOf возвращает address(0), если токена не существует.
        address tokenOwner = _ownerOf(tokenId);
        if (tokenOwner == address(0)) {
            return (false, address(0), address(0), 0, "", "");
        }
        BadgeInfo memory info = badgeInfo[tokenId];
        return (
            true,
            tokenOwner,
            info.issuer,
            info.issuedAt,
            info.category,
            tokenURI(tokenId)
        );
    }

    /// @notice Сколько всего бейджей было выпущено (включая отозванные id).
    function totalIssued() external view returns (uint256) {
        return _nextTokenId;
    }

    // --- Soulbound: запрет передачи ---

    /**
     * @dev Переопределяем _update из ERC721. Это единая точка, через которую
     *      проходят mint, transfer и burn в OpenZeppelin v5.
     *      Разрешаем только mint (from == 0) и burn (to == 0),
     *      но запрещаем обычную передачу между пользователями.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        require(
            from == address(0) || to == address(0),
            "Soulbound: badge is non-transferable"
        );
        return super._update(to, tokenId, auth);
    }
}
