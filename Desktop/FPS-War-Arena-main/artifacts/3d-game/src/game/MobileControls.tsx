import { useEffect, useRef, useCallback, useState } from "react";

export interface MobileInput {
  dx: number;
  dy: number;
  lookDx: number;
  lookDy: number;
  fire: boolean;
  jump: boolean;
  ability: boolean;
  reload: boolean;
}

interface MobileControlsProps {
  active: boolean;
  sensitivity: number;
  onInput: (input: Partial<MobileInput>) => void;
  onFire: () => void;
  onJump: () => void;
  onAbility: () => void;
  onReload: () => void;
  isFounder: boolean;
  onOpenAdmin: () => void;
}

export default function MobileControls({
  active, sensitivity, onInput, onFire, onJump, onAbility, onReload, isFounder, onOpenAdmin,
}: MobileControlsProps) {
  const joystickAreaRef = useRef<HTMLDivElement>(null);
  const lookAreaRef = useRef<HTMLDivElement>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickTouchRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const gyroEnabledRef = useRef(false);
  const lastBetaRef  = useRef<number | null>(null);
  const lastGammaRef = useRef<number | null>(null);

  const JOYSTICK_MAX = 50;

  const handleJoystickStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (joystickTouchRef.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchRef.current = touch.identifier;
    joystickOriginRef.current = { x: touch.clientX, y: touch.clientY };
    if (joystickBaseRef.current) {
      joystickBaseRef.current.style.opacity = "0.7";
    }
  }, []);

  const handleJoystickMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (joystickTouchRef.current === null) return;
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === joystickTouchRef.current);
    if (!touch) return;
    const dx = touch.clientX - joystickOriginRef.current.x;
    const dy = touch.clientY - joystickOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_MAX);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * clamped) / JOYSTICK_MAX;
    const ny = (Math.sin(angle) * clamped) / JOYSTICK_MAX;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`;
    }
    onInput({ dx: nx, dy: ny });
  }, [onInput]);

  const handleJoystickEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === joystickTouchRef.current);
    if (!touch) return;
    joystickTouchRef.current = null;
    if (joystickKnobRef.current) joystickKnobRef.current.style.transform = "translate(-50%, -50%)";
    if (joystickBaseRef.current) joystickBaseRef.current.style.opacity = "0.4";
    onInput({ dx: 0, dy: 0 });
  }, [onInput]);

  const handleLookStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (lookTouchRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchRef.current = { id: touch.identifier, lastX: touch.clientX, lastY: touch.clientY };
  }, []);

  const handleLookMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!lookTouchRef.current) return;
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === lookTouchRef.current!.id);
    if (!touch) return;
    const ldx = (touch.clientX - lookTouchRef.current.lastX) * sensitivity * 0.4;
    const ldy = (touch.clientY - lookTouchRef.current.lastY) * sensitivity * 0.4;
    lookTouchRef.current.lastX = touch.clientX;
    lookTouchRef.current.lastY = touch.clientY;
    onInput({ lookDx: ldx, lookDy: ldy });
  }, [onInput, sensitivity]);

  const handleLookEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = Array.from(e.changedTouches).find((t) => t.identifier === lookTouchRef.current?.id);
    if (!touch) return;
    lookTouchRef.current = null;
    onInput({ lookDx: 0, lookDy: 0 });
  }, [onInput]);

  useEffect(() => {
    if (!active) return;
    const joy = joystickAreaRef.current;
    const look = lookAreaRef.current;
    if (!joy || !look) return;
    joy.addEventListener("touchstart", handleJoystickStart, { passive: false });
    joy.addEventListener("touchmove", handleJoystickMove, { passive: false });
    joy.addEventListener("touchend", handleJoystickEnd, { passive: false });
    look.addEventListener("touchstart", handleLookStart, { passive: false });
    look.addEventListener("touchmove", handleLookMove, { passive: false });
    look.addEventListener("touchend", handleLookEnd, { passive: false });
    return () => {
      joy.removeEventListener("touchstart", handleJoystickStart);
      joy.removeEventListener("touchmove", handleJoystickMove);
      joy.removeEventListener("touchend", handleJoystickEnd);
      look.removeEventListener("touchstart", handleLookStart);
      look.removeEventListener("touchmove", handleLookMove);
      look.removeEventListener("touchend", handleLookEnd);
    };
  }, [active, handleJoystickStart, handleJoystickMove, handleJoystickEnd, handleLookStart, handleLookMove, handleLookEnd]);

  // ── Gyroscope (DeviceOrientationEvent) ──────────────────────────────────
  useEffect(() => {
    if (!active || !gyroEnabled) { lastBetaRef.current = null; lastGammaRef.current = null; return; }
    gyroEnabledRef.current = true;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!gyroEnabledRef.current) return;
      const beta  = e.beta  ?? 0;   // front-back tilt  → vertical aim
      const gamma = e.gamma ?? 0;   // left-right tilt  → horizontal aim

      if (lastBetaRef.current === null) { lastBetaRef.current = beta; lastGammaRef.current = gamma; return; }

      const dBeta  = beta  - (lastBetaRef.current  ?? beta);
      const dGamma = gamma - (lastGammaRef.current ?? gamma);
      lastBetaRef.current  = beta;
      lastGammaRef.current = gamma;

      const GYRO_SENSITIVITY = sensitivity * 0.28;
      onInput({ lookDx: dGamma * GYRO_SENSITIVITY, lookDy: dBeta * GYRO_SENSITIVITY });
    };
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => {
      gyroEnabledRef.current = false;
      window.removeEventListener("deviceorientation", handleOrientation);
      lastBetaRef.current = null; lastGammaRef.current = null;
    };
  }, [active, gyroEnabled, sensitivity, onInput]);

  if (!active) return null;

  return (
    <>
      {/* Left: Joystick area */}
      <div className="mobile-joy-area" ref={joystickAreaRef}>
        <div className="mobile-joy-base" ref={joystickBaseRef}>
          <div className="mobile-joy-knob" ref={joystickKnobRef} />
        </div>
      </div>

      {/* Right: Look area */}
      <div className="mobile-look-area" ref={lookAreaRef} />

      {/* Action buttons */}
      <div className="mobile-action-btns">
        <button className="mobile-btn mobile-fire" onTouchStart={(e) => { e.preventDefault(); onFire(); }}>🔫</button>
        <div className="mobile-secondary-btns">
          <button className="mobile-btn mobile-jump" onTouchStart={(e) => { e.preventDefault(); onJump(); }}>⬆</button>
          <button className="mobile-btn mobile-ability" onTouchStart={(e) => { e.preventDefault(); onAbility(); }}>⚡</button>
          <button className="mobile-btn mobile-reload" onTouchStart={(e) => { e.preventDefault(); onReload(); }}>🔄</button>
        </div>
      </div>

      {/* Gyroscope toggle */}
      <button
        className={`mobile-gyro-btn${gyroEnabled ? " active" : ""}`}
        onTouchStart={(e) => {
          e.preventDefault();
          const next = !gyroEnabled;
          setGyroEnabled(next);
          if (next && typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
            (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
              .requestPermission()
              .then((perm: string) => { if (perm !== "granted") setGyroEnabled(false); })
              .catch(() => setGyroEnabled(false));
          }
        }}
        title="Jiroskop Nişan Alma"
      >
        {gyroEnabled ? "🎯" : "📱"}
      </button>

      {/* Founder admin quick access */}
      {isFounder && (
        <button className="mobile-admin-btn" onTouchStart={(e) => { e.preventDefault(); onOpenAdmin(); }}>🛡️</button>
      )}
    </>
  );
}
