import { useEffect } from "react";
import { MAP_LIST, MapId } from "./Map";

interface MapSelectProps {
  isOpen: boolean;
  currentMap: MapId;
  onSelectMap: (id: MapId) => void;
  onClose: () => void;
  isHost: boolean;
}

const MAP_BG_PREVIEW: Record<MapId, string> = {
  astral:    "linear-gradient(135deg,#020208,#0011aa,#8800ff)",
  canyon:    "linear-gradient(135deg,#110800,#9b6535,#ff8844)",
  frost:     "linear-gradient(135deg,#030a14,#1a3a55,#88ddff)",
  ruins:     "linear-gradient(135deg,#080010,#1c1030,#cc88ff)",
  mars:      "linear-gradient(135deg,#1a0500,#4a1500,#ff4422)",
  volcano:   "linear-gradient(135deg,#0d0200,#2a0800,#ff6600)",
  space:     "linear-gradient(135deg,#02000a,#050018,#8844ff)",
  egypt:     "linear-gradient(135deg,#110c00,#a07840,#ffcc00)",
  cyberpunk: "linear-gradient(135deg,#030008,#0a000f,#ff00ff)",
  underwater:"linear-gradient(135deg,#000d18,#001a2e,#00ccff)",
};

const MAP_GRAVITY_LABEL: Partial<Record<MapId, string>> = {
  mars:      "Düşük Yerçekimi",
  space:     "Azaltılmış G",
  underwater:"Su Direnci",
};

const MAP_MECHANIC_LABEL: Partial<Record<MapId, string>> = {
  volcano:   "🔥 Lav Hasarı",
  space:     "🌀 Portallar",
  mars:      "🔴 Kızıl Sis",
  cyberpunk: "🌧️ Neon Yağmur",
  underwater:"🫧 Kabarcıklar",
};

export default function MapSelect({ isOpen, currentMap, onSelectMap, onClose, isHost }: MapSelectProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mapselect-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mapselect-panel">
        <div className="mapselect-header">
          <span className="mapselect-title">🗺️ HARİTA SEÇİMİ</span>
          <span className="mapselect-sub">{isHost ? "Seçim yap — diğer oyunculara uygulanır" : "Sadece host harita değiştirebilir"}</span>
          <button className="mapselect-close" onClick={onClose}>✕</button>
        </div>
        <div className="mapselect-grid">
          {MAP_LIST.map(m => (
            <button
              key={m.id}
              className={`mapselect-card${currentMap === m.id ? " active" : ""}${!isHost ? " disabled" : ""}`}
              style={{ background: MAP_BG_PREVIEW[m.id], borderColor: m.accentColor }}
              onClick={() => { if (isHost) { onSelectMap(m.id); onClose(); } }}
              disabled={!isHost}
            >
              <div className="mapselect-icon">{m.icon}</div>
              <div className="mapselect-name" style={{ color: m.accentColor }}>{m.name}</div>
              <div className="mapselect-desc">{m.desc}</div>
              {MAP_GRAVITY_LABEL[m.id] && (
                <div className="mapselect-tag gravity">{MAP_GRAVITY_LABEL[m.id]}</div>
              )}
              {MAP_MECHANIC_LABEL[m.id] && (
                <div className="mapselect-tag mechanic">{MAP_MECHANIC_LABEL[m.id]}</div>
              )}
              {currentMap === m.id && (
                <div className="mapselect-active-badge" style={{ background: m.accentColor }}>AKTİF</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
