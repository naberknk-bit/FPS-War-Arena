import { useState, useEffect } from "react";
import langs from "../languages.json";

type LangKey = keyof typeof langs;
type T = typeof langs["tr"];

interface PortalProps {
  onPlay: () => void;
  onGame2: () => void;
  onGame3: () => void;
  onGame4: () => void;
  lang: LangKey;
  onLangChange: (l: LangKey) => void;
}

const LANG_KEYS: LangKey[] = ["tr", "en", "es", "ru"];

const GAME_COVER_GRADIENT = "linear-gradient(135deg, #0d0d12 0%, #1a0a14 40%, #2a0a0a 100%)";

export default function Portal({ onPlay, onGame2, onGame3, onGame4, lang, onLangChange }: PortalProps) {
  const t: T = langs[lang] as T;
  const [glowPulse, setGlowPulse] = useState(false);
  const aboutId = "portal-about";

  useEffect(() => {
    const id = setInterval(() => setGlowPulse(v => !v), 2200);
    return () => clearInterval(id);
  }, []);

  const miniGames = [
    {
      emoji: "⚔️",
      title: t.game2Title,
      desc: "WASD ile hareket et · FPS arena savaşı · Dalgalarla gelen düşmanlar",
      color: "#4488ff",
      accentBg: "linear-gradient(135deg, #0a0a1a 0%, #0a1028 100%)",
      borderColor: "#4488ff",
      btnColor: "#4488ff",
      badge: "🔵 FPS · ARENA",
      onClick: onGame2,
    },
    {
      emoji: "🧟",
      title: t.game3Title,
      desc: "Yeşil küp zombiler seni kovalıyor · Dalgalar gitgide zorlaşır",
      color: "#44ff88",
      accentBg: "linear-gradient(135deg, #030f03 0%, #0a1a0a 100%)",
      borderColor: "#44ff44",
      btnColor: "#44ff44",
      badge: "🟢 HAYATTA KAL",
      onClick: onGame3,
    },
    {
      emoji: "🎯",
      title: t.game4Title,
      desc: "Hareket eden hedefleri vur · Headshot = 2x puan · Rüzgar etkisi",
      color: "#ffaa44",
      accentBg: "linear-gradient(135deg, #0d0a02 0%, #1a1202 100%)",
      borderColor: "#ffaa44",
      btnColor: "#ffaa44",
      badge: "🟡 NİŞANCI",
      onClick: onGame4,
    },
  ];

  return (
    <div className="portal-root">
      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav className="portal-nav">
        <div className="portal-nav-logo">
          <span className="portal-nav-b">B</span>
          <span className="portal-nav-brand">OSNA GAMES</span>
        </div>
        <div className="portal-nav-links">
          <a className="portal-nav-link" href="#">{t.navGames}</a>
          <a className="portal-nav-link" href="#">{t.navLeaderboard}</a>
          <a className="portal-nav-link" href="#">{t.navShop}</a>
          <a className="portal-nav-link" href={`#${aboutId}`}>{t.navAbout}</a>
        </div>
        <div className="portal-lang-switcher">
          {LANG_KEYS.map((k) => (
            <button
              key={k}
              className={`portal-lang-btn${lang === k ? " active" : ""}`}
              onClick={() => onLangChange(k)}
              title={(langs[k] as T).label}
            >
              {k === "tr" ? "🇹🇷" : k === "en" ? "🇬🇧" : k === "es" ? "🇪🇸" : "⬜"}
            </button>
          ))}
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <main className="portal-main">
        {/* PRIMARY GAME CARD */}
        <div className="portal-main-card" onClick={onPlay}>
          <div className="portal-card-bg" style={{ background: GAME_COVER_GRADIENT }}>
            <div className="portal-card-crosshair portal-card-crosshair--tl" />
            <div className="portal-card-crosshair portal-card-crosshair--tr" />
            <div className="portal-card-crosshair portal-card-crosshair--bl" />
            <div className="portal-card-crosshair portal-card-crosshair--br" />

            <div className="portal-card-art">
              <div className={`portal-card-logo-ring${glowPulse ? " pulse" : ""}`}>
                <span className="portal-card-logo-b">B</span>
              </div>
              <div className="portal-card-title-wrap">
                <div className="portal-card-subtitle">BOSNA GAMES</div>
                <div className="portal-card-game-title">TACTICAL STRIKE</div>
                <div className="portal-card-game-mode">FPS · MULTIPLAYER · TACTICAL</div>
              </div>
            </div>

            <button className="portal-play-btn" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
              <span className="portal-play-arrow">▶</span>
              <span className="portal-play-text">{t.play}</span>
            </button>

            <div className="portal-card-badges">
              <span className="portal-badge portal-badge--live">🔴 LIVE</span>
              <span className="portal-badge portal-badge--free">FREE TO PLAY</span>
              <span className="portal-badge portal-badge--browser">BROWSER</span>
            </div>
          </div>
        </div>

        {/* MINI GAME CARDS — ACTIVE */}
        <div className="portal-soon-grid">
          {miniGames.map((g, i) => (
            <div
              key={i}
              className="portal-soon-card portal-soon-card--active"
              style={{ "--soon-color": g.color } as React.CSSProperties}
              onClick={g.onClick}
            >
              <div style={{ position: "absolute", inset: 0, background: g.accentBg, borderRadius: "inherit" }} />
              <div style={{ position: "absolute", inset: 0, border: `1.5px solid ${g.borderColor}33`, borderRadius: "inherit" }} />

              <div className="portal-soon-emoji" style={{ position: "relative", zIndex: 2 }}>{g.emoji}</div>
              <div className="portal-soon-title" style={{ position: "relative", zIndex: 2, color: "#fff" }}>{g.title}</div>
              <div className="portal-soon-desc" style={{ position: "relative", zIndex: 2 }}>{g.desc}</div>

              <div style={{ position: "relative", zIndex: 2, marginTop: "auto" }}>
                <div style={{ fontSize: "0.65rem", color: g.color, letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>{g.badge}</div>
                <button
                  className="portal-mini-play-btn"
                  style={{ background: g.btnColor, color: g.btnColor === "#ffaa44" ? "#000" : "#fff", borderColor: g.btnColor }}
                  onClick={(e) => { e.stopPropagation(); g.onClick(); }}
                >
                  HEMEN OYNA ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <section className="portal-about" id={aboutId}>
        <div className="portal-about-inner">
          <div className="portal-about-kicker">BOSNA GAMES</div>
          <h2 className="portal-about-title">BİZ KİMİZ?</h2>
          <p className="portal-about-subtitle">Bosna Games - Geleceğin Oyun Dünyasını İnşa Ediyoruz.</p>
          <p className="portal-about-text">
            Bosna Games, tutkulu bir geliştirici tarafından, oyunculara en iyi FPS ve hayatta kalma deneyimini sunmak amacıyla kuruldu.
            2026 yılında başlayan bu yolculukta, Replit ve en gelişmiş AI teknolojilerini kullanarak 'Tactical Strike' gibi projelerle
            sınırları zorluyoruz. Amacımız; tarayıcı tabanlı oyunlarda yüksek kaliteyi ve rekabetçi ruhu herkes için ulaşılabilir kılmak.
          </p>
          <div className="portal-about-grid">
            <div className="portal-about-card">
              <div className="portal-about-card-label">Vizyonumuz</div>
              <div className="portal-about-card-text">Küçük bir stüdyodan çıkan büyük fikirlerin, küresel oyun pazarında ses getirmesini sağlamak.</div>
            </div>
            <div className="portal-about-card">
              <div className="portal-about-card-label">Misyonumuz</div>
              <div className="portal-about-card-text">Oyuncuların geri bildirimleriyle şekillenen, dinamik ve eğlenceli bir oyun ekosistemi yaratmak.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="portal-footer">
        <span>© 2025 BOSNA GAMES — Tactical Strike</span>
        <span className="portal-footer-sep">·</span>
        <span>Made with ❤️ by Muhammed Ali Bosna</span>
      </footer>
    </div>
  );
}
