import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const GRAVITY = -10;
const SHELL_LIFETIME = 3.5;
const BLOOD_COUNT = 18;

interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  age: number;
  bounces: number;
  mat: THREE.MeshStandardMaterial;
}

interface BloodCloud {
  pts: THREE.Points;
  vels: THREE.Vector3[];
  age: number;
  mat: THREE.PointsMaterial;
}

interface ExpSpark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
}

interface Explosion {
  sparks: ExpSpark[];
  ring: THREE.Mesh;
  light: THREE.PointLight;
  age: number;
}

interface SmokeCloud {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  mat: THREE.MeshStandardMaterial;
}

export default function ParticleSystem() {
  const { scene } = useThree();
  const shellsRef     = useRef<Shell[]>([]);
  const bloodRef      = useRef<BloodCloud[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const smokeRef      = useRef<SmokeCloud[]>([]);

  const shellGeoRef = useRef<THREE.CylinderGeometry | null>(null);
  const sparkGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const ringGeoRef  = useRef<THREE.TorusGeometry | null>(null);

  useEffect(() => {
    shellGeoRef.current = new THREE.CylinderGeometry(0.007, 0.007, 0.028, 6);
    sparkGeoRef.current = new THREE.SphereGeometry(0.04, 4, 4);
    ringGeoRef.current  = new THREE.TorusGeometry(0.12, 0.055, 6, 32);

    const onShell = (e: Event) => {
      const d = (e as CustomEvent).detail as { px:number; py:number; pz:number; vx:number; vy:number; vz:number };
      if (!shellGeoRef.current) return;
      const mat = new THREE.MeshStandardMaterial({ color: "#ccaa44", metalness: 0.92, roughness: 0.18, transparent: true });
      const mesh = new THREE.Mesh(shellGeoRef.current, mat);
      mesh.position.set(d.px, d.py, d.pz);
      mesh.castShadow = false;
      scene.add(mesh);
      shellsRef.current.push({
        mesh, mat,
        vel: new THREE.Vector3(d.vx, d.vy, d.vz),
        angVel: new THREE.Vector3((Math.random()-0.5)*18, (Math.random()-0.5)*18, (Math.random()-0.5)*18),
        age: 0, bounces: 0,
      });
    };

    const onBlood = (e: Event) => {
      const d = (e as CustomEvent).detail as { px:number; py:number; pz:number };
      const positions = new Float32Array(BLOOD_COUNT * 3);
      const vels: THREE.Vector3[] = [];
      for (let i = 0; i < BLOOD_COUNT; i++) {
        positions[i*3]   = d.px + (Math.random()-0.5)*0.08;
        positions[i*3+1] = d.py + (Math.random()-0.5)*0.08;
        positions[i*3+2] = d.pz + (Math.random()-0.5)*0.08;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        vels.push(new THREE.Vector3(
          Math.cos(angle) * speed,
          0.5 + Math.random() * 3,
          Math.sin(angle) * speed
        ));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color: "#cc0000", size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      bloodRef.current.push({ pts, vels, age: 0, mat });
    };

    const onExplosion = (e: Event) => {
      const d = (e as CustomEvent).detail as { px:number; py:number; pz:number };
      const pos = new THREE.Vector3(d.px, d.py, d.pz);
      const sparks: ExpSpark[] = [];
      const SPARK_COUNT = 28;
      for (let i = 0; i < SPARK_COUNT; i++) {
        if (!sparkGeoRef.current) break;
        const col = i % 3 === 0 ? "#ff8800" : i % 3 === 1 ? "#ffcc00" : "#ff4400";
        const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true });
        const mesh = new THREE.Mesh(sparkGeoRef.current, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        const angle = (i / SPARK_COUNT) * Math.PI * 2;
        const speed = 5 + Math.random() * 7;
        sparks.push({ mesh, vel: new THREE.Vector3(Math.cos(angle)*speed, (0.4+Math.random())*speed*0.7, Math.sin(angle)*speed), age: 0 });
      }
      if (!ringGeoRef.current) return;
      const rmat = new THREE.MeshBasicMaterial({ color: "#ff8800", transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeoRef.current, rmat);
      ring.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      const light = new THREE.PointLight("#ff8800", 9, 14, 2);
      light.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
      scene.add(light);

      // volumetric smoke puffs
      for (let i = 0; i < 6; i++) {
        const sgeo = new THREE.SphereGeometry(0.35 + Math.random()*0.35, 8, 8);
        const smat = new THREE.MeshStandardMaterial({ color: "#555555", transparent: true, opacity: 0.28, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
        const sm = new THREE.Mesh(sgeo, smat);
        sm.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.5, Math.random()*0.5, (Math.random()-0.5)*0.5));
        scene.add(sm);
        const sv = new THREE.Vector3((Math.random()-0.5)*1.2, 1.2+Math.random()*1.8, (Math.random()-0.5)*1.2);
        smokeRef.current.push({ mesh: sm, vel: sv, age: 0, mat: smat });
      }

      explosionsRef.current.push({ sparks, ring, light, age: 0 });
    };

    const onMuzzleSmoke = (e: Event) => {
      const d = (e as CustomEvent).detail as { px:number; py:number; pz:number; vx:number; vy:number; vz:number };
      for (let i = 0; i < 3; i++) {
        const sgeo = new THREE.SphereGeometry(0.055 + Math.random()*0.045, 7, 7);
        const smat = new THREE.MeshStandardMaterial({ color: "#888888", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
        const sm = new THREE.Mesh(sgeo, smat);
        sm.position.set(d.px + (Math.random()-0.5)*0.05, d.py + (Math.random()-0.5)*0.05, d.pz + (Math.random()-0.5)*0.05);
        scene.add(sm);
        smokeRef.current.push({
          mesh: sm, mat: smat, age: 0,
          vel: new THREE.Vector3(d.vx + (Math.random()-0.5)*0.4, d.vy + Math.random()*0.3, d.vz + (Math.random()-0.5)*0.4),
        });
      }
    };

    window.addEventListener("fx:shell",      onShell);
    window.addEventListener("fx:blood",      onBlood);
    window.addEventListener("fx:explosion",  onExplosion);
    window.addEventListener("fx:muzzlesmoke",onMuzzleSmoke);

    return () => {
      window.removeEventListener("fx:shell",      onShell);
      window.removeEventListener("fx:blood",      onBlood);
      window.removeEventListener("fx:explosion",  onExplosion);
      window.removeEventListener("fx:muzzlesmoke",onMuzzleSmoke);
      shellGeoRef.current?.dispose();
      sparkGeoRef.current?.dispose();
      ringGeoRef.current?.dispose();
    };
  }, [scene]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);

    // ── Shell casings ─────────────────────────────────────────────────────
    shellsRef.current = shellsRef.current.filter((s) => {
      s.age += dt;
      if (s.age > SHELL_LIFETIME) { scene.remove(s.mesh); s.mat.dispose(); return false; }
      s.vel.y += GRAVITY * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.angVel.x * dt;
      s.mesh.rotation.z += s.angVel.z * dt;
      if (s.mesh.position.y < 0.014 && s.bounces < 4) {
        s.mesh.position.y = 0.014;
        s.vel.y = Math.abs(s.vel.y) * 0.38;
        s.vel.x *= 0.72; s.vel.z *= 0.72;
        s.angVel.multiplyScalar(0.55);
        s.bounces++;
      }
      const fadeStart = SHELL_LIFETIME - 0.6;
      if (s.age > fadeStart) s.mat.opacity = Math.max(0, 1 - (s.age - fadeStart) / 0.6);
      return true;
    });

    // ── Blood clouds ──────────────────────────────────────────────────────
    bloodRef.current = bloodRef.current.filter((b) => {
      b.age += dt;
      if (b.age > 1.4) { scene.remove(b.pts); b.pts.geometry.dispose(); b.mat.dispose(); return false; }
      const pos = b.pts.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < BLOOD_COUNT; i++) {
        b.vels[i].y += GRAVITY * dt * 0.65;
        pos[i*3]   += b.vels[i].x * dt;
        pos[i*3+1] += b.vels[i].y * dt;
        pos[i*3+2] += b.vels[i].z * dt;
        if (pos[i*3+1] < 0.012) { pos[i*3+1] = 0.012; b.vels[i].y *= -0.28; b.vels[i].x *= 0.65; b.vels[i].z *= 0.65; }
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.mat.opacity = Math.max(0, 0.95 - b.age / 1.4 * 1.1);
      b.mat.size = Math.max(0.02, 0.09 - b.age * 0.04);
      return true;
    });

    // ── Explosions ────────────────────────────────────────────────────────
    explosionsRef.current = explosionsRef.current.filter((exp) => {
      exp.age += dt;
      const t = exp.age;
      exp.sparks = exp.sparks.filter((sp) => {
        sp.age += dt;
        if (sp.age > 2.2) { scene.remove(sp.mesh); return false; }
        sp.vel.y += GRAVITY * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        if (sp.mesh.position.y < 0.04) { sp.mesh.position.y = 0.04; sp.vel.y *= -0.32; sp.vel.x *= 0.7; sp.vel.z *= 0.7; }
        const op = Math.max(0, 1 - sp.age / 2.2);
        (sp.mesh.material as THREE.MeshBasicMaterial).opacity = op;
        return true;
      });
      if (t < 0.55) {
        const sc = 1 + t * 22;
        exp.ring.scale.setScalar(sc);
        (exp.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - t * 1.8);
      } else if (exp.ring.parent) scene.remove(exp.ring);
      exp.light.intensity = Math.max(0, 9 - t * 28);
      if (exp.light.intensity <= 0 && exp.light.parent) scene.remove(exp.light);
      if (exp.sparks.length === 0 && t > 2.2) return false;
      return true;
    });

    // ── Smoke ─────────────────────────────────────────────────────────────
    smokeRef.current = smokeRef.current.filter((s) => {
      s.age += dt;
      const lifetime = 5.0;
      if (s.age > lifetime) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mat.dispose(); return false; }
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y *= 0.99;
      const t = s.age / lifetime;
      s.mesh.scale.setScalar(1 + t * 4.5);
      s.mat.opacity = Math.max(0, 0.28 * (1 - t * 1.1));
      return true;
    });
  });

  return null;
}
