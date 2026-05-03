import { useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import HumanoidModel, { AnimState, SkinId } from "./HumanoidModel";

// Bot 0 = Dragon, Bot ENEMY_SPAWNS.length = Legendary (boss-tier enemies)
const BOT_SKINS: Record<number, SkinId> = { 0: "dragon", 5: "legendary" };

// ── Waypoints ──────────────────────────────────────────────────────────────
const ALL_WAYPOINTS: THREE.Vector3[] = [
  new THREE.Vector3(-14, 0.8, -14), new THREE.Vector3(14, 0.8, -14),
  new THREE.Vector3(-14, 0.8, 14),  new THREE.Vector3(14, 0.8, 14),
  new THREE.Vector3(-20, 0.8, 0),   new THREE.Vector3(20, 0.8, 0),
  new THREE.Vector3(0, 0.8, -20),   new THREE.Vector3(0, 0.8, 20),
  new THREE.Vector3(-8, 0.8, -8),   new THREE.Vector3(8, 0.8, 8),
  new THREE.Vector3(8, 0.8, -8),    new THREE.Vector3(-8, 0.8, 8),
];

// 5v5: 5 red enemy bots + 4 green ally bots
const ENEMY_SPAWNS: [number, number, number][] = [
  [-14, 0.8, -14], [14, 0.8, -14], [-14, 0.8, 14], [14, 0.8, 14], [0, 0.8, -22],
];
const ALLY_SPAWNS: [number, number, number][] = [
  [-20, 0.8, 0], [20, 0.8, 0], [0, 0.8, 20], [-10, 0.8, 12],
];
const TOTAL_BOTS = ENEMY_SPAWNS.length + ALLY_SPAWNS.length;

const RESPAWN_TIME    = 4;
const DETECT_RANGE    = 22;
const ATTACK_RANGE    = 6;
const PATROL_SPEED    = 2.5;
const CHASE_SPEED     = 5.0;
const ATTACK_COOLDOWN = 1.3;
const ATTACK_DAMAGE   = 8;
const MAP_BOUND       = 28;

type AIState = "patrol" | "chase" | "strafe" | "attack";
type PeekPhase = "none" | "out" | "back";

interface BotAI {
  id: number;
  team: "red" | "green";
  pos: THREE.Vector3;
  alive: boolean;
  respawnTimer: number;
  state: AIState;
  wpIdx: number;
  attackTimer: number;
  strafeDir: number;
  strafeTimer: number;
  stuckTimer: number;
  prevPos: THREE.Vector3;
  rotY: number;
  targetRotY: number;
  animTime: number;
  // Advanced AI
  isCrouching: boolean;
  crouchTimer: number;
  peekPhase: PeekPhase;
  peekTimer: number;
  coverPos: THREE.Vector3 | null;
}

export interface EnemiesHandle {
  getEnemyMeshes: () => Array<{ id: number; mesh: THREE.Mesh }>;
  killEnemy: (id: number) => void;
}

interface EnemiesProps {
  onKill: (victimId?: string, weapon?: string, isHeadshot?: boolean) => void;
  playerPositionRef?: React.MutableRefObject<THREE.Vector3>;
  onDamagePlayer?: (dmg: number) => void;
}

function randWp(cur: number) {
  let n = Math.floor(Math.random() * ALL_WAYPOINTS.length);
  if (n === cur) n = (n + 1) % ALL_WAYPOINTS.length;
  return n;
}
function clampMap(v: THREE.Vector3) {
  v.x = THREE.MathUtils.clamp(v.x, -MAP_BOUND, MAP_BOUND);
  v.z = THREE.MathUtils.clamp(v.z, -MAP_BOUND, MAP_BOUND);
}

const _dir  = new THREE.Vector3();
const _move = new THREE.Vector3();

const Enemies = forwardRef<EnemiesHandle, EnemiesProps>(({ onKill, playerPositionRef, onDamagePlayer }, ref) => {
  const bots = useRef<BotAI[]>([
    ...ENEMY_SPAWNS.map((p, i): BotAI => ({
      id: i, team: "red", pos: new THREE.Vector3(...p), alive: true, respawnTimer: 0,
      state: "patrol", wpIdx: i % ALL_WAYPOINTS.length,
      attackTimer: Math.random() * ATTACK_COOLDOWN, strafeDir: 1, strafeTimer: 0, stuckTimer: 0,
      prevPos: new THREE.Vector3(...p), rotY: 0, targetRotY: 0, animTime: i * 0.7,
      isCrouching: false, crouchTimer: 0, peekPhase: "none", peekTimer: 0, coverPos: null,
    })),
    ...ALLY_SPAWNS.map((p, i): BotAI => ({
      id: ENEMY_SPAWNS.length + i, team: "green", pos: new THREE.Vector3(...p), alive: true, respawnTimer: 0,
      state: "patrol", wpIdx: (i + 5) % ALL_WAYPOINTS.length,
      attackTimer: Math.random() * ATTACK_COOLDOWN, strafeDir: -1, strafeTimer: 0, stuckTimer: 0,
      prevPos: new THREE.Vector3(...p), rotY: 0, targetRotY: 0, animTime: i * 0.5,
      isCrouching: false, crouchTimer: 0, peekPhase: "none", peekTimer: 0, coverPos: null,
    })),
  ]);

  // Per-bot animation refs (plain objects, act like React refs)
  const botAnimRefs = useRef<Array<{ animState: { current: AnimState }; shootSignal: { current: number } }>>(
    Array.from({ length: TOTAL_BOTS }, () => ({
      animState:   { current: "idle" as AnimState },
      shootSignal: { current: 0 },
    }))
  );

  // Group refs for position/rotation (outer wrapper)
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());
  // Body mesh refs for raycasting hit detection
  const meshRefs  = useRef<Map<number, THREE.Mesh>>(new Map());

  useImperativeHandle(ref, () => ({
    getEnemyMeshes: () => {
      const out: Array<{ id: number; mesh: THREE.Mesh }> = [];
      meshRefs.current.forEach((mesh, id) => {
        const b = bots.current.find((b) => b.id === id);
        if (b?.alive && b.team === "red") out.push({ id, mesh });
      });
      return out;
    },
    killEnemy: (id) => {
      const b = bots.current.find((b) => b.id === id);
      if (b?.alive) {
        b.alive = false; b.respawnTimer = RESPAWN_TIME;
        botAnimRefs.current[id].animState.current = "dead";
        const g = groupRefs.current.get(id);
        if (g) g.visible = false;
        onKill(String(id), "pistol", false);
      }
    },
  }));

  useFrame((_, delta) => {
    const playerPos = playerPositionRef?.current ?? null;

    bots.current.forEach((bot) => {
      // ── Respawn ────────────────────────────────────────────────
      if (!bot.alive) {
        bot.respawnTimer -= delta;
        if (bot.respawnTimer <= 0) {
          bot.alive = true;
          let bestWp = 0;
          if (playerPos) {
            let maxD = 0;
            ALL_WAYPOINTS.forEach((wp, i) => {
              const d = wp.distanceTo(playerPos);
              if (d > maxD) { maxD = d; bestWp = i; }
            });
          } else bestWp = Math.floor(Math.random() * ALL_WAYPOINTS.length);
          bot.pos.copy(ALL_WAYPOINTS[bestWp]);
          bot.state = "patrol"; bot.wpIdx = bestWp;
          botAnimRefs.current[bot.id].animState.current = "walk";
          const g = groupRefs.current.get(bot.id);
          if (g) { g.position.copy(bot.pos); g.visible = true; }
        }
        return;
      }

      bot.prevPos.copy(bot.pos);
      bot.animTime += delta;

      // ── Find target ────────────────────────────────────────────
      let targetPos: THREE.Vector3 | null = null;
      let distToTarget = Infinity;

      if (bot.team === "red") {
        if (playerPos) { distToTarget = bot.pos.distanceTo(playerPos); targetPos = playerPos; }
        bots.current.forEach((b) => {
          if (b.team === "green" && b.alive) {
            const d = bot.pos.distanceTo(b.pos);
            if (d < distToTarget) { distToTarget = d; targetPos = b.pos; }
          }
        });
      } else {
        bots.current.forEach((b) => {
          if (b.team === "red" && b.alive) {
            const d = bot.pos.distanceTo(b.pos);
            if (d < distToTarget) { distToTarget = d; targetPos = b.pos; }
          }
        });
      }

      // ── State machine ──────────────────────────────────────────
      if (targetPos) {
        if (distToTarget <= ATTACK_RANGE) bot.state = "attack";
        else if (distToTarget <= DETECT_RANGE) {
          if (bot.state === "attack") { bot.state = "strafe"; bot.strafeTimer = 0.7 + Math.random() * 0.7; }
          else if (bot.state !== "strafe") bot.state = "chase";
        } else {
          if (bot.state !== "patrol") { bot.state = "patrol"; bot.wpIdx = randWp(bot.wpIdx); }
        }
      } else bot.state = "patrol";

      if (bot.state === "strafe") {
        bot.strafeTimer -= delta;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir = -bot.strafeDir; bot.strafeTimer = 0.5 + Math.random() * 0.6;
          if (distToTarget > ATTACK_RANGE * 1.5) bot.state = "chase";
        }
        // Peek behavior: briefly leave cover, shoot, duck back
        if (bot.peekPhase === "none" && Math.random() < 0.015) {
          bot.peekPhase = "out"; bot.peekTimer = 0.22 + Math.random() * 0.15;
          if (!bot.coverPos) bot.coverPos = bot.pos.clone();
        }
        if (bot.peekPhase === "out") {
          bot.peekTimer -= delta;
          if (bot.peekTimer <= 0) {
            botAnimRefs.current[bot.id].shootSignal.current++;
            bot.peekPhase = "back"; bot.peekTimer = 0.35;
          }
        } else if (bot.peekPhase === "back") {
          bot.peekTimer -= delta;
          if (bot.peekTimer <= 0) { bot.peekPhase = "none"; bot.coverPos = null; }
        }
      } else {
        bot.peekPhase = "none"; bot.coverPos = null;
      }

      // ── Direction ──────────────────────────────────────────────
      _dir.set(0, 0, 0); let speed = PATROL_SPEED;
      if (bot.state === "patrol") {
        const wp = ALL_WAYPOINTS[bot.wpIdx];
        _dir.subVectors(wp, bot.pos); _dir.y = 0;
        if (_dir.length() < 0.8) bot.wpIdx = randWp(bot.wpIdx); else _dir.normalize();
        speed = PATROL_SPEED;
      } else if (bot.state === "chase" && targetPos) {
        _dir.subVectors(targetPos, bot.pos); _dir.y = 0; _dir.normalize(); speed = CHASE_SPEED;
      } else if ((bot.state === "strafe" || bot.state === "attack") && targetPos) {
        _dir.subVectors(targetPos, bot.pos); _dir.y = 0; _dir.normalize();
        _dir.set(-_dir.z * bot.strafeDir, 0, _dir.x * bot.strafeDir);
        speed = bot.state === "attack" ? PATROL_SPEED * 0.5 : CHASE_SPEED * 0.7;
      }

      if (bot.pos.x >  MAP_BOUND - 2) _dir.x -= 2;
      if (bot.pos.x < -MAP_BOUND + 2) _dir.x += 2;
      if (bot.pos.z >  MAP_BOUND - 2) _dir.z -= 2;
      if (bot.pos.z < -MAP_BOUND + 2) _dir.z += 2;
      if (_dir.lengthSq() > 0.001) _dir.normalize();

      _move.copy(_dir).multiplyScalar(speed * delta);
      bot.pos.add(_move); clampMap(bot.pos);

      // Stuck detection
      if (bot.pos.distanceTo(bot.prevPos) < 0.001 && bot.state === "patrol") {
        bot.stuckTimer += delta;
        if (bot.stuckTimer > 0.5) { bot.wpIdx = randWp(bot.wpIdx); bot.stuckTimer = 0; }
      } else bot.stuckTimer = 0;

      // ── Rotation ───────────────────────────────────────────────
      if (bot.state === "attack" && targetPos) {
        bot.targetRotY = Math.atan2(targetPos.x - bot.pos.x, targetPos.z - bot.pos.z);
      } else if (_dir.lengthSq() > 0.001) {
        bot.targetRotY = Math.atan2(_dir.x, _dir.z);
      }
      const diff = ((bot.targetRotY - bot.rotY + Math.PI) % (Math.PI * 2)) - Math.PI;
      bot.rotY += diff * Math.min(1, delta * 10);

      // ── Crouch management ──────────────────────────────────────
      if (bot.isCrouching) {
        bot.crouchTimer -= delta;
        if (bot.crouchTimer <= 0) bot.isCrouching = false;
      }

      // ── Attack ─────────────────────────────────────────────────
      if (bot.state === "attack" && targetPos) {
        bot.attackTimer -= delta;
        if (bot.attackTimer <= 0) {
          bot.attackTimer = ATTACK_COOLDOWN + Math.random() * 0.4;
          // Random crouch on shot — makes bots harder to hit
          if (Math.random() < 0.38 && !bot.isCrouching) {
            bot.isCrouching = true; bot.crouchTimer = 0.7 + Math.random() * 1.1;
          } else if (bot.isCrouching && Math.random() < 0.45) {
            bot.isCrouching = false;
          }
          // Trigger shoot animation
          botAnimRefs.current[bot.id].shootSignal.current++;

          if (distToTarget <= ATTACK_RANGE + 1) {
            if (bot.team === "red" && playerPos && targetPos === playerPos) {
              onDamagePlayer?.(ATTACK_DAMAGE);
            } else if (bot.team === "green") {
              let closest: BotAI | null = null; let minD = Infinity;
              bots.current.forEach((b) => {
                if (b.team === "red" && b.alive) {
                  const d = bot.pos.distanceTo(b.pos);
                  if (d < minD) { minD = d; closest = b; }
                }
              });
              if (closest && minD <= ATTACK_RANGE + 1) {
                (closest as BotAI).alive = false; (closest as BotAI).respawnTimer = RESPAWN_TIME;
                botAnimRefs.current[(closest as BotAI).id].animState.current = "dead";
                const g = groupRefs.current.get((closest as BotAI).id);
                if (g) g.visible = false;
                // Bot-vs-bot kill: do NOT call onKill — only player kills award XP
              }
            } else if (bot.team === "red") {
              let closest: BotAI | null = null; let minD = Infinity;
              bots.current.forEach((b) => {
                if (b.team === "green" && b.alive) {
                  const d = bot.pos.distanceTo(b.pos);
                  if (d < minD) { minD = d; closest = b; }
                }
              });
              if (closest && minD <= ATTACK_RANGE + 1) {
                (closest as BotAI).alive = false; (closest as BotAI).respawnTimer = RESPAWN_TIME;
                botAnimRefs.current[(closest as BotAI).id].animState.current = "dead";
                const g = groupRefs.current.get((closest as BotAI).id);
                if (g) g.visible = false;
              }
            }
          }
        }
      }

      // ── Update anim state from AI state ────────────────────────
      const bar = botAnimRefs.current[bot.id];
      if (bot.state === "attack")                                 bar.animState.current = "shoot";
      else if (bot.state === "chase" || bot.state === "strafe")  bar.animState.current = "run";
      else if (bot.state === "patrol")                           bar.animState.current = "walk";
      else                                                       bar.animState.current = "idle";

      // ── Apply position/rotation/crouch ─────────────────────────
      const g = groupRefs.current.get(bot.id);
      if (g) {
        const crouchTarget = bot.isCrouching ? 0.6 : 1;
        g.scale.y = THREE.MathUtils.lerp(g.scale.y, crouchTarget, delta * 12);
        // Peek: offset position towards cover when peeking back
        if (bot.peekPhase === "back" && bot.coverPos) {
          const cp = bot.coverPos;
          g.position.lerp(cp, delta * 8);
        } else {
          g.position.copy(bot.pos);
        }
        g.rotation.y = bot.rotY;
      }
    });
  });

  const allBots = [
    ...ENEMY_SPAWNS.map((_, i) => ({ id: i, team: "red" as const })),
    ...ALLY_SPAWNS.map((_, i) => ({ id: ENEMY_SPAWNS.length + i, team: "green" as const })),
  ];

  return (
    <group>
      {allBots.map(({ id, team }) => (
        <group
          key={id}
          ref={(g) => { if (g) groupRefs.current.set(id, g); }}
          scale={team === "red" ? [1, 1, 1] : [0.97, 0.97, 0.97]}
        >
          <HumanoidModel
            animStateRef={botAnimRefs.current[id].animState}
            shootSignalRef={botAnimRefs.current[id].shootSignal}
            team={team}
            isFounder={false}
            skin={BOT_SKINS[id] ?? "default"}
            onBodyMesh={(m) => {
              if (m) meshRefs.current.set(id, m);
              else meshRefs.current.delete(id);
            }}
          />
        </group>
      ))}
    </group>
  );
});

Enemies.displayName = "Enemies";
export default Enemies;
