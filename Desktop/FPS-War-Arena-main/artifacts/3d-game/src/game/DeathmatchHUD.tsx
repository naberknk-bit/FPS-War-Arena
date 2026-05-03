import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";

interface DMPlayer {
  username: string;
  kills: number;
  deaths: number;
}

interface DeathmatchHUDProps {
  active: boolean;
  socket: Socket | null;
  myUsername: string;
  onStop: () => void;
}

export default function DeathmatchHUD({ active, socket, myUsername, onStop }: DeathmatchHUDProps) {
  const [players, setPlayers] = useState<DMPlayer[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [myKills, setMyKills]   = useState(0);

  useEffect(() => {
    if (!active) return;
    setTimeLeft(300);
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { onStop(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, onStop]);

  useEffect(() => {
    if (!socket || !active) return;
    const onDMKill = ({ killer, victim }: { killer: string; victim: string }) => {
      setPlayers(prev => {
        const next = [...prev];
        const ki = next.findIndex(p => p.username === killer);
        const vi = next.findIndex(p => p.username === victim);
        if (ki >= 0) next[ki] = { ...next[ki], kills: next[ki].kills + 1 };
        else next.push({ username: killer, kills: 1, deaths: 0 });
        if (vi >= 0) next[vi] = { ...next[vi], deaths: next[vi].deaths + 1 };
        else next.push({ username: victim, kills: 0, deaths: 1 });
        return next.sort((a, b) => b.kills - a.kills);
      });
      if (killer === myUsername) setMyKills(k => k + 1);
    };
    const onDMUpdate = (data: DMPlayer[]) => setPlayers(data);
    socket.on("dm_kill",   onDMKill);
    socket.on("dm_update", onDMUpdate);
    return () => { socket.off("dm_kill", onDMKill); socket.off("dm_update", onDMUpdate); };
  }, [socket, active, myUsername]);

  if (!active) return null;

  const mm = Math.floor(timeLeft / 60), ss = timeLeft % 60;

  return (
    <div className="dm-hud">
      <div className="dm-hud-header">
        <span className="dm-hud-mode">⚡ DEATHMATCH</span>
        <span className="dm-hud-timer" style={{ color: timeLeft < 30 ? "#ff4444" : "#fff" }}>
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </span>
        <button className="dm-stop-btn" onClick={onStop}>■ Durdur</button>
      </div>
      <div className="dm-my-kills">🎯 Öldürdüğün: <b>{myKills}</b></div>
      <div className="dm-scoreboard">
        {players.slice(0, 8).map((p, i) => (
          <div key={p.username} className={`dm-row${p.username === myUsername ? " dm-row--me" : ""}`}>
            <span className="dm-rank">#{i + 1}</span>
            <span className="dm-name">{p.username}</span>
            <span className="dm-kd">{p.kills}/{p.deaths}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
