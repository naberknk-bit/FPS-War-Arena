import { useState, useEffect, useRef, useCallback } from "react";

interface Target {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hp: number;
  points: number;
  color: string;
  alive: boolean;
  type: "normal" | "fast" | "armored" | "bonus";
}

let _tid = 1;

function makeTarget(level: number): Target {
  const types: Target["type"][] = level < 3 ? ["normal"] : level < 5 ? ["normal", "fast"] : ["normal", "fast", "armored", "bonus"];
  const type = types[Math.floor(Math.random() * types.length)];
  const cfg = {
    normal:  { size: 52, hp: 1, points: 100, color: "#ff4655", speed: 1.2 + level * 0.15 },
    fast:    { size: 38, hp: 1, points: 200, color: "#ffcc44", speed: 2.2 + level * 0.2 },
    armored: { size: 62, hp: 3, points: 350, color: "#4488ff", speed: 0.7 + level * 0.1 },
    bonus:   { size: 30, hp: 1, points: 500, color: "#44ff88", speed: 2.8 + level * 0.2 },
  }[type];
  const speed = cfg.speed;
  const angle = Math.random() * Math.PI * 2;
  return {
    id: _tid++,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 70,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: cfg.size,
    hp: cfg.hp,
    points: cfg.points,
    color: cfg.color,
    alive: true,
    type,
  };
}

interface HitEffect {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

const SCOPE_SIZE = 200;

export default function SniperEliteGame({ onBack }: { onBack: () => void }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [level, setLevel] = useState(1);
  const [hits, setHits] = useState(0);
  const [effects, setEffects] = useState<HitEffect[]>([]);
  const [scopePos, setScopePos] = useState({ x: 0, y: 0 });
  const [scopeVisible, setScopeVisible] = useState(false);
  const [windX, setWindX] = useState(() => (Math.random() - 0.5) * 2.5);
  const [windY, setWindY] = useState(() => (Math.random() - 0.5) * 1.2);
  const [breathe, setBreathe] = useState(0);
  const [holding, setHolding] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const breatheRef = useRef(0);

  const addEffect = useCallback((x: number, y: number, text: string, color: string) => {
    const id = Date.now() + Math.random();
    setEffects(e => [...e.slice(-12), { id, x, y, text, color, t: 1 }]);
    setTimeout(() => setEffects(e => e.filter(ef => ef.id !== id)), 900);
  }, []);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setGameOver(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameStarted, gameOver]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const spawnInterval = setInterval(() => {
      setTargets(prev => {
        const alive = prev.filter(t => t.alive).length;
        const cap = Math.min(4 + level, 10);
        if (alive >= cap) return prev;
        return [...prev.filter(t => t.alive), makeTarget(level)];
      });
    }, 800);
    return () => clearInterval(spawnInterval);
  }, [gameStarted, gameOver, level]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const loop = (now: number) => {
      const delta = Math.min((now - lastTime.current) / 1000, 0.05);
      lastTime.current = now;
      breatheRef.current += delta;
      const b = holding ? 0 : Math.sin(breatheRef.current * 1.4) * 8 + Math.cos(breatheRef.current * 0.9) * 4;
      setTargets(prev => prev.map(t => {
        if (!t.alive) return t;
        let nx = t.x + t.vx * delta * 60;
        let ny = t.y + t.vy * delta * 60;
        let nvx = t.vx;
        let nvy = t.vy;
        if (nx < 3 || nx > 97) { nvx = -nvx; nx = Math.max(3, Math.min(97, nx)); }
        if (ny < 5 || ny > 90) { nvy = -nvy; ny = Math.max(5, Math.min(90, ny)); }
        return { ...t, x: nx, y: ny, vx: nvx, vy: nvy };
      }));
      animRef.current = requestAnimationFrame(loop);
    };
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gameStarted, gameOver, holding]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const windTimer = setInterval(() => {
      setWindX((Math.random() - 0.5) * 2.5);
      setWindY((Math.random() - 0.5) * 1.2);
    }, 5000);
    return () => clearInterval(windTimer);
  }, [gameStarted, gameOver]);

  useEffect(() => {
    if (hits > 0 && hits % 10 === 0) {
      setLevel((l) => Math.min(l + 1, 10));
    }
  }, [hits]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    setScopePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setScopeVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => setScopeVisible(false), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!gameStarted || gameOver) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;
    const drift = { x: windX + (holding ? 0 : breathe * 0.15), y: windY };
    const ax = cx + drift.x * 0.5;
    const ay = cy + drift.y * 0.5;

    let hitAny = false;
    setTargets(prev => prev.map(t => {
      if (!t.alive || hitAny) return t;
      const dx = ax - t.x; const dy = ay - t.y;
      const hw = (t.size / rect.width) * 50;
      const hh = (t.size / rect.height) * 50;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
        hitAny = true;
        const isHeadshot = Math.abs(dx) < hw * 0.35 && Math.abs(dy) < hh * 0.35;
        const newHp = t.hp - 1;
        if (newHp <= 0) {
          const mult = isHeadshot ? 2 : 1;
          const pts = t.points * mult * (streak > 4 ? 2 : 1);
          setScore(s => s + pts);
          setHits(h => h + 1);
          setStreak(s => { const ns = s + 1; if (ns > bestStreak) setBestStreak(ns); return ns; });
          addEffect(e.clientX - rect.left, e.clientY - rect.top, isHeadshot ? `🎯 HEADSHOT! +${pts}` : `+${pts}`, isHeadshot ? "#ffcc44" : t.color);
          return { ...t, hp: 0, alive: false };
        }
        addEffect(e.clientX - rect.left, e.clientY - rect.top, `HIT -${1}`, t.color);
        return { ...t, hp: newHp };
      }
      return t;
    }));

    if (!hitAny) {
      setMisses(m => m + 1);
      setStreak(0);
      addEffect(e.clientX - rect.left, e.clientY - rect.top, "MISS", "#ff4655");
    }
  }, [gameStarted, gameOver, windX, windY, breathe, holding, streak, bestStreak, addEffect]);

  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100;

  const ScopeOverlay = () => (
    <div style={{ position: "absolute", left: scopePos.x - SCOPE_SIZE / 2 + breathe + windX * 2, top: scopePos.y - SCOPE_SIZE / 2 + windY * 2, width: SCOPE_SIZE, height: SCOPE_SIZE, pointerEvents: "none", zIndex: 30 }}>
      <svg width={SCOPE_SIZE} height={SCOPE_SIZE} viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
        <circle cx="100" cy="100" r="80" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <line x1="100" y1="2" x2="100" y2="40" stroke="#ff4655" strokeWidth="1.5" />
        <line x1="100" y1="160" x2="100" y2="198" stroke="#ff4655" strokeWidth="1.5" />
        <line x1="2" y1="100" x2="40" y2="100" stroke="#ff4655" strokeWidth="1.5" />
        <line x1="160" y1="100" x2="198" y2="100" stroke="#ff4655" strokeWidth="1.5" />
        {[60, 80, 120, 140].map(p => (
          <line key={`v${p}`} x1={p} y1="97" x2={p} y2="103" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        ))}
        {[60, 80, 120, 140].map(p => (
          <line key={`h${p}`} x1="97" y1={p} x2="103" y2={p} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        ))}
        <circle cx="100" cy="100" r="4" fill="none" stroke="#ff4655" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="1.5" fill="#ff4655" />
        <text x="150" y="96" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">MIL</text>
        <text x="150" y="106" fill="rgba(255,70,85,0.7)" fontSize="8" fontFamily="monospace">{Math.round((windX ** 2 + windY ** 2) ** 0.5 * 10) / 10}</text>
      </svg>
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a1a", position: "relative", overflow: "hidden", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", background: "rgba(0,0,0,0.8)", borderBottom: "1px solid rgba(255,170,68,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,170,68,0.1)", border: "1px solid #ffaa44", color: "#ffaa44", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", letterSpacing: "0.1em" }}>← PORTAL</button>
          <div style={{ color: "#ffaa44", fontWeight: 900, fontSize: "1rem", letterSpacing: "0.2em" }}>🎯 SNİPER ELİTE</div>
          <div style={{ color: "#666", fontSize: "0.75rem" }}>SEVİYE {level}</div>
        </div>
        <div style={{ display: "flex", gap: 20, color: "#fff", fontSize: "0.82rem", alignItems: "center" }}>
          <div>⏱ <strong style={{ color: timeLeft <= 10 ? "#ff4655" : "#ffcc44" }}>{timeLeft}s</strong></div>
          <div>💎 <strong style={{ color: "#ffaa44" }}>{score.toLocaleString()}</strong></div>
          <div>🔥 <strong style={{ color: streak > 4 ? "#ff4655" : "#fff" }}>{streak}</strong> seri</div>
          <div>🎯 <strong style={{ color: "#44aaff" }}>{accuracy}%</strong></div>
          <div>
            <span style={{ color: "#555", fontSize: "0.7rem" }}>RÜZGAR</span>
            <span style={{ color: "#aaa", marginLeft: 6 }}>{windX > 0 ? "→" : "←"}{Math.abs(windX).toFixed(1)}</span>
          </div>
          <button onMouseDown={() => setHolding(true)} onMouseUp={() => setHolding(false)}
            style={{ background: holding ? "rgba(255,170,68,0.3)" : "rgba(255,170,68,0.1)", border: "1px solid #ffaa44", color: "#ffaa44", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: "0.72rem" }}>
            {holding ? "🫁 TUTTU" : "🫁 TUT (NEFES)"}
          </button>
        </div>
      </div>

      {!gameStarted && !gameOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40, background: "rgba(0,0,0,0.85)" }}>
          <div style={{ textAlign: "center", color: "#fff", maxWidth: 420 }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: "2rem", marginBottom: 12, color: "#ffaa44", fontWeight: 900, letterSpacing: "0.2em" }}>SNİPER ELİTE</div>
            <div style={{ color: "#888", marginBottom: 6, fontSize: "0.85rem", lineHeight: 1.7 }}>
              Hareket eden hedeflere tıkla · Headshot = 2x puan<br />
              Nefes tut = Titreme durur · Rüzgar sürükler
            </div>
            <div style={{ color: "#555", marginBottom: 24, fontSize: "0.75rem" }}>60 saniye — Mümkün olduğunca çok puan topla</div>
            <button onClick={() => setGameStarted(true)}
              style={{ background: "#ffaa44", color: "#000", border: "none", borderRadius: 8, padding: "14px 48px", fontSize: "1.1rem", fontWeight: 900, cursor: "pointer", letterSpacing: "0.15em" }}>
              BAŞLAT
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40, background: "rgba(0,0,0,0.9)" }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8, color: "#ffaa44", fontWeight: 900, letterSpacing: "0.2em" }}>SÜRE BİTTİ</div>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: "#ffcc44", marginBottom: 8 }}>{score.toLocaleString()}</div>
            <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: 4 }}>Hedef: {hits} · Kaçış: {misses} · İsabet: {accuracy}%</div>
            <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: 20 }}>En iyi seri: {bestStreak} · Seviye: {level}</div>
            <button onClick={() => { setScore(0); setHits(0); setMisses(0); setStreak(0); setLevel(1); setTimeLeft(60); setTargets([]); setGameOver(false); setGameStarted(true); }}
              style={{ background: "#ffaa44", color: "#000", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: "1rem", fontWeight: 900, cursor: "pointer", marginRight: 12 }}>
              YENİDEN
            </button>
            <button onClick={onBack}
              style={{ background: "rgba(255,70,85,0.15)", color: "#ff4655", border: "1px solid #ff4655", borderRadius: 8, padding: "12px 32px", fontSize: "1rem", cursor: "pointer" }}>
              PORTAL'A DÖN
            </button>
          </div>
        </div>
      )}

      <div ref={fieldRef} onClick={handleClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        style={{ position: "absolute", inset: 0, top: 50, cursor: "none", background: "linear-gradient(180deg, #0a1628 0%, #1a2a1a 40%, #2a1a0a 100%)", overflow: "hidden" }}>

        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} style={{ position: "absolute", width: 2, height: 2, background: "rgba(255,255,255,0.6)", borderRadius: "50%", left: `${(i * 37 + 7) % 100}%`, top: `${(i * 23 + 11) % 100}%` }} />
        ))}
        <div style={{ position: "absolute", bottom: "30%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: "25%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.03)" }} />

        {targets.filter(t => t.alive).map(t => {
          const fieldRect = fieldRef.current?.getBoundingClientRect();
          const px = fieldRect ? (t.x / 100) * fieldRect.width : t.x * 8;
          const py = fieldRect ? (t.y / 100) * (fieldRect.height - 50) : t.y * 6;
          const icons = { normal: "🎯", fast: "⚡", armored: "🛡️", bonus: "⭐" };
          return (
            <div key={t.id} style={{ position: "absolute", left: px - t.size / 2, top: py - t.size / 2, width: t.size, height: t.size, transition: "none" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `3px solid ${t.color}`, background: `radial-gradient(circle, ${t.color}22 0%, ${t.color}08 100%)`, boxShadow: `0 0 ${t.type === "bonus" ? 20 : 10}px ${t.color}88`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <div style={{ fontSize: t.size * 0.28 }}>{icons[t.type]}</div>
                {t.hp > 1 && (
                  <div style={{ position: "absolute", bottom: -8, left: "10%", right: "10%", height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${(t.hp / 3) * 100}%`, height: "100%", background: t.color }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {effects.map(ef => (
          <div key={ef.id} style={{ position: "absolute", left: ef.x, top: ef.y, color: ef.color, fontWeight: 900, fontSize: "0.9rem", pointerEvents: "none", animation: "floatUp 0.9s ease-out forwards", whiteSpace: "nowrap", textShadow: `0 0 8px ${ef.color}` }}>
            {ef.text}
          </div>
        ))}

        {scopeVisible && gameStarted && !gameOver && <ScopeOverlay />}

        {streak >= 3 && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", color: streak >= 7 ? "#ff4655" : "#ffcc44", fontWeight: 900, fontSize: "0.85rem", letterSpacing: "0.2em", textShadow: "0 0 12px currentColor", pointerEvents: "none" }}>🔥 {streak}x SERİ{streak >= 5 ? " — UNSTOPPABLE!" : ""}</div>}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
