import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface WeaponProps {
  isFiring: boolean;
  isReloading: boolean;
  isMoving: boolean;
  nightMode?: boolean;
}

export default function Weapon({ isFiring, isReloading, isMoving, nightMode = false }: WeaponProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const kickRef = useRef(0);
  const swayTimeRef = useRef(0);
  const reloadProgressRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (isReloading) {
      reloadProgressRef.current = Math.min(reloadProgressRef.current + delta / 2.0, 1);
    } else {
      reloadProgressRef.current = 0;
    }

    if (isFiring) kickRef.current = 0.1;
    kickRef.current = Math.max(0, kickRef.current - delta * 5);

    if (isMoving) swayTimeRef.current += delta * 8;
    const swayX = isMoving ? Math.sin(swayTimeRef.current) * 0.012 : 0;
    const swayY = isMoving ? Math.abs(Math.sin(swayTimeRef.current * 0.5)) * 0.008 : 0;

    const reloadDrop = isReloading ? Math.sin(reloadProgressRef.current * Math.PI) * 0.25 : 0;
    const reloadTilt = isReloading ? Math.sin(reloadProgressRef.current * Math.PI) * 0.6 : 0;

    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const dist = 0.5;
    const h = Math.tan((fov * Math.PI) / 360) * dist;
    const w = h * aspect;

    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion);
    groupRef.current.rotation.z = 0.05;
    groupRef.current.rotation.x = euler.x + kickRef.current * 0.4 + reloadTilt;
    groupRef.current.rotation.y = euler.y + 0.05;

    const offset = new THREE.Vector3(
      w * 0.55 + swayX,
      -h * 0.65 - kickRef.current * 0.06 - reloadDrop + swayY,
      -dist
    );
    offset.applyQuaternion(camera.quaternion);
    groupRef.current.position.copy(camera.position).add(offset);
  });

  const reloadAlpha = isReloading ? 0.5 : 1;

  // Night mode: neon emissive colors
  const bodyColor = nightMode ? "#0a0a1a" : "#1a1a1a";
  const bodyEmissive = nightMode ? "#0066ff" : "#000000";
  const bodyEmissiveInt = nightMode ? 0.6 : 0;

  const barrelColor = nightMode ? "#050510" : "#111";
  const barrelEmissive = nightMode ? "#00aaff" : "#000000";
  const barrelEmissiveInt = nightMode ? 0.8 : 0;

  const gripColor = nightMode ? "#0a0a18" : "#222";
  const gripEmissive = nightMode ? "#ff0066" : "#000000";
  const gripEmissiveInt = nightMode ? 0.5 : 0;

  return (
    <group ref={groupRef}>
      {/* Gun body */}
      <mesh>
        <boxGeometry args={[0.06, 0.055, 0.28]} />
        <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveInt} roughness={0.4} metalness={0.8} transparent opacity={reloadAlpha} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.01, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
        <meshStandardMaterial color={barrelColor} emissive={barrelEmissive} emissiveIntensity={barrelEmissiveInt} roughness={0.3} metalness={0.9} transparent opacity={reloadAlpha} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.055, 0.04]}>
        <boxGeometry args={[0.045, 0.09, 0.065]} />
        <meshStandardMaterial color={gripColor} emissive={gripEmissive} emissiveIntensity={gripEmissiveInt} roughness={0.7} metalness={0.3} transparent opacity={reloadAlpha} />
      </mesh>
      {/* Magazine */}
      <mesh position={[0, isReloading ? -0.15 - reloadProgressRef.current * 0.1 : -0.055, 0.04]}>
        <boxGeometry args={[0.035, 0.07, 0.055]} />
        <meshStandardMaterial color="#333" roughness={0.6} metalness={0.4} transparent opacity={isReloading ? Math.max(0, 1 - reloadProgressRef.current * 2) : 1} />
      </mesh>
      {/* Sight */}
      <mesh position={[0, 0.042, 0.02]}>
        <boxGeometry args={[0.008, 0.018, 0.025]} />
        <meshStandardMaterial color="#333" emissive={nightMode ? "#00ff88" : "#000"} emissiveIntensity={nightMode ? 1 : 0} roughness={0.5} metalness={0.7} transparent opacity={reloadAlpha} />
      </mesh>
      {/* Muzzle flash */}
      {isFiring && !isReloading && (
        <mesh position={[0, 0.01, -0.32]}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshStandardMaterial color="#ffcc44" emissive={nightMode ? "#00ffff" : "#ff8800"} emissiveIntensity={3} transparent opacity={0.9} />
        </mesh>
      )}
      {/* Night mode: neon edge light */}
      {nightMode && (
        <pointLight position={[0, 0, -0.1]} color="#0066ff" intensity={0.5} distance={0.5} />
      )}
    </group>
  );
}
