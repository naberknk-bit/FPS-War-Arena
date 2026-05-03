import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type EntityType = "robot" | "dragon";

interface SpawnedEntityProps {
  type: EntityType;
  position?: [number, number, number];
  onDespawn: () => void;
  lifetime?: number;
}

function RobotMesh() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += dt * 0.7;
    groupRef.current.position.y = 1.2 + Math.sin(Date.now() * 0.0015) * 0.3;
  });
  return (
    <group ref={groupRef} scale={[3, 3, 3]}>
      {/* torso */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshStandardMaterial color="#444466" metalness={0.9} roughness={0.2} emissive="#0022ff" emissiveIntensity={0.3} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.4, 0.35, 0.35]} />
        <meshStandardMaterial color="#333355" metalness={0.9} roughness={0.15} emissive="#00aaff" emissiveIntensity={0.5} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.1, 0.68, 0.18]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>
      <mesh position={[0.1, 0.68, 0.18]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>
      {/* left arm */}
      <mesh position={[-0.45, 0.05, 0]}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color="#555577" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* right arm */}
      <mesh position={[0.45, 0.05, 0]}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color="#555577" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.17, -0.65, 0]}>
        <boxGeometry args={[0.2, 0.55, 0.2]} />
        <meshStandardMaterial color="#333355" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.17, -0.65, 0]}>
        <boxGeometry args={[0.2, 0.55, 0.2]} />
        <meshStandardMaterial color="#333355" metalness={0.7} roughness={0.3} />
      </mesh>
      <pointLight color="#0066ff" intensity={6} distance={8} decay={2} />
    </group>
  );
}

function DragonMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const wingLRef = useRef<THREE.Mesh>(null);
  const wingRRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += dt * 0.5;
    groupRef.current.position.y = 2 + Math.sin(Date.now() * 0.0012) * 0.8;
    if (wingLRef.current) wingLRef.current.rotation.z =  0.3 + Math.sin(Date.now() * 0.003) * 0.5;
    if (wingRRef.current) wingRRef.current.rotation.z = -0.3 - Math.sin(Date.now() * 0.003) * 0.5;
  });
  return (
    <group ref={groupRef} scale={[4, 4, 4]}>
      {/* body */}
      <mesh>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial color="#661100" metalness={0.2} roughness={0.7} emissive="#ff2200" emissiveIntensity={0.25} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 0.45, 0.25]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#550e00" />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.75, 0.45]}>
        <boxGeometry args={[0.28, 0.2, 0.4]} />
        <meshStandardMaterial color="#661100" emissive="#ff3300" emissiveIntensity={0.4} />
      </mesh>
      {/* left wing */}
      <mesh ref={wingLRef} position={[-0.6, 0.2, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.08, 0.9, 4]} />
        <meshStandardMaterial color="#882200" side={THREE.DoubleSide} transparent opacity={0.88} />
      </mesh>
      {/* right wing */}
      <mesh ref={wingRRef} position={[0.6, 0.2, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.08, 0.9, 4]} />
        <meshStandardMaterial color="#882200" side={THREE.DoubleSide} transparent opacity={0.88} />
      </mesh>
      {/* tail */}
      <mesh position={[0, -0.2, -0.55]} rotation={[0.6, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#550e00" />
      </mesh>
      <pointLight color="#ff3300" intensity={8} distance={10} decay={2} />
    </group>
  );
}

export default function SpawnedEntity({ type, position = [0, 0, 0], onDespawn, lifetime = 30 }: SpawnedEntityProps) {
  const birthRef = useRef(Date.now());
  useFrame(() => {
    if ((Date.now() - birthRef.current) / 1000 > lifetime) onDespawn();
  });
  return (
    <group position={position}>
      {type === "robot"  ? <RobotMesh  /> : <DragonMesh />}
    </group>
  );
}
