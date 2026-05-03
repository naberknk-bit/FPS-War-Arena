import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

interface FounderShieldProps {
  visible: boolean;
  founderPresent: boolean;
}

export default function FounderShield({ visible, founderPresent }: FounderShieldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (founderPresent || visible) {
      groupRef.current.rotation.y += delta * 0.4;
    }
    if (ringRef.current) {
      (ringRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.5 + Math.sin(Date.now() * 0.002) * 1.5;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z += delta * 0.6;
    }
  });

  if (!visible && !founderPresent) return null;

  return (
    <group ref={groupRef} position={[0, 22, 0]}>
      {/* Outer glow ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8, 0.6, 16, 128]} />
        <meshStandardMaterial
          color="#ffdd00"
          emissive="#ffaa00"
          emissiveIntensity={3}
          roughness={0}
          metalness={1}
        />
      </mesh>
      {/* Inner spinning ring */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[6, 0.3, 8, 64]} />
        <meshStandardMaterial
          color="#ff8800"
          emissive="#ff6600"
          emissiveIntensity={4}
          roughness={0}
          metalness={1}
        />
      </mesh>
      {/* Shield emoji text */}
      <Text
        position={[0, 0, 0]}
        fontSize={6}
        anchorX="center"
        anchorY="middle"
        color="#ffdd00"
      >
        🛡️
      </Text>
      {/* KURUCU label */}
      <Text
        position={[0, -5, 0]}
        fontSize={1.4}
        anchorX="center"
        anchorY="middle"
        color="#ffdd00"
        font={undefined}
      >
        KURUCU
      </Text>
      {/* Point lights */}
      <pointLight color="#ffaa00" intensity={8} distance={30} decay={2} />
      <pointLight color="#ff6600" intensity={5} distance={20} decay={2} position={[0, -3, 0]} />
    </group>
  );
}
