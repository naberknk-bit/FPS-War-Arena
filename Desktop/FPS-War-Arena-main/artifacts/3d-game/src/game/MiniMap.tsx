import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import * as THREE from "three";

const MAP_SIZE = 60;
const CANVAS_SIZE = 140;
const HALF = MAP_SIZE / 2;

interface RemotePos { id: string; username: string; x: number; z: number; team?: string; }

interface MiniMapProps {
  socket: Socket;
  myPosition: THREE.Vector3;
  myRotationY: number;
  spikePos: { x: number; z: number } | null;
  spikeArmed: boolean;
}

export default function MiniMap({ socket, myPosition, myRotationY, spikePos, spikeArmed }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const remoteRef = useRef<RemotePos[]>([]);

  useEffect(() => {
    const handler = (data: { id: string; username: string; x: number; z: number; team?: string }) => {
      remoteRef.current = remoteRef.current.filter((p) => p.id !== data.id).concat(data);
    };
    const leaveHandler = (data: { id: string }) => {
      remoteRef.current = remoteRef.current.filter((p) => p.id !== data.id);
    };
    socket.on("player_moved", handler);
    socket.on("player_left", leaveHandler);
    return () => { socket.off("player_moved", handler); socket.off("player_left", leaveHandler); };
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const S = CANVAS_SIZE;
      ctx.clearRect(0, 0, S, S);

      // Background
      ctx.fillStyle = "rgba(10,10,14,0.82)";
      ctx.fillRect(0, 0, S, S);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      const cells = 6;
      for (let i = 1; i < cells; i++) {
        const p = (i / cells) * S;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, S, S);

      const toCanvas = (wx: number, wz: number): [number, number] => {
        const px = ((wx + HALF) / MAP_SIZE) * S;
        const py = ((wz + HALF) / MAP_SIZE) * S;
        return [px, py];
      };

      // Spike
      if (spikePos) {
        const [sx, sy] = toCanvas(spikePos.x, spikePos.z);
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = spikeArmed ? "#ff2222" : "#ff8800";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (spikeArmed) {
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,30,30,0.5)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Remote players
      for (const p of remoteRef.current) {
        const [px, py] = toCanvas(p.x, p.z);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.team === "red" ? "#ff4444" : p.team === "blue" ? "#4488ff" : "#ffcc44";
        ctx.fill();
      }

      // Self (larger with direction indicator)
      const mx = myPosition.x;
      const mz = myPosition.z;
      const [cx, cy] = toCanvas(mx, mz);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(myRotationY);
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "8px monospace";
      ctx.fillText("N", S / 2 - 3, 9);
    };

    const id = setInterval(draw, 50);
    draw();
    return () => clearInterval(id);
  }, [myPosition, myRotationY, spikePos, spikeArmed]);

  return (
    <div className="minimap-container">
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="minimap-canvas" />
      <div className="minimap-label">RAD</div>
    </div>
  );
}
