import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import {
  connectWallet,
  getContract,
  hasMetaMask,
  CONTRACT_ADDRESS,
} from "./contract";

// Человекочитаемые названия категорий.
const CATEGORY_LABELS = {
  course: "Курс",
  event: "Мероприятие",
  internship: "Практика/стажировка",
  volunteering: "Волонтёрство",
};

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || value || "—";
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState("portfolio");
  const [status, setStatus] = useState("");

  // Если в URL есть ?badge=N — сразу открываем вкладку проверки.
  const initialBadge = (() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const b = p.get("badge");
    return b !== null && b !== "" ? b : null;
  })();

  useEffect(() => {
    if (initialBadge !== null) setTab("verify");
  }, [initialBadge]);

  const connect = async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      setStatus("");
    } catch (e) {
      setStatus(e.message);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>StudCred</h1>
          <p className="subtitle">Проверяемое цифровое портфолио студента</p>
        </div>
        <div className="wallet">
          {account ? (
            <span className="badge-pill">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          ) : (
            <button onClick={connect}>Подключить кошелёк</button>
          )}
        </div>
      </header>

      {!hasMetaMask() && (
        <div className="warn">
          MetaMask не обнаружен. Для работы установите расширение MetaMask.
        </div>
      )}
      {status && <div className="warn">{status}</div>}

      <nav className="tabs">
        <button
          className={tab === "portfolio" ? "active" : ""}
          onClick={() => setTab("portfolio")}
        >
          Моё портфолио
        </button>
        <button
          className={tab === "issue" ? "active" : ""}
          onClick={() => setTab("issue")}
        >
          Выпустить бейдж
        </button>
        <button
          className={tab === "verify" ? "active" : ""}
          onClick={() => setTab("verify")}
        >
          Проверка бейджа
        </button>
      </nav>

      <main className="main">
        {tab === "portfolio" && <Portfolio account={account} />}
        {tab === "issue" && <IssueBadge account={account} />}
        {tab === "verify" && <VerifyBadge initialBadge={initialBadge} />}
      </main>

      <footer className="footer">
        Контракт: <code>{CONTRACT_ADDRESS}</code> · сеть FACHAIN
      </footer>
    </div>
  );
}

// --- Вкладка: портфолио студента ---
function Portfolio({ account }) {
  const [badges, setBadges] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const contract = await getContract(false);
      const total = Number(await contract.totalIssued());
      const owned = [];
      for (let id = 0; id < total; id++) {
        const [valid, student, issuer, issuedAt, title, category] =
          await contract.verifyBadge(id);
        if (valid && student.toLowerCase() === account.toLowerCase()) {
          owned.push({
            id,
            issuer,
            issuedAt: Number(issuedAt),
            title,
            category,
          });
        }
      }
      setBadges(owned);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  if (!account)
    return <p className="hint">Подключите кошелёк, чтобы увидеть свои бейджи.</p>;
  if (loading) return <p className="hint">Загрузка бейджей…</p>;
  if (badges.length === 0)
    return <p className="hint">У вас пока нет бейджей.</p>;

  const shown =
    filter === "all" ? badges : badges.filter((b) => b.category === filter);

  return (
    <div>
      <div className="filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Все
        </button>
        {Object.keys(CATEGORY_LABELS).map((c) => (
          <button
            key={c}
            className={filter === c ? "active" : ""}
            onClick={() => setFilter(c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="grid">
        {shown.map((b) => (
          <BadgeCard key={b.id} badge={b} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ badge }) {
  const date = new Date(badge.issuedAt * 1000).toLocaleDateString("ru-RU");
  const verifyUrl = `${window.location.origin}/?badge=${badge.id}`;
  return (
    <div className="card">
      <div className="card-cat">{categoryLabel(badge.category)}</div>
      <h3>{badge.title || `Бейдж #${badge.id}`}</h3>
      <div className="card-meta">
        <span>Бейдж #{badge.id}</span>
        <span>Выдан: {date}</span>
        <span className="mono">
          Эмитент: {badge.issuer.slice(0, 6)}…{badge.issuer.slice(-4)}
        </span>
      </div>
      <a className="share-link" href={verifyUrl} target="_blank" rel="noreferrer">
        Ссылка для проверки
      </a>
    </div>
  );
}

// --- Вкладка: выпуск бейджа (для организаций) ---
function IssueBadge({ account }) {
  const [form, setForm] = useState({
    student: "",
    title: "",
    category: "course",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!account) return setStatus("Сначала подключите кошелёк.");
    if (!form.student || !form.title)
      return setStatus("Заполните адрес и название.");
    setBusy(true);
    setStatus("Отправка транзакции в блокчейн…");
    try {
      const contract = await getContract(true);
      const tx = await contract.issueBadge(
        form.student,
        form.title,
        form.category
      );
      setStatus("Ожидание подтверждения сети…");
      await tx.wait();
      setStatus("✅ Бейдж успешно выпущен!");
      setForm({ ...form, student: "", title: "" });
    } catch (e) {
      setStatus("Ошибка: " + (e.reason || e.shortMessage || e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <p className="hint">
        Выпускать бейджи может только авторизованная организация
        (добавляется администратором контракта). Данные достижения
        записываются прямо в блокчейн.
      </p>
      <label>
        Адрес студента (кошелёк)
        <input
          value={form.student}
          onChange={update("student")}
          placeholder="0x…"
        />
      </label>
      <label>
        Название достижения
        <input
          value={form.title}
          onChange={update("title")}
          placeholder="Призёр олимпиады по международным финансам"
        />
      </label>
      <label>
        Категория
        <select value={form.category} onChange={update("category")}>
          <option value="course">Курс</option>
          <option value="event">Мероприятие</option>
          <option value="internship">Практика/стажировка</option>
          <option value="volunteering">Волонтёрство</option>
        </select>
      </label>
      <button onClick={submit} disabled={busy}>
        {busy ? "Выпуск…" : "Выпустить бейдж"}
      </button>
      {status && <div className="status">{status}</div>}
    </div>
  );
}

// --- Вкладка: публичная проверка ---
function VerifyBadge({ initialBadge }) {
  const [tokenId, setTokenId] = useState(initialBadge ?? "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef(null);

  const verify = useCallback(async (id) => {
    const checkId = id ?? tokenId;
    if (checkId === "" || checkId === null) return;
    setBusy(true);
    setResult(null);
    try {
      const contract = await getContract(false);
      const [valid, student, issuer, issuedAt, title, category] =
        await contract.verifyBadge(checkId);
      setResult({
        valid,
        student,
        issuer,
        issuedAt: Number(issuedAt),
        title,
        category,
        id: checkId,
      });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }, [tokenId]);

  // Автопроверка при заходе по ссылке ?badge=N
  useEffect(() => {
    if (initialBadge !== null && initialBadge !== undefined) {
      verify(initialBadge);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Рисуем QR-код ссылки на проверку, когда есть валидный результат.
  useEffect(() => {
    if (result?.valid && qrRef.current) {
      const url = `${window.location.origin}/?badge=${result.id}`;
      QRCode.toCanvas(qrRef.current, url, { width: 160, margin: 1 }, () => {});
    }
  }, [result]);

  return (
    <div className="form">
      <p className="hint">
        Введите номер бейджа или откройте ссылку проверки. Проверка работает
        без авторизации и не раскрывает лишних персональных данных.
      </p>
      <label>
        Номер бейджа (tokenId)
        <input
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="0"
        />
      </label>
      <button onClick={() => verify()} disabled={busy || tokenId === ""}>
        {busy ? "Проверка…" : "Проверить"}
      </button>

      {result?.error && <div className="warn">{result.error}</div>}
      {result && !result.error && (
        <div className={result.valid ? "verify-ok" : "verify-fail"}>
          {result.valid ? (
            <>
              <strong>✅ Бейдж подлинный</strong>
              <p>{result.title || "(без названия)"}</p>
              <div className="card-meta">
                <span>Категория: {categoryLabel(result.category)}</span>
                <span>
                  Выдан:{" "}
                  {new Date(result.issuedAt * 1000).toLocaleDateString("ru-RU")}
                </span>
                <span className="mono">Владелец: {result.student}</span>
                <span className="mono">Эмитент: {result.issuer}</span>
              </div>
              <div className="qr-block">
                <p className="hint">QR-код для проверки этого бейджа:</p>
                <canvas ref={qrRef} />
              </div>
            </>
          ) : (
            <strong>❌ Бейдж не найден или был отозван</strong>
          )}
        </div>
      )}
    </div>
  );
}
