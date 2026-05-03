import { useState, useCallback, useEffect } from "react";
import { Socket } from "socket.io-client";
import { MAP_LIST, MapId } from "./Map";

interface CreatorPanelProps {
  socket: Socket;
  isOpen: boolean;
  onClose: () => void;
  onStartBattleRoyale: () => void;
  onStartZombieInvasion: () => void;
  currentMap: MapId;
}

type CreatorTab = "world" | "players" | "events" | "maps" | "godmode";

const GRAVITY_PRESETS = [
  { label: "Normal",         value: 1.0,  icon: "⚖️" },
  { label: "Ay",             value: 0.17, icon: "🌙" },
  { label: "Mars",           value: 0.38, icon: "🔴" },
  { label: "Ters Yerçekimi", value: -0.5, icon: "🔃" },
  { label: "Sıfır G",        value: 0.01, icon: "🚀" },
];

export default function CreatorPanel({ socket, isOpen, onClose, onStartBattleRoyale, onStartZombieInvasion, currentMap }: CreatorPanelProps) {
  const [tab, setTab] = useState<CreatorTab>("world");
  const [gravityValue, setGravityValue] = useState(1.0);
  const [playerScale, setPlayerScale] = useState(1.0);
  const [feedback, setFeedback] = useState("");
  const [shieldVisible, setShieldVisible] = useState(false);

  const fb = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2500);
  }, []);

  const sendGravity = useCallback((val: number) => {
    setGravityValue(val);
    socket.emit("creator_gravity", { multiplier: val });
    fb(`Yerçekimi × ${val} olarak ayarlandı`);
  }, [socket, fb]);

  const sendSize = useCallback((scale: number) => {
    setPlayerScale(scale);
    socket.emit("creator_size_all", { scale });
    fb(`Tüm oyuncular ${scale === 1 ? "normal" : scale > 1 ? "DEV" : "MİNYATÜR"} boyuta alındı`);
  }, [socket, fb]);

  const triggerMapExplode = useCallback(() => {
    socket.emit("creator_map_explode");
    fb("💥 Harita patlatma efekti tetiklendi!");
  }, [socket, fb]);

  const toggleShield = useCallback(() => {
    const next = !shieldVisible;
    setShieldVisible(next);
    socket.emit("creator_shield", { visible: next });
    fb(next ? "🛡️ Gökyüzü kalkanı aktif!" : "Gökyüzü kalkanı kapatıldı");
  }, [shieldVisible, socket, fb]);

  const forceMap = useCallback((mapId: MapId) => {
    socket.emit("admin_force_map", { map: mapId });
    fb(`Harita → ${mapId.toUpperCase()} olarak değiştirildi`);
  }, [socket, fb]);

  const startZombie = useCallback(() => {
    socket.emit("creator_zombie_invasion");
    onStartZombieInvasion();
    fb("🧟 ZOMBİ İSTİLASI BAŞLADI!");
  }, [socket, onStartZombieInvasion, fb]);

  const startBR = useCallback(() => {
    onStartBattleRoyale();
    fb("🔴 BATTLE ROYALE BAŞLADI!");
  }, [onStartBattleRoyale, fb]);

  const [slowmoFactor, setSlowmoFactor] = useState(0.3);
  const [blackholeActive, setBlackholeActive] = useState(false);

  const triggerSlowmo = useCallback(() => {
    socket.emit("creator_slowmo", { factor: slowmoFactor });
    fb(`🌀 ZAMAN YAVAŞLADI × ${slowmoFactor}`);
    setTimeout(() => { socket.emit("creator_reset_slowmo"); }, 8000);
  }, [socket, slowmoFactor, fb]);

  const triggerNuke = useCallback(() => {
    socket.emit("creator_nuke");
    fb("☢ NÜKLEER PATLAMA TETİKLENDİ!");
  }, [socket, fb]);

  const spawnEntity = useCallback((entity: "robot" | "dragon") => {
    socket.emit("creator_spawn", { entity });
    fb(`${entity === "robot" ? "🤖 Robot" : "🐉 Ejderha"} oluşturuldu!`);
  }, [socket, fb]);

  const toggleBlackhole = useCallback(() => {
    const next = !blackholeActive;
    setBlackholeActive(next);
    socket.emit("creator_blackhole", { active: next });
    fb(next ? "🕳 KARA DELİK AÇILDI!" : "Kara delik kapatıldı");
  }, [blackholeActive, socket, fb]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="creator-panel-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="creator-panel">
        <div className="creator-panel-header">
          <span className="creator-panel-icon">⚡</span>
          <span className="creator-panel-title">YARATICI PANELİ</span>
          <span className="creator-panel-sub">KURUCU YETKİSİ</span>
          <button className="creator-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="creator-tabs">
          {(["world","players","events","maps","godmode"] as CreatorTab[]).map(t => (
            <button key={t} className={`creator-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
              {t==="world"?"🌍 Dünya":t==="players"?"👥 Oyuncular":t==="events"?"⚡ Olaylar":t==="maps"?"🗺️ Haritalar":"☢ GOD"}
            </button>
          ))}
        </div>

        <div className="creator-content">

          {tab === "world" && (
            <div className="creator-section">
              <h3 className="creator-section-title">⚖️ YERÇEKİMİ KONTROLÜ</h3>
              <div className="creator-gravity-presets">
                {GRAVITY_PRESETS.map(p => (
                  <button key={p.value} className={`creator-preset-btn${gravityValue===p.value?" active":""}`}
                    onClick={() => sendGravity(p.value)}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
              <div className="creator-slider-row">
                <label>Özel: ×{gravityValue.toFixed(2)}</label>
                <input type="range" min="-1" max="2" step="0.05" value={gravityValue}
                  onChange={e => setGravityValue(parseFloat(e.target.value))}
                  onMouseUp={e => sendGravity(parseFloat((e.target as HTMLInputElement).value))}
                  className="creator-slider" />
              </div>

              <h3 className="creator-section-title" style={{marginTop:"18px"}}>💥 HARITA EFEKTLERİ</h3>
              <div className="creator-btn-grid">
                <button className="creator-action-btn danger" onClick={triggerMapExplode}>
                  💥 Haritayı Patlat
                </button>
                <button className={`creator-action-btn${shieldVisible?" active":""}`} onClick={toggleShield}>
                  🛡️ {shieldVisible ? "Kalkanı Kapat" : "Kalkanı Aç"}
                </button>
              </div>
            </div>
          )}

          {tab === "players" && (
            <div className="creator-section">
              <h3 className="creator-section-title">📏 OYUNCU BOYUTU</h3>
              <div className="creator-size-grid">
                <button className="creator-size-btn" onClick={() => sendSize(3.0)}>
                  🔺 DEV YAP<span>×3</span>
                </button>
                <button className="creator-size-btn" onClick={() => sendSize(2.0)}>
                  ⬆️ Büyüt<span>×2</span>
                </button>
                <button className={`creator-size-btn${playerScale===1?" active":""}`} onClick={() => sendSize(1.0)}>
                  ↔️ Normal<span>×1</span>
                </button>
                <button className="creator-size-btn" onClick={() => sendSize(0.5)}>
                  ⬇️ Küçült<span>×0.5</span>
                </button>
                <button className="creator-size-btn" onClick={() => sendSize(0.2)}>
                  🔻 MİNYATÜR<span>×0.2</span>
                </button>
              </div>
              <h3 className="creator-section-title" style={{marginTop:"18px"}}>⚡ TOPLU KOMUTLAR</h3>
              <div className="creator-btn-grid">
                <button className="creator-action-btn" onClick={() => { socket.emit("admin_giveall", { money: 5000 }); fb("💰 Herkese $5000 verildi!"); }}>
                  💰 Herkese Para
                </button>
                <button className="creator-action-btn" onClick={() => { socket.emit("admin_broadcast", { message: "🛡️ KURUCU SAHNEDE!" }); fb("📣 Yayın yapıldı!"); }}>
                  📣 Kurucu Duyurusu
                </button>
              </div>
            </div>
          )}

          {tab === "events" && (
            <div className="creator-section">
              <h3 className="creator-section-title">🎮 ÖZEL MODLAR</h3>
              <div className="creator-event-list">
                <button className="creator-event-btn zombie" onClick={startZombie}>
                  <span className="creator-event-icon">🧟</span>
                  <div>
                    <div className="creator-event-name">ZOMBİ İSTİLASI</div>
                    <div className="creator-event-desc">Portal açılır, zombie botlar haritayı basar. Takımlar birleşir!</div>
                  </div>
                </button>
                <button className="creator-event-btn br" onClick={startBR}>
                  <span className="creator-event-icon">🔴</span>
                  <div>
                    <div className="creator-event-name">BATTLE ROYALE</div>
                    <div className="creator-event-desc">Küçülen güvenli bölge, son kişi kazanır!</div>
                  </div>
                </button>
                <button className="creator-event-btn" onClick={() => { socket.emit("admin_event", { message: "⚔️ 2X XP ETKİNLİĞİ! Tüm öldürmeler 2 kat!" }); fb("Etkinlik başlatıldı!"); }}>
                  <span className="creator-event-icon">⚔️</span>
                  <div>
                    <div className="creator-event-name">2X XP ETKİNLİĞİ</div>
                    <div className="creator-event-desc">Tüm oyunculara duyurulur</div>
                  </div>
                </button>
                <button className="creator-event-btn" onClick={() => { socket.emit("admin_event", { message: "💰 PARA YAĞMURU! $1500 yatırıldı!" }); socket.emit("admin_giveall", { money: 1500 }); fb("Para yağmuru başladı!"); }}>
                  <span className="creator-event-icon">💰</span>
                  <div>
                    <div className="creator-event-name">PARA YAĞMURU</div>
                    <div className="creator-event-desc">Herkese $1500 anında verilir</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {tab === "maps" && (
            <div className="creator-section">
              <h3 className="creator-section-title">🗺️ ANINDA HARİTA DEĞİŞTİR</h3>
              <p className="creator-hint">Maç ortasında bile aktif — tüm odalar değişir</p>
              <div className="creator-map-grid">
                {MAP_LIST.map(m => (
                  <button key={m.id}
                    className={`creator-map-btn${currentMap===m.id?" active":""}`}
                    style={{"--map-accent":m.accentColor} as React.CSSProperties}
                    onClick={() => forceMap(m.id)}>
                    <span className="creator-map-icon">{m.icon}</span>
                    <span className="creator-map-name">{m.name}</span>
                    <span className="creator-map-desc">{m.desc}</span>
                    {currentMap===m.id && <span className="creator-map-active-badge">AKTİF</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "godmode" && (
            <div className="creator-section">
              <h3 className="creator-section-title">☢ EVRENSEL KONTROL — MUHAMMED ALİ BOSNA MODU</h3>

              <div className="creator-god-grid">

                <button className="creator-god-btn nuke" onClick={triggerNuke}>
                  <span className="creator-god-icon">☢</span>
                  <div className="creator-god-label">NÜKLEER BOMBA</div>
                  <div className="creator-god-desc">Tüm düşmanları atom bombası efektiyle yok et</div>
                </button>

                <button className={`creator-god-btn blackhole${blackholeActive ? " active-bh" : ""}`} onClick={toggleBlackhole}>
                  <span className="creator-god-icon">🕳</span>
                  <div className="creator-god-label">{blackholeActive ? "KARA DELİĞİ KAPAT" : "KARA DELİK AÇ"}</div>
                  <div className="creator-god-desc">Haritanın merkezinde her şeyi içine çeken vorteks</div>
                </button>

                <div className="creator-god-slowmo">
                  <div className="creator-god-slowmo-header">
                    <span className="creator-god-icon">🌀</span>
                    <div>
                      <div className="creator-god-label">ZAMAN YAVAŞLATICI (MATRIX)</div>
                      <div className="creator-god-desc">Hız: × {slowmoFactor} — 8 saniye sürer</div>
                    </div>
                  </div>
                  <input type="range" className="creator-slider" min={0.05} max={0.95} step={0.05}
                    value={slowmoFactor} onChange={e => setSlowmoFactor(Number(e.target.value))} />
                  <button className="creator-god-btn slowmo" onClick={triggerSlowmo} style={{marginTop:"8px",width:"100%"}}>
                    🌀 ZAMANI YAVAŞLAT
                  </button>
                </div>

                <button className="creator-god-btn spawn-robot" onClick={() => spawnEntity("robot")}>
                  <span className="creator-god-icon">🤖</span>
                  <div className="creator-god-label">ROBOT ÇAĞIR</div>
                  <div className="creator-god-desc">Devasa bir savaş robotu doğur</div>
                </button>

                <button className="creator-god-btn spawn-dragon" onClick={() => spawnEntity("dragon")}>
                  <span className="creator-god-icon">🐉</span>
                  <div className="creator-god-label">EJDERHA ÇAĞIR</div>
                  <div className="creator-god-desc">Uçan bir ejderha oluştur</div>
                </button>

              </div>
            </div>
          )}

        </div>

        {feedback && <div className="creator-feedback">{feedback}</div>}
      </div>
    </div>
  );
}
