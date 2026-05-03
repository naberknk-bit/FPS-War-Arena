import { useRef, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INITIAL_RADIUS = 28;
const FINAL_RADIUS = 4;
const PHASE_DURATION = 45; // seconds per phase
const PHASES = 4;
const ZONE_DAMAGE_PER_SEC = 20;

interface BattleRoyaleProps {
  active: boolean;
  playerPos: THREE.Vector3;
  onDamage: (dmg: number) => void;
}

export function BattleRoyaleZone({ active, playerPos, onDamage }: BattleRoyaleProps) {
  const ringRef  = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const radiusRef = useRef(INITIAL_RADIUS);
  const lastDmgRef = useRef(0);

  useFrame((_, delta) => {
    if (!active) return;
    // Shrink radius
    const minRadius = FINAL_RADIUS;
    if (radiusRef.current > minRadius) {
      radiusRef.current = Math.max(minRadius, radiusRef.current - delta * (INITIAL_RADIUS - FINAL_RADIUS) / (PHASE_DURATION * PHASES));
    }
    const r = radiusRef.current;

    // Update ring geometry scale
    if (ringRef.current) {
      ringRef.current.scale.set(r / INITIAL_RADIUS, 1, r / INITIAL_RADIUS);
      (ringRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(Date.now() * 0.004) * 1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.set(r / INITIAL_RADIUS, 1, r / INITIAL_RADIUS);
    }

    // Damage player if outside zone
    const distXZ = Math.sqrt(playerPos.x ** 2 + playerPos.z ** 2);
    if (distXZ > r) {
      const now = Date.now();
      if (now - lastDmgRef.current > 1000) {
        lastDmgRef.current = now;
        onDamage(ZONE_DAMAGE_PER_SEC * delta * 5); // burst damage
      }
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* Zone boundary ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <torusGeometry args={[INITIAL_RADIUS, 0.5, 8, 128]} />
        <meshStandardMaterial
          color="#ff3333"
          emissive="#ff0000"
          emissiveIntensity={3}
          roughness={0}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Inner glow ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[INITIAL_RADIUS, 1.5, 4, 128]} />
        <meshStandardMaterial
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={1}
          roughness={0}
          transparent
          opacity={0.15}
        />
      </mesh>
      {/* Zone wall (cylinder) */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[INITIAL_RADIUS, INITIAL_RADIUS, 8, 64, 1, true]} />
        <meshStandardMaterial
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={0.5}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

interface BattleRoyaleHUDProps {
  active: boolean;
  onStop: () => void;
}

export function BattleRoyaleHUD({ active, onStop }: BattleRoyaleHUDProps) {
  const [timeLeft, setTimeLeft] = useState(PHASE_DURATION * PHASES);
  const [phase, setPhase] = useState(1);
  const [warning, setWarning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) { setTimeLeft(PHASE_DURATION * PHASES); setPhase(1); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = Math.max(0, t - 1);
        const elapsed = PHASE_DURATION * PHASES - next;
        setPhase(Math.min(PHASES, Math.floor(elapsed / PHASE_DURATION) + 1));
        setWarning(next % PHASE_DURATION <= 10);
        if (next === 0 && intervalRef.current) clearInterval(intervalRef.current);
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  if (!active) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="br-hud">
      <div className={`br-phase${warning ? " warning" : ""}`}>
        <span className="br-icon">🔴</span>
        <div className="br-info">
          <div className="br-title">BATTLE ROYALE — FAZ {phase}/{PHASES}</div>
          <div className="br-timer">{mins}:{secs.toString().padStart(2, "0")}</div>
          <div className="br-subtitle">Bölge Küçülüyor</div>
        </div>
      </div>
      {warning && <div className="br-warning-flash">⚠️ BÖLGE KAPANIYOR!</div>}
      <button className="br-stop-btn" onClick={onStop}>Battle Royale Durdur</button>
    </div>
  );
}
