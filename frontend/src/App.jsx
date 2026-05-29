import { useState, useEffect, useCallback } from "react";
import {
  connectWallet,
  getContract,
  hasMetaMask,
  CONTRACT_ADDRESS,
} from "./contract";
import {
  buildBadgeMetadata,
  uploadMetadataToIPFS,
  fetchMetadata,
} from "./ipfs";

export default function App() {
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState("portfolio");
  const [status, setStatus] = useState("");

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
        {tab === "verify" && <VerifyBadge />}
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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const contract = await getContract(false);
      const total = Number(await contract.totalIssued());
      const owned = [];
      // Перебираем все выпущенные бейджи и отбираем принадлежащие студенту.
      for (let id = 0; id < total; id++) {
        const [valid, owner_, issuer, issuedAt, category, uri] =
          await contract.verifyBadge(id);
        if (valid && owner_.toLowerCase() === account.toLowerCase()) {
          const meta = await fetchMetadata(uri);
          owned.push({ id, issuer, issuedAt: Number(issuedAt), category, meta });
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

  if (!account) return <p className="hint">Подключите кошелёк, чтобы увидеть свои бейджи.</p>;
  if (loading) return <p className="hint">Загрузка бейджей…</p>;
  if (badges.length === 0) return <p className="hint">У вас пока нет бейджей.</p>;

  return (
    <div className="grid">
      {badges.map((b) => (
        <BadgeCard key={b.id} badge={b} />
      ))}
    </div>
  );
}

function BadgeCard({ badge }) {
  const title = badge.meta?.name || `Бейдж #${badge.id}`;
  const date = new Date(badge.issuedAt * 1000).toLocaleDateString("ru-RU");
  return (
    <div className="card">
      <div className="card-cat">{badge.category}</div>
      <h3>{title}</h3>
      {badge.meta?.description && <p>{badge.meta.description}</p>}
      <div className="card-meta">
        <span>Выдан: {date}</span>
        <span className="mono">
          Эмитент: {badge.issuer.slice(0, 6)}…{badge.issuer.slice(-4)}
        </span>
      </div>
    </div>
  );
}

// --- Вкладка: выпуск бейджа (для организаций) ---
function IssueBadge({ account }) {
  const [form, setForm] = useState({
    student: "",
    title: "",
    description: "",
    category: "course",
    issuerName: "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!account) return setStatus("Сначала подключите кошелёк.");
    if (!form.student || !form.title) return setStatus("Заполните адрес и название.");
    setBusy(true);
    setStatus("Загрузка метаданных в IPFS…");
    try {
      const metadata = buildBadgeMetadata(form);
      const uri = await uploadMetadataToIPFS(metadata);
      setStatus("Отправка транзакции в блокчейн…");
      const contract = await getContract(true);
      const tx = await contract.issueBadge(form.student, uri, form.category);
      await tx.wait();
      setStatus("✅ Бейдж успешно выпущен!");
      setForm({ ...form, student: "", title: "", description: "" });
    } catch (e) {
      setStatus("Ошибка: " + (e.reason || e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <p className="hint">
        Выпускать бейджи может только авторизованная организация
        (добавляется администратором контракта).
      </p>
      <label>
        Адрес студента (кошелёк)
        <input value={form.student} onChange={update("student")} placeholder="0x…" />
      </label>
      <label>
        Название достижения
        <input value={form.title} onChange={update("title")} placeholder="Призёр олимпиады по международным финансам" />
      </label>
      <label>
        Описание
        <textarea value={form.description} onChange={update("description")} rows={3} />
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
      <label>
        Название организации
        <input value={form.issuerName} onChange={update("issuerName")} placeholder="Финуниверситет, факультет МЭО" />
      </label>
      <button onClick={submit} disabled={busy}>
        {busy ? "Выпуск…" : "Выпустить бейдж"}
      </button>
      {status && <div className="status">{status}</div>}
    </div>
  );
}

// --- Вкладка: публичная проверка ---
function VerifyBadge() {
  const [tokenId, setTokenId] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    setResult(null);
    try {
      const contract = await getContract(false);
      const [valid, owner_, issuer, issuedAt, category, uri] =
        await contract.verifyBadge(tokenId);
      const meta = valid ? await fetchMetadata(uri) : null;
      setResult({ valid, owner_, issuer, issuedAt: Number(issuedAt), category, meta });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <p className="hint">
        Введите номер бейджа (или отсканируйте QR-код). Проверка работает
        без авторизации и не раскрывает лишних персональных данных.
      </p>
      <label>
        Номер бейджа (tokenId)
        <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="0" />
      </label>
      <button onClick={verify} disabled={busy || tokenId === ""}>
        {busy ? "Проверка…" : "Проверить"}
      </button>

      {result?.error && <div className="warn">{result.error}</div>}
      {result && !result.error && (
        <div className={result.valid ? "verify-ok" : "verify-fail"}>
          {result.valid ? (
            <>
              <strong>✅ Бейдж подлинный</strong>
              <p>{result.meta?.name || "(без названия)"}</p>
              <div className="card-meta">
                <span>Категория: {result.category}</span>
                <span>
                  Выдан: {new Date(result.issuedAt * 1000).toLocaleDateString("ru-RU")}
                </span>
                <span className="mono">Владелец: {result.owner_}</span>
                <span className="mono">Эмитент: {result.issuer}</span>
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
