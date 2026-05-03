import { useRef, useEffect, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "socket.io-client";

interface Spray {
  id: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  isFounder: boolean;
  username: string;
  createdAt: number;
}

interface SpraySystemProps {
  socket: Socket | null;
  isFounder: boolean;
  username: string;
  chatFocused: boolean;
  roomId: string | null;
  mobileMode: boolean;
}

let _sprayId = 0;

export default function SpraySystem({ socket, isFounder, username, chatFocused, roomId, mobileMode }: SpraySystemProps) {
  const { camera, scene } = useThree();
  const [sprays, setSprays] = useState<Spray[]>([]);
  const chatRef = useRef(chatFocused);
  chatRef.current = chatFocused;
  const raycaster = useRef(new THREE.Raycaster());
  const center = useRef(new THREE.Vector2(0, 0));

  const placeSpray = () => {
    raycaster.current.setFromCamera(center.current, camera);
    const hits = raycaster.current.intersectObjects(scene.children, true);
    if (hits.length === 0) return;
    const hit = hits[0];
    const spray: Spray = {
      id: ++_sprayId,
      position: hit.point.clone().addScaledVector(hit.face?.normal ?? new THREE.Vector3(0, 1, 0), 0.02),
      normal: hit.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0),
      isFounder,
      username,
      createdAt: Date.now(),
    };
    setSprays((prev) => [...prev.slice(-10), spray]);
    socket?.emit("spray", { x: spray.position.x, y: spray.position.y, z: spray.position.z, nx: spray.normal.x, ny: spray.normal.y, nz: spray.normal.z, isFounder, username, roomId });
    setTimeout(() => setSprays((prev) => prev.filter((s) => s.id !== spray.id)), 30000);
  };

  useEffect(() => {
    if (mobileMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (chatRef.current) return;
      if (e.code === "KeyT") { e.preventDefault(); placeSpray(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMode, placeSpray]);

  useEffect(() => {
    if (!socket) return;
    const onSpray = (data: { x: number; y: number; z: number; nx: number; ny: number; nz: number; isFounder: boolean; username: string }) => {
      const spray: Spray = {
        id: ++_sprayId,
        position: new THREE.Vector3(data.x, data.y, data.z),
        normal: new THREE.Vector3(data.nx, data.ny, data.nz),
        isFounder: data.isFounder,
        username: data.username,
        createdAt: Date.now(),
      };
      setSprays((prev) => [...prev.slice(-10), spray]);
      setTimeout(() => setSprays((prev) => prev.filter((s) => s.id !== spray.id)), 30000);
    };
    socket.on("spray_placed", onSpray);
    return () => { socket.off("spray_placed", onSpray); };
  }, [socket]);

  return (
    <>
      {sprays.map((spray) => (
        <SprayDecal key={spray.id} spray={spray} />
      ))}
    </>
  );
}

function SprayDecal({ spray }: { spray: Spray }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Orient the plane to face the normal
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = spray.normal.clone().normalize();
  if (Math.abs(normal.dot(up)) > 0.99) {
    quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  } else {
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current && spray.isFounder) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(timeRef.current * 3) * 0.4;
    }
  });

  if (spray.isFounder) {
    return (
      <mesh ref={meshRef} position={spray.position} quaternion={quaternion}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial color="#ffd700" emissive="#ff8800" emissiveIntensity={1} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} position={spray.position} quaternion={quaternion}>
      <circleGeometry args={[0.35, 16]} />
      <meshStandardMaterial color="#ff4655" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}
