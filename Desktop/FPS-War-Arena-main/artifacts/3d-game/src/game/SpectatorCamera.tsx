import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "socket.io-client";

interface RemotePos {
  socketId: string;
  username: string;
  x: number; y: number; z: number;
  rotY: number;
  team?: string;
  hp?: number;
}

interface SpectatorCameraProps {
  socket: Socket | null;
  active: boolean;          // true when isDead
  localUsername: string;
}

export default function SpectatorCamera({ socket, active, localUsername }: SpectatorCameraProps) {
  const { camera }    = useThree();
  const [players, setPlayers] = useState<RemotePos[]>([]);
  const [targetIdx, setTargetIdx] = useState(0);
  const camPos        = useRef(new THREE.Vector3());
  const camTarget     = useRef(new THREE.Vector3());
  const smoothPos     = useRef(new THREE.Vector3());
  const smoothTarget  = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { players: RemotePos[] }) => {
      const alive = data.players.filter(p => (p.hp ?? 100) > 0 && p.username !== localUsername);
      setPlayers(alive);
    };
    socket.on("players_state", handler);
    return () => { socket.off("players_state", handler); };
  }, [socket, localUsername]);

  // Expose spectator controls to HTML overlay via window events
  useEffect(() => {
    const prev = () => setTargetIdx(i => i <= 0 ? Math.max(0, players.length - 1) : i - 1);
    const next = () => setTargetIdx(i => i >= players.length - 1 ? 0 : i + 1);
    window.addEventListener("spectator:prev", prev);
    window.addEventListener("spectator:next", next);
    return () => { window.removeEventListener("spectator:prev", prev); window.removeEventListener("spectator:next", next); };
  }, [players.length]);

  useFrame(() => {
    if (!active || players.length === 0) return;
    const idx = Math.min(targetIdx, players.length - 1);
    const p = players[idx];
    if (!p) return;

    // Target camera position: behind/above the spectated player
    const eyeY = p.y + 1.55;
    camPos.current.set(
      p.x - Math.sin(p.rotY) * 0.35,
      eyeY,
      p.z - Math.cos(p.rotY) * 0.35,
    );
    camTarget.current.set(
      p.x + Math.sin(p.rotY) * 4,
      eyeY,
      p.z + Math.cos(p.rotY) * 4,
    );

    smoothPos.current.lerp(camPos.current, 0.12);
    smoothTarget.current.lerp(camTarget.current, 0.12);

    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothTarget.current);
  });

  return null;
}

// ── Spectator HUD Overlay (DOM, outside canvas) ─────────────────────────────
interface SpectatorHUDProps {
  socket: Socket | null;
  active: boolean;
  localUsername: string;
}

export function SpectatorHUD({ socket, active, localUsername }: SpectatorHUDProps) {
  const [players, setPlayers] = useState<RemotePos[]>([]);
  const [targetIdx, setTargetIdx] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { players: RemotePos[] }) => {
      const alive = data.players.filter(p => (p.hp ?? 100) > 0 && p.username !== localUsername);
      setPlayers(alive);
    };
    socket.on("players_state", handler);
    return () => { socket.off("players_state", handler); };
  }, [socket, localUsername]);

  if (!active || players.length === 0) return null;
  const target = players[Math.min(targetIdx, players.length - 1)];

  const prev = () => { const ni = targetIdx <= 0 ? players.length - 1 : targetIdx - 1; setTargetIdx(ni); window.dispatchEvent(new Event("spectator:prev")); };
  const next = () => { const ni = targetIdx >= players.length - 1 ? 0 : targetIdx + 1; setTargetIdx(ni); window.dispatchEvent(new Event("spectator:next")); };

  return (
    <div className="spectator-overlay">
      <div className="spectator-bar">
        <span className="spectator-label">👁 İZLEME MODU</span>
        <button className="spectator-nav" onClick={prev}>‹</button>
        <span className="spectator-name">
          {target?.username ?? "—"}
          {target?.team && <span className={`spectator-team ${target.team}`}> [{target.team.toUpperCase()}]</span>}
        </span>
        <button className="spectator-nav" onClick={next}>›</button>
        <span className="spectator-counter">{Math.min(targetIdx,players.length-1)+1}/{players.length}</span>
      </div>
      <div className="spectator-players">
        {players.map((p, i) => (
          <button key={p.socketId} className={`spectator-player-chip${i===targetIdx?" active":""}`} onClick={() => { setTargetIdx(i); }}>
            {p.username} {p.hp != null ? `❤${p.hp}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
