import { useEffect, useState } from "react";

export interface KillEvent {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  isHeadshot?: boolean;
  killerIsFounder?: boolean;
}

const WEAPON_ICONS: Record<string, string> = {
  vandal: "⚡",
  phantom: "👻",
  operator: "🎯",
  pistol: "🔫",
  default: "💀",
};

interface KillFeedProps {
  kills: KillEvent[];
}

export default function KillFeed({ kills }: KillFeedProps) {
  return (
    <div className="kill-feed-panel">
      {kills.slice(-5).map((k) => (
        <div key={k.id} className={`kf-row${k.isHeadshot ? " kf-headshot" : ""}`}>
          <span className={k.killerIsFounder ? "kf-name kf-founder" : "kf-name"}>{k.killer}</span>
          <span className="kf-weapon">{WEAPON_ICONS[k.weapon] ?? WEAPON_ICONS.default}</span>
          {k.isHeadshot && <span className="kf-hs-badge">HS</span>}
          <span className="kf-victim">{k.victim}</span>
        </div>
      ))}
    </div>
  );
}
