import { useEffect, useState } from "react";

export interface LastKill {
  killer: string;
  victim: string;
  weapon: string;
  isHeadshot: boolean;
  killerIsFounder: boolean;
}

interface LastKillReplayProps {
  kill: LastKill | null;
  visible: boolean;
  onEnd: () => void;
}

export default function LastKillReplay({ kill, visible, onEnd }: LastKillReplayProps) {
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<"in" | "show" | "out">("in");

  useEffect(() => {
    if (!visible || !kill) return;
    setCountdown(3);
    setPhase("in");
    const t1 = setTimeout(() => setPhase("show"), 400);
    const t2 = setTimeout(() => setCountdown(2), 1000);
    const t3 = setTimeout(() => setCountdown(1), 2000);
    const t4 = setTimeout(() => setPhase("out"), 2800);
    const t5 = setTimeout(() => onEnd(), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [visible, kill]);

  if (!visible || !kill) return null;

  const WEAPON_EMOJIS: Record<string, string> = { pistol: "🔫", phantom: "🟦", vandal: "🟥", operator: "💛" };

  return (
    <div className={`replay-overlay replay-${phase}`}>
      {/* Cinematic bars */}
      <div className="replay-bar-top" />
      <div className="replay-bar-bottom" />

      {/* Content */}
      <div className="replay-content">
        <div className="replay-label">◀ SON ÖLDÜRme TEKRARI ▶</div>
        <div className="replay-slowmo">0.25x</div>

        <div className="replay-kill-info">
          <span className={`replay-killer${kill.killerIsFounder ? " founder" : ""}`}>
            {kill.killerIsFounder && "🛡️ "}{kill.killer}
          </span>
          <span className="replay-weapon">{WEAPON_EMOJIS[kill.weapon] ?? "🔫"} {kill.weapon.toUpperCase()}</span>
          <span className="replay-victim">{kill.victim}</span>
        </div>

        {kill.isHeadshot && (
          <div className="replay-headshot">🎯 KRİTİK VURUŞ!</div>
        )}

        <div className="replay-countdown">{countdown}</div>
      </div>

      {/* Slow-motion grain overlay */}
      <div className="replay-grain" />
    </div>
  );
}
