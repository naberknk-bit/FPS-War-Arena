import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Box, Plane, Sphere } from "@react-three/drei";
import * as THREE from "three";

const FLOOR_Y = 1.65;
const MOVE_SPEED = 6;
const GRAVITY = -18;
const JUMP_VEL = 6;

interface Zombie {
  id: number;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  phase: number;
}

function ZombieHorde({ zombies, setZombies, onKill }: {
  zombies: Zombie[];
  setZombies: React.Dispatch<React.SetStateAction<Zombie[]>>;
  onKill: (z: Zombie) => void;
}) {
  const { camera } = useThree();
  const lastShot = useRef(0);

  useEffect(() => {
    const shoot = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - lastShot.current < 180) return;
      lastShot.current = now;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const ray = new THREE.Raycaster(camera.position.clone(), dir);
      setZombies(prev => {
        let killed: Zombie | null = null;
        const next = prev.map(z => {
          if (!z.alive) return z;
          const box = new THREE.Box3(
            new THREE.Vector3(z.pos.x - 0.45, 0, z.pos.z - 0.45),
            new THREE.Vector3(z.pos.x + 0.45, 2.0, z.pos.z + 0.45)
          );
          if (ray.ray.intersectsBox(box)) {
            const newHp = z.hp - 34;
            if (newHp <= 0) { killed = { ...z, hp: 0, alive: false }; return { ...z, hp: 0, alive: false }; }
            return { ...z, hp: newHp };
          }
          return z;
        });
        if (killed) onKill(killed);
        return next;
      });
    };
    document.addEventListener("mousedown", shoot);
    return () => document.removeEventListener("mousedown", shoot);
  }, [camera, setZombies, onKill]);

  useFrame((_, delta) => {
    setZombies(prev => prev.map(z => {
      if (!z.alive) return z;
      const toPlayer = camera.position.clone().sub(z.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist < 1.2) return z;
      toPlayer.normalize();
      const speed = 2.5 + Math.sin(z.phase) * 0.3;
      z.pos.addScaledVector(toPlayer, speed * delta);
      return { ...z, phase: z.phase + delta * 4 };
    }));
  });

  return null;
}

function ZombieModel({ z }: { z: Zombie }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.position.copy(z.pos);
      ref.current.position.y = 0;
      ref.current.rotation.y += delta * 0.5;
    }
  });
  return (
    <group ref={ref}>
      <Box args={[0.8, 1.2, 0.5]} position={[0, 0.7, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" roughness={0.7} emissive="#115511" emissiveIntensity={0.5} />
      </Box>
      <Box args={[0.55, 0.55, 0.55]} position={[0, 1.55, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" roughness={0.7} emissive="#115511" emissiveIntensity={0.4} />
      </Box>
      <Sphere args={[0.08]} position={[0.14, 1.62, 0.28]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
      </Sphere>
      <Sphere args={[0.08]} position={[-0.14, 1.62, 0.28]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
      </Sphere>
      <Box args={[0.18, 0.8, 0.18]} position={[0.5, 0.8, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" emissive="#115511" emissiveIntensity={0.3} />
      </Box>
      <Box args={[0.18, 0.8, 0.18]} position={[-0.5, 0.8, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" emissive="#115511" emissiveIntensity={0.3} />
      </Box>
      <Box args={[0.18, 0.75, 0.18]} position={[0.2, 0.1, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" emissive="#115511" emissiveIntensity={0.3} />
      </Box>
      <Box args={[0.18, 0.75, 0.18]} position={[-0.2, 0.1, 0]} castShadow>
        <meshStandardMaterial color="#22aa22" emissive="#115511" emissiveIntensity={0.3} />
      </Box>
      <mesh position={[0, 2.05, 0]}>
        <planeGeometry args={[0.8, 0.07]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.4 + (z.hp / 100) * 0.4, 2.05, 0.01]}>
        <planeGeometry args={[(z.hp / 100) * 0.8, 0.07]} />
        <meshStandardMaterial color="#44ff88" emissive="#44ff88" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function SurvivalMap() {
  return (
    <>
      <Plane args={[80, 80]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#0a1a0a" roughness={0.95} />
      </Plane>
      {[-40, 40].map(x => (
        <Box key={`wx${x}`} args={[1, 8, 80]} position={[x, 4, 0]}>
          <meshStandardMaterial color="#0d1a0d" roughness={0.9} />
        </Box>
      ))}
      {[-40, 40].map(z => (
        <Box key={`wz${z}`} args={[80, 8, 1]} position={[0, 4, z]}>
          <meshStandardMaterial color="#0d1a0d" roughness={0.9} />
        </Box>
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 18;
        return (
          <Box key={`b${i}`} args={[3, 4, 3]} position={[Math.cos(angle) * r, 2, Math.sin(angle) * r]}>
            <meshStandardMaterial color="#112211" roughness={0.8} />
          </Box>
        );
      })}
      <ambientLight intensity={0.25} color="#003300" />
      <pointLight position={[0, 6, 0]} intensity={3} color="#44ff44" distance={30} decay={2} />
      <pointLight position={[15, 4, 0]} intensity={1.5} color="#228822" distance={20} decay={2} />
      <pointLight position={[-15, 4, 0]} intensity={1.5} color="#228822" distance={20} decay={2} />
      <pointLight position={[0, 4, 15]} intensity={1.5} color="#226622" distance={20} decay={2} />
      <pointLight position={[0, 4, -15]} intensity={1.5} color="#226622" distance={20} decay={2} />
      <fog attach="fog" args={["#030f03", 20, 55]} />
    </>
  );
}

function PlayerController({ hp, onDamage }: { hp: number; onDamage: () => void; }) {
  const { camera } = useThree();
  const velY = useRef(0);
  const onGround = useRef(true);
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });

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
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -38, 38);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -38, 38);
  });

  return null;
}

let _idCounter = 1;

function spawnWave(wave: number): Zombie[] {
  const count = Math.min(5 + wave * 3, 30);
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const r = 25 + Math.random() * 10;
    return {
      id: _idCounter++,
      pos: new THREE.Vector3(Math.cos(angle) * r, 0.8, Math.sin(angle) * r),
      hp: 100,
      alive: true,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

export default function ZombieSurvivalGame({ onBack }: { onBack: () => void }) {
  const [zombies, setZombies] = useState<Zombie[]>(() => spawnWave(1));
  const [wave, setWave] = useState(1);
  const [kills, setKills] = useState(0);
  const [hp, setHp] = useState(100);
  const [locked, setLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);

  useEffect(() => {
    const alive = zombies.filter(z => z.alive).length;
    if (alive === 0 && zombies.length > 0) {
      const next = wave + 1;
      setWave(next);
      setTimeout(() => setZombies(spawnWave(next)), 1800);
    }
  }, [zombies, wave]);

  const handleKill = useCallback((z: Zombie) => {
    setKills(k => k + 1);
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 80);
  }, []);

  const aliveCount = zombies.filter(z => z.alive).length;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#030f03", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "rgba(0,0,0,0.75)", borderBottom: "1px solid rgba(68,255,68,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(68,255,68,0.1)", border: "1px solid #44ff44", color: "#44ff44", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", letterSpacing: "0.1em" }}>← PORTAL</button>
          <div style={{ color: "#44ff88", fontWeight: 900, fontSize: "1rem", letterSpacing: "0.2em" }}>🧟 ZOMBİ HAYATİ</div>
        </div>
        <div style={{ display: "flex", gap: 24, color: "#fff", fontSize: "0.85rem", alignItems: "center" }}>
          <div><span style={{ color: "#aaa" }}>Dalga:</span> <strong style={{ color: "#ffcc44" }}>{wave}</strong></div>
          <div><span style={{ color: "#aaa" }}>Zombi:</span> <strong style={{ color: "#44ff88" }}>{aliveCount}</strong></div>
          <div><span style={{ color: "#aaa" }}>Öldürme:</span> <strong style={{ color: "#ff4655" }}>{kills}</strong></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#aaa" }}>HP:</span>
            <div style={{ width: 80, height: 10, background: "#333", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${hp}%`, height: "100%", background: hp > 50 ? "#44ff44" : hp > 25 ? "#ffcc44" : "#ff4655", borderRadius: 5, transition: "width 0.3s" }} />
            </div>
            <strong style={{ color: hp > 50 ? "#44ff44" : "#ff4655" }}>{hp}</strong>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 10 }}>
        <div style={{ width: 3, height: 20, background: "#44ff88", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <div style={{ height: 3, width: 20, background: "#44ff88", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <div style={{ width: 6, height: 6, border: "2px solid #44ff88", borderRadius: "50%", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      </div>

      {hitFlash && <div style={{ position: "absolute", inset: 0, background: "rgba(68,255,68,0.15)", pointerEvents: "none", zIndex: 5 }} />}

      {!locked && !gameOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, background: "rgba(0,0,0,0.75)" }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🧟</div>
            <div style={{ fontSize: "1.8rem", marginBottom: 12, color: "#44ff88", fontWeight: 900, letterSpacing: "0.2em" }}>ZOMBİ HAYATİ</div>
            <div style={{ color: "#aaa", marginBottom: 8, fontSize: "0.9rem" }}>WASD = Hareket · Boşluk = Zıpla · Sol Tık = Ateş</div>
            <div style={{ color: "#666", marginBottom: 24, fontSize: "0.78rem" }}>Zombileri öldür · Dalgalar gitgide zorlaşır</div>
            <div style={{ background: "#44ff44", color: "#000", border: "none", borderRadius: 8, padding: "14px 40px", fontSize: "1.1rem", fontWeight: 900, cursor: "pointer", letterSpacing: "0.15em" }}
              onClick={() => { setLocked(true); }}>
              TIKLA — BAŞLAT
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, background: "rgba(0,0,0,0.85)" }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>💀</div>
            <div style={{ fontSize: "2rem", marginBottom: 12, color: "#ff4655", fontWeight: 900 }}>ÖLDÜN</div>
            <div style={{ color: "#aaa", marginBottom: 8 }}>Dalga: {wave} · Öldürme: {kills}</div>
            <button onClick={() => { setHp(100); setKills(0); setWave(1); setZombies(spawnWave(1)); setGameOver(false); }}
              style={{ background: "#44ff44", color: "#000", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: "1rem", fontWeight: 900, cursor: "pointer", marginRight: 12 }}>
              YENİDEN BAŞLA
            </button>
            <button onClick={onBack}
              style={{ background: "rgba(255,70,85,0.15)", color: "#ff4655", border: "1px solid #ff4655", borderRadius: 8, padding: "12px 32px", fontSize: "1rem", cursor: "pointer" }}>
              PORTAL'A DÖN
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ fov: 75, position: [0, FLOOR_Y, 0] }} style={{ position: "absolute", inset: 0 }} shadows>
        <SurvivalMap />
        {zombies.map(z => z.alive && <ZombieModel key={z.id} z={z} />)}
        <ZombieHorde zombies={zombies} setZombies={setZombies} onKill={handleKill} />
        <PlayerController hp={hp} onDamage={() => setHp(h => Math.max(0, h - 10))} />
      </Canvas>
    </div>
  );
}
