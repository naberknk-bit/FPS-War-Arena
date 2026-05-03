import { useState } from "react";

export type PlayerClass = "assault" | "scout" | "support";

interface ClassDef {
  id: PlayerClass;
  name: string;
  desc: string;
  ability: string;
  abilityDesc: string;
  icon: string;
  color: string;
  stats: { speed: number; armor: number; damage: number };
}

const CLASSES: ClassDef[] = [
  {
    id: "assault",
    name: "TAARRUZ",
    desc: "Saldırı odaklı savaşçı. Hızlı ve ölümcül.",
    ability: "DASH",
    abilityDesc: "[E] İleri atılım — ani mesafe kat et.",
    icon: "⚡",
    color: "#ff4655",
    stats: { speed: 80, armor: 60, damage: 90 },
  },
  {
    id: "scout",
    name: "KEŞİFÇİ",
    desc: "Çevredeki düşmanları tespit eden radar uzmanı.",
    ability: "SCAN",
    abilityDesc: "[E] Radar darbesi — yakın düşmanları tespit et.",
    icon: "📡",
    color: "#44aaff",
    stats: { speed: 90, armor: 40, damage: 70 },
  },
  {
    id: "support",
    name: "DESTEK",
    desc: "Takım arkadaşlarını destekleyen taktik uzmanı.",
    ability: "FLASH",
    abilityDesc: "[E] Flaş — ekranı beyazlaştır, düşmanları kör et.",
    icon: "💡",
    color: "#ffcc44",
    stats: { speed: 70, armor: 80, damage: 60 },
  },
];

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="stat-bar-track">
      <div className="stat-bar-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

interface CharacterSelectProps {
  onSelect: (cls: PlayerClass) => void;
  onBack: () => void;
}

export default function CharacterSelect({ onSelect, onBack }: CharacterSelectProps) {
  const [selected, setSelected] = useState<PlayerClass | null>(null);

  return (
    <div className="class-select-screen">
      <h1 className="class-select-title">KARAKTER SEÇ</h1>
      <p className="class-select-sub">Oyuna başlamadan önce sınıfını seç</p>

      <div className="class-cards">
        {CLASSES.map((cls) => (
          <div
            key={cls.id}
            className={`class-card${selected === cls.id ? " selected" : ""}`}
            style={{ "--class-color": cls.color } as React.CSSProperties}
            onClick={() => setSelected(cls.id)}
          >
            <div className="class-icon">{cls.icon}</div>
            <div className="class-name" style={{ color: cls.color }}>{cls.name}</div>
            <div className="class-desc">{cls.desc}</div>
            <div className="class-ability-box" style={{ borderColor: cls.color + "55" }}>
              <div className="class-ability-name" style={{ color: cls.color }}>{cls.ability}</div>
              <div className="class-ability-desc">{cls.abilityDesc}</div>
            </div>
            <div className="class-stats">
              {(["speed", "armor", "damage"] as const).map((stat) => (
                <div className="stat-row" key={stat}>
                  <span className="stat-label">
                    {stat === "speed" ? "HIZ" : stat === "armor" ? "ZIRH" : "HASAR"}
                  </span>
                  <StatBar value={cls.stats[stat]} color={cls.color} />
                </div>
              ))}
            </div>
            {selected === cls.id && <div className="class-selected-badge" style={{ background: cls.color }}>SEÇİLDİ ✓</div>}
          </div>
        ))}
      </div>

      <div className="class-select-actions">
        <button className="start-btn" onClick={() => selected && onSelect(selected)} disabled={!selected}>
          {selected
            ? `▶ ${CLASSES.find((c) => c.id === selected)?.name} ile Oyna`
            : "Bir sınıf seç"}
        </button>
        <button className="back-link" onClick={onBack} style={{ marginTop: "12px" }}>
          ← Lobiye Dön
        </button>
      </div>
    </div>
  );
}
