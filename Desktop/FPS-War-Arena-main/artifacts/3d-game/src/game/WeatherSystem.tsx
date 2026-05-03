import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type WeatherType = "clear" | "rain" | "snow" | "sandstorm";

interface WeatherSystemProps {
  weather: WeatherType;
}

const RAIN_COUNT  = 3500;
const SNOW_COUNT  = 2000;
const SAND_COUNT  = 5500;
const AREA        = 60;
const RAIN_HEIGHT = 28;

const WEATHER_FOG: Record<WeatherType, { color: string; near: number; far: number; density: number }> = {
  clear:     { color: "#1a1c22", near: 30, far: 200, density: 0.006 },
  rain:      { color: "#2a3040", near: 8,  far: 55,  density: 0.03  },
  snow:      { color: "#c8d4e8", near: 10, far: 60,  density: 0.025 },
  sandstorm: { color: "#8a6030", near: 4,  far: 22,  density: 0.075 },
};

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

export default function WeatherSystem({ weather }: WeatherSystemProps) {
  const { scene } = useThree();
  const rainRef  = useRef<THREE.InstancedMesh>(null);
  const snowRef  = useRef<THREE.InstancedMesh>(null);
  const sandRef  = useRef<THREE.InstancedMesh>(null);

  // Particle data: [x, y, z, speed, phase, drift]
  const rainData = useMemo(() => Array.from({ length: RAIN_COUNT }, () => [
    rand(-AREA, AREA), rand(-2, RAIN_HEIGHT), rand(-AREA, AREA),
    rand(18, 28), 0, rand(-0.3, 0.3),
  ]), []);
  const snowData = useMemo(() => Array.from({ length: SNOW_COUNT }, () => [
    rand(-AREA, AREA), rand(-2, RAIN_HEIGHT), rand(-AREA, AREA),
    rand(0.8, 2.2), rand(0, Math.PI * 2), rand(-0.5, 0.5),
  ]), []);
  const sandData = useMemo(() => Array.from({ length: SAND_COUNT }, () => [
    rand(-AREA, AREA), rand(0, 8), rand(-AREA, AREA),
    rand(18, 40), rand(0, Math.PI * 2), rand(-1.5, 1.5),
  ]), []);

  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const fogColor = useRef(new THREE.Color(WEATHER_FOG.clear.color));
  const fogNear  = useRef(WEATHER_FOG.clear.near);
  const fogFar   = useRef(WEATHER_FOG.clear.far);
  const elapsed  = useRef(0);

  // Initialize fog
  useEffect(() => {
    if (!scene.fog) scene.fog = new THREE.Fog(WEATHER_FOG.clear.color, 30, 200);
  }, [scene]);

  useFrame((_, dt) => {
    elapsed.current += dt;
    const t = elapsed.current;

    const target = WEATHER_FOG[weather];
    const tColor = new THREE.Color(target.color);
    fogColor.current.lerp(tColor, dt * 1.5);
    fogNear.current  = THREE.MathUtils.lerp(fogNear.current,  target.near, dt * 1.5);
    fogFar.current   = THREE.MathUtils.lerp(fogFar.current,   target.far,  dt * 1.5);

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(fogColor.current);
      scene.fog.near = fogNear.current;
      scene.fog.far  = fogFar.current;
    }

    // ── Rain ─────────────────────────────────────────────────────────
    const rm = rainRef.current;
    if (rm) {
      rm.visible = weather === "rain";
      if (weather === "rain") {
        for (let i = 0; i < RAIN_COUNT; i++) {
          const d = rainData[i];
          d[1] -= d[3] * dt;
          if (d[1] < -2) { d[1] = RAIN_HEIGHT; d[0] = rand(-AREA, AREA); d[2] = rand(-AREA, AREA); }
          d[0] += d[5] * dt; // wind drift
          dummy.position.set(d[0], d[1], d[2]);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          rm.setMatrixAt(i, dummy.matrix);
        }
        rm.instanceMatrix.needsUpdate = true;
      }
    }

    // ── Snow ─────────────────────────────────────────────────────────
    const sm = snowRef.current;
    if (sm) {
      sm.visible = weather === "snow";
      if (weather === "snow") {
        for (let i = 0; i < SNOW_COUNT; i++) {
          const d = snowData[i];
          d[1] -= d[3] * dt;
          d[0] += Math.sin(t * 0.5 + d[4]) * 0.5 * dt + d[5] * dt * 0.2;
          if (d[1] < -2) { d[1] = RAIN_HEIGHT; d[0] = rand(-AREA, AREA); d[2] = rand(-AREA, AREA); }
          dummy.position.set(d[0], d[1], d[2]);
          dummy.rotation.set(t * 0.4 + d[4], t * 0.3, 0);
          dummy.scale.setScalar(0.5 + Math.sin(t + d[4]) * 0.1);
          dummy.updateMatrix();
          sm.setMatrixAt(i, dummy.matrix);
        }
        sm.instanceMatrix.needsUpdate = true;
      }
    }

    // ── Sandstorm ────────────────────────────────────────────────────
    const sa = sandRef.current;
    if (sa) {
      sa.visible = weather === "sandstorm";
      if (weather === "sandstorm") {
        for (let i = 0; i < SAND_COUNT; i++) {
          const d = sandData[i];
          d[0] -= d[3] * dt;                                   // blow west
          d[1] += Math.sin(t * 2 + d[4]) * 0.8 * dt;          // vertical turbulence
          d[2] += d[5] * dt;                                   // lateral spread
          if (d[0] < -AREA) { d[0] = AREA; d[1] = rand(0, 8); d[2] = rand(-AREA, AREA); }
          dummy.position.set(d[0], d[1], d[2]);
          dummy.rotation.set(0, 0, t * 2 + d[4]);
          dummy.scale.setScalar(0.08 + Math.random() * 0.08);
          dummy.updateMatrix();
          sa.setMatrixAt(i, dummy.matrix);
        }
        sa.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Rain drops */}
      <instancedMesh ref={rainRef} args={[undefined, undefined, RAIN_COUNT]} frustumCulled={false} visible={false}>
        <boxGeometry args={[0.018, 0.55, 0.018]} />
        <meshBasicMaterial color="#8ab0cc" transparent opacity={0.65} />
      </instancedMesh>

      {/* Snow flakes */}
      <instancedMesh ref={snowRef} args={[undefined, undefined, SNOW_COUNT]} frustumCulled={false} visible={false}>
        <dodecahedronGeometry args={[0.045, 0]} />
        <meshBasicMaterial color="#ddeeff" transparent opacity={0.82} />
      </instancedMesh>

      {/* Sand/dust */}
      <instancedMesh ref={sandRef} args={[undefined, undefined, SAND_COUNT]} frustumCulled={false} visible={false}>
        <boxGeometry args={[0.1, 0.05, 0.1]} />
        <meshBasicMaterial color="#c89448" transparent opacity={0.45} />
      </instancedMesh>
    </group>
  );
}
