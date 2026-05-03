import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Box, Plane, Sphere } from "@react-three/drei";
import * as THREE from "three";

const MOVE_SPEED = 7;
const GRAVITY = -18;
const JUMP_VEL = 6;
const FLOOR_Y = 1.65;

interface BotEnemy {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  alive: boolean;
  color: string;
}

function Arena() {
  return (
    <>
      <Plane args={[60, 60]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </Plane>
      {[-30, 30].map((x) => (
        <Box key={`wall-x-${x}`} args={[1, 6, 60]} position={[x, 3, 0]} castShadow>
          <meshStandardMaterial color="#2a0a14" roughness={0.8} />
        </Box>
      ))}
      {[-30, 30].map((z) => (
        <Box key={`wall-z-${z}`} args={[60, 6, 1]} position={[0, 3, z]} castShadow>
          <meshStandardMaterial color="#2a0a14" roughness={0.8} />
        </Box>
      ))}
      {[
        [8, 1.5, 5], [-8, 1.5, -5], [0, 1.5, -12], [12, 1.5, -8],
        [-12, 1.5, 8], [5, 1.5, 15], [-5, 1.5, -15],
      ].map(([x, y, z], i) => (
        <Box key={i} args={[4, 3, 4]} position={[x, y, z]} castShadow>
          <meshStandardMaterial color="#1a0a1a" roughness={0.7} metalness={0.2} />
        </Box>
      ))}
      <ambientLight intensity={0.4} color="#220011" />
      <pointLight position={[0, 8, 0]} intensity={2} color="#ff4655" distance={40} />
      <pointLight position={[15, 6, 15]} intensity={1.5} color="#4444ff" distance={30} />
      <pointLight position={[-15, 6, -15]} intensity={1.5} color="#44ff88" distance={30} />
      <pointLight position={[15, 6, -15]} intensity={1} color="#ffaa44" distance={25} />
      <pointLight position={[-15, 6, 15]} intensity={1} color="#aa44ff" distance={25} />
    </>
  );
}

function BotMesh({ pos, color, hp }: { pos: THREE.Vector3; color: string; hp: number }) {
  const meshRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(pos);
      meshRef.current.position.y = 0.8;
    }
  });
  return (
    <group ref={meshRef}>
      <Box args={[0.7, 1.6, 0.7]} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} emissive={color} emissiveIntensity={0.3} />
      </Box>
      <Box args={[0.5, 0.5, 0.5]} position={[0, 1.05, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} emissive={color} emissiveIntensity={0.5} />
      </Box>
      <Sphere args={[0.1]} position={[0.15, 1.2, 0.26]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </Sphere>
      <Sphere args={[0.1]} position={[-0.15, 1.2, 0.26]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </Sphere>
      <mesh position={[0, 2.0, 0]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[-0.4 + (hp / 100) * 0.4, 2.0, 0.01]}>
        <planeGeometry args={[(hp / 100) * 0.8, 0.08]} />
        <meshStandardMaterial color="#ff4655" emissive="#ff4655" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function FPSController({ bots, setBots, onKill, onHit, kills }: {
  bots: BotEnemy[];
  setBots: React.Dispatch<React.SetStateAction<BotEnemy[]>>;
  onKill: () => void;
  onHit: () => void;
  kills: number;
}) {
  const { camera } = useThree();
  const velY = useRef(0);
  const onGround = useRef(true);
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });
  const lastShot = useRef(0);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = true;
      if (e.code === "KeyA") keys.current.a = true;
      if (e.code === "KeyS") keys.current.s = true;
      if (e.code === "KeyD") keys.current.d = true;
      if (e.code === "Space") keys.current.space = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = false;
      if (e.code === "KeyA") keys.current.a = false;
      if (e.code === "KeyS") keys.current.s = false;
      if (e.code === "KeyD") keys.current.d = false;
      if (e.code === "Space") keys.current.space = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const shoot = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - lastShot.current < 200) return;
      lastShot.current = now;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const ray = new THREE.Raycaster(camera.position.clone(), dir);
      let hitAny = false;
      setBots(prev => prev.map(b => {
        if (!b.alive) return b;
        const box = new THREE.Box3(
          new THREE.Vector3(b.pos.x - 0.35, 0, b.pos.z - 0.35),
          new THREE.Vector3(b.pos.x + 0.35, 1.8, b.pos.z + 0.35)
        );
        if (ray.ray.intersectsBox(box)) {
          hitAny = true;
          const newHp = b.hp - 25;
          if (newHp <= 0) { onKill(); return { ...b, hp: 0, alive: false }; }
          return { ...b, hp: newHp };
        }
        return b;
      }));
      if (hitAny) onHit();
    };
    document.addEventListener("mousedown", shoot);
    return () => document.removeEventListener("mousedown", shoot);
  }, [camera, setBots, onKill, onHit]);

  useFrame((_, delta) => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (keys.current.w) move.addScaledVector(dir, 1);
    if (keys.current.s) move.addScaledVector(dir, -1);
    if (keys.current.a) move.addScaledVector(right, -1);
    if (keys.current.d) move.addScaledVector(right, 1);
    if (move.lengthSq() > 0) { move.normalize(); camera.position.addScaledVector(move, MOVE_SPEED * delta); }
    if (keys.current.space && onGround.current) { velY.current = JUMP_VEL; onGround.current = false; }
    velY.current += GRAVITY * delta;
    camera.position.y += velY.current * delta;
    if (camera.position.y <= FLOOR_Y) { camera.position.y = FLOOR_Y; velY.current = 0; onGround.current = true; }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -28, 28);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -28, 28);
    setBots(prev => prev.map(b => {
      if (!b.alive) return b;
      const toPlayer = camera.position.clone().sub(b.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist < 1.5) return b;
      toPlayer.normalize();
      b.pos.addScaledVector(toPlayer, 2.5 * delta);
      return { ...b };
    }));
  });

  return null;
}

function Crosshair() {
  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 10 }}>
      <div style={{ width: 20, height: 2, background: "#ff4655", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      <div style={{ height: 20, width: 2, background: "#ff4655", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
    </div>
  );
}

const BOT_COLORS = ["#ff4444", "#ff8800", "#cc44ff", "#44aaff", "#ff44aa"];

function spawnBots(wave: number): BotEnemy[] {
  const count = 3 + wave * 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = 18 + Math.random() * 6;
    return {
      id: Date.now() + i,
      pos: new THREE.Vector3(Math.cos(angle) * r, 0.8, Math.sin(angle) * r),
      vel: new THREE.Vector3(),
      hp: 100,
      alive: true,
      color: BOT_COLORS[i % BOT_COLORS.length],
    };
  });
}

export default function BattleArenaGame({ onBack }: { onBack: () => void }) {
  const [bots, setBots] = useState<BotEnemy[]>(() => spawnBots(1));
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [hitFlash, setHitFlash] = useState(false);
  const [locked, setLocked] = useState(false);

  const handleKill = useCallback(() => {
    setKills(k => k + 1);
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 80);
  }, []);

  const handleHit = useCallback(() => {
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 60);
  }, []);

  useEffect(() => {
    const alive = bots.filter(b => b.alive).length;
    if (alive === 0 && bots.length > 0) {
      const nextWave = wave + 1;
      setWave(nextWave);
      setTimeout(() => setBots(spawnBots(nextWave)), 1500);
    }
  }, [bots, wave]);

  const aliveCount = bots.filter(b => b.alive).length;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#08080f", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "rgba(0,0,0,0.7)", borderBottom: "1px solid rgba(255,70,85,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,70,85,0.15)", border: "1px solid #ff4655", color: "#ff4655", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", letterSpacing: "0.1em" }}>← PORTAL</button>
          <div style={{ color: "#ff4655", fontWeight: 900, fontSize: "1rem", letterSpacing: "0.2em" }}>⚔️ BATTLE ARENA</div>
        </div>
        <div style={{ display: "flex", gap: 24, color: "#fff", fontSize: "0.85rem" }}>
          <div><span style={{ color: "#aaa" }}>Dalga:</span> <strong style={{ color: "#ffcc44" }}>{wave}</strong></div>
          <div><span style={{ color: "#aaa" }}>Düşman:</span> <strong style={{ color: "#ff4655" }}>{aliveCount}</strong></div>
          <div><span style={{ color: "#aaa" }}>Öldürme:</span> <strong style={{ color: "#44ff88" }}>{kills}</strong></div>
        </div>
      </div>

      <Crosshair />
      {hitFlash && <div style={{ position: "absolute", inset: 0, background: "rgba(255,70,85,0.18)", pointerEvents: "none", zIndex: 5 }} />}

      {!locked && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, background: "rgba(0,0,0,0.6)" }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "2rem", marginBottom: 16, color: "#ff4655", fontWeight: 900, letterSpacing: "0.2em" }}>⚔️ BATTLE ARENA</div>
            <div style={{ color: "#aaa", marginBottom: 24, fontSize: "0.9rem" }}>WASD = Hareket · Boşluk = Zıpla · Fare = Nişan al ve ateş et</div>
            <div style={{ background: "#ff4655", color: "#fff", border: "none", borderRadius: 8, padding: "14px 40px", fontSize: "1.1rem", fontWeight: 900, cursor: "pointer", letterSpacing: "0.15em" }}
              onClick={() => { setLocked(true); }}>
              TIKLA — BAŞLAT
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ fov: 75, position: [0, FLOOR_Y, 0] }} style={{ position: "absolute", inset: 0 }} shadows>
        <Arena />
        {bots.map(b => b.alive && <BotMesh key={b.id} pos={b.pos} color={b.color} hp={b.hp} />)}
        <FPSController bots={bots} setBots={setBots} onKill={handleKill} onHit={handleHit} kills={kills} />
      </Canvas>
    </div>
  );
}
