import { useEffect, useRef, useState } from "react";

interface RankUpCinematicProps {
  visible: boolean;
  newLevel: number;
  newRankName: string;
  newRankColor: string;
  onEnd: () => void;
}

const RANK_ICONS: Record<string, string> = {
  "Demir":   "⬛",
  "Bronz":   "🟫",
  "Gümüş":   "⬜",
  "Altın":   "🟨",
  "Platin":  "🟦",
  "Elmas":   "💎",
  "Radyant": "🔥",
};

export default function RankUpCinematic({ visible, newLevel, newRankName, newRankColor, onEnd }: RankUpCinematicProps) {
  const [phase, setPhase] = useState<"flash"|"show"|"fade"|"done">("flash");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) { setPhase("flash"); return; }
    setPhase("flash");
    timerRef.current = setTimeout(() => { setPhase("show"); }, 300);
    timerRef.current = setTimeout(() => { setPhase("fade"); }, 3500);
    timerRef.current = setTimeout(() => { setPhase("done"); onEnd(); }, 4500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, onEnd]);

  if (!visible || phase === "done") return null;

  const icon = RANK_ICONS[newRankName] ?? "⭐";

  return (
    <div className={`rankup-overlay ${phase}`}>
      <div className="rankup-flash" />
      <div className="rankup-content">
        <div className="rankup-label">SEVİYE ATLADINIZ!</div>
        <div className="rankup-level" style={{ color: newRankColor }}>
          SEVİYE {newLevel}
        </div>
        <div className="rankup-icon">{icon}</div>
        <div className="rankup-rank" style={{ color: newRankColor }}>
          {newRankName}
        </div>
        <div className="rankup-stars">
          {"⭐".repeat(Math.min(newLevel, 5))}
        </div>
        <div className="rankup-sub">Tebrikler! Yeni rütbeniz kilidini açtı.</div>
      </div>
      {/* Particle burst */}
      <div className="rankup-particles">
        {Array.from({length:20}).map((_,i) => (
          <div key={i} className="rankup-particle" style={{
            "--angle": `${i * 18}deg`,
            "--delay": `${Math.random() * 0.3}s`,
            "--color": newRankColor,
          } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
