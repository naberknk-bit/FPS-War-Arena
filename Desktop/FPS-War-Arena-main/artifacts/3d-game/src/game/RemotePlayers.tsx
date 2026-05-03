import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Socket } from "socket.io-client";
import HumanoidModel, { AnimState, CharTeam } from "./HumanoidModel";

interface RemotePlayer {
  id: string;
  username: string;
  isFounder: boolean;
  team: "red" | "blue" | "none";
  x: number; y: number; z: number;
  ry: number;
  hitFlash: number;
  shootSignal: number;
}

interface RemotePlayersProps {
  socket: Socket | null;
  mySocketId: string | null;
  myTeam: "red" | "blue" | "none";
  onTeammateHit?: (username: string) => void;
}

export default function RemotePlayers({ socket, mySocketId, myTeam, onTeammateHit }: RemotePlayersProps) {
  const [players, setPlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const playersRef = useRef<Map<string, RemotePlayer>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onMoved = (data: { id: string; username: string; isFounder: boolean; team: string; x: number; y: number; z: number; ry: number }) => {
      if (data.id === mySocketId) return;
      setPlayers((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.id);
        next.set(data.id, {
          id: data.id,
          username: data.username,
          isFounder: data.isFounder,
          team: (data.team as RemotePlayer["team"]) ?? "none",
          x: data.x, y: data.y, z: data.z, ry: data.ry,
          hitFlash:    existing?.hitFlash    ?? 0,
          shootSignal: existing?.shootSignal ?? 0,
        });
        playersRef.current = next;
        return next;
      });
    };

    const onLeft = ({ id }: { id: string }) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.delete(id);
        playersRef.current = next;
        return next;
      });
    };

    const onKillFeed = (evt: { killer: string; victim: string }) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        for (const [, p] of next) {
          if (p.username === evt.victim) {
            p.hitFlash = 0.4;
            if (myTeam !== "none" && p.team === myTeam) onTeammateHit?.(evt.victim);
          }
          if (p.username === evt.killer) {
            p.shootSignal = (p.shootSignal ?? 0) + 1;
          }
        }
        playersRef.current = next;
        return next;
      });
    };

    socket.on("player_moved", onMoved);
    socket.on("player_left",  onLeft);
    socket.on("kill_feed",    onKillFeed);
    return () => {
      socket.off("player_moved", onMoved);
      socket.off("player_left",  onLeft);
      socket.off("kill_feed",    onKillFeed);
    };
  }, [socket, mySocketId, myTeam, onTeammateHit]);

  return (
    <>
      {Array.from(players.values()).map((p) => (
        <RemotePlayerMesh key={p.id} player={p} myTeam={myTeam} />
      ))}
    </>
  );
}

// ─── Per-player mesh ─────────────────────────────────────────────────────────
function RemotePlayerMesh({ player, myTeam }: { player: RemotePlayer; myTeam: string }) {
  const groupRef       = useRef<THREE.Group>(null);
  const animStateRef   = useRef<AnimState>("idle");
  const shootSignalRef = useRef(0);
  const prevPos        = useRef(new THREE.Vector3(player.x, player.y, player.z));

  // Propagate shoot signal from prop change
  const lastShootProp = useRef(player.shootSignal);
  if (player.shootSignal !== lastShootProp.current) {
    lastShootProp.current = player.shootSignal;
    shootSignalRef.current++;
  }

  const isTeammate = myTeam !== "none" && player.team === myTeam;
  const charTeam: CharTeam = player.team === "red" ? "red" : player.team === "blue" ? "blue" : "none";

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth interpolation
    const target = new THREE.Vector3(player.x, player.y, player.z);
    groupRef.current.position.lerp(target, Math.min(1, delta * 18));
    groupRef.current.rotation.y = player.ry;

    // Velocity-based animation
    const vel = groupRef.current.position.distanceTo(prevPos.current) / Math.max(delta, 0.001);
    prevPos.current.copy(groupRef.current.position);

    if (vel > 4.5)     animStateRef.current = "run";
    else if (vel > 0.4) animStateRef.current = "walk";
    else               animStateRef.current = "idle";
  });

  return (
    <group ref={groupRef} position={[player.x, player.y, player.z]}>
      <HumanoidModel
        animStateRef={animStateRef}
        shootSignalRef={shootSignalRef}
        team={charTeam}
        isFounder={player.isFounder}
      />
      {/* Hit flash overlay (red pulse around body) */}
      {player.hitFlash > 0 && (
        <pointLight color="#ff2200" intensity={player.hitFlash * 4} distance={3} position={[0,1,0]} />
      )}
      {/* Floating username */}
      <Html
        position={[0, isFounder(player) ? 2.45 : 2.15, 0]}
        center distanceFactor={8}
        zIndexRange={[0, 0]}
        occlude
      >
        <div
          className="remote-player-name"
          style={{ color: player.isFounder ? "#ffcc44" : isTeammate ? "#66aaff" : "#ff6666" }}
        >
          {player.isFounder && "🛡️ "}
          {player.username}
          {isTeammate && <span className="remote-team-badge">TAKIM</span>}
          {player.isFounder && <span className="founder-badge-small"> KURUCU</span>}
        </div>
      </Html>
    </group>
  );
}

function isFounder(p: RemotePlayer) { return p.isFounder; }
