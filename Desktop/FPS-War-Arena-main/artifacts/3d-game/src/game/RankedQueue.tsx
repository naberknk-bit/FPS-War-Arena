import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { getRankTier } from "./Scoreboard";

interface QueuePlayer {
  username: string;
  rr: number;
}

interface RankedQueueProps {
  socket: Socket;
  rr: number;
  onMatchFound: (roomId: string) => void;
  onCancel: () => void;
}

export default function RankedQueue({ socket, rr, onMatchFound, onCancel }: RankedQueueProps) {
  const [queuePlayers, setQueuePlayers] = useState<QueuePlayer[]>([]);
  const [dots, setDots] = useState(".");
  const tier = getRankTier(rr);
  const needed = 2;

  useEffect(() => {
    socket.emit("join_ranked_queue");
    const handler = (players: QueuePlayer[]) => setQueuePlayers(players);
    const matchHandler = ({ roomId }: { roomId: string }) => onMatchFound(roomId);
    socket.on("ranked_queue_update", handler);
    socket.on("ranked_match_found", matchHandler);
    const dotsInterval = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 500);
    return () => {
      socket.off("ranked_queue_update", handler);
      socket.off("ranked_match_found", matchHandler);
      clearInterval(dotsInterval);
    };
  }, [socket, onMatchFound]);

  const handleCancel = () => {
    socket.emit("leave_ranked_queue");
    onCancel();
  };

  return (
    <div className="ranked-queue-screen">
      <div className="rq-header">
        <div className="rq-mode-badge">🏆 DERECELİ MOD</div>
        <div className="rq-rank" style={{ color: tier.color }}>
          {tier.name} · {rr} RR
        </div>
      </div>

      <div className="rq-spinner">{dots}</div>
      <div className="rq-title">Sıra Bekleniyor</div>
      <div className="rq-count">
        <span className="rq-count-val" style={{ color: tier.color }}>{queuePlayers.length}</span>
        <span className="rq-count-sep"> / </span>
        <span className="rq-count-max">{needed}</span>
      </div>
      <div className="rq-sub">2 oyuncu dolunca maç başlayacak</div>

      <div className="rq-players">
        {queuePlayers.map((p, i) => {
          const t = getRankTier(p.rr);
          return (
            <div key={i} className="rq-player-row">
              <span className="rq-dot" style={{ background: t.color }} />
              <span className="rq-player-name">{p.username}</span>
              <span className="rq-player-rr" style={{ color: t.color }}>{t.name} {p.rr}</span>
            </div>
          );
        })}
      </div>

      <button className="ranked-cancel-btn" onClick={handleCancel}>İptal Et</button>
    </div>
  );
}
