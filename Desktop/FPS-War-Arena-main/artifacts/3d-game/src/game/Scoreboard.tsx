import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface PlayerScore {
  socketId: string;
  username: string;
  isFounder: boolean;
  kills: number;
  deaths: number;
  assists: number;
  ping: number;
  team: "red" | "blue" | "none";
}

interface ScoreboardProps {
  socket: Socket;
  visible: boolean;
  localUsername: string;
  isFounder: boolean;
}

const RR_TIERS = [
  { name: "DEMİR",     min: 0,    color: "#aaa" },
  { name: "BRONZ",     min: 200,  color: "#cd7f32" },
  { name: "GÜMÜŞ",     min: 400,  color: "#c0c0c0" },
  { name: "ALTIN",     min: 600,  color: "#ffd700" },
  { name: "PLATİN",    min: 800,  color: "#44aaff" },
  { name: "ELMAS",     min: 1000, color: "#44ffcc" },
  { name: "RADYANT",   min: 1200, color: "#ffcc44" },
];

export function getRankTier(rr: number) {
  let tier = RR_TIERS[0];
  for (const t of RR_TIERS) { if (rr >= t.min) tier = t; }
  return tier;
}

export default function Scoreboard({ socket, visible, localUsername, isFounder }: ScoreboardProps) {
  const [players, setPlayers] = useState<PlayerScore[]>([]);

  useEffect(() => {
    if (!visible) return;
    socket.emit("get_scoreboard");
    const t = setInterval(() => socket.emit("get_scoreboard"), 2000);
    const handler = (data: PlayerScore[]) => setPlayers(data);
    socket.on("scoreboard_data", handler);
    return () => { clearInterval(t); socket.off("scoreboard_data", handler); };
  }, [socket, visible]);

  if (!visible) return null;

  const sorted = [...players].sort((a, b) => b.kills - a.kills);

  return (
    <div className="scoreboard-overlay">
      <div className="scoreboard">
        <div className="sb-header">
          <span className="sb-title">SKOR TABLOSU</span>
          <span className="sb-hint">TAB basılı tut</span>
        </div>
        <div className="sb-table">
          <div className="sb-row sb-thead">
            <span className="sb-col-name">OYUNCU</span>
            <span className="sb-col-kda">K</span>
            <span className="sb-col-kda">Ö</span>
            <span className="sb-col-kda">A</span>
            <span className="sb-col-ping">PING</span>
          </div>
          {sorted.map((p) => (
            <div
              key={p.socketId}
              className={[
                "sb-row",
                p.username === localUsername ? "sb-self" : "",
                p.isFounder ? "sb-founder" : "",
                p.team !== "none" ? `sb-team-${p.team}` : "",
              ].join(" ")}
            >
              <span className="sb-col-name">
                {p.isFounder && <span className="sb-founder-icon">🛡️ </span>}
                {p.username}
                {p.isFounder && <span className="sb-founder-tag"> KURUCU</span>}
              </span>
              <span className="sb-col-kda sb-kills">{p.kills}</span>
              <span className="sb-col-kda sb-deaths">{p.deaths}</span>
              <span className="sb-col-kda">{p.assists}</span>
              <span className={`sb-col-ping ${p.ping < 60 ? "ping-good" : p.ping < 120 ? "ping-ok" : "ping-bad"}`}>
                {p.ping}ms
              </span>
            </div>
          ))}
          {players.length === 0 && (
            <div className="sb-empty">Veri bekleniyor...</div>
          )}
        </div>
      </div>
    </div>
  );
}
