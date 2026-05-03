import { useRef, useCallback, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { BulletTrail, ImpactMark, SmokeOrb } from "./types";
import { EnemiesHandle } from "./Enemies";
import Weapon from "./Weapon";
import Effects from "./Effects";
import type { PlayerClass } from "./CharacterSelect";
import type { WeaponId } from "./BuyMenu";
import { WEAPONS } from "./BuyMenu";
import { Socket } from "socket.io-client";
import { SpikeState, SpikeSystem } from "./Spike";
import { playGunshot, playFootstep, playHitSound, playReload } from "./AudioEngine";

const MOVE_SPEED = 8;
const JUMP_VELOCITY = 7;
const GRAVITY = -18;
const PLAYER_HEIGHT = 1.65;
const FLOOR_Y = PLAYER_HEIGHT;
const ABILITY_COOLDOWN = 12;

const RADIO_COMMANDS = [
  { fKey: "F1", message: "Rush B!", color: "#ff6600" },
  { fKey: "F2", message: "Geri çekil!", color: "#4488ff" },
  { fKey: "F3", message: "Yardım lazım!", color: "#ffcc00" },
  { fKey: "F4", message: "Düşman görüldü!", color: "#ff4655" },
];

function playRadioBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 500);
  } catch { /* ignore */ }
}

export interface MobileRefs {
  move: React.MutableRefObject<{ dx: number; dy: number }>;
  look: React.MutableRefObject<{ dx: number; dy: number }>;
  fire: React.MutableRefObject<boolean>;
  jump: React.MutableRefObject<boolean>;
  ability: React.MutableRefObject<boolean>;
  reload: React.MutableRefObject<boolean>;
}

interface PlayerProps {
  enemiesRef: React.RefObject<EnemiesHandle | null>;
  ammo: number;
  setAmmo: (v: number | ((prev: number) => number)) => void;
  onKill: (victimId?: string, weapon?: string, isHeadshot?: boolean) => void;
  onHit: () => void;
  chatFocused: boolean;
  playerClass: PlayerClass | null;
  socket: Socket | null;
  roomId: string | null;
  onAbilityUsed: (ability: string) => void;
  onFlash: () => void;
  onRadioCommand: (msg: string, color: string) => void;
  onTeleport?: { x: number; y: number; z: number } | null;
  currentWeapon: WeaponId;
  isFly: boolean;
  onPositionUpdate: (pos: THREE.Vector3, ry: number) => void;
  spikeState: SpikeState;
  hasSpike: boolean;
  onSpikeStateChange: (s: SpikeState) => void;
  onIsPlanting: (v: boolean) => void;
  onPlantProgress: (v: number) => void;
  onIsDefusing: (v: boolean) => void;
  onDefuseProgress: (v: number) => void;
  onTimeLeft: (v: number) => void;
  mobileMode: boolean;
  mobileRefs: MobileRefs;
  onLockChange: (locked: boolean) => void;
  nightMode: boolean;
  onNightModeToggle: () => void;
  skin?: "default" | "dragon" | "legendary" | "rare_red" | "rare_blue" | "rare_gold";
}

export default function Player({
  enemiesRef, ammo, setAmmo, onKill, onHit, chatFocused,
  playerClass, socket, roomId, onAbilityUsed, onFlash, onRadioCommand, onTeleport,
  currentWeapon, isFly, onPositionUpdate,
  spikeState, hasSpike, onSpikeStateChange,
  onIsPlanting, onPlantProgress, onIsDefusing, onDefuseProgress, onTimeLeft,
  mobileMode, mobileRefs, onLockChange, nightMode, onNightModeToggle, skin = "default",
}: PlayerProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const velocityY = useRef(0);
  const onGround = useRef(true);
  const [isFiringState, setIsFiringState] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isMovingState, setIsMovingState] = useState(false);
  const abilityHeld = useRef(false);
  const lastShot = useRef(0);
  const ammoRef = useRef(ammo);
  ammoRef.current = ammo;
  const chatFocusedRef = useRef(chatFocused);
  chatFocusedRef.current = chatFocused;
  const isReloadingRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abilityCooldownRef = useRef(0);
  const recoilYRef = useRef(0);
  const recoilXRef = useRef(0);
  const currentWeaponRef = useRef(currentWeapon);
  currentWeaponRef.current = currentWeapon;
  const isFlyRef = useRef(isFly);
  isFlyRef.current = isFly;
  const mobileModeRef = useRef(mobileMode);
  mobileModeRef.current = mobileMode;
  const posEmitThrottle = useRef(0);

  // Camera euler for mobile look (accumulated yaw/pitch)
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  const trails = useRef<BulletTrail[]>([]);
  const impacts = useRef<ImpactMark[]>([]);
  const smokes = useRef<SmokeOrb[]>([]);
  const effectId = useRef(0);

  const raycaster = useRef(new THREE.Raycaster());
  const center = useRef(new THREE.Vector2(0, 0));
  const [, getKeys] = useKeyboardControls();

  useEffect(() => { camera.position.set(0, FLOOR_Y, 5); yawRef.current = 0; pitchRef.current = 0; }, [camera]);

  useEffect(() => {
    if (!onTeleport) return;
    camera.position.set(onTeleport.x, onTeleport.y, onTeleport.z);
  }, [onTeleport, camera]);

  // Own lock state — source of truth for all shooting/movement checks
  const isLockedRef = useRef(true);
  const lastUnlockTimeRef = useRef(0);

  // Track pointer lock via document event — works even if controlsRef lags
  useEffect(() => {
    if (mobileMode) return;
    const handleLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      isLockedRef.current = locked;
      if (!locked) lastUnlockTimeRef.current = performance.now();
      onLockChange(locked);
    };
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl.domElement, mobileMode]);

  useEffect(() => {
    if (mobileMode) return;
    const canvas = gl.domElement;
    const handleCanvasClick = (e: MouseEvent) => {
      const elapsed = performance.now() - lastUnlockTimeRef.current;
      if (!isLockedRef.current && elapsed < 1100) e.stopImmediatePropagation();
    };
    canvas.addEventListener("click", handleCanvasClick, true);
    return () => canvas.removeEventListener("click", handleCanvasClick, true);
  }, [gl.domElement, mobileMode]);

  const weaponDef = WEAPONS.find((w) => w.id === currentWeapon) ?? WEAPONS[0];
  const reloadTime = 2.0;
  const fireRateSeconds = 1 / weaponDef.fireRate;

  const startReload = useCallback(() => {
    if (isReloadingRef.current) return;
    if (ammoRef.current >= weaponDef.ammo) return;
    isReloadingRef.current = true;
    setIsReloading(true);
    playReload();
    onAbilityUsed("RELOAD");
    reloadTimerRef.current = setTimeout(() => {
      setAmmo(weaponDef.ammo);
      isReloadingRef.current = false;
      setIsReloading(false);
    }, reloadTime * 1000);
  }, [setAmmo, onAbilityUsed, weaponDef]);

  const shoot = useCallback(() => {
    if (ammoRef.current <= 0) { startReload(); return; }
    if (chatFocusedRef.current) return;
    if (isReloadingRef.current) return;
    const now = performance.now() / 1000;
    if (now - lastShot.current < fireRateSeconds) return;
    lastShot.current = now;

    setAmmo((prev) => Math.max(0, prev - 1));
    setIsFiringState(true);
    setTimeout(() => setIsFiringState(false), 80);

    playGunshot(currentWeaponRef.current);

    recoilYRef.current = Math.min(recoilYRef.current + 0.008, 0.06);
    recoilXRef.current += (Math.random() - 0.5) * 0.003;

    raycaster.current.setFromCamera(center.current, camera);
    const direction = raycaster.current.ray.direction.clone().normalize();
    const origin = camera.position.clone();
    const far = origin.clone().addScaledVector(direction, 80);

    const enemies = enemiesRef.current?.getEnemyMeshes() ?? [];
    const hits = raycaster.current.intersectObjects(enemies.map((e) => e.mesh), false);

    // Shell casing eject
    const rightVec = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    window.dispatchEvent(new CustomEvent("fx:shell", { detail: {
      px: origin.x + rightVec.x * 0.25,
      py: origin.y - 0.15,
      pz: origin.z + rightVec.z * 0.25,
      vx: rightVec.x * 3.8 + (Math.random() - 0.5) * 1.8,
      vy: 1.9 + Math.random() * 1.6,
      vz: rightVec.z * 3.8 + (Math.random() - 0.5) * 1.8,
    }}));
    // Muzzle smoke
    window.dispatchEvent(new CustomEvent("fx:muzzlesmoke", { detail: {
      px: origin.x + direction.x * 0.6,
      py: origin.y - 0.05,
      pz: origin.z + direction.z * 0.6,
      vx: direction.x * 0.5, vy: 0.25, vz: direction.z * 0.5,
    }}));

    let endPoint = far.clone();
    if (hits.length > 0) {
      endPoint = hits[0].point.clone();
      // Blood splatter on any hit
      window.dispatchEvent(new CustomEvent("fx:blood", { detail: {
        px: hits[0].point.x, py: hits[0].point.y, pz: hits[0].point.z,
      }}));
      const hitEnemy = enemies.find((e) => e.mesh === hits[0].object);
      if (hitEnemy) {
        const isHeadshot = hits[0].point.y > hitEnemy.mesh.position.y + 1.4;
        playHitSound(isHeadshot);
        enemiesRef.current?.killEnemy(hitEnemy.id);
        onKill(String(hitEnemy.id), currentWeaponRef.current, isHeadshot);
      } else {
        onHit();
      }
      impacts.current.push({ id: effectId.current++, position: hits[0].point.clone(), createdAt: now });
    }
    trails.current.push({ id: effectId.current++, from: origin.clone().addScaledVector(direction, 0.5), to: endPoint, createdAt: now });
  }, [camera, enemiesRef, setAmmo, startReload, onKill, onHit, fireRateSeconds]);

  const useAbility = useCallback(() => {
    if (chatFocusedRef.current) return;
    if (!mobileModeRef.current && !isLockedRef.current) return;
    if (abilityCooldownRef.current > 0) return;
    const now = performance.now() / 1000;

    if (playerClass === "assault") {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      camera.position.addScaledVector(dir, 6);
      abilityCooldownRef.current = ABILITY_COOLDOWN;
      onAbilityUsed("DASH");
    } else if (playerClass === "scout") {
      abilityCooldownRef.current = ABILITY_COOLDOWN;
      onAbilityUsed("SCAN");
    } else if (playerClass === "support") {
      abilityCooldownRef.current = ABILITY_COOLDOWN;
      onFlash(); onAbilityUsed("FLASH");
      if (socket && roomId) socket.emit("radio_command", { message: "⚡ FLASH!", color: "#ffffff", roomId });
    } else {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const startPos = camera.position.clone().addScaledVector(dir, 0.7); startPos.y -= 0.1;
      smokes.current.push({ id: effectId.current++, position: startPos, velocity: dir.clone().multiplyScalar(12), createdAt: now, moving: true });
      onAbilityUsed("SMOKE");
    }
  }, [camera, playerClass, socket, roomId, onAbilityUsed, onFlash]);

  // Desktop shoot — listen on document so pointer-lock never swallows the event
  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  useEffect(() => {
    if (mobileMode) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !chatFocusedRef.current) shootRef.current();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [mobileMode]);

  // Desktop keyboard actions
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (chatFocusedRef.current) return;
      if (e.code === "KeyE" && !abilityHeld.current && isLockedRef.current) {
        abilityHeld.current = true; useAbility();
      }
      if (e.code === "KeyR" && isLockedRef.current) startReload();
      if (e.code === "KeyL" && (isLockedRef.current || mobileModeRef.current)) { e.preventDefault(); onNightModeToggle(); }
      const radio = RADIO_COMMANDS.find((rc) => e.key === rc.fKey);
      if (radio && isLockedRef.current) {
        e.preventDefault(); playRadioBeep(); onRadioCommand(radio.message, radio.color);
        if (socket) socket.emit("radio_command", { message: radio.message, color: radio.color, roomId });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "KeyE") abilityHeld.current = false; };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKey); window.removeEventListener("keyup", handleKeyUp); };
  }, [useAbility, startReload, socket, roomId, onRadioCommand]);

  useFrame((_, delta) => {
    const isMobile = mobileModeRef.current;

    // Mobile actions
    if (isMobile) {
      if (mobileRefs.fire.current) { mobileRefs.fire.current = false; shoot(); }
      if (mobileRefs.ability.current) { mobileRefs.ability.current = false; useAbility(); }
      if (mobileRefs.reload.current) { mobileRefs.reload.current = false; startReload(); }
    }

    // Movement gating: desktop needs lock, mobile doesn't
    const canMove = isMobile || (isLockedRef.current && !chatFocusedRef.current);
    if (!canMove) return;

    // Mobile look (apply dx/dy from touch)
    if (isMobile) {
      const lk = mobileRefs.look.current;
      if (lk.dx !== 0 || lk.dy !== 0) {
        yawRef.current -= lk.dx * 0.002;
        pitchRef.current -= lk.dy * 0.002;
        pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -Math.PI / 2.5, Math.PI / 2.5);
        const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, "YXZ");
        camera.quaternion.setFromEuler(euler);
        lk.dx = 0; lk.dy = 0;
      }
    }

    // Movement
    let dx = 0, dy = 0;
    if (isMobile) {
      dx = mobileRefs.move.current.dx;
      dy = mobileRefs.move.current.dy;
    } else {
      const keys = getKeys() as { forward: boolean; back: boolean; left: boolean; right: boolean; jump: boolean };
      if (keys.forward) dy -= 1;
      if (keys.back)    dy += 1;
      if (keys.right)   dx += 1;
      if (keys.left)    dx -= 1;
    }

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (dy !== 0) move.addScaledVector(dir, -dy);
    if (dx !== 0) move.addScaledVector(right, dx);
    const moving = move.lengthSq() > 0.001;
    if (moving) { move.normalize(); playFootstep(); }
    setIsMovingState(moving);
    camera.position.addScaledVector(move, MOVE_SPEED * delta);

    // Jump
    const wantsJump = isMobile ? mobileRefs.jump.current : false;
    if (isMobile && wantsJump) mobileRefs.jump.current = false;

    if (isFlyRef.current) {
      if (wantsJump || (!isMobile && (getKeys() as any).jump)) camera.position.y += 5 * delta;
      velocityY.current = 0;
    } else {
      const kJump = isMobile ? wantsJump : (getKeys() as any).jump;
      if (kJump && onGround.current) { velocityY.current = JUMP_VELOCITY; onGround.current = false; }
      velocityY.current += GRAVITY * delta;
      camera.position.y += velocityY.current * delta;
      if (camera.position.y <= FLOOR_Y) { camera.position.y = FLOOR_Y; velocityY.current = 0; onGround.current = true; }
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -29, 29);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -29, 29);

    // Recoil decay
    if (recoilYRef.current > 0) {
      const kick = recoilYRef.current * Math.min(delta * 3, 0.5);
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      euler.x -= kick;
      recoilYRef.current = Math.max(0, recoilYRef.current - delta * 1.2);
      camera.quaternion.setFromEuler(euler);
    }
    if (Math.abs(recoilXRef.current) > 0.0001) {
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      euler.y -= recoilXRef.current * Math.min(delta * 3, 0.5);
      recoilXRef.current *= Math.max(0, 1 - delta * 3);
      camera.quaternion.setFromEuler(euler);
    }

    if (abilityCooldownRef.current > 0) abilityCooldownRef.current = Math.max(0, abilityCooldownRef.current - delta);

    posEmitThrottle.current += delta;
    if (posEmitThrottle.current > 0.05 && socket) {
      posEmitThrottle.current = 0;
      socket.emit("position", { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y });
      onPositionUpdate(camera.position, camera.rotation.y);
    }
  });

  return (
    <>
      {!mobileMode && <PointerLockControls ref={controlsRef} />}
      <Weapon isFiring={isFiringState} isReloading={isReloading} isMoving={isMovingState} nightMode={nightMode} />
      <Effects trails={trails} impacts={impacts} smokes={smokes} />
      {socket && (
        <SpikeSystem
          socket={socket} hasSpike={hasSpike} spikeState={spikeState}
          onSpikeStateChange={onSpikeStateChange}
          onPlantProgress={onPlantProgress} onIsPlanting={onIsPlanting}
          onIsDefusing={onIsDefusing} onDefuseProgress={onDefuseProgress}
          onTimeLeft={onTimeLeft}
          chatFocused={chatFocused} roomId={roomId}
        />
      )}
    </>
  );
}
