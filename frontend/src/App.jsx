import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { connectWallet, getContract, hasMetaMask, CONTRACT_ADDRESS } from "./contract";

// ── Категории ──────────────────────────────────────────────────────────────
const CATEGORIES = {
  course:       { label: "Курс",               icon: "🎓" },
  event:        { label: "Мероприятие",         icon: "🏆" },
  internship:   { label: "Практика/стажировка", icon: "💼" },
  volunteering: { label: "Волонтёрство",        icon: "🤝" },
};
const catLabel = (v) => CATEGORIES[v]?.label || v || "—";
const catIcon  = (v) => CATEGORIES[v]?.icon  || "📋";

// ── Toast-система ──────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === "success" ? "✅" : "❌"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState(null);
  const [tab, setTab] = useState("portfolio");
  const { toasts, add: toast } = useToast();

  const initialBadge = (() => {
    if (typeof window === "undefined") return null;
    const b = new URLSearchParams(window.location.search).get("badge");
    return b !== null && b !== "" ? b : null;
  })();

  useEffect(() => { if (initialBadge !== null) setTab("verify"); }, [initialBadge]);

  const connect = async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      toast("Кошелёк подключён!", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <h1>StudCred</h1>
          <p className="subtitle">Проверяемое цифровое портфолио студента</p>
        </div>
        <div>
          {account ? (
            <span className="badge-pill">{account.slice(0,6)}…{account.slice(-4)}</span>
          ) : (
            <button onClick={connect}>⚡ Подключить кошелёк</button>
          )}
        </div>
      </header>

      {!hasMetaMask() && (
        <div className="warn">⚠️ MetaMask не обнаружен. Для работы установите расширение MetaMask.</div>
      )}

      <nav className="tabs">
        {[
          { id: "portfolio", label: "🗂 Портфолио" },
          { id: "issue",     label: "✨ Выпустить бейдж" },
          { id: "verify",    label: "🔍 Проверка" },
        ].map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "portfolio" && <Portfolio account={account} toast={toast} />}
        {tab === "issue"     && <IssueBadge account={account} toast={toast} />}
        {tab === "verify"    && <VerifyBadge initialBadge={initialBadge} toast={toast} />}
      </main>

      <footer className="footer">
        <span>⛓</span>
        <code>{CONTRACT_ADDRESS}</code>
        <span style={{color:"var(--border-bright)"}}>·</span>
        <span>FACHAIN testnet</span>
      </footer>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// ── Портфолио ──────────────────────────────────────────────────────────────
function Portfolio({ account, toast }) {
  const [badges, setBadges]   = useState([]);
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const contract = await getContract(false);
      const total = Number(await contract.totalIssued());
      const owned = [];
      for (let id = 0; id < total; id++) {
        const [valid, student, issuer, issuedAt, title, category] = await contract.verifyBadge(id);
        if (valid && student.toLowerCase() === account.toLowerCase())
          owned.push({ id, issuer, issuedAt: Number(issuedAt), title, category });
      }
      setBadges(owned);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { load(); }, [load]);

  if (!account) return (
    <div className="empty-state">
      <span className="empty-state-icon">🔐</span>
      <h3>Подключите кошелёк</h3>
      <p>Для просмотра портфолио подключите MetaMask-кошелёк в сети FACHAIN</p>
    </div>
  );

  if (loading) return <p className="loading-pulse" style={{padding:"40px 0"}}>⏳ Загрузка бейджей из блокчейна…</p>;

  const shown = filter === "all" ? badges : badges.filter(b => b.category === filter);

  return (
    <div>
      {badges.length > 0 && (
        <div className="portfolio-stats">
          <div className="stat-chip"><strong>{badges.length}</strong>Всего бейджей</div>
          {Object.entries(CATEGORIES).map(([k, v]) => {
            const cnt = badges.filter(b => b.category === k).length;
            return cnt > 0 ? (
              <div key={k} className="stat-chip">
                <strong>{cnt}</strong>{v.icon} {v.label}
              </div>
            ) : null;
          })}
        </div>
      )}

      <div className="filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все</button>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🏅</span>
          <h3>{badges.length === 0 ? "Пока нет бейджей" : "Нет бейджей в этой категории"}</h3>
          <p>{badges.length === 0 ? "Ваши достижения появятся здесь после их выпуска организацией" : "Попробуйте другую категорию"}</p>
        </div>
      ) : (
        <div className="grid">
          {shown.map(b => <BadgeCard key={b.id} badge={b} toast={toast} onRevoke={load} account={account} />)}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, toast, onRevoke, account }) {
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied]     = useState(false);
  const verifyUrl = `${window.location.origin}/?badge=${badge.id}`;
  const date = new Date(badge.issuedAt * 1000).toLocaleDateString("ru-RU");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      toast("Ссылка скопирована!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast("Не удалось скопировать", "error"); }
  };

  const revoke = async () => {
    if (!window.confirm(`Отозвать бейдж #${badge.id}? Это действие необратимо.`)) return;
    setRevoking(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.revokeBadge(badge.id);
      await tx.wait();
      toast(`Бейдж #${badge.id} отозван`, "success");
      onRevoke();
    } catch (e) {
      toast("Ошибка: " + (e.reason || e.shortMessage || e.message), "error");
    } finally { setRevoking(false); }
  };

  const isOwner = account?.toLowerCase() === badge.issuer?.toLowerCase();

  return (
    <div className="card">
      <span className="card-icon">{catIcon(badge.category)}</span>
      <div className="card-cat">{catLabel(badge.category)}</div>
      <h3>{badge.title || `Бейдж #${badge.id}`}</h3>
      <div className="card-meta">
        <span>#{badge.id} · {date}</span>
        <span className="mono">Эмитент: {badge.issuer.slice(0,6)}…{badge.issuer.slice(-4)}</span>
      </div>
      <div className="card-actions">
        <a className="share-link" href={verifyUrl} target="_blank" rel="noreferrer">🔗 Открыть</a>
        <button className={`copy-btn${copied ? " copied" : ""}`} onClick={copyLink}>
          {copied ? "✓ Скопировано" : "📋 Копировать"}
        </button>
        {isOwner && (
          <button className="btn-danger" onClick={revoke} disabled={revoking}>
            {revoking ? "…" : "🗑 Отозвать"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Выпуск бейджа ──────────────────────────────────────────────────────────
function IssueBadge({ account, toast }) {
  const [form, setForm] = useState({ student: "", title: "", category: "course" });
  const [busy, setBusy] = useState(false);
  const upd = k => e => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!account) return toast("Сначала подключите кошелёк.", "error");
    if (!form.student || !form.title) return toast("Заполните адрес и название.", "error");
    setBusy(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.issueBadge(form.student, form.title, form.category);
      await tx.wait();
      toast("✅ Бейдж успешно выпущен!", "success");
      setForm({ ...form, student: "", title: "" });
    } catch (e) {
      toast("Ошибка: " + (e.reason || e.shortMessage || e.message), "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="form">
      <p className="hint">
        Выпускать бейджи может только авторизованная организация. Данные достижения записываются прямо в блокчейн — без внешних хранилищ.
      </p>
      <label>
        Адрес студента (кошелёк)
        <input value={form.student} onChange={upd("student")} placeholder="0x…" />
      </label>
      <label>
        Название достижения
        <input value={form.title} onChange={upd("title")} placeholder="Призёр олимпиады по международным финансам" />
      </label>
      <label>
        Категория
        <select value={form.category} onChange={upd("category")}>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </label>
      <button onClick={submit} disabled={busy} style={{alignSelf:"flex-start"}}>
        {busy ? "⏳ Выпуск…" : "✨ Выпустить бейдж"}
      </button>
    </div>
  );
}

// ── Проверка бейджа ────────────────────────────────────────────────────────
function VerifyBadge({ initialBadge, toast }) {
  const [tokenId, setTokenId] = useState(initialBadge ?? "");
  const [result,  setResult]  = useState(null);
  const [busy,    setBusy]    = useState(false);
  const qrRef = useRef(null);

  const verify = useCallback(async (id) => {
    const checkId = id ?? tokenId;
    if (checkId === "" || checkId === null) return;
    setBusy(true);
    setResult(null);
    try {
      const contract = await getContract(false);
      const [valid, student, issuer, issuedAt, title, category] = await contract.verifyBadge(checkId);
      setResult({ valid, student, issuer, issuedAt: Number(issuedAt), title, category, id: checkId });
    } catch (e) {
      setResult({ error: e.message });
      toast("Ошибка проверки", "error");
    } finally { setBusy(false); }
  }, [tokenId, toast]);

  useEffect(() => {
    if (initialBadge !== null && initialBadge !== undefined) verify(initialBadge);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (result?.valid && qrRef.current) {
      const url = `${window.location.origin}/?badge=${result.id}`;
      QRCode.toCanvas(qrRef.current, url, { width: 160, margin: 1, color: { dark: "#000", light: "#fff" } }, () => {});
    }
  }, [result]);

  return (
    <div className="form">
      <p className="hint">
        Введите номер бейджа или откройте ссылку вида <code style={{color:"var(--accent3)"}}>/?badge=0</code>. Проверка работает без авторизации.
      </p>
      <label>
        Номер бейджа (tokenId)
        <input value={tokenId} onChange={e => setTokenId(e.target.value)} placeholder="0" />
      </label>
      <button onClick={() => verify()} disabled={busy || tokenId === ""} style={{alignSelf:"flex-start"}}>
        {busy ? "⏳ Проверка…" : "🔍 Проверить"}
      </button>

      {result?.error && <div className="warn">❌ {result.error}</div>}

      {result && !result.error && (
        <div className={result.valid ? "verify-ok" : "verify-fail"}>
          {result.valid ? (
            <>
              <strong style={{fontSize:"17px"}}>✅ Бейдж подлинный</strong>
              <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                <span style={{fontSize:"24px"}}>{catIcon(result.category)}</span>
                <span style={{fontWeight:600,fontSize:"16px"}}>{result.title || "(без названия)"}</span>
              </div>
              <div className="card-meta">
                <span>Категория: {catLabel(result.category)}</span>
                <span>Выдан: {new Date(result.issuedAt * 1000).toLocaleDateString("ru-RU")}</span>
                <span className="mono">Владелец: {result.student}</span>
                <span className="mono">Эмитент: {result.issuer}</span>
              </div>
              <div className="qr-block">
                <p className="hint" style={{marginBottom:6}}>QR-код для проверки:</p>
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
