import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FounderAuraProps {
  position: THREE.Vector3;
}

export default function FounderAura({ position }: FounderAuraProps) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);
  const orb   = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (ring1.current) {
      ring1.current.position.copy(position).add(new THREE.Vector3(0, 0.3, 0));
      ring1.current.rotation.y = t.current * 1.2;
      ring1.current.rotation.x = Math.sin(t.current * 0.7) * 0.3;
      (ring1.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + Math.sin(t.current * 2) * 0.5;
    }
    if (ring2.current) {
      ring2.current.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
      ring2.current.rotation.y = -t.current * 0.9;
      ring2.current.rotation.z = t.current * 0.5;
      (ring2.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.cos(t.current * 2.5) * 0.4;
    }
    if (ring3.current) {
      ring3.current.position.copy(position).add(new THREE.Vector3(0, 1.3, 0));
      ring3.current.rotation.y = t.current * 1.8;
      ring3.current.rotation.x = t.current * 0.3;
      (ring3.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t.current * 3) * 0.5;
    }
    if (orb.current) {
      orb.current.position.copy(position).add(new THREE.Vector3(0, 1.0, 0));
      const s = 1 + Math.sin(t.current * 2) * 0.08;
      orb.current.scale.set(s, s, s);
      (orb.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t.current * 2) * 0.3;
    }
  });

  return (
    <>
      {/* Outer energy rings */}
      <mesh ref={ring1}>
        <torusGeometry args={[0.9, 0.04, 8, 48]} />
        <meshStandardMaterial color="#ff4655" emissive="#ff4655" emissiveIntensity={1.5} transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[0.7, 0.03, 8, 48]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={1.2} transparent opacity={0.75} />
      </mesh>
      <mesh ref={ring3}>
        <torusGeometry args={[0.5, 0.025, 8, 48]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ffcc44" emissiveIntensity={1.0} transparent opacity={0.7} />
      </mesh>
      {/* Center orb */}
      <mesh ref={orb}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#ff2030" emissive="#ff2030" emissiveIntensity={0.7} transparent opacity={0.5} />
      </mesh>
      {/* Ground glow */}
      <pointLight position={[position.x, position.y + 0.3, position.z]} color="#ff4655" intensity={2.5} distance={4} />
    </>
  );
}
