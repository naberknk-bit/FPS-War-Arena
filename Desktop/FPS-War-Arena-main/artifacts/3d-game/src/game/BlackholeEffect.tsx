import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BlackholeProps {
  active: boolean;
  position?: [number, number, number];
}

export default function BlackholeEffect({ active, position = [0, 3, 0] }: BlackholeProps) {
  const diskRef   = useRef<THREE.Mesh>(null);
  const disk2Ref  = useRef<THREE.Mesh>(null);
  const ptsRef    = useRef<THREE.Points>(null);
  const glowRef   = useRef<THREE.Mesh>(null);
  const timeRef   = useRef(0);

  const COUNT = 300;
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 9;
      arr[i * 3]     = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (!active) return;
    timeRef.current += dt;
    const t = timeRef.current;
    if (diskRef.current)  diskRef.current.rotation.y  += dt * 2.8;
    if (disk2Ref.current) disk2Ref.current.rotation.y -= dt * 1.8;
    if (ptsRef.current)   { ptsRef.current.rotation.y += dt * 1.2; ptsRef.current.rotation.z += dt * 0.4; }
    if (glowRef.current)  {
      const s = 1 + Math.sin(t * 3) * 0.08;
      glowRef.current.scale.setScalar(s);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 4) * 0.06;
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      {/* event horizon */}
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial color="#6600cc" transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* accretion disk 1 */}
      <mesh ref={diskRef} rotation={[Math.PI / 8, 0, 0]}>
        <torusGeometry args={[4, 0.9, 16, 80]} />
        <meshBasicMaterial color="#9900ff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {/* accretion disk 2 */}
      <mesh ref={disk2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[6, 0.45, 16, 80]} />
        <meshBasicMaterial color="#4400aa" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* particle stream */}
      <points ref={ptsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#cc44ff" size={0.18} transparent opacity={0.85} depthWrite={false} />
      </points>
      <pointLight color="#8800ff" intensity={80} distance={40} decay={2} />
    </group>
  );
}
