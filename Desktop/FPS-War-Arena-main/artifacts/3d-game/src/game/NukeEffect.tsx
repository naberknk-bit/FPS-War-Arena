import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface NukeEffectProps {
  active: boolean;
  onComplete: () => void;
}

export default function NukeEffect({ active, onComplete }: NukeEffectProps) {
  const ring1Ref  = useRef<THREE.Mesh>(null);
  const ring2Ref  = useRef<THREE.Mesh>(null);
  const flashRef  = useRef<THREE.Mesh>(null);
  const pillarRef = useRef<THREE.Mesh>(null);
  const prog = useRef(0);
  const done = useRef(false);

  useEffect(() => { if (active) { prog.current = 0; done.current = false; } }, [active]);

  useFrame((_, dt) => {
    if (!active || done.current) return;
    prog.current += dt * 0.45;
    const p = prog.current;

    if (ring1Ref.current) {
      const s = p * 80;
      ring1Ref.current.scale.set(s, s, s);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p * 0.6);
    }
    if (ring2Ref.current) {
      const s = p * 45;
      ring2Ref.current.scale.set(s, s, s);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - p * 0.5);
    }
    if (flashRef.current) {
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - p * 1.8);
    }
    if (pillarRef.current) {
      const h = Math.min(p * 60, 40);
      pillarRef.current.scale.set(1, h, 1);
      pillarRef.current.position.y = h / 2;
      (pillarRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - p * 0.4);
    }
    if (p >= 2.2 && !done.current) { done.current = true; onComplete(); }
  });

  const ringGeo = useMemo(() => new THREE.RingGeometry(0.88, 1, 64), []);

  if (!active) return null;

  return (
    <group position={[0, 0.05, 0]}>
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={ringGeo} />
        <meshBasicMaterial color="#ff6600" transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={ringGeo} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={pillarRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[2, 5, 1, 24, 1, true]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#ff6600" intensity={200} distance={80} decay={2} />
    </group>
  );
}
