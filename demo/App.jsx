import { useState, useEffect, useRef } from "react";

// ============================================================================
//  StudCred — интерактивное демо
//  Симулирует логику смарт-контракта в памяти браузера (без реального
//  блокчейна), чтобы показать сквозной сценарий: выпуск → портфолио → проверка.
//  Состояние сохраняется между сессиями через window.storage.
// ============================================================================

const ROLES = {
  student: { label: "Студент", addr: "0xA1c3…student", emoji: "🎓" },
  university: { label: "Финуниверситет", addr: "0xF1nU…gov", emoji: "🏛️" },
  employer: { label: "ПАО «Сбербанк»", addr: "0xSb3r…bank", emoji: "🏦" },
};

const CATEGORIES = {
  course: { label: "Курс", color: "#6366f1" },
  event: { label: "Мероприятие", color: "#ec4899" },
  internship: { label: "Практика", color: "#14b8a6" },
  volunteering: { label: "Волонтёрство", color: "#f59e0b" },
};

const SEED_BADGES = [
  {
    id: 0,
    title: "Призёр Международной студенческой олимпиады по финансам",
    description: "2-е место в индивидуальном зачёте, секция «Международные финансы».",
    category: "event",
    issuer: "university",
    owner: "student",
    issuedAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    revoked: false,
  },
  {
    id: 1,
    title: "Курс «Международные валютно-кредитные отношения»",
    description: "Успешно завершён курс ФМЭО, итоговая оценка 5/5.",
    category: "course",
    issuer: "university",
    owner: "student",
    issuedAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    revoked: false,
  },
  {
    id: 2,
    title: "Стажировка в отделе международных расчётов",
    description: "8 недель практики в управлении корреспондентских отношений.",
    category: "internship",
    issuer: "employer",
    owner: "student",
    issuedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    revoked: false,
  },
];

export default function App() {
  const [role, setRole] = useState("student");
  const [tab, setTab] = useState("portfolio");
  const [badges, setBadges] = useState(null); // null = ещё загружаем
  const [toast, setToast] = useState(null);

  // Загрузка состояния из хранилища при старте.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get("studcred-badges");
        if (!cancelled) setBadges(res ? JSON.parse(res.value) : SEED_BADGES);
      } catch {
        if (!cancelled) setBadges(SEED_BADGES);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Сохранение состояния при каждом изменении.
  useEffect(() => {
    if (badges === null) return;
    window.storage
      .set("studcred-badges", JSON.stringify(badges))
      .catch(() => {});
  }, [badges]);

  const showToast = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  const issueBadge = (data) => {
    const nextId = badges.length ? Math.max(...badges.map((b) => b.id)) + 1 : 0;
    setBadges([
      ...badges,
      { ...data, id: nextId, owner: "student", issuedAt: Date.now(), revoked: false },
    ]);
    showToast(`Бейдж #${nextId} выпущен и записан в блокчейн ✓`);
  };

  const revokeBadge = (id) => {
    setBadges(badges.map((b) => (b.id === id ? { ...b, revoked: true } : b)));
    showToast(`Бейдж #${id} отозван`, "warn");
  };

  const resetDemo = () => {
    setBadges(SEED_BADGES);
    showToast("Демо сброшено к исходному состоянию", "warn");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="sc-root">
        <Header role={role} setRole={setRole} />

        <div className="sc-tabs">
          {[
            ["portfolio", "Портфолио"],
            ["issue", "Выпустить бейдж"],
            ["verify", "Проверка"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sc-main">
          {badges === null ? (
            <p className="sc-hint">Загрузка…</p>
          ) : tab === "portfolio" ? (
            <Portfolio badges={badges} role={role} onRevoke={revokeBadge} />
          ) : tab === "issue" ? (
            <IssueForm role={role} onIssue={issueBadge} setRole={setRole} />
          ) : (
            <Verify badges={badges} />
          )}
        </div>

        <footer className="sc-footer">
          <span>Демо-режим · логика контракта симулируется в браузере</span>
          <button className="sc-reset" onClick={resetDemo}>Сбросить демо</button>
        </footer>

        {toast && <div className={`sc-toast ${toast.kind}`}>{toast.msg}</div>}
      </div>
    </>
  );
}

function Header({ role, setRole }) {
  return (
    <header className="sc-header">
      <div className="sc-brand">
        <div className="sc-logo">SC</div>
        <div>
          <h1>StudCred</h1>
          <p>Финуниверситет · проверяемое цифровое портфолио студента</p>
        </div>
      </div>
      <div className="sc-role">
        <span className="sc-role-label">Вы вошли как</span>
        <div className="sc-role-switch">
          {Object.entries(ROLES).map(([k, r]) => (
            <button
              key={k}
              className={role === k ? "active" : ""}
              onClick={() => setRole(k)}
              title={r.addr}
            >
              <span>{r.emoji}</span> {r.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Portfolio({ badges, role, onRevoke }) {
  const visible = badges.filter((b) => !b.revoked && b.owner === "student");

  if (role !== "student") {
    // Организация видит портфолио студента в режиме просмотра.
  }

  if (visible.length === 0) {
    return (
      <div className="sc-empty">
        <div className="sc-empty-icon">🏅</div>
        <p>Пока нет бейджей. Перейдите во вкладку «Выпустить бейдж».</p>
      </div>
    );
  }

  return (
    <>
      <div className="sc-portfolio-head">
        <div>
          <h2>{ROLES.student.label}</h2>
          <p className="sc-mono">{ROLES.student.addr}</p>
        </div>
        <div className="sc-count">{visible.length} бейджей</div>
      </div>
      <div className="sc-grid">
        {visible.map((b, i) => (
          <BadgeCard key={b.id} badge={b} index={i} role={role} onRevoke={onRevoke} />
        ))}
      </div>
    </>
  );
}

function BadgeCard({ badge, index, role, onRevoke }) {
  const cat = CATEGORIES[badge.category];
  const issuer = ROLES[badge.issuer];
  const date = new Date(badge.issuedAt).toLocaleDateString("ru-RU");
  const canRevoke = role === badge.issuer; // отозвать может выпустившая сторона

  return (
    <div className="sc-card" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="sc-card-glow" style={{ background: cat.color }} />
      <div className="sc-card-top">
        <span className="sc-cat" style={{ background: cat.color + "22", color: cat.color }}>
          {cat.label}
        </span>
        <span className="sc-id">#{badge.id}</span>
      </div>
      <h3>{badge.title}</h3>
      <p className="sc-desc">{badge.description}</p>
      <div className="sc-card-foot">
        <span title={issuer.addr}>{issuer.emoji} {issuer.label}</span>
        <span className="sc-date">{date}</span>
      </div>
      {canRevoke && (
        <button className="sc-revoke" onClick={() => onRevoke(badge.id)}>
          Отозвать
        </button>
      )}
    </div>
  );
}

function IssueForm({ role, onIssue, setRole }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "course",
  });
  const [minting, setMinting] = useState(false);

  const isIssuer = role !== "student";
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    if (!form.title.trim()) return;
    setMinting(true);
    // Имитируем задержку транзакции в блокчейне.
    setTimeout(() => {
      onIssue({ ...form, issuer: role });
      setForm({ title: "", description: "", category: "course" });
      setMinting(false);
    }, 1100);
  };

  if (!isIssuer) {
    return (
      <div className="sc-gate">
        <div className="sc-empty-icon">🔒</div>
        <h3>Выпускать бейджи могут только организации</h3>
        <p>В смарт-контракте это проверяется через реестр эмитентов (issuers).</p>
        <div className="sc-gate-actions">
          <button onClick={() => setRole("university")}>
            Войти как {ROLES.university.label}
          </button>
          <button onClick={() => setRole("employer")}>
            Войти как {ROLES.employer.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-form">
      <p className="sc-hint">
        Выпуск от имени: <strong>{ROLES[role].emoji} {ROLES[role].label}</strong>.
        Бейдж получит студент {ROLES.student.addr}.
      </p>
      <label>
        Название достижения
        <input
          value={form.title}
          onChange={upd("title")}
          placeholder="Призёр олимпиады по международным финансам"
        />
      </label>
      <label>
        Описание
        <textarea value={form.description} onChange={upd("description")} rows={3} />
      </label>
      <label>
        Категория
        <div className="sc-cat-picker">
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <button
              key={k}
              type="button"
              className={form.category === k ? "active" : ""}
              style={form.category === k ? { background: c.color, borderColor: c.color } : {}}
              onClick={() => setForm({ ...form, category: k })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </label>
      <button className="sc-submit" onClick={submit} disabled={minting || !form.title.trim()}>
        {minting ? "Запись в блокчейн…" : "Выпустить бейдж"}
      </button>
    </div>
  );
}

function Verify({ badges }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = () => {
    setChecking(true);
    setResult(null);
    setTimeout(() => {
      const id = parseInt(query, 10);
      const badge = badges.find((b) => b.id === id);
      if (!badge || badge.revoked) {
        setResult({ valid: false });
      } else {
        setResult({ valid: true, badge });
      }
      setChecking(false);
    }, 700);
  };

  return (
    <div className="sc-verify">
      <p className="sc-hint">
        Публичная проверка работает без авторизации. Введите номер бейджа —
        как если бы вы отсканировали QR-код в резюме студента.
      </p>
      <div className="sc-verify-input">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Номер бейджа, например 0"
          onKeyDown={(e) => e.key === "Enter" && query !== "" && check()}
        />
        <button onClick={check} disabled={checking || query === ""}>
          {checking ? "…" : "Проверить"}
        </button>
      </div>

      {result?.valid === false && (
        <div className="sc-result fail">
          <div className="sc-result-icon">✕</div>
          <div>
            <strong>Бейдж не найден или отозван</strong>
            <p>В блокчейне нет действующей записи с таким номером.</p>
          </div>
        </div>
      )}

      {result?.valid === true && (
        <div className="sc-result ok">
          <div className="sc-result-icon">✓</div>
          <div className="sc-result-body">
            <strong>Бейдж подлинный</strong>
            <h3>{result.badge.title}</h3>
            <div className="sc-result-meta">
              <span>{CATEGORIES[result.badge.category].label}</span>
              <span>Выдал: {ROLES[result.badge.issuer].label}</span>
              <span>{new Date(result.badge.issuedAt).toLocaleDateString("ru-RU")}</span>
            </div>
            <p className="sc-mono sc-tiny">Владелец: {ROLES.student.addr}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  .sc-root {
    --bg: #0b0f17;
    --panel: #131a26;
    --panel-2: #1b2433;
    --line: #283041;
    --ink: #eef2f8;
    --muted: #8593a8;
    --green: #34d399;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background:
      radial-gradient(1200px 500px at 80% -10%, rgba(99,102,241,0.15), transparent),
      radial-gradient(900px 400px at -10% 20%, rgba(20,184,166,0.10), transparent),
      var(--bg);
    color: var(--ink);
    min-height: 100vh;
    padding: 28px;
    border-radius: 16px;
  }
  .sc-root * { box-sizing: border-box; }

  .sc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    flex-wrap: wrap; gap: 18px; padding-bottom: 22px;
    border-bottom: 1px solid var(--line);
  }
  .sc-brand { display: flex; gap: 14px; align-items: center; }
  .sc-logo {
    width: 46px; height: 46px; border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #14b8a6);
    display: grid; place-items: center; font-weight: 800; font-size: 18px;
    letter-spacing: -0.5px; box-shadow: 0 6px 20px rgba(99,102,241,0.4);
  }
  .sc-brand h1 { margin: 0; font-size: 24px; letter-spacing: -0.5px; }
  .sc-brand p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

  .sc-role { text-align: right; }
  .sc-role-label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .sc-role-switch { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .sc-role-switch button {
    background: var(--panel); border: 1px solid var(--line); color: var(--muted);
    padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer;
    transition: all 0.15s;
  }
  .sc-role-switch button.active { background: var(--panel-2); color: var(--ink); border-color: #6366f1; }

  .sc-tabs { display: flex; gap: 6px; margin: 22px 0; }
  .sc-tabs button {
    background: transparent; border: none; color: var(--muted);
    padding: 10px 18px; border-radius: 9px; font-size: 14px; cursor: pointer;
    font-weight: 600; transition: all 0.15s;
  }
  .sc-tabs button:hover { color: var(--ink); }
  .sc-tabs button.active { background: var(--panel); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }

  .sc-main { min-height: 340px; }
  .sc-hint { color: var(--muted); font-size: 14px; margin-bottom: 18px; }
  .sc-hint strong { color: var(--ink); }
  .sc-mono { font-family: ui-monospace, monospace; }
  .sc-tiny { font-size: 11px; }

  .sc-portfolio-head {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;
  }
  .sc-portfolio-head h2 { margin: 0; font-size: 18px; }
  .sc-portfolio-head p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
  .sc-count {
    background: var(--panel); border: 1px solid var(--line); padding: 6px 14px;
    border-radius: 20px; font-size: 13px; color: var(--green);
  }

  .sc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 16px; }

  .sc-card {
    position: relative; background: var(--panel); border: 1px solid var(--line);
    border-radius: 14px; padding: 18px; overflow: hidden;
    animation: scFade 0.5s ease both;
  }
  @keyframes scFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .sc-card-glow {
    position: absolute; top: -40px; right: -40px; width: 90px; height: 90px;
    border-radius: 50%; filter: blur(34px); opacity: 0.45;
  }
  .sc-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; position: relative; }
  .sc-cat { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
  .sc-id { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); }
  .sc-card h3 { margin: 0 0 8px; font-size: 15px; line-height: 1.35; }
  .sc-desc { margin: 0 0 14px; color: var(--muted); font-size: 13px; line-height: 1.5; }
  .sc-card-foot { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--muted); }
  .sc-date { font-variant-numeric: tabular-nums; }
  .sc-revoke {
    margin-top: 14px; width: 100%; background: transparent; border: 1px solid var(--line);
    color: #f87171; padding: 7px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s;
  }
  .sc-revoke:hover { background: rgba(248,113,113,0.1); border-color: #f87171; }

  .sc-empty, .sc-gate {
    text-align: center; padding: 50px 20px; color: var(--muted);
  }
  .sc-empty-icon { font-size: 48px; margin-bottom: 14px; }
  .sc-gate h3 { color: var(--ink); margin: 0 0 8px; }
  .sc-gate-actions { display: flex; gap: 10px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
  .sc-gate-actions button, .sc-submit, .sc-verify-input button {
    background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; color: #fff;
    padding: 11px 20px; border-radius: 9px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.15s;
  }
  .sc-gate-actions button:hover, .sc-submit:hover { filter: brightness(1.12); }

  .sc-form { max-width: 540px; display: flex; flex-direction: column; gap: 16px; }
  .sc-form label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .sc-form input, .sc-form textarea {
    background: var(--panel); border: 1px solid var(--line); border-radius: 9px;
    padding: 11px 13px; color: var(--ink); font-size: 14px; font-family: inherit; text-transform: none; letter-spacing: 0;
  }
  .sc-form input:focus, .sc-form textarea:focus { outline: none; border-color: #6366f1; }
  .sc-cat-picker { display: flex; gap: 8px; flex-wrap: wrap; }
  .sc-cat-picker button {
    background: var(--panel); border: 1px solid var(--line); color: var(--muted);
    padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s;
  }
  .sc-cat-picker button.active { color: #fff; font-weight: 600; }
  .sc-submit { margin-top: 4px; }
  .sc-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sc-verify { max-width: 560px; }
  .sc-verify-input { display: flex; gap: 10px; margin-bottom: 22px; }
  .sc-verify-input input {
    flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: 9px;
    padding: 12px 14px; color: var(--ink); font-size: 14px;
  }
  .sc-verify-input input:focus { outline: none; border-color: #6366f1; }
  .sc-verify-input button:disabled { opacity: 0.5; cursor: not-allowed; }

  .sc-result { display: flex; gap: 16px; padding: 20px; border-radius: 14px; animation: scFade 0.4s ease both; }
  .sc-result.ok { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.4); }
  .sc-result.fail { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.35); }
  .sc-result-icon {
    width: 42px; height: 42px; min-width: 42px; border-radius: 50%; display: grid; place-items: center;
    font-size: 22px; font-weight: 700;
  }
  .sc-result.ok .sc-result-icon { background: var(--green); color: #04221a; }
  .sc-result.fail .sc-result-icon { background: #f87171; color: #2a0808; }
  .sc-result strong { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sc-result.ok strong { color: var(--green); }
  .sc-result.fail strong { color: #f87171; }
  .sc-result h3 { margin: 8px 0 12px; font-size: 17px; }
  .sc-result p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .sc-result-meta { display: flex; flex-wrap: wrap; gap: 8px; }
  .sc-result-meta span { background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 6px; font-size: 12px; color: var(--ink); }

  .sc-footer {
    margin-top: 34px; padding-top: 18px; border-top: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center;
    color: var(--muted); font-size: 12px; flex-wrap: wrap; gap: 10px;
  }
  .sc-reset { background: none; border: 1px solid var(--line); color: var(--muted); padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; }
  .sc-reset:hover { color: var(--ink); border-color: var(--muted); }

  .sc-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600;
    animation: scToast 0.3s ease both; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  .sc-toast.ok { background: var(--green); color: #04221a; }
  .sc-toast.warn { background: #f59e0b; color: #2a1a00; }
  @keyframes scToast { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;
