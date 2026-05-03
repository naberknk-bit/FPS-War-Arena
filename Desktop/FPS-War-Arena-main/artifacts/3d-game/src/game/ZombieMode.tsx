import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "socket.io-client";

interface ZombieModeProps {
  active: boolean;
  socket: Socket | null;
}

interface ZombiePortalProps {
  position: [number, number, number];
  color: string;
}

function ZombiePortal({ position, color }: ZombiePortalProps) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (outerRef.current) outerRef.current.rotation.z += delta * 1.5;
    if (innerRef.current) {
      innerRef.current.rotation.z -= delta * 2.0;
      (innerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        3 + Math.sin(Date.now() * 0.005) * 2;
    }
  });

  return (
    <group position={position}>
      {/* Portal frame */}
      <mesh ref={outerRef}>
        <torusGeometry args={[2, 0.3, 8, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} roughness={0} />
      </mesh>
      <mesh ref={innerRef}>
        <torusGeometry args={[1.5, 0.15, 6, 32]} />
        <meshStandardMaterial color="#220000" emissive="#440000" emissiveIntensity={3} roughness={0} />
      </mesh>
      {/* Portal fill */}
      <mesh>
        <circleGeometry args={[1.8, 32]} />
        <meshStandardMaterial
          color="#110000"
          emissive="#220000"
          emissiveIntensity={2}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight color={color} intensity={8} distance={12} decay={2} />
      {/* Eerie ground fog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <circleGeometry args={[5, 16]} />
        <meshStandardMaterial color="#110000" emissive="#330000" emissiveIntensity={1} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

export function ZombiePortalScene({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group>
      <ZombiePortal position={[-18, 1.8, 0]} color="#88ff00" />
      <ZombiePortal position={[18, 1.8, 0]} color="#00ff44" />
      <ZombiePortal position={[0, 1.8, -18]} color="#aaffaa" />
      {/* Eerie ambient light */}
      <pointLight position={[-18, 2, 0]} color="#88ff00" intensity={5} distance={20} decay={2} />
      <pointLight position={[18, 2, 0]} color="#00ff44" intensity={5} distance={20} decay={2} />
    </group>
  );
}

interface ZombieHUDProps {
  active: boolean;
  socket: Socket | null;
  onStop: () => void;
}

export function ZombieHUD({ active, socket, onStop }: ZombieHUDProps) {
  const [wave, setWave] = useState(1);
  const [zombiesLeft, setZombiesLeft] = useState(10);
  const [showWarning, setShowWarning] = useState(true);
  const [phase, setPhase] = useState<"portal"|"wave"|"clear">("portal");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) { setWave(1); setZombiesLeft(10); setPhase("portal"); setShowWarning(true); return; }

    // Phase 1: Portal open warning
    setPhase("portal");
    setShowWarning(true);
    timerRef.current = setTimeout(() => {
      setPhase("wave");
      setShowWarning(false);
      // Simulate zombie kills
      let remaining = 10;
      const killInterval = setInterval(() => {
        remaining = Math.max(0, remaining - Math.floor(Math.random() * 3 + 1));
        setZombiesLeft(remaining);
        if (remaining <= 0) {
          clearInterval(killInterval);
          setPhase("clear");
          setWave(w => w + 1);
          // Next wave
          timerRef.current = setTimeout(() => {
            setPhase("portal");
            setZombiesLeft(prev => prev + 5);
            setShowWarning(true);
          }, 5000);
        }
      }, 3000);
    }, 5000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active]);

  useEffect(() => {
    if (!active || !socket) return;
    const onZombieKill = () => setZombiesLeft(z => Math.max(0, z - 1));
    socket.on("zombie_killed", onZombieKill);
    return () => { socket.off("zombie_killed", onZombieKill); };
  }, [active, socket]);

  if (!active) return null;

  return (
    <div className="zombie-hud">
      {phase === "portal" && showWarning && (
        <div className="zombie-warning">
          <div className="zombie-warning-icon">🧟</div>
          <div className="zombie-warning-text">PORTAL AÇILIYOR!</div>
          <div className="zombie-warning-sub">Zombie istilasına hazırlanın...</div>
        </div>
      )}
      <div className="zombie-status">
        <span className="zombie-wave-badge">DALGA {wave}</span>
        <span className="zombie-left">{phase==="clear"?"✅ TEMİZLENDİ":`🧟 ${zombiesLeft} Zombie`}</span>
        <button className="zombie-stop-btn" onClick={onStop}>✕</button>
      </div>
    </div>
  );
}
