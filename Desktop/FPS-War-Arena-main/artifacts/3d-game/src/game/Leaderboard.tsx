import { useState, useEffect } from "react";

const API_BASE = "/api";

interface LBEntry {
  rank: number;
  username: string;
  rr: number;
  level: number;
  totalKills: number;
  isFounder: boolean;
  tier: string;
  tierColor: string;
}

function getTier(rr: number) {
  if (rr >= 1200) return { name: "Radyant", color: "#ff4655" };
  if (rr >= 1000) return { name: "Elmas", color: "#44ccff" };
  if (rr >= 800)  return { name: "Platin", color: "#44ffaa" };
  if (rr >= 600)  return { name: "Altın", color: "#ffcc44" };
  if (rr >= 400)  return { name: "Gümüş", color: "#aaaaaa" };
  if (rr >= 200)  return { name: "Bronz", color: "#cc8844" };
  return { name: "Demir", color: "#888888" };
}

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/leaderboard`)
      .then((r) => r.json())
      .then((data) => { setEntries(data.leaderboard ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="lb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-panel">
        <div className="lb-header">
          <span className="lb-title">🏆 GLOBAL SIRALAMASI</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="lb-loading">Yükleniyor...</div>
        ) : (
          <div className="lb-list">
            {entries.map((e) => {
              const t = getTier(e.rr);
              const isTop1 = e.rank === 1;
              return (
                <div key={e.username} className={`lb-row${isTop1 ? " lb-row-first" : ""}${e.isFounder ? " lb-row-founder" : ""}`}>
                  <span className="lb-rank">
                    {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                  </span>
                  <span className="lb-name">
                    {e.isFounder && <span className="lb-founder-badge">🛡️</span>}
                    {e.username}
                  </span>
                  <span className="lb-tier" style={{ color: t.color }}>{t.name}</span>
                  <span className="lb-rr" style={{ color: t.color }}>{e.rr} RR</span>
                  <span className="lb-level">LVL {e.level}</span>
                  <span className="lb-kills">☠ {e.totalKills}</span>
                </div>
              );
            })}
            {entries.length === 0 && <div className="lb-empty">Henüz sıralama yok.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
