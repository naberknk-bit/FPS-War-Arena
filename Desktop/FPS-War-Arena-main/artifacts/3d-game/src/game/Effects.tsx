import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BulletTrail, ImpactMark, SmokeOrb } from "./types";

interface EffectsProps {
  trails: React.MutableRefObject<BulletTrail[]>;
  impacts: React.MutableRefObject<ImpactMark[]>;
  smokes: React.MutableRefObject<SmokeOrb[]>;
}

const TRAIL_DURATION = 0.12;
const IMPACT_DURATION = 0.5;
const SMOKE_DURATION = 6;

export default function Effects({ trails, impacts, smokes }: EffectsProps) {
  const { scene } = useThree();
  const trailObjects = useRef<Map<number, THREE.Line>>(new Map());
  const impactObjects = useRef<Map<number, THREE.Mesh>>(new Map());
  const smokeObjects = useRef<Map<number, THREE.Mesh>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trailObjects.current.forEach((l) => { scene.remove(l); l.geometry.dispose(); });
      impactObjects.current.forEach((m) => { scene.remove(m); m.geometry.dispose(); });
      smokeObjects.current.forEach((m) => { scene.remove(m); m.geometry.dispose(); });
    };
  }, [scene]);

  useFrame((_, delta) => {
    const now = performance.now() / 1000;

    // --- Bullet Trails ---
    trails.current.forEach((trail) => {
      if (!trailObjects.current.has(trail.id)) {
        const points = [trail.from.clone(), trail.to.clone()];
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: "#ffee88",
          transparent: true,
          opacity: 0.85,
        });
        const line = new THREE.Line(geom, mat);
        scene.add(line);
        trailObjects.current.set(trail.id, line);
      }
    });

    // Expire trails
    trails.current = trails.current.filter((trail) => {
      const age = now - trail.createdAt;
      if (age > TRAIL_DURATION) {
        const line = trailObjects.current.get(trail.id);
        if (line) {
          scene.remove(line);
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          trailObjects.current.delete(trail.id);
        }
        return false;
      }
      // Fade out
      const line = trailObjects.current.get(trail.id);
      if (line) {
        (line.material as THREE.LineBasicMaterial).opacity = 0.85 * (1 - age / TRAIL_DURATION);
      }
      return true;
    });

    // --- Impact Marks ---
    impacts.current.forEach((imp) => {
      if (!impactObjects.current.has(imp.id)) {
        const geom = new THREE.RingGeometry(0.02, 0.15, 12);
        const mat = new THREE.MeshBasicMaterial({
          color: "#ff8800",
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(imp.position);
        // Orient toward camera approximately
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y += 0.01;
        scene.add(mesh);
        impactObjects.current.set(imp.id, mesh);
      }
    });

    // Expire impacts
    impacts.current = impacts.current.filter((imp) => {
      const age = now - imp.createdAt;
      if (age > IMPACT_DURATION) {
        const mesh = impactObjects.current.get(imp.id);
        if (mesh) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          impactObjects.current.delete(imp.id);
        }
        return false;
      }
      const mesh = impactObjects.current.get(imp.id);
      if (mesh) {
        const t = age / IMPACT_DURATION;
        mesh.scale.setScalar(1 + t * 3);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      }
      return true;
    });

    // --- Smoke Orbs ---
    smokes.current.forEach((smoke) => {
      if (!smokeObjects.current.has(smoke.id)) {
        const geom = new THREE.SphereGeometry(0.6, 10, 10);
        const mat = new THREE.MeshStandardMaterial({
          color: "#64b4ff",
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(smoke.position);
        scene.add(mesh);
        smokeObjects.current.set(smoke.id, mesh);
      }
    });

    // Update and expire smokes
    smokes.current = smokes.current.filter((smoke) => {
      const age = now - smoke.createdAt;
      if (age > SMOKE_DURATION) {
        const mesh = smokeObjects.current.get(smoke.id);
        if (mesh) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          smokeObjects.current.delete(smoke.id);
        }
        return false;
      }

      const mesh = smokeObjects.current.get(smoke.id);
      if (mesh) {
        // Move smoke forward
        if (smoke.moving) {
          smoke.position.addScaledVector(smoke.velocity, delta);
          if (age > 0.8) smoke.moving = false;
        }
        mesh.position.copy(smoke.position);

        // Expand and fade
        const t = age / SMOKE_DURATION;
        const scale = 1 + t * 3;
        mesh.scale.setScalar(scale);
        (mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.35 * (1 - t * 1.2));
      }

      return true;
    });
  });

  return null;
}
