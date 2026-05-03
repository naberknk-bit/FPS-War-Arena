import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type AnimState = "idle" | "walk" | "run" | "crouch" | "shoot" | "dead";
export type CharTeam  = "red" | "green" | "blue" | "none";
export type SkinId    = "default" | "dragon" | "legendary";

// ─── Palette ──────────────────────────────────────────────────────────────────
interface Pal { body: string; armor: string; accent: string; emit: string; visor: string }
const PAL: Record<CharTeam | "founder", Pal> = {
  red:     { body: "#c41c1c", armor: "#7a1010", accent: "#ff4455", emit: "#440000", visor: "#ff4455" },
  green:   { body: "#1aaa44", armor: "#126630", accent: "#33ff88", emit: "#003311", visor: "#33ff88" },
  blue:    { body: "#2244cc", armor: "#112288", accent: "#4499ff", emit: "#001155", visor: "#4499ff" },
  none:    { body: "#778899", armor: "#445566", accent: "#aabbcc", emit: "#111822", visor: "#aabbcc" },
  founder: { body: "#cc8800", armor: "#775500", accent: "#ffcc44", emit: "#442200", visor: "#ffcc44" },
};
const DRAGON_PAL: Pal  = { body: "#1e0000", armor: "#550000", accent: "#ff6600", emit: "#550000", visor: "#ff3300" };
const LEGEND_PAL: Pal  = { body: "#020006", armor: "#1a0030", accent: "#cc44ff", emit: "#110022", visor: "#cc44ff" };

// ─── Props ────────────────────────────────────────────────────────────────────
export interface HumanoidModelProps {
  animStateRef:   { current: AnimState };
  shootSignalRef: { current: number };
  team:           CharTeam;
  isFounder?:     boolean;
  skin?:          SkinId;
  onBodyMesh?:    (m: THREE.Mesh | null) => void;
}

// ─── Helper sub-components (no hooks – pure geometry) ─────────────────────────
function Seg({ size, pos, col, emit = "#000", emitI = 0, rough = 0.65, metal = 0.3, castShadow: cs = true }:
  { size:[number,number,number]; pos:[number,number,number]; col:string; emit?:string; emitI?:number; rough?:number; metal?:number; castShadow?:boolean }
) {
  return (
    <mesh position={pos} castShadow={cs}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={col} emissive={emit} emissiveIntensity={emitI} roughness={rough} metalness={metal} />
    </mesh>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function HumanoidModel({ animStateRef, shootSignalRef, team, isFounder = false, skin = "default", onBodyMesh }: HumanoidModelProps) {
  const basePal = PAL[isFounder ? "founder" : team];
  const p = skin === "dragon" ? DRAGON_PAL : skin === "legendary" ? LEGEND_PAL : basePal;

  // ── Bone refs ──────────────────────────────────────────────────────
  const rootRef        = useRef<THREE.Group>(null);
  const spineRef       = useRef<THREE.Group>(null);
  const headRef        = useRef<THREE.Group>(null);
  const lUpperLegRef   = useRef<THREE.Group>(null);
  const rUpperLegRef   = useRef<THREE.Group>(null);
  const lLowerLegRef   = useRef<THREE.Group>(null);
  const rLowerLegRef   = useRef<THREE.Group>(null);
  const lUpperArmRef   = useRef<THREE.Group>(null);
  const rUpperArmRef   = useRef<THREE.Group>(null);
  const lLowerArmRef   = useRef<THREE.Group>(null);
  const rLowerArmRef   = useRef<THREE.Group>(null);
  const weaponRef      = useRef<THREE.Group>(null);
  const muzzleLightRef = useRef<THREE.PointLight>(null);
  const eyeLRef        = useRef<THREE.MeshStandardMaterial>(null);
  const eyeRRef        = useRef<THREE.MeshStandardMaterial>(null);
  const capeRefs       = useRef<(THREE.Group | null)[]>([null,null,null,null,null]);

  // ── Skin overlay refs ───────────────────────────────────────────
  const dragonScaleMatRef  = useRef<THREE.MeshStandardMaterial>(null);
  const legendaryVeinRefs  = useRef<THREE.MeshStandardMaterial[]>([]);
  const legendaryOrbRef    = useRef<THREE.Mesh>(null);
  const skinLightRef       = useRef<THREE.PointLight>(null);

  // ── Animation state ─────────────────────────────────────────────
  const animTime    = useRef(Math.random() * 10);
  const lastShoot   = useRef(shootSignalRef.current);
  const recoilTimer = useRef(0);
  const crouchB     = useRef(0);
  const runB        = useRef(0);
  const walkB       = useRef(0);
  const shootB      = useRef(0);
  const deadB       = useRef(0);
  const bodyY       = useRef(0);
  // Cape spring state [angle, angularVelocity] per segment
  const capeAng     = useRef([0, 0, 0, 0, 0]);
  const capeAngV    = useRef([0, 0, 0, 0, 0]);
  const prevRootPos = useRef(new THREE.Vector3());
  const capeFwd     = useRef(0); // forward velocity for cape

  useFrame((state, rawDelta) => {
    const dt  = Math.min(rawDelta, 0.05);
    const anim = animStateRef.current;

    // ── Detect recoil ────────────────────────────────────────────
    if (shootSignalRef.current !== lastShoot.current) {
      lastShoot.current = shootSignalRef.current;
      recoilTimer.current = 0.22;
    }
    if (recoilTimer.current > 0) recoilTimer.current -= dt;
    const recoilT = Math.max(0, recoilTimer.current / 0.22);

    // ── Blend targets ────────────────────────────────────────────
    crouchB.current = THREE.MathUtils.lerp(crouchB.current, anim === "crouch" ? 1 : 0, dt * 9);
    runB.current    = THREE.MathUtils.lerp(runB.current,    anim === "run"    ? 1 : 0, dt * 9);
    walkB.current   = THREE.MathUtils.lerp(walkB.current,   anim === "walk"   ? 1 : 0, dt * 9);
    shootB.current  = THREE.MathUtils.lerp(shootB.current,  (anim === "shoot" || recoilTimer.current > 0) ? 1 : 0, dt * 12);
    deadB.current   = THREE.MathUtils.lerp(deadB.current,   anim === "dead"   ? 1 : 0, dt * 5);

    const moveB = Math.max(walkB.current, runB.current);
    const liveB = 1 - deadB.current;

    // ── Timing ───────────────────────────────────────────────────
    const freq = 2.8 + runB.current * 3.5 + walkB.current * 1.5 + crouchB.current * 1.5;
    animTime.current += dt * freq;
    const t = animTime.current;

    // ── Legs ─────────────────────────────────────────────────────
    const legAmp   = (walkB.current * 0.6 + runB.current * 0.82 + crouchB.current * 0.28) * liveB;
    const legSwing = Math.sin(t) * legAmp;
    const kneeBend = crouchB.current * 0.72 + Math.max(0, -Math.sin(t)) * legAmp * 0.52;

    if (lUpperLegRef.current) lUpperLegRef.current.rotation.x  =  legSwing;
    if (rUpperLegRef.current) rUpperLegRef.current.rotation.x  = -legSwing;
    if (lLowerLegRef.current) lLowerLegRef.current.rotation.x  =  Math.max(0, -legSwing) * 0.48 + kneeBend;
    if (rLowerLegRef.current) rLowerLegRef.current.rotation.x  =  Math.max(0, legSwing)  * 0.48 + kneeBend;

    // ── Arms ─────────────────────────────────────────────────────
    const armSwingAmp = (walkB.current * 0.38 + runB.current * 0.6) * liveB;
    const lArmNatural =  Math.sin(t) * armSwingAmp;
    const rArmNatural = -Math.sin(t) * armSwingAmp;

    // Shoot pose
    const aimL_x = -0.72 * shootB.current; // left arm raised forward (support grip)
    const aimR_x = -0.88 * shootB.current; // right arm raised forward (trigger)
    const recoilX = recoilT * 0.32;

    if (lUpperArmRef.current) {
      lUpperArmRef.current.rotation.x =  lArmNatural * (1 - shootB.current) + aimL_x;
      lUpperArmRef.current.rotation.z =  0.14 + crouchB.current * 0.08;
    }
    if (rUpperArmRef.current) {
      rUpperArmRef.current.rotation.x =  rArmNatural * (1 - shootB.current) + aimR_x + recoilX;
      rUpperArmRef.current.rotation.z = -0.14 - crouchB.current * 0.08;
    }
    if (lLowerArmRef.current) lLowerArmRef.current.rotation.x = shootB.current * 0.28;
    if (rLowerArmRef.current) rLowerArmRef.current.rotation.x = shootB.current * 0.22;

    // Weapon recoil
    if (weaponRef.current) weaponRef.current.rotation.x = recoilX * 0.6;

    // ── Muzzle flash ─────────────────────────────────────────────
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = recoilT > 0.55 ? 4 : 0;
    }

    // ── Spine (breathing + lean) ──────────────────────────────────
    const breathe    = Math.sin(t * 0.45) * 0.013;
    const runLean    = runB.current * 0.16;
    const crouchLean = crouchB.current * 0.14;
    const deadLean   = deadB.current * 1.55;
    if (spineRef.current) spineRef.current.rotation.x = breathe + runLean + crouchLean + deadLean;

    // ── Head bob ─────────────────────────────────────────────────
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 2) * moveB * 0.028;
    }

    // ── Crouch & dead offset ──────────────────────────────────────
    const targetY = crouchB.current * -0.38 + deadB.current * -0.82;
    bodyY.current = THREE.MathUtils.lerp(bodyY.current, targetY, dt * 9);
    if (rootRef.current) {
      rootRef.current.position.y = bodyY.current;
      rootRef.current.rotation.z = deadB.current * (-Math.PI / 2.2);
    }

    // ── Eye glow by AI state ──────────────────────────────────────
    const eyeCol = anim === "shoot" ? (team === "red" ? 0xff2200 : 0x00ff44)
                 : anim === "run"   ? (team === "red" ? 0xff8800 : 0x88ff44)
                 : (team === "red"  ? 0xffff00 : 0xaaffaa);
    const eyeIntens = anim === "shoot" ? 2.5 : anim === "run" ? 1.6 : 0.9;
    if (eyeLRef.current) { eyeLRef.current.color.setHex(eyeCol); eyeLRef.current.emissive.setHex(eyeCol); eyeLRef.current.emissiveIntensity = eyeIntens; }
    if (eyeRRef.current) { eyeRRef.current.color.setHex(eyeCol); eyeRRef.current.emissive.setHex(eyeCol); eyeRRef.current.emissiveIntensity = eyeIntens; }

    // ── Skin overlay animations ───────────────────────────────────
    const pulse = Math.sin(t * 3.2) * 0.5 + 0.5;
    if (skin === "dragon") {
      if (dragonScaleMatRef.current) dragonScaleMatRef.current.emissiveIntensity = 0.6 + pulse * 1.4;
      if (skinLightRef.current) skinLightRef.current.intensity = 0.7 + pulse * 0.9;
    }
    if (skin === "legendary") {
      if (legendaryOrbRef.current) { legendaryOrbRef.current.rotation.y += dt * 2.4; legendaryOrbRef.current.rotation.x += dt * 1.6; }
      legendaryVeinRefs.current.forEach(m => { if (m) m.emissiveIntensity = 1.2 + pulse * 1.8; });
      if (skinLightRef.current) skinLightRef.current.intensity = 0.9 + pulse * 1.1;
    }

    // ── Cape cloth physics (founder) ──────────────────────────────
    if (isFounder) {
      const rp = rootRef.current?.parent?.position;
      if (rp) {
        const fwdVel = (rp.z - prevRootPos.current.z) / dt;
        capeFwd.current = THREE.MathUtils.lerp(capeFwd.current, fwdVel, dt * 5);
        prevRootPos.current.copy(rp);
      }
      const wind = Math.abs(capeFwd.current) * 0.035;
      for (let i = 0; i < 5; i++) {
        const g = capeRefs.current[i];
        if (!g) continue;
        const parentAng = i === 0 ? 0 : capeAng.current[i - 1] * 0.35;
        const gravity = 2.5;
        const damping = 0.84;
        capeAngV.current[i] += (-gravity * Math.sin(capeAng.current[i] + parentAng) + wind) * dt;
        capeAngV.current[i] *= Math.pow(damping, dt * 60);
        capeAng.current[i]  += capeAngV.current[i] * dt;
        capeAng.current[i]   = THREE.MathUtils.clamp(capeAng.current[i], -0.85, 0.85);
        g.rotation.x = capeAng.current[i];
      }
    }
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <group ref={rootRef}>
      {/* ── Left leg ──────────────────────────────────────────────────── */}
      <group position={[0.14, 0.8, 0]} ref={lUpperLegRef}>
        <Seg pos={[0,-0.22,0]}  size={[0.15,0.44,0.15]} col={p.armor} />
        {/* Knee pad */}
        <Seg pos={[0,-0.43,0.06]} size={[0.14,0.1,0.06]} col={p.accent} emit={p.accent} emitI={0.35} />
        <group position={[0,-0.44,0]} ref={lLowerLegRef}>
          <Seg pos={[0,-0.19,0]} size={[0.12,0.38,0.12]} col={p.body} />
          {/* Shin armor */}
          <Seg pos={[0,-0.19,0.055]} size={[0.11,0.3,0.04]} col={p.armor} metal={0.6} />
          {/* Foot */}
          <mesh position={[0,-0.4,0.07]} castShadow>
            <boxGeometry args={[0.13, 0.07, 0.24]} />
            <meshStandardMaterial color={p.armor} roughness={0.55} metalness={0.45} />
          </mesh>
        </group>
      </group>

      {/* ── Right leg ─────────────────────────────────────────────────── */}
      <group position={[-0.14, 0.8, 0]} ref={rUpperLegRef}>
        <Seg pos={[0,-0.22,0]}  size={[0.15,0.44,0.15]} col={p.armor} />
        <Seg pos={[0,-0.43,0.06]} size={[0.14,0.1,0.06]} col={p.accent} emit={p.accent} emitI={0.35} />
        <group position={[0,-0.44,0]} ref={rLowerLegRef}>
          <Seg pos={[0,-0.19,0]} size={[0.12,0.38,0.12]} col={p.body} />
          <Seg pos={[0,-0.19,0.055]} size={[0.11,0.3,0.04]} col={p.armor} metal={0.6} />
          <mesh position={[0,-0.4,0.07]} castShadow>
            <boxGeometry args={[0.13, 0.07, 0.24]} />
            <meshStandardMaterial color={p.armor} roughness={0.55} metalness={0.45} />
          </mesh>
        </group>
      </group>

      {/* ── Pelvis ─────────────────────────────────────────────────────── */}
      <Seg pos={[0,0.8,0]} size={[0.36,0.18,0.21]} col={p.armor} />
      {/* Belt detail */}
      <Seg pos={[0,0.78,0.1]} size={[0.35,0.05,0.06]} col={p.accent} emit={p.accent} emitI={0.25} />

      {/* ── Spine group ────────────────────────────────────────────────── */}
      <group position={[0, 0.88, 0]} ref={spineRef}>

        {/* Abdomen */}
        <Seg pos={[0,0.12,0]} size={[0.32,0.22,0.2]} col={p.body} />

        {/* Chest */}
        <mesh
          ref={onBodyMesh ? (m) => { onBodyMesh(m); } : undefined}
          position={[0, 0.39, 0]}
          castShadow
        >
          <boxGeometry args={[0.44, 0.46, 0.24]} />
          <meshStandardMaterial color={p.body} emissive={p.emit} emissiveIntensity={isFounder ? 0.25 : 0.18} roughness={0.6} metalness={isFounder ? 0.7 : 0.38} />
        </mesh>

        {/* Chest armor plate */}
        <Seg pos={[0,0.43,0.12]} size={[0.38,0.36,0.06]} col={p.armor} emit={isFounder ? p.accent : p.emit} emitI={isFounder ? 0.55 : 0.08} rough={0.4} metal={0.75} />
        {/* Team badge */}
        <Seg pos={[0,0.55,0.15]} size={[0.14,0.08,0.03]} col={p.accent} emit={p.accent} emitI={1.2} rough={0} metal={1} />

        {/* Shoulder pads */}
        <Seg pos={[0.3,0.43,0]}  size={[0.14,0.19,0.24]} col={p.armor} rough={0.4} metal={0.6} />
        <Seg pos={[-0.3,0.43,0]} size={[0.14,0.19,0.24]} col={p.armor} rough={0.4} metal={0.6} />
        <Seg pos={[0.3,0.43,0.09]}  size={[0.13,0.12,0.05]} col={p.accent} emit={p.accent} emitI={0.3} />
        <Seg pos={[-0.3,0.43,0.09]} size={[0.13,0.12,0.05]} col={p.accent} emit={p.accent} emitI={0.3} />

        {/* ── Left arm ──────────────────────────────────────────────── */}
        <group position={[0.3, 0.36, 0]} rotation={[0,0,0.13]} ref={lUpperArmRef}>
          <Seg pos={[0,-0.19,0]} size={[0.13,0.38,0.13]} col={p.body} />
          {/* Elbow */}
          <Seg pos={[0,-0.36,0.04]} size={[0.12,0.1,0.08]} col={p.armor} rough={0.4} metal={0.65} />
          <group position={[0,-0.38,0]} ref={lLowerArmRef}>
            <Seg pos={[0,-0.15,0]} size={[0.11,0.3,0.11]} col={p.armor} rough={0.55} metal={0.5} />
            {/* Left hand (support grip on barrel) */}
            <Seg pos={[0,-0.33,0.02]} size={[0.1,0.11,0.09]} col={p.body} rough={0.8} />
          </group>
        </group>

        {/* ── Right arm ─────────────────────────────────────────────── */}
        <group position={[-0.3, 0.36, 0]} rotation={[0,0,-0.13]} ref={rUpperArmRef}>
          <Seg pos={[0,-0.19,0]} size={[0.13,0.38,0.13]} col={p.body} />
          <Seg pos={[0,-0.36,0.04]} size={[0.12,0.1,0.08]} col={p.armor} rough={0.4} metal={0.65} />
          <group position={[0,-0.38,0]} ref={rLowerArmRef}>
            <Seg pos={[0,-0.15,0]} size={[0.11,0.3,0.11]} col={p.armor} rough={0.55} metal={0.5} />
            <Seg pos={[0,-0.33,0.02]} size={[0.1,0.11,0.09]} col={p.body} rough={0.8} />
            {/* ── Weapon in right hand ───────────────────────────── */}
            <group position={[-0.01,-0.38,-0.04]} ref={weaponRef}>
              {/* Receiver */}
              <Seg pos={[0,0,-0.14]} size={[0.06,0.055,0.3]} col={isFounder ? "#2a1a00" : "#1a1a1a"} emit={isFounder ? "#ff8800" : "#0a0a0a"} emitI={isFounder ? 0.6 : 0} rough={0.25} metal={0.95} />
              {/* Barrel */}
              <mesh position={[0,0.004,-0.32]} rotation={[Math.PI/2,0,0]}>
                <cylinderGeometry args={[0.013, 0.013, 0.24, 6]} />
                <meshStandardMaterial color={isFounder ? "#884400" : "#111"} metalness={0.98} roughness={0.15} emissive={isFounder ? "#ff6600" : "#000"} emissiveIntensity={isFounder ? 0.4 : 0} />
              </mesh>
              {/* Grip */}
              <Seg pos={[0,-0.065,-0.05]} size={[0.045,0.1,0.065]} col="#222" rough={0.85} />
              {/* Mag */}
              <Seg pos={[0,-0.068,-0.12]} size={[0.038,0.1,0.042]} col="#2a2a2a" rough={0.7} />
              {/* Rail & sight */}
              <Seg pos={[0,0.04,-0.14]} size={[0.055,0.025,0.18]} col="#333" rough={0.4} metal={0.8} />
              <Seg pos={[0,0.065,-0.16]} size={[0.03,0.04,0.05]} col={isFounder ? "#ffcc00" : "#ff4455"} emit={isFounder ? "#ffcc00" : "#ff4455"} emitI={1.8} />
              {/* Muzzle flash light */}
              <pointLight ref={muzzleLightRef} color={isFounder ? "#ffcc44" : "#ff8833"} intensity={0} distance={3.5} position={[0,0,-0.46]} />
            </group>
          </group>
        </group>

        {/* ── Neck ──────────────────────────────────────────────────── */}
        <mesh position={[0,0.69,0]}>
          <cylinderGeometry args={[0.07,0.09,0.13,8]} />
          <meshStandardMaterial color={p.body} roughness={0.8} />
        </mesh>

        {/* ── Head group ────────────────────────────────────────────── */}
        <group position={[0,0.8,0]} ref={headRef}>
          {/* Skull */}
          <mesh castShadow>
            <boxGeometry args={[0.37,0.39,0.35]} />
            <meshStandardMaterial color={p.body} roughness={0.7} emissive={p.emit} emissiveIntensity={isFounder ? 0.2 : 0.06} />
          </mesh>
          {/* Helmet brow ridge */}
          <Seg pos={[0,0.16,0.15]} size={[0.36,0.07,0.12]} col={p.armor} rough={0.4} metal={0.7} />
          {/* Visor */}
          <Seg pos={[0,0.02,0.17]} size={[0.29,0.18,0.06]} col={p.visor} emit={p.visor} emitI={0.7} rough={0.04} metal={0.98} />
          {/* Left eye */}
          <mesh position={[0.1,0.05,0.18]}>
            <boxGeometry args={[0.08,0.056,0.02]} />
            <meshStandardMaterial ref={eyeLRef} color={p.accent} emissive={p.accent} emissiveIntensity={1.5} roughness={0} />
          </mesh>
          {/* Right eye */}
          <mesh position={[-0.1,0.05,0.18]}>
            <boxGeometry args={[0.08,0.056,0.02]} />
            <meshStandardMaterial ref={eyeRRef} color={p.accent} emissive={p.accent} emissiveIntensity={1.5} roughness={0} />
          </mesh>
          {/* Chin guard */}
          <Seg pos={[0,-0.14,0.16]} size={[0.25,0.07,0.1]} col={p.armor} rough={0.5} metal={0.65} />
          {/* Antenna (tactical) */}
          <Seg pos={[0.16,0.22,0.06]} size={[0.02,0.12,0.02]} col={p.accent} emit={p.accent} emitI={1.0} />

          {/* ── Founder Crown ──────────────────────────────────────── */}
          {isFounder && <>
            <mesh position={[0,0.25,0]}>
              <cylinderGeometry args={[0.21,0.23,0.14,5]} />
              <meshStandardMaterial color="#cc8800" emissive="#ffcc00" emissiveIntensity={0.9} roughness={0.15} metalness={0.95} />
            </mesh>
            {[0,1,2,3,4].map(i => (
              <mesh key={i} position={[Math.sin(i*Math.PI*2/5)*0.18, 0.36, Math.cos(i*Math.PI*2/5)*0.18]}>
                <coneGeometry args={[0.026,0.12,4]} />
                <meshStandardMaterial color="#ffcc44" emissive="#ffcc44" emissiveIntensity={2} roughness={0} metalness={1} />
              </mesh>
            ))}
            <pointLight color="#ffcc44" intensity={0.9} distance={4} position={[0,0.32,0]} />
            {/* Founder nameplate glow */}
            <Seg pos={[0,-0.08,0.19]} size={[0.28,0.06,0.02]} col="#ffcc44" emit="#ffcc44" emitI={2.5} rough={0} metal={1} />
          </>}
        </group>

        {/* ── Dragon Skin Overlays ────────────────────────────────────── */}
        {skin === "dragon" && <>
          {/* Dragon scales on chest (2 rows × 3) */}
          {[0,1,2,3,4,5].map(i => (
            <mesh key={i} position={[(i%3 - 1)*0.12, 0.36 + Math.floor(i/3)*0.15, 0.155]} rotation={[0,0,Math.PI/4]}>
              <boxGeometry args={[0.088, 0.088, 0.042]} />
              <meshStandardMaterial ref={i===0 ? dragonScaleMatRef : undefined}
                color="#cc4400" emissive="#ff6600" emissiveIntensity={0.8} roughness={0.15} metalness={0.95} />
            </mesh>
          ))}
          {/* Shoulder dorsal spikes */}
          <mesh position={[0.33, 0.5, -0.04]} rotation={[0, 0, 0.82]}>
            <coneGeometry args={[0.04, 0.22, 5]} />
            <meshStandardMaterial color="#991100" emissive="#ff6600" emissiveIntensity={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[-0.33, 0.5, -0.04]} rotation={[0, 0, -0.82]}>
            <coneGeometry args={[0.04, 0.22, 5]} />
            <meshStandardMaterial color="#991100" emissive="#ff6600" emissiveIntensity={0.7} roughness={0.25} />
          </mesh>
          {/* Spine ridge spikes */}
          {[0,1,2].map(i => (
            <mesh key={i} position={[0, 0.28 + i*0.13, -0.13]} rotation={[0.5, 0, 0]}>
              <coneGeometry args={[0.025, 0.14, 4]} />
              <meshStandardMaterial color="#881100" emissive="#ff4400" emissiveIntensity={0.6} roughness={0.3} />
            </mesh>
          ))}
          <pointLight ref={skinLightRef} color="#ff6600" intensity={0.9} distance={3.8} position={[0, 0.4, 0.2]} />
        </>}

        {/* ── Legendary Skin Overlays ──────────────────────────────────── */}
        {skin === "legendary" && <>
          {/* Energy vein strips — chest left+right */}
          {[-0.17,0.17].map((x, col) => (
            [0.28, 0.38, 0.48, 0.58, 0.68].map((y, row) => (
              <mesh key={`${col}-${row}`} position={[x, y, 0.135]}>
                <boxGeometry args={[0.04, 0.078, 0.026]} />
                <meshStandardMaterial
                  ref={el => { if (el && !legendaryVeinRefs.current.includes(el)) legendaryVeinRefs.current.push(el); }}
                  color="#660099" emissive="#cc44ff" emissiveIntensity={1.5} roughness={0} metalness={1} />
              </mesh>
            ))
          ))}
          {/* Plasma orb core in chest */}
          <mesh ref={legendaryOrbRef} position={[0, 0.43, 0.14]}>
            <octahedronGeometry args={[0.065, 1]} />
            <meshStandardMaterial color="#440066" emissive="#cc44ff" emissiveIntensity={3.5} roughness={0} metalness={1} />
          </mesh>
          {/* Void shoulder runes */}
          {[-0.3, 0.3].map(x => (
            <mesh key={x} position={[x, 0.44, 0.1]}>
              <torusGeometry args={[0.055, 0.014, 4, 6]} />
              <meshStandardMaterial color="#330055" emissive="#aa44ff" emissiveIntensity={2.2} roughness={0} metalness={1} />
            </mesh>
          ))}
          <pointLight ref={skinLightRef} color="#aa00ff" intensity={1.2} distance={4.2} position={[0, 0.4, 0.2]} />
        </>}

        {/* ── Founder Cape ────────────────────────────────────────────── */}
        {isFounder && (
          <group position={[0, 0.52, -0.14]}>
            {[0,1,2,3,4].map(i => (
              <group
                key={i}
                position={[0, -i * 0.17, 0]}
                ref={el => { capeRefs.current[i] = el; }}
              >
                <mesh position={[0, -0.085, -0.03 * i]}>
                  <boxGeometry args={[0.58 - i * 0.05, 0.17, 0.026]} />
                  <meshStandardMaterial
                    color={i % 2 === 0 ? "#cc8800" : "#886600"}
                    emissive="#ffaa00"
                    emissiveIntensity={0.28 - i * 0.04}
                    roughness={0.4} metalness={0.65}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                {/* Cape trim glow */}
                <Seg pos={[0, -0.17, -0.03 * i]} size={[0.58 - i*0.05, 0.025, 0.02]} col="#ffcc44" emit="#ffcc44" emitI={1.2 - i*0.2} rough={0} metal={1} />
              </group>
            ))}
          </group>
        )}

      </group>{/* end spine */}

      {/* ── Founder body aura ───────────────────────────────────────────── */}
      {isFounder && <pointLight color="#ffaa00" intensity={1.4} distance={5.5} position={[0,1,0]} />}
    </group>
  );
}
