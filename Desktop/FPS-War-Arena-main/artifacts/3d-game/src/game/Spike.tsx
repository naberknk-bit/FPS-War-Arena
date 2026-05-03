import { useEffect, useRef, useState, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "socket.io-client";
import { playSpikeBeep, playSpikeArmed, playSpikeExplode, playDefuse } from "./AudioEngine";

const PLANT_TIME = 4;
const DEFUSE_TIME = 5;
const FUSE_TIME = 45;

export interface SpikeState {
  armed: boolean;
  plantedAt: number | null;
  position: { x: number; y: number; z: number } | null;
  defused: boolean;
  exploded: boolean;
}

interface SpikeHUDProps {
  hasSpike: boolean;
  spikeState: SpikeState;
  isPlanting: boolean;
  plantProgress: number;
  isDefusing: boolean;
  defuseProgress: number;
  timeLeft: number;
}

export function SpikeHUD({ hasSpike, spikeState, isPlanting, plantProgress, isDefusing, defuseProgress, timeLeft }: SpikeHUDProps) {
  if (!hasSpike && !spikeState.armed && !spikeState.defused && !spikeState.exploded) return null;

  const urgentTime = timeLeft < 10;

  return (
    <div className="spike-hud">
      {hasSpike && !spikeState.armed && (
        <div className="spike-carry">🧨 SPIKE ELİNDE · [4] Kur</div>
      )}
      {isPlanting && (
        <div className="spike-action-bar">
          <div className="spike-action-label">SPIKE KURULUYOR...</div>
          <div className="spike-progress-track">
            <div className="spike-progress-fill" style={{ width: `${plantProgress * 100}%`, background: "#ff8800" }} />
          </div>
        </div>
      )}
      {isDefusing && (
        <div className="spike-action-bar">
          <div className="spike-action-label">İMHA EDİLİYOR...</div>
          <div className="spike-progress-track">
            <div className="spike-progress-fill" style={{ width: `${defuseProgress * 100}%`, background: "#44aaff" }} />
          </div>
        </div>
      )}
      {spikeState.armed && !spikeState.defused && !spikeState.exploded && (
        <div className={`spike-timer${urgentTime ? " spike-urgent" : ""}`}>
          🧨 {Math.ceil(timeLeft)}s
        </div>
      )}
      {spikeState.defused && (
        <div className="spike-result spike-defused">✅ SPIKE İMHA EDİLDİ</div>
      )}
      {spikeState.exploded && (
        <div className="spike-result spike-exploded">💥 SPIKE PATLADI</div>
      )}
    </div>
  );
}

interface SpikeSystemProps {
  socket: Socket;
  hasSpike: boolean;
  spikeState: SpikeState;
  onSpikeStateChange: (s: SpikeState) => void;
  onPlantProgress: (v: number) => void;
  onIsPlanting: (v: boolean) => void;
  onIsDefusing: (v: boolean) => void;
  onDefuseProgress: (v: number) => void;
  onTimeLeft: (v: number) => void;
  chatFocused: boolean;
  roomId: string | null;
}

export function SpikeSystem({
  socket, hasSpike, spikeState, onSpikeStateChange,
  onPlantProgress, onIsPlanting, onIsDefusing, onDefuseProgress, onTimeLeft,
  chatFocused, roomId,
}: SpikeSystemProps) {
  const { camera } = useThree();
  const plantStartRef = useRef<number | null>(null);
  const defuseStartRef = useRef<number | null>(null);
  const plantIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defuseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fuseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spikeStateRef = useRef(spikeState);
  spikeStateRef.current = spikeState;

  const stopAll = useCallback(() => {
    [plantIntervalRef, defuseIntervalRef].forEach((r) => { if (r.current) { clearInterval(r.current); r.current = null; } });
    plantStartRef.current = null;
    defuseStartRef.current = null;
    onIsPlanting(false);
    onIsDefusing(false);
    onPlantProgress(0);
    onDefuseProgress(0);
  }, [onIsPlanting, onIsDefusing, onPlantProgress, onDefuseProgress]);

  // Socket events
  useEffect(() => {
    const onArmed = (data: { x: number; y: number; z: number }) => {
      playSpikeArmed();
      const newState: SpikeState = {
        armed: true,
        plantedAt: Date.now(),
        position: data,
        defused: false,
        exploded: false,
      };
      onSpikeStateChange(newState);
      stopAll();

      // Start fuse countdown
      let remaining = FUSE_TIME;
      onTimeLeft(remaining);
      if (fuseIntervalRef.current) clearInterval(fuseIntervalRef.current);
      fuseIntervalRef.current = setInterval(() => {
        remaining -= 0.1;
        onTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(fuseIntervalRef.current!);
          fuseIntervalRef.current = null;
          playSpikeExplode();
          onSpikeStateChange({ ...spikeStateRef.current, exploded: true });
        }
      }, 100);

      // Beep
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      let beepInterval = 900;
      const adaptiveBeep = () => {
        playSpikeBeep(remaining < 10);
        beepInterval = Math.max(150, beepInterval - (remaining < 10 ? 50 : 10));
        beepIntervalRef.current = setTimeout(adaptiveBeep, beepInterval) as unknown as ReturnType<typeof setInterval>;
      };
      adaptiveBeep();
    };

    const onDefused = () => {
      playDefuse();
      if (fuseIntervalRef.current) { clearInterval(fuseIntervalRef.current); fuseIntervalRef.current = null; }
      if (beepIntervalRef.current) { clearInterval(beepIntervalRef.current); beepIntervalRef.current = null; }
      onSpikeStateChange({ ...spikeStateRef.current, defused: true });
      stopAll();
    };

    socket.on("spike_armed", onArmed);
    socket.on("spike_defused", onDefused);
    return () => {
      socket.off("spike_armed", onArmed);
      socket.off("spike_defused", onDefused);
    };
  }, [socket, onSpikeStateChange, stopAll, onTimeLeft]);

  // Keydown handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatFocused) return;

      // Plant (4)
      if (e.code === "Digit4" && hasSpike && !spikeStateRef.current.armed) {
        e.preventDefault();
        if (plantStartRef.current !== null) return;
        plantStartRef.current = Date.now();
        onIsPlanting(true);
        plantIntervalRef.current = setInterval(() => {
          if (plantStartRef.current === null) return;
          const progress = (Date.now() - plantStartRef.current) / (PLANT_TIME * 1000);
          onPlantProgress(Math.min(progress, 1));
          if (progress >= 1) {
            clearInterval(plantIntervalRef.current!);
            plantIntervalRef.current = null;
            const pos = { x: camera.position.x, y: 0, z: camera.position.z };
            socket.emit("spike_plant", { ...pos, roomId });
            onIsPlanting(false);
            onPlantProgress(0);
            plantStartRef.current = null;
          }
        }, 50);
      }

      // Defuse (F / 4 near spike)
      if (e.code === "KeyF" && spikeStateRef.current.armed && !spikeStateRef.current.defused) {
        if (defuseStartRef.current !== null) return;
        const sp = spikeStateRef.current.position;
        if (sp) {
          const dx = camera.position.x - sp.x;
          const dz = camera.position.z - sp.z;
          if (Math.sqrt(dx * dx + dz * dz) > 3) return;
        }
        defuseStartRef.current = Date.now();
        onIsDefusing(true);
        defuseIntervalRef.current = setInterval(() => {
          if (defuseStartRef.current === null) return;
          const progress = (Date.now() - defuseStartRef.current) / (DEFUSE_TIME * 1000);
          onDefuseProgress(Math.min(progress, 1));
          if (progress >= 1) {
            clearInterval(defuseIntervalRef.current!);
            defuseIntervalRef.current = null;
            socket.emit("spike_defuse", { roomId });
            onIsDefusing(false);
            onDefuseProgress(0);
            defuseStartRef.current = null;
          }
        }, 50);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Digit4" && plantIntervalRef.current) {
        clearInterval(plantIntervalRef.current);
        plantIntervalRef.current = null;
        plantStartRef.current = null;
        onIsPlanting(false);
        onPlantProgress(0);
      }
      if (e.code === "KeyF" && defuseIntervalRef.current) {
        clearInterval(defuseIntervalRef.current);
        defuseIntervalRef.current = null;
        defuseStartRef.current = null;
        onIsDefusing(false);
        onDefuseProgress(0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [chatFocused, hasSpike, socket, roomId, camera, onIsPlanting, onIsDefusing, onPlantProgress, onDefuseProgress]);

  return null;
}
