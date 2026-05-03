import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import type { PlayerClass } from "./CharacterSelect";

interface MVPData {
  username: string;
  kills: number;
  deaths: number;
  playerClass: PlayerClass | null;
  isFounder: boolean;
  xp: number;
  level: number;
}

const CLASS_COLORS: Record<string, string> = {
  assault: "#ff4655",
  scout: "#44aaff",
  support: "#ffcc44",
};

function HumanoidModel({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 1.0;
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.58, 0.76, 0.32]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[-0.44, 1.1, 0]}>
        <boxGeometry args={[0.19, 0.68, 0.19]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.44, 1.1, 0]}>
        <boxGeometry args={[0.19, 0.68, 0.19]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.19, 0.38, 0]}>
        <boxGeometry args={[0.21, 0.78, 0.21]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.19, 0.38, 0]}>
        <boxGeometry args={[0.21, 0.78, 0.21]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

interface MVPScreenProps {
  data: MVPData;
  onContinue: () => void;
}

export default function MVPScreen({ data, onContinue }: MVPScreenProps) {
  const [rrProgress, setRrProgress] = useState(0);
  const [timer, setTimer] = useState(10);
  const rr = Math.max(0, data.kills * 20 - data.deaths * 5);
  const color = data.playerClass ? (CLASS_COLORS[data.playerClass] ?? "#ff4655") : "#ff4655";
  const xpGained = data.kills * 100;
  const xpForNext = data.level * 500;
  const xpProgress = Math.min(data.xp / xpForNext, 1);

  useEffect(() => {
    const t = setTimeout(() => setRrProgress(Math.min(rr / 100, 1)), 600);
    return () => clearTimeout(t);
  }, [rr]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(interval); onContinue(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onContinue]);

  return (
    <div className="mvp-screen">
      <div className="mvp-top-bar">
        <div className="mvp-title-badge">⭐ MVP</div>
        <div className="mvp-timer-text">{timer}s</div>
      </div>

      <div className="mvp-content">
        <div className="mvp-3d-view">
          <Canvas camera={{ position: [0, 1.2, 3.5], fov: 50 }} gl={{ alpha: true }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 3]} intensity={1.4} />
            <pointLight position={[-2, 2, -1]} color={color} intensity={1.2} />
            <HumanoidModel color={color} />
          </Canvas>
          <div className="mvp-glow" style={{ background: color }} />
        </div>

        <div className="mvp-info">
          <div className="mvp-username" style={{ color }}>
            {data.isFounder && <span className="mvp-founder-badge">🛡️ KURUCU · </span>}
            {data.username}
          </div>

          <div className="mvp-stats-grid">
            <div className="mvp-stat">
              <div className="mvp-stat-val" style={{ color }}>{data.kills}</div>
              <div className="mvp-stat-label">YOK ETME</div>
            </div>
            <div className="mvp-stat">
              <div className="mvp-stat-val">{data.deaths}</div>
              <div className="mvp-stat-label">DÜŞME</div>
            </div>
            <div className="mvp-stat">
              <div className="mvp-stat-val" style={{ color: "#44cc88" }}>+{xpGained}</div>
              <div className="mvp-stat-label">KAZANILAN XP</div>
            </div>
          </div>

          <div className="mvp-rr-section">
            <div className="mvp-rr-label">RÜTBE PUANI (RR)</div>
            <div className="mvp-rr-bar-track">
              <div
                className="mvp-rr-bar-fill"
                style={{ width: `${rrProgress * 100}%`, background: color, transition: "width 1.5s cubic-bezier(0.22,1,0.36,1)" }}
              />
              <div className="mvp-rr-bar-text">+{rr} RR</div>
            </div>
          </div>

          <div className="mvp-level-section">
            <div className="mvp-rr-label">SEVİYE {data.level} · {data.xp} / {xpForNext} XP</div>
            <div className="mvp-rr-bar-track">
              <div
                className="mvp-rr-bar-fill"
                style={{ width: `${xpProgress * 100}%`, background: "#44cc88", transition: "width 1.8s ease" }}
              />
            </div>
          </div>

          <button className="start-btn mvp-continue-btn" onClick={onContinue}>
            Lobiye Dön →
          </button>
        </div>
      </div>
    </div>
  );
}
