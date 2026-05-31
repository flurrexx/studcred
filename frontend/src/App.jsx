import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { connectWallet, getContract, hasMetaMask, CONTRACT_ADDRESS } from "./contract";

const CATEGORIES = {
  course:       { label: "Курс",               icon: "🎓", cls: "cat-course" },
  event:        { label: "Мероприятие",         icon: "🏆", cls: "cat-event" },
  internship:   { label: "Практика",            icon: "💼", cls: "cat-internship" },
  volunteering: { label: "Волонтёрство",        icon: "🤝", cls: "cat-volunteering" },
};
const cat = (v) => CATEGORIES[v] || { label: v || "—", icon: "📋", cls: "" };

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
  return toasts.length ? (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "success" ? "✅" : "❌"} {t.msg}
        </div>
      ))}
    </div>
  ) : null;
}

function SkeletonCard() {
  return (
    <div className="skeleton">
      <div className="skeleton-line" style={{width:"40%",height:"12px"}} />
      <div className="skeleton-line" style={{width:"80%",height:"18px",marginTop:"14px"}} />
      <div className="skeleton-line" style={{width:"60%",height:"12px"}} />
      <div className="skeleton-line" style={{width:"50%",height:"12px"}} />
    </div>
  );
}

export default function App() {
  const [account, setAccount]   = useState(null);
  const [tab, setTab]           = useState("portfolio");
  const [theme, setTheme]       = useState("dark");
  const [modal, setModal]       = useState(null);
  const { toasts, add: toast }  = useToast();

  const initialBadge   = (() => { const b = new URLSearchParams(window.location.search).get("badge"); return b ?? null; })();
  const initialAddress = (() => { const a = new URLSearchParams(window.location.search).get("address"); return a ?? null; })();

  useEffect(() => { if (initialBadge !== null) setTab("verify"); }, [initialBadge]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const connect = async () => {
    try { const a = await connectWallet(); setAccount(a); toast("Кошелёк подключён!"); }
    catch (e) { toast(e.message, "error"); }
  };

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const tabs = [
    { id: "portfolio", label: "🗂 Портфолио" },
    { id: "issue",     label: "✨ Выпустить" },
    { id: "verify",    label: "🔍 Проверка" },
  ];

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="app">
        <header className="header">
          <div>
            <div className="logo">
              <span className="logo-stud">Stud</span>
              <span className="logo-cred">Cred</span>
            </div>
            <div className="subtitle">Проверяемое цифровое портфолио</div>
          </div>
          <div className="header-right">
            <button className="theme-toggle" onClick={toggleTheme} style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {account ? (
              <div className="wallet-btn">
                <span className="wallet-dot" />
                {account.slice(0,6)}…{account.slice(-4)}
              </div>
            ) : (
              <button onClick={connect}>⚡ Подключить</button>
            )}
          </div>
        </header>

        {!account && !initialAddress && tab === "portfolio" && (
          <div className="hero">
            <h1 className="hero-title">
              Ваши достижения —<br />
              <span className="grad">проверяемые и навсегда</span>
            </h1>
            <p className="hero-sub">
              NFT-бейджи в блокчейне FACHAIN. Поделитесь ссылкой — работодатель проверит подлинность за секунду.
            </p>
            <div className="hero-actions">
              {hasMetaMask()
                ? <button onClick={connect}>⚡ Подключить кошелёк</button>
                : <button className="btn-secondary" onClick={() => window.open("https://metamask.io","_blank")}>📦 Установить MetaMask</button>
              }
              <button className="btn-secondary" onClick={() => setTab("verify")}>🔍 Проверить бейдж</button>
            </div>
          </div>
        )}

        {!hasMetaMask() && tab !== "verify" && (
          <div className="warn">⚠️ MetaMask не обнаружен. Установите расширение для полной функциональности.</div>
        )}

        <nav className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <main>
          {tab === "portfolio" && <Portfolio account={account} toast={toast} onOpen={setModal} initialAddress={initialAddress} />}
          {tab === "issue"     && <IssueBadge account={account} toast={toast} />}
          {tab === "verify"    && <VerifyBadge initialBadge={initialBadge} toast={toast} />}
        </main>

        <footer className="footer">
          <span>⛓</span>
          <code>{CONTRACT_ADDRESS}</code>
          <span style={{color:"var(--border-bright)"}}>·</span>
          <span>FACHAIN testnet</span>
        </footer>
      </div>

      {modal && <BadgeModal badge={modal} onClose={() => setModal(null)} toast={toast} />}
      <ToastContainer toasts={toasts} />
    </>
  );
}

// ── Portfolio ─────────────────────────────────────────────────────────────
function Portfolio({ account, toast, onOpen, initialAddress }) {
  const [badges, setBadges]   = useState([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState("newest");
  const [loading, setLoading] = useState(false);

  const viewAddr = initialAddress || account;

  const load = useCallback(async () => {
    if (!viewAddr) return;
    setLoading(true);
    try {
      const contract = await getContract(false);
      const total = Number(await contract.totalIssued());
      const owned = [];
      for (let id = 0; id < total; id++) {
        const [valid, student, issuer, issuedAt, title, category] = await contract.verifyBadge(id);
        if (valid && student.toLowerCase() === viewAddr.toLowerCase())
          owned.push({ id, issuer, issuedAt: Number(issuedAt), title, category });
      }
      setBadges(owned);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [viewAddr]);

  useEffect(() => { load(); }, [load]);

  if (!viewAddr) return (
    <div className="empty-state">
      <span className="empty-state-icon">🔐</span>
      <h3>Подключите кошелёк</h3>
      <p>Или откройте публичный профиль по ссылке <code style={{color:"var(--accent3)"}}>/?address=0x...</code></p>
    </div>
  );

  let shown = [...badges];
  if (filter !== "all")  shown = shown.filter(b => b.category === filter);
  if (search.trim())     shown = shown.filter(b => b.title.toLowerCase().includes(search.toLowerCase()));
  if (sort === "newest") shown.sort((a,b) => b.issuedAt - a.issuedAt);
  if (sort === "oldest") shown.sort((a,b) => a.issuedAt - b.issuedAt);
  if (sort === "az")     shown.sort((a,b) => a.title.localeCompare(b.title));

  const isPublic = initialAddress && initialAddress !== account;

  return (
    <div>
      {isPublic && (
        <div className="profile-banner">
          <div className="profile-avatar">👤</div>
          <div>
            <div className="profile-label">Публичный профиль</div>
            <div className="profile-addr">{initialAddress}</div>
          </div>
        </div>
      )}

      {badges.length > 0 && (
        <div className="portfolio-stats">
          <div className="stat-chip"><strong>{badges.length}</strong>Всего</div>
          {Object.entries(CATEGORIES).map(([k,v]) => {
            const n = badges.filter(b => b.category === k).length;
            return n > 0 ? <div key={k} className="stat-chip"><strong>{n}</strong>{v.icon} {v.label}</div> : null;
          })}
        </div>
      )}

      <div className="portfolio-header">
        <div className="search-row">
          <input
            className="search-input"
            placeholder="🔎 Поиск по названию…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Новые первыми</option>
            <option value="oldest">Старые первыми</option>
            <option value="az">По алфавиту</option>
          </select>
        </div>
        <div className="filters">
          <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Все</button>
          {Object.entries(CATEGORIES).map(([k,v]) => (
            <button key={k} className={filter===k?"active":""} onClick={()=>setFilter(k)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">{badges.length===0?"🏅":"🔍"}</span>
          <h3>{badges.length===0 ? "Пока нет бейджей" : "Ничего не найдено"}</h3>
          <p>{badges.length===0 ? "Бейджи появятся здесь после выдачи организацией" : "Попробуйте изменить фильтр или поисковый запрос"}</p>
        </div>
      ) : (
        <div className="grid">
          {shown.map(b => <BadgeCard key={b.id} badge={b} toast={toast} onOpen={onOpen} onRevoke={load} account={account} />)}
        </div>
      )}
    </div>
  );
}

// ── Badge Card ────────────────────────────────────────────────────────────
function BadgeCard({ badge, toast, onOpen, onRevoke, account }) {
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied]     = useState(false);
  const info = cat(badge.category);
  const url  = `${window.location.origin}/?badge=${badge.id}`;
  const date = new Date(badge.issuedAt * 1000).toLocaleDateString("ru-RU");
  const isIssuer = account?.toLowerCase() === badge.issuer?.toLowerCase();

  const copyLink = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Ссылка скопирована!");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast("Не удалось скопировать", "error"); }
  };

  const revoke = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Отозвать бейдж #${badge.id}? Действие необратимо.`)) return;
    setRevoking(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.revokeBadge(badge.id);
      await tx.wait();
      toast(`Бейдж #${badge.id} отозван`);
      onRevoke();
    } catch (e) { toast("Ошибка: " + (e.reason || e.shortMessage || e.message), "error"); }
    finally { setRevoking(false); }
  };

  return (
    <div className={`card ${info.cls}`} onClick={() => onOpen(badge)}>
      <span className="card-icon">{info.icon}</span>
      <div className={`card-cat ${info.cls}`}>{info.label}</div>
      <h3>{badge.title || `Бейдж #${badge.id}`}</h3>
      <div className="card-meta">
        <span>#{badge.id} · {date}</span>
        <span className="mono">Эмитент: {badge.issuer.slice(0,6)}…{badge.issuer.slice(-4)}</span>
      </div>
      <div className="card-actions" onClick={e => e.stopPropagation()}>
        <a className="share-link" href={url} target="_blank" rel="noreferrer">🔗 Открыть</a>
        <button className={`btn-icon${copied?" copied":""}`} onClick={copyLink}>
          {copied ? "✓" : "📋"}
        </button>
        {isIssuer && (
          <button className="btn-danger" onClick={revoke} disabled={revoking}>
            {revoking ? "…" : "🗑"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Badge Modal ───────────────────────────────────────────────────────────
function BadgeModal({ badge, onClose, toast }) {
  const qrRef = useRef(null);
  const info  = cat(badge.category);
  const url   = `${window.location.origin}/?badge=${badge.id}`;
  const date  = new Date(badge.issuedAt * 1000).toLocaleDateString("ru-RU");

  useEffect(() => {
    if (qrRef.current) QRCode.toCanvas(qrRef.current, url, { width: 160, margin: 1 }, () => {});
  }, [url]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована!"); }
    catch { toast("Ошибка копирования", "error"); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <span className="modal-icon">{info.icon}</span>
        <div className={`card-cat ${info.cls}`} style={{marginBottom:12}}>{info.label}</div>
        <h2>{badge.title || `Бейдж #${badge.id}`}</h2>
        <div className="modal-meta">
          {[
            ["Бейдж №", `#${badge.id}`],
            ["Дата выдачи", date],
            ["Владелец", badge.student],
            ["Эмитент", badge.issuer],
          ].map(([l,v]) => (
            <div key={l} className="modal-row">
              <span className="modal-label">{l}</span>
              <span className="modal-value">{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:"9px",flexWrap:"wrap"}}>
          <button onClick={copy} className="btn-secondary" style={{fontSize:13}}>📋 Копировать ссылку</button>
          <a href={url} target="_blank" rel="noreferrer">
            <button className="btn-secondary" style={{fontSize:13}}>🔗 Открыть</button>
          </a>
        </div>
        <div className="modal-qr">
          <span className="hint" style={{marginBottom:0}}>QR-код для проверки:</span>
          <canvas ref={qrRef} />
        </div>
      </div>
    </div>
  );
}

// ── Issue Badge ───────────────────────────────────────────────────────────
function IssueBadge({ account, toast }) {
  const [form, setForm]   = useState({ student: "", title: "", category: "course" });
  const [busy, setBusy]   = useState(false);
  const [addrOk, setAddrOk] = useState(null);
  const upd = k => e => {
    const v = e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    if (k === "student") {
      if (!v) setAddrOk(null);
      else setAddrOk(/^0x[0-9a-fA-F]{40}$/.test(v));
    }
  };

  const submit = async () => {
    if (!account) return toast("Сначала подключите кошелёк.", "error");
    if (!form.student || !form.title) return toast("Заполните адрес и название.", "error");
    if (!addrOk) return toast("Неверный адрес кошелька.", "error");
    setBusy(true);
    try {
      const contract = await getContract(true);
      const tx = await contract.issueBadge(form.student, form.title, form.category);
      await tx.wait();
      toast("✅ Бейдж успешно выпущен!");
      setForm({ ...form, student: "", title: "" });
      setAddrOk(null);
    } catch (e) { toast("Ошибка: " + (e.reason || e.shortMessage || e.message), "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="form">
      <p className="hint">Выпускать бейджи могут только авторизованные организации. Данные записываются прямо в блокчейн — без внешних хранилищ.</p>
      <label>
        Адрес студента (кошелёк)
        <input
          value={form.student}
          onChange={upd("student")}
          placeholder="0x…"
          className={addrOk === true ? "input-valid" : addrOk === false ? "input-invalid" : ""}
        />
        {addrOk === true  && <span className="addr-hint valid">✓ Адрес валиден</span>}
        {addrOk === false && <span className="addr-hint invalid">✗ Неверный формат адреса</span>}
      </label>
      <label>
        Название достижения
        <input value={form.title} onChange={upd("title")} placeholder="Призёр олимпиады по международным финансам" />
      </label>
      <label>
        Категория
        <select value={form.category} onChange={upd("category")}>
          {Object.entries(CATEGORIES).map(([k,v]) => (
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

// ── Verify Badge ──────────────────────────────────────────────────────────
function VerifyBadge({ initialBadge, toast }) {
  const [tokenId, setTokenId] = useState(initialBadge ?? "");
  const [result,  setResult]  = useState(null);
  const [busy,    setBusy]    = useState(false);
  const qrRef = useRef(null);

  const verify = useCallback(async (id) => {
    const checkId = id ?? tokenId;
    if (checkId === "" || checkId === null) return;
    setBusy(true); setResult(null);
    try {
      const contract = await getContract(false);
      const [valid, student, issuer, issuedAt, title, category] = await contract.verifyBadge(checkId);
      setResult({ valid, student, issuer, issuedAt: Number(issuedAt), title, category, id: checkId });
      if (valid) toast("Бейдж подлинный ✅");
      else toast("Бейдж не найден", "error");
    } catch (e) { setResult({ error: e.message }); toast("Ошибка проверки", "error"); }
    finally { setBusy(false); }
  }, [tokenId, toast]);

  useEffect(() => { if (initialBadge !== null && initialBadge !== undefined) verify(initialBadge); }, []); // eslint-disable-line

  useEffect(() => {
    if (result?.valid && qrRef.current) {
      const url = `${window.location.origin}/?badge=${result.id}`;
      QRCode.toCanvas(qrRef.current, url, { width: 160, margin: 1, color: { dark: "#000", light: "#fff" } }, () => {});
    }
  }, [result]);

  return (
    <div className="form">
      <p className="hint">Введите номер бейджа или откройте ссылку <code style={{color:"var(--accent3)"}}>/?badge=0</code>. Без авторизации, без лишних данных.</p>
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
              <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                <span style={{fontSize:"26px"}}>{cat(result.category).icon}</span>
                <span style={{fontWeight:600,fontSize:"16px"}}>{result.title}</span>
              </div>
              <div className="card-meta">
                <span>Категория: {cat(result.category).label}</span>
                <span>Выдан: {new Date(result.issuedAt*1000).toLocaleDateString("ru-RU")}</span>
                <span className="mono">Владелец: {result.student}</span>
                <span className="mono">Эмитент: {result.issuer}</span>
              </div>
              <div className="qr-block">
                <span className="hint" style={{marginBottom:0}}>QR-код:</span>
                <canvas ref={qrRef} />
              </div>
            </>
          ) : <strong>❌ Бейдж не найден или был отозван</strong>}
        </div>
      )}
    </div>
  );
}
