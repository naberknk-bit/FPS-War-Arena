import { Canvas, useThree } from "@react-three/fiber";
import { KeyboardControls, Preload } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, DepthOfField, ChromaticAberration } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import Map, { MapId } from "./Map";
import Player, { MobileRefs } from "./Player";
import Enemies, { EnemiesHandle } from "./Enemies";
import HUD from "./HUD";
import ChatOverlay from "./ChatOverlay";
import VoiceChat from "./VoiceChat";
import RoomSystem from "./RoomSystem";
import CharacterSelect, { PlayerClass } from "./CharacterSelect";
import MVPScreen from "./MVPScreen";
import AdminPanel from "./AdminPanel";
import BuyMenu, { WeaponDef, WeaponId, WEAPONS } from "./BuyMenu";
import KillFeed, { KillEvent } from "./KillFeed";
import Scoreboard from "./Scoreboard";
import MiniMap from "./MiniMap";
import RankedQueue from "./RankedQueue";
import { SpikeState } from "./Spike";
import { getSocket } from "./socket";
import { Socket } from "socket.io-client";
import { playRoundWin, playRoundLoss } from "./AudioEngine";
import SettingsPanel from "./SettingsPanel";
import MobileControls from "./MobileControls";
import Leaderboard from "./Leaderboard";
import SpraySystem from "./SpraySystem";
import Market from "./Market";
import type { InventoryItem } from "./Market";
import FounderAura from "./FounderAura";
import LastKillReplay, { LastKill } from "./LastKillReplay";
import RemotePlayers from "./RemotePlayers";
import DeathScreen from "./DeathScreen";
import ParticleSystem from "./ParticleSystem";
import WeatherSystem, { WeatherType } from "./WeatherSystem";
import Portal from "./Portal";
import BattleArenaGame from "./BattleArenaGame";
import ZombieSurvivalGame from "./ZombieSurvivalGame";
import SniperEliteGame from "./SniperEliteGame";
import SpectatorCamera, { SpectatorHUD } from "./SpectatorCamera";
import DailyChallenges from "./DailyChallenges";
import BosnaMarket from "./BosnaMarket";
import CreatorPanel from "./CreatorPanel";
import FounderShield from "./FounderShield";
import { BattleRoyaleZone, BattleRoyaleHUD } from "./BattleRoyale";
import { ZombiePortalScene, ZombieHUD } from "./ZombieMode";
import TradeWindow from "./TradeWindow";
import RankUpCinematic from "./RankUpCinematic";
import MapSelect from "./MapSelect";
import { MAP_CONFIGS } from "./Map";
import NukeEffect from "./NukeEffect";
import BlackholeEffect from "./BlackholeEffect";
import SpawnedEntity, { EntityType } from "./SpawnedEntity";
import AuctionHouse from "./AuctionHouse";
import DeathmatchHUD from "./DeathmatchHUD";

// ── Performance Mode Scene Manager (runs inside Canvas) ───────────────────────
function PerfSceneManager({ perfMode }: { perfMode: boolean }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    gl.setPixelRatio(perfMode ? 1 : Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = !perfMode;
    gl.shadowMap.needsUpdate = true;
    const cam = camera as THREE.PerspectiveCamera;
    cam.far = perfMode ? 120 : 500;
    cam.updateProjectionMatrix();
    scene.traverse((obj) => {
      if (obj instanceof THREE.PointLight || obj instanceof THREE.SpotLight) {
        obj.visible = !perfMode;
      }
      if (obj instanceof THREE.DirectionalLight) {
        obj.castShadow = !perfMode;
        obj.intensity = perfMode ? Math.min(obj.intensity, 0.2) : obj.intensity;
      }
      if (obj instanceof THREE.Mesh) {
        if (perfMode && Array.isArray(obj.receiveShadow)) { obj.receiveShadow = false; }
        if (perfMode) { obj.receiveShadow = false; obj.castShadow = false; }
      }
    });
  }, [perfMode, gl, camera, scene]);
  return perfMode ? <ambientLight intensity={1.4} color="#cccccc" /> : null;
}

const keyMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "back",    keys: ["ArrowDown", "KeyS"] },
  { name: "left",    keys: ["ArrowLeft", "KeyA"] },
  { name: "right",   keys: ["ArrowRight", "KeyD"] },
  { name: "jump",    keys: ["Space"] },
];

const API_BASE = "/api";
const ABILITY_COOLDOWN = 12;

type Screen = "portal" | "login" | "verify" | "lobby" | "classSelect" | "game" | "mvp" | "rankedQueue" | "battleArena" | "zombieSurvival" | "sniperElite";
type LangKey = "tr" | "en" | "es" | "ru";
type AuthMode = "login" | "register";
type PlayerSkin = "default" | "dragon" | "legendary" | "rare_red" | "rare_blue" | "rare_gold";

interface AuthUser {
  id: number; username: string; isFounder: boolean; isVerified: boolean;
  totalKills: number; totalGames: number; xp: number; level: number; rr?: number;
}

interface RadioToast { id: number; message: string; color: string; }

let _toastId = 0;

function getStoredToken() { return localStorage.getItem("game_token"); }
function setStoredToken(t: string) { localStorage.setItem("game_token", t); }
function clearStoredToken() { localStorage.removeItem("game_token"); }

function getRankInfo(rr: number) {
  if (rr >= 1200) return { name: "Radyant", color: "#ff4655" };
  if (rr >= 1000) return { name: "Elmas", color: "#44ccff" };
  if (rr >= 800)  return { name: "Platin", color: "#44ffaa" };
  if (rr >= 600)  return { name: "Altın", color: "#ffcc44" };
  if (rr >= 400)  return { name: "Gümüş", color: "#aaaaaa" };
  if (rr >= 200)  return { name: "Bronz", color: "#cc8844" };
  return { name: "Demir", color: "#888888" };
}

export default function Game() {
  const [screen, setScreen] = useState<Screen>("portal");
  const [lang, setLang] = useState<LangKey>(() => (localStorage.getItem("bosna_lang") as LangKey) ?? "tr");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [money, setMoney] = useState(800);
  const [ammo, setAmmo] = useState(15);
  const [kills, setKills] = useState(0);
  const [chatFocused, setChatFocused] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [vsMode, setVsMode] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentMap, setCurrentMap] = useState<MapId>("astral");

  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const [selectedSkin, setSelectedSkin] = useState<PlayerSkin>("default");
  const [currentWeapon, setCurrentWeapon] = useState<WeaponId>("pistol");
  const [hasArmor, setHasArmor] = useState(false);
  const [abilityCooldown, setAbilityCooldown] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [radioToasts, setRadioToasts] = useState<RadioToast[]>([]);
  const [isFly, setIsFly] = useState(false);
  const [isGod, setIsGod] = useState(false);

  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [rr, setRr] = useState(0);
  const [rrChange, setRrChange] = useState<number | null>(null);

  const [gameKills, setGameKills] = useState(0);
  const [gameDeaths, setGameDeaths] = useState(0);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showBuyMenu, setShowBuyMenu] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [adminTeleport, setAdminTeleport] = useState<{ x: number; y: number; z: number } | null>(null);

  const [killFeedEvents, setKillFeedEvents] = useState<KillEvent[]>([]);

  const [spikeState, setSpikeState] = useState<SpikeState>({ armed: false, plantedAt: null, position: null, defused: false, exploded: false });
  const [hasSpike, setHasSpike] = useState(false);
  const [isPlanting, setIsPlanting] = useState(false);
  const [plantProgress, setPlantProgress] = useState(0);
  const [isDefusing, setIsDefusing] = useState(false);
  const [defuseProgress, setDefuseProgress] = useState(0);
  const [spikeTimeLeft, setSpikeTimeLeft] = useState(0);

  const [roundMsg, setRoundMsg] = useState<string | null>(null);
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const [round, setRound] = useState(1);

  const [hitmarkerActive, setHitmarkerActive] = useState(false);
  const [criticalHit, setCriticalHit] = useState(false);

  const [myPosition, setMyPosition] = useState(new THREE.Vector3(0, 1.65, 5));
  const [myRotationY, setMyRotationY] = useState(0);

  // Settings & Mobile
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMode, setMobileMode] = useState<boolean>(() => localStorage.getItem("mobile_mode") === "true");
  const [sensitivity, setSensitivity] = useState<number>(() => parseFloat(localStorage.getItem("sensitivity") ?? "2"));
  const [isLocked, setIsLocked] = useState(false);

  // Night mode (default ON — potato graphics = day mode)
  const [nightMode, setNightMode] = useState(true);

  // Broadcast & event announcements from admin
  const [broadcastAnnounce, setBroadcastAnnounce] = useState<string | null>(null);
  const [eventAnnounce, setEventAnnounce] = useState<string | null>(null);

  // Leaderboard & Market
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("inventory") ?? "[]"); } catch { return []; }
  });

  // New features
  const [weather, setWeather]             = useState<WeatherType>("clear");
  const [bosnaCoins, setBosnaCoins]       = useState(0);
  const [showDailyChallenges, setShowDailyChallenges] = useState(false);
  const [showBosnaMarket, setShowBosnaMarket]         = useState(false);

  // Performance mode (Ultra-Low Graphics)
  const [perfMode, setPerfMode] = useState(() => localStorage.getItem("perf_mode") === "true");

  // Creator panel + new systems
  const [showCreatorPanel, setShowCreatorPanel] = useState(false);
  const [showMapSelect, setShowMapSelect]       = useState(false);
  const [showTradeWindow, setShowTradeWindow]   = useState(false);
  const [brActive, setBrActive]                 = useState(false);
  const [zombieActive, setZombieActive]         = useState(false);
  const [shieldVisible, setShieldVisible]       = useState(false);
  const [founderPresent, setFounderPresent]     = useState(false);
  const [playerScale, setPlayerScale]           = useState(1.0);
  const [mapExplodeFlash, setMapExplodeFlash]   = useState(false);

  // Rank-up cinematic
  const [showRankUp, setShowRankUp]             = useState(false);
  const [rankUpLevel, setRankUpLevel]           = useState(1);
  const prevLevelRef                            = useRef(1);

  // Super-Admin GOD powers
  const [nukeActive,    setNukeActive]    = useState(false);
  const [blackholeActive, setBlackholeActive] = useState(false);
  const [spawnedEntities, setSpawnedEntities] = useState<Array<{ id: number; type: EntityType; pos: [number, number, number] }>>([]);
  const [slowFactor,    setSlowFactor]    = useState(1.0);
  const slowOverlayActive = slowFactor < 0.95;
  const spawnIdRef = useRef(0);

  // Deathmatch mode
  const [deathmatchActive, setDeathmatchActive] = useState(false);

  // Auction House
  const [showAuction, setShowAuction] = useState(false);

  const WEATHER_CYCLE: WeatherType[] = ["clear", "rain", "snow", "sandstorm"];
  const cycleWeather = useCallback(() => {
    setWeather(w => { const i = WEATHER_CYCLE.indexOf(w); return WEATHER_CYCLE[(i + 1) % WEATHER_CYCLE.length]; });
  }, []);

  // Founder aura — track founder positions from socket
  const [founderPositions, setFounderPositions] = useState<{ id: string; pos: THREE.Vector3 }[]>([]);
  const [founderAnnounce, setFounderAnnounce] = useState<string | null>(null);

  // Last kill replay
  const [lastKill, setLastKill] = useState<LastKill | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  // Multiplayer
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<"red" | "blue" | "none">("none");
  const [teammateHitToast, setTeammateHitToast] = useState<{ id: number; name: string } | null>(null);
  let _toastCounter = 0;

  // Death
  const [isDead, setIsDead] = useState(false);
  const [killedBy, setKilledBy] = useState<string | undefined>(undefined);
  const [killedByIsFounder, setKilledByIsFounder] = useState(false);

  // Mobile input refs
  const mobileRefs: MobileRefs = {
    move:    useRef({ dx: 0, dy: 0 }),
    look:    useRef({ dx: 0, dy: 0 }),
    fire:    useRef(false),
    jump:    useRef(false),
    ability: useRef(false),
    reload:  useRef(false),
  };

  const enemiesRef = useRef<EnemiesHandle | null>(null);
  const playerPosRef = useRef(new THREE.Vector3(0, 1.65, 5));
  const abilityCooldownRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => { if (authUser) { setXp(authUser.xp ?? 0); setLevel(authUser.level ?? 1); setRr(authUser.rr ?? 0); } }, [authUser]);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) return;
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) { setAuthUser(data.user); setToken(stored); connectSocket(stored, data.user.username); setScreen("lobby"); }
        else clearStoredToken();
      }).catch(() => clearStoredToken());
  }, []);

  // Persist language selection
  useEffect(() => { localStorage.setItem("bosna_lang", lang); }, [lang]);

  function connectSocket(tok: string, uname: string) {
    const s = getSocket();
    setSocket(s);
    s.emit("register", { token: tok, username: uname });
    s.on("registered", ({ playerId }: { playerId: string }) => setMySocketId(playerId));
    s.on("bosnacoins_update", ({ bosnaCoins: bc }: { bosnaCoins: number }) => setBosnaCoins(bc));
    s.on("team_update", ({ playerId, team }: { playerId: string; team: "red" | "blue" }) => {
      // Track own team
      s.emit("get_scoreboard"); // request fresh data
      if (playerId === s.id) setMyTeam(team);
    });
    s.on("select_team_ack", ({ team }: { team: "red" | "blue" }) => setMyTeam(team));
    s.on("admin_hp_set", ({ hp: h }: { hp: number }) => setHp(h));
    s.on("admin_money_set", ({ money: m }: { money: number }) => setMoney(m));
    s.on("admin_teleport", (pos: { x: number; y: number; z: number }) => setAdminTeleport(pos));
    s.on("admin_fly_toggle", ({ fly }: { fly: boolean }) => setIsFly(fly));
    s.on("admin_god_toggle", ({ god }: { god: boolean }) => setIsGod(god));
    s.on("kicked", ({ reason }: { reason: string }) => { alert(reason); handleLogout(); });
    s.on("xp_update", ({ xp: nx, level: nl }: { xp: number; level: number }) => {
      setXp(nx);
      setLevel(nl);
      if (nl > prevLevelRef.current) {
        prevLevelRef.current = nl;
        setRankUpLevel(nl);
        setShowRankUp(true);
      }
    });
    s.on("rr_update", ({ rr: nr, change }: { rr: number; change: number }) => {
      setRr(nr); setRrChange(change);
      setTimeout(() => setRrChange(null), 4000);
    });
    s.on("kill_feed", (evt: KillEvent) => {
      setKillFeedEvents((prev) => [...prev.slice(-4), evt]);
      setTimeout(() => setKillFeedEvents((prev) => prev.filter((e) => e.id !== evt.id)), 5000);
      // Track if local player was killed
      const myUsername = authUser?.username ?? "";
      if (evt.victim === myUsername) {
        setIsDead(true);
        setGameDeaths((d) => d + 1);
        setKilledBy(evt.killer);
        setKilledByIsFounder(evt.killerIsFounder ?? false);
      }
    });
    s.on("spike_owner", ({ hasSpike: hs }: { hasSpike: boolean }) => setHasSpike(hs));
    s.on("spike_armed", (pos: { x: number; y: number; z: number }) => {
      setSpikeState({ armed: true, plantedAt: Date.now(), position: pos, defused: false, exploded: false });
    });
    s.on("spike_defused", () => setSpikeState((prev) => ({ ...prev, defused: true, armed: false })));
    s.on("spike_exploded", () => setSpikeState((prev) => ({ ...prev, exploded: true, armed: false })));
    s.on("round_over", ({ winner, redScore: rs, blueScore: bs, round: r }: { winner: string; redScore: number; blueScore: number; round: number }) => {
      setRedScore(rs); setBlueScore(bs); setRound(r);
      setRoundMsg(winner === "red" ? "🔴 SALDIRGANLAR KAZANDI" : "🔵 SAVUNMA KAZANDI");
      setTimeout(() => setRoundMsg(null), 4000);
      setSpikeState({ armed: false, plantedAt: null, position: null, defused: false, exploded: false });
      // Respawn dead player at round start
      setIsDead(false);
      setHp(100);
      setKilledBy(undefined);
    });
    s.on("round_result_client", ({ won }: { won: boolean }) => {
      if (won) playRoundWin(); else playRoundLoss();
      s.emit("round_result", { won });
    });
    // Founder entry announcement
    s.on("founder_joined", ({ username: fu }: { username: string }) => {
      setFounderAnnounce(fu);
      setTimeout(() => setFounderAnnounce(null), 5000);
    });
    // Founder position tracking (for aura)
    // Note: player_moved for founder aura is in connectSocket below (no duplicate)
    s.on("player_left", ({ id }: { id: string }) => {
      setFounderPositions((prev) => prev.filter((p) => p.id !== id));
    });
    // Super-Admin GOD power events
    s.on("slow_motion", ({ factor }: { factor: number }) => {
      setSlowFactor(factor);
      if (factor >= 0.95) return;
      // auto-restore after 8s in case server doesn't send reset
      setTimeout(() => setSlowFactor(1.0), 8500);
    });
    s.on("nuke_effect", () => {
      setNukeActive(true);
    });
    s.on("blackhole_effect", ({ active }: { active: boolean }) => {
      setBlackholeActive(active);
    });
    s.on("spawn_entity", ({ entity, x, y, z }: { entity: EntityType; x: number; y: number; z: number }) => {
      const id = ++spawnIdRef.current;
      setSpawnedEntities(prev => [...prev, { id, type: entity, pos: [x, y, z] }]);
    });
    s.on("admin_kill", () => {
      setHp(0);
      setIsDead(true);
    });
    // Last kill replay
    s.on("last_kill_replay", (kill: LastKill) => {
      setLastKill(kill);
      setShowReplay(true);
    });
    s.on("map_changed", ({ map }: { map: MapId }) => {
      setCurrentMap(map);
    });
    s.on("admin_broadcast", ({ message }: { message: string }) => {
      setBroadcastAnnounce(message);
      setTimeout(() => setBroadcastAnnounce(null), 6000);
    });
    s.on("admin_event_announce", ({ message }: { message: string }) => {
      setEventAnnounce(message);
      setTimeout(() => setEventAnnounce(null), 9000);
    });
    // Creator panel events
    s.on("gravity_changed", (_: { multiplier: number }) => {
      // gravity_changed is handled locally for now — visual HUD only
    });
    s.on("player_scale_changed", ({ scale }: { scale: number }) => {
      setPlayerScale(scale);
    });
    s.on("creator_map_explode", () => {
      setMapExplodeFlash(true);
      setTimeout(() => setMapExplodeFlash(false), 800);
    });
    s.on("creator_shield_changed", ({ visible }: { visible: boolean }) => {
      setShieldVisible(visible);
    });
    s.on("zombie_invasion_start", () => {
      setZombieActive(true);
    });
    // Founder presence — detect from founder positions
    s.on("player_moved", (data: { id: string; username: string; isFounder: boolean; x: number; y: number; z: number }) => {
      if (data.isFounder) {
        setFounderPresent(true);
        setFounderPositions((prev) => {
          const filtered = prev.filter((p) => p.id !== data.id);
          return [...filtered, { id: data.id, pos: new THREE.Vector3(data.x, data.y, data.z) }];
        });
      }
    });
  }

  const handleAuth = useCallback(async () => {
    setAuthError("");
    if (!username.trim()) { setAuthError("Kullanıcı adı gerekli."); return; }
    if (!password || password.length < 6) { setAuthError("Şifre en az 6 karakter olmalı."); return; }
    if (authMode === "register" && !email.trim()) { setAuthError("Kayıt için e-posta gerekli."); return; }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const body: Record<string, string> = { username: username.trim(), password };
      if (authMode === "register") body.email = email.trim();
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.needsVerification) { setPendingUserId(data.userId); setPendingEmail(data.email ?? email); setVerifySuccess("Doğrulama kodu e-postana gönderildi."); setScreen("verify"); return; }
        setAuthError(data.error ?? "Bir hata oluştu."); return;
      }
      if (data.needsVerification) { setPendingUserId(data.userId); setPendingEmail(email.trim()); setVerifySuccess(data.message ?? "Doğrulama kodu e-postana gönderildi."); setScreen("verify"); return; }
      setStoredToken(data.token); setToken(data.token); setAuthUser(data.user); connectSocket(data.token, data.user.username); setScreen("lobby");
    } catch { setAuthError("Sunucuya bağlanılamadı."); } finally { setAuthLoading(false); }
  }, [authMode, username, email, password]);

  const handleVerify = useCallback(async () => {
    if (!pendingUserId || !verifyCode.trim()) { setVerifyError("Kodu gir."); return; }
    setVerifyLoading(true); setVerifyError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: pendingUserId, code: verifyCode.trim() }) });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error ?? "Doğrulama başarısız."); return; }
      setStoredToken(data.token); setToken(data.token); setAuthUser(data.user); connectSocket(data.token, data.user.username); setScreen("lobby");
    } catch { setVerifyError("Sunucuya bağlanılamadı."); } finally { setVerifyLoading(false); }
  }, [pendingUserId, verifyCode]);

  const handleResend = useCallback(async () => {
    if (!pendingUserId || resendCooldown > 0) return;
    setResendCooldown(60);
    try {
      const res = await fetch(`${API_BASE}/auth/resend-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: pendingUserId }) });
      const data = await res.json();
      setVerifySuccess(data.message ?? "Kod tekrar gönderildi.");
    } catch { setVerifyError("Kod gönderilemedi."); }
  }, [pendingUserId, resendCooldown]);

  const handleLogout = useCallback(() => {
    clearStoredToken(); setToken(null); setAuthUser(null); setUsername(""); setPassword(""); setEmail("");
    setScreen("login"); socket?.disconnect(); setSocket(null);
  }, [socket]);

  const handleRoomJoined = useCallback((roomId: string, host: boolean, vs: boolean, map: MapId) => {
    setCurrentRoom(roomId); setIsHost(host); setVsMode(vs); setCurrentMap(map);
  }, []);
  const handleRoomLeft = useCallback(() => { setCurrentRoom(null); setIsHost(false); setVsMode(false); setCurrentMap("astral"); }, []);

  const handleKill = useCallback((victimId?: string, weapon?: string, isHeadshot?: boolean) => {
    setKills((k) => k + 1); setGameKills((k) => k + 1);
    setHitmarkerActive(true); setCriticalHit(isHeadshot ?? false);
    setTimeout(() => { setHitmarkerActive(false); setCriticalHit(false); }, 160);
    socket?.emit("kill_recorded", { victimId, weapon: weapon ?? currentWeapon, isHeadshot: isHeadshot ?? false });
  }, [socket, currentWeapon]);

  const handleHit = useCallback(() => {
    setHitmarkerActive(true);
    setTimeout(() => setHitmarkerActive(false), 120);
    // handleHit = hitmarker only (damage dealt), NOT a kill — do NOT emit kill_recorded here
  }, []);

  const handleAbilityUsed = useCallback((ability: string) => {
    if (ability === "RELOAD") { setIsReloading(true); setTimeout(() => setIsReloading(false), 2000); return; }
    abilityCooldownRef.current = ABILITY_COOLDOWN;
    setAbilityCooldown(ABILITY_COOLDOWN);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      abilityCooldownRef.current = Math.max(0, abilityCooldownRef.current - 0.1);
      setAbilityCooldown(abilityCooldownRef.current);
      if (abilityCooldownRef.current <= 0 && cooldownTimerRef.current) { clearInterval(cooldownTimerRef.current); cooldownTimerRef.current = null; }
    }, 100);
  }, []);

  const handleFlash = useCallback(() => { setFlashActive(true); setTimeout(() => setFlashActive(false), 1800); }, []);

  const handleRadioCommand = useCallback((msg: string, color: string) => {
    const id = ++_toastId;
    setRadioToasts((prev) => [...prev.slice(-3), { id, message: msg, color }]);
    setTimeout(() => setRadioToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const handleBuyWeapon = useCallback((w: WeaponDef) => {
    if (money < w.cost) return;
    setMoney((m) => m - w.cost); setCurrentWeapon(w.id); setAmmo(w.ammo);
    socket?.emit("weapon_update", { weapon: w.id });
  }, [money, socket]);

  const handleBuyArmor = useCallback((full: boolean) => {
    const cost = full ? 1000 : 400; const hpBonus = full ? 100 : 50;
    if (money < cost) return;
    setMoney((m) => m - cost); setHasArmor(true); setMaxHp(100 + hpBonus);
    setHp((h) => Math.min(h + hpBonus, 100 + hpBonus));
  }, [money]);

  const handlePositionUpdate = useCallback((pos: THREE.Vector3, ry: number) => {
    setMyPosition(pos.clone()); setMyRotationY(ry);
    playerPosRef.current.copy(pos);
  }, []);

  const handleDamagePlayer = useCallback((dmg: number) => {
    setHp((prev) => {
      const next = Math.max(0, prev - dmg);
      if (next === 0) {
        setIsDead(true);
        setGameDeaths((d) => d + 1);
        // killer is a bot in solo mode
        setKilledBy("Bot");
        setKilledByIsFounder(false);
      }
      return next;
    });
  }, []);

  const goToLobby = useCallback(() => {
    if (gameKills > 0) { setScreen("mvp"); } else { setGameKills(0); setGameDeaths(0); setScreen("lobby"); }
  }, [gameKills]);

  const handleAddItem = useCallback((item: InventoryItem) => {
    setInventory((prev) => {
      const updated = [...prev, item];
      localStorage.setItem("inventory", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleNightToggle = useCallback(() => setNightMode((v) => !v), []);

  useEffect(() => {
    if (screen !== "game") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatFocused) return;
      if (e.code === "KeyB") { e.preventDefault(); setShowBuyMenu((v) => !v); }
      if (e.code === "Tab") { e.preventDefault(); setShowScoreboard(true); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Tab") setShowScoreboard(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [screen, chatFocused]);

  // ── PORTAL ────────────────────────────────────────────────────
  if (screen === "battleArena") return <BattleArenaGame onBack={() => setScreen("portal")} />;
  if (screen === "zombieSurvival") return <ZombieSurvivalGame onBack={() => setScreen("portal")} />;
  if (screen === "sniperElite") return <SniperEliteGame onBack={() => setScreen("portal")} />;

  if (screen === "portal") return (
    <Portal
      lang={lang}
      onLangChange={setLang}
      onPlay={() => setScreen("login")}
      onGame2={() => setScreen("battleArena")}
      onGame3={() => setScreen("zombieSurvival")}
      onGame4={() => setScreen("sniperElite")}
    />
  );

  // ── LOGIN ─────────────────────────────────────────────────────
  if (screen === "login") return (
    <div className="start-screen">
      <h1>BOSNA GAMES</h1>
      <p>Tactical Strike — Ücretsiz Browser FPS</p>
      <div className="login-form">
        <div className="auth-tabs">
          <button className={`auth-tab${authMode === "login" ? " active" : ""}`} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Giriş Yap</button>
          <button className={`auth-tab${authMode === "register" ? " active" : ""}`} onClick={() => { setAuthMode("register"); setAuthError(""); }}>Kayıt Ol</button>
        </div>
        <label className="login-label">Kullanıcı Adı</label>
        <input className="login-input" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuth()} placeholder="Adın ne?" maxLength={30} autoFocus autoComplete="username" />
        {authMode === "register" && (<>
          <label className="login-label">E-posta <span className="required-star">*</span></label>
          <input className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuth()} placeholder="Doğrulama kodu buraya gelecek" type="email" autoComplete="email" />
        </>)}
        <label className="login-label">Şifre</label>
        <input className="login-input" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAuth()} placeholder={authMode === "register" ? "En az 6 karakter" : "Şifren"} type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} />
        {authError && <div className="login-error">{authError}</div>}
        <button className="start-btn" onClick={handleAuth} disabled={authLoading}>{authLoading ? "Bekle..." : authMode === "register" ? "Hesap Oluştur →" : "Giriş Yap →"}</button>
      </div>
    </div>
  );

  // ── VERIFY ────────────────────────────────────────────────────
  if (screen === "verify") return (
    <div className="start-screen">
      <h1>BOSNA GAMES</h1>
      <div className="verify-box">
        <div className="verify-icon">📧</div>
        <h2 className="verify-title">E-posta Doğrulama</h2>
        <p className="verify-desc"><strong>{pendingEmail}</strong> adresine 6 haneli kod gönderdik.</p>
        {verifySuccess && <div className="verify-success">{verifySuccess}</div>}
        {verifyError && <div className="login-error">{verifyError}</div>}
        <input className="login-input verify-code-input" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handleVerify()} placeholder="6 haneli kodu gir" maxLength={6} autoFocus inputMode="numeric" />
        <button className="start-btn" onClick={handleVerify} disabled={verifyLoading}>{verifyLoading ? "Doğrulanıyor..." : "Doğrula →"}</button>
        <button className="resend-btn" onClick={handleResend} disabled={resendCooldown > 0}>{resendCooldown > 0 ? `Tekrar gönder (${resendCooldown}s)` : "Kodu tekrar gönder"}</button>
        <button className="back-link" onClick={() => setScreen("login")}>← Geri dön</button>
      </div>
    </div>
  );

  // ── RANKED QUEUE ──────────────────────────────────────────────
  if (screen === "rankedQueue") return (
    <RankedQueue socket={socket!} rr={rr}
      onMatchFound={(roomId) => { setCurrentRoom(roomId); setScreen("classSelect"); }}
      onCancel={() => setScreen("lobby")}
    />
  );

  // ── LOBBY ─────────────────────────────────────────────────────
  if (screen === "lobby") {
    const { name: tierName, color: tierColor } = getRankInfo(rr);
    return (
      <div className="lobby-screen">
        <div className="lobby-header">
          <h2 className="lobby-title">BOSNA GAMES — TACTICAL STRIKE {authUser?.isFounder && <span className="founder-lobby-badge">🛡️ KURUCU</span>}</h2>
          <div className="lobby-user-area">
            <div className="lobby-user-info">
              <span className={authUser?.isFounder ? "lobby-username founder" : "lobby-username"}>
                {authUser?.username}{authUser?.isVerified && <span className="verified-tick">✓</span>}
              </span>
              <span className="lobby-stats">☠ {authUser?.totalKills} · LVL {level} · <span style={{ color: tierColor }}>{tierName} {rr} RR</span></span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button className="lobby-icon-btn" onClick={() => setShowLeaderboard(true)} title="Sıralama">🏆</button>
              <button className="lobby-icon-btn" onClick={() => setShowMarket(true)} title="Market">🛒</button>
              <button className="logout-btn" onClick={handleLogout}>Çıkış</button>
            </div>
          </div>
        </div>
        <div className="lobby-content">
          {socket && <RoomSystem socket={socket} username={authUser?.username ?? ""} isFounder={authUser?.isFounder ?? false} onRoomJoined={handleRoomJoined} onRoomLeft={handleRoomLeft} currentRoom={currentRoom} isHost={isHost} vsMode={vsMode} currentMap={currentMap} />}
          <div className="lobby-actions">
            <button className="start-btn" onClick={() => setScreen("classSelect")}>▶ Normal Mod — Oyna</button>
            <button className="start-btn ranked-btn" onClick={() => socket && setScreen("rankedQueue")}>🏆 Dereceli Mod</button>
            {currentRoom && <button className="start-btn room-play-btn" onClick={() => setScreen("classSelect")}>▶ Oda ile Oyna [{currentRoom}]</button>}
          </div>
        </div>
        {socket && <div className="lobby-chat"><ChatOverlay socket={socket} username={authUser?.username ?? ""} isFounder={authUser?.isFounder ?? false} roomId={currentRoom} onFocusChange={setChatFocused} /></div>}

        {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
        <Market
          isOpen={showMarket} money={money} inventory={inventory}
          onClose={() => setShowMarket(false)}
          onSpendMoney={(amt) => setMoney((m) => Math.max(0, m - amt))}
          onAddItem={handleAddItem}
        />
        <BosnaMarket
          isOpen={showBosnaMarket}
          onClose={() => setShowBosnaMarket(false)}
          token={token ?? ""}
          bosnaCoins={money}
          onCoinsChange={setMoney}
          onSkinSelect={setSelectedSkin}
        />
      </div>
    );
  }

  // ── CHARACTER SELECT ──────────────────────────────────────────
  if (screen === "classSelect") return (
    <CharacterSelect
      onSelect={(cls) => {
        setSelectedClass(cls);
        socket?.emit("select_class", { playerClass: cls });
        setGameKills(0); setGameDeaths(0); setHp(100); setAmmo(WEAPONS.find((w) => w.id === "pistol")!.ammo);
        setCurrentWeapon("pistol"); setHasArmor(false); setMaxHp(100); setMoney(800);
        setSpikeState({ armed: false, plantedAt: null, position: null, defused: false, exploded: false });
        setScreen("game");
      }}
      onBack={() => setScreen("lobby")}
    />
  );

  // ── MVP SCREEN ────────────────────────────────────────────────
  if (screen === "mvp") return (
    <MVPScreen
      data={{ username: authUser?.username ?? "Oyuncu", kills: gameKills, deaths: gameDeaths, playerClass: selectedClass, isFounder: authUser?.isFounder ?? false, xp, level }}
      onContinue={() => { setGameKills(0); setGameDeaths(0); setScreen("lobby"); }}
    />
  );

  // ── GAME ──────────────────────────────────────────────────────
  return (
    <div className={`game-container${nightMode ? " night-mode" : ""}`}>
      <KeyboardControls map={keyMap}>
        <Canvas
          camera={{ fov: 75, near: 0.05, far: perfMode ? 120 : 500, position: [0, 1.65, 5] }}
          gl={{ antialias: !perfMode, alpha: false, powerPreference: perfMode ? "low-power" : "high-performance" }}
          dpr={perfMode ? 1 : [1, 2]}
          style={{ background: nightMode ? "#020208" : "#111" }}
        >
          <Suspense fallback={null}>
            <Map mapId={currentMap} />
            <Enemies ref={enemiesRef} onKill={handleKill} playerPositionRef={playerPosRef} onDamagePlayer={handleDamagePlayer} />
            <Player
              enemiesRef={enemiesRef}
              ammo={ammo} setAmmo={setAmmo}
              onKill={handleKill} onHit={handleHit}
              chatFocused={chatFocused}
              playerClass={selectedClass}
              socket={socket} roomId={currentRoom}
              onAbilityUsed={handleAbilityUsed}
              onFlash={handleFlash}
              onRadioCommand={handleRadioCommand}
              onTeleport={adminTeleport}
              currentWeapon={currentWeapon}
              isFly={isFly}
              onPositionUpdate={handlePositionUpdate}
              spikeState={spikeState}
              hasSpike={hasSpike}
              onSpikeStateChange={setSpikeState}
              onIsPlanting={setIsPlanting}
              onPlantProgress={setPlantProgress}
              onIsDefusing={setIsDefusing}
              onDefuseProgress={setDefuseProgress}
              onTimeLeft={setSpikeTimeLeft}
              mobileMode={mobileMode}
              mobileRefs={mobileRefs}
              onLockChange={setIsLocked}
              nightMode={nightMode}
              onNightModeToggle={handleNightToggle}
              skin={selectedSkin}
            />

            {/* Founder auras */}
            {founderPositions.map((fp) => (
              <FounderAura key={fp.id} position={fp.pos} />
            ))}

            {/* Remote players (other socket users in 3D) */}
            {socket && currentRoom && (
              <RemotePlayers
                socket={socket}
                mySocketId={mySocketId}
                myTeam={myTeam}
                onTeammateHit={(name) => {
                  const id = ++_toastCounter;
                  setTeammateHitToast({ id, name });
                  setTimeout(() => setTeammateHitToast(null), 3000);
                }}
              />
            )}

            {/* Spray system */}
            {socket && (
              <SpraySystem
                socket={socket}
                isFounder={authUser?.isFounder ?? false}
                username={authUser?.username ?? ""}
                chatFocused={chatFocused}
                roomId={currentRoom}
                mobileMode={mobileMode}
              />
            )}

            {/* Performance mode scene manager — must be inside Canvas */}
            <PerfSceneManager perfMode={perfMode} />

            {!perfMode && <ParticleSystem />}
            {!perfMode && <WeatherSystem weather={weather} />}
            {isDead && socket && (
              <SpectatorCamera socket={socket} active={isDead} localUsername={authUser?.username ?? ""} />
            )}

            {/* Founder sky shield */}
            <FounderShield visible={shieldVisible} founderPresent={founderPresent || (authUser?.isFounder ?? false)} />

            {/* Super-Admin GOD effects (R3F) */}
            <NukeEffect active={nukeActive} onComplete={() => setNukeActive(false)} />
            <BlackholeEffect active={blackholeActive} />
            {spawnedEntities.map(e => (
              <SpawnedEntity key={e.id} type={e.type} position={e.pos}
                onDespawn={() => setSpawnedEntities(prev => prev.filter(x => x.id !== e.id))}
                lifetime={30}
              />
            ))}

            {/* Battle Royale zone ring */}
            <BattleRoyaleZone active={brActive} playerPos={myPosition} onDamage={handleDamagePlayer} />

            {/* Zombie invasion portals */}
            <ZombiePortalScene active={zombieActive} />

            {!perfMode && (
              <EffectComposer>
                <DepthOfField focusDistance={0.005} focalLength={0.045} bokehScale={nightMode ? 1.8 : 0.8} height={480} />
                <Bloom luminanceThreshold={nightMode ? 0.28 : 0.85} luminanceSmoothing={0.18} intensity={nightMode ? 1.6 : 0.55} />
                <ChromaticAberration offset={new Vector2(nightMode ? 0.0008 : 0.0003, nightMode ? 0.0008 : 0.0003)} />
                <Vignette eskil={false} offset={0.15} darkness={nightMode ? 0.88 : 0.62} />
              </EffectComposer>
            )}
            <Preload all />
          </Suspense>
        </Canvas>

        {/* Admin broadcast overlay */}
        {broadcastAnnounce && (
          <div className="broadcast-overlay">
            <div className="broadcast-box">
              <span className="broadcast-icon">📢</span>
              <span className="broadcast-msg">{broadcastAnnounce}</span>
            </div>
          </div>
        )}

        {/* Admin event announcement */}
        {eventAnnounce && (
          <div className="event-announce-overlay">
            <div className="event-announce-box">
              <span className="event-announce-icon">⚡</span>
              <span className="event-announce-msg">{eventAnnounce}</span>
            </div>
          </div>
        )}

        {/* Founder entry announcement */}
        {founderAnnounce && (
          <div className="founder-announce">
            <div className="founder-announce-inner">
              <span className="founder-announce-icon">🛡️</span>
              <span className="founder-announce-text">KURUCU SAHAYA İNDİ!</span>
              <span className="founder-announce-name">{founderAnnounce}</span>
            </div>
          </div>
        )}

        {/* Graphics mode indicator */}
        <div className={nightMode ? "night-mode-badge" : "potato-mode-badge"}>
          {nightMode ? "🌙 GECE MODU" : "🥔 PATATESGRAFİK"}
        </div>

        {/* Click-to-play overlay */}
        {!mobileMode && !isLocked && !chatFocused && !showBuyMenu && !showAdminPanel && !showSettings && (
          <div className="click-to-play">
            <div className="ctp-box">
              <div className="ctp-icon">🎯</div>
              <div className="ctp-title">OYNAMAK İÇİN TIKLA</div>
              <div className="ctp-hint">WASD ile hareket · Fare ile bakış · Sol tık ile ateş</div>
              <div className="ctp-keys">
                <span className="key-badge">W A S D</span> Hareket &nbsp;
                <span className="key-badge">SPACE</span> Zıpla &nbsp;
                <span className="key-badge">E</span> Yetenek &nbsp;
                <span className="key-badge">R</span> Şarjör &nbsp;
                <span className="key-badge">T</span> Sprey &nbsp;
                <span className="key-badge">L</span> Gece Modu &nbsp;
                <span className="key-badge">B</span> Satın Al
              </div>
            </div>
          </div>
        )}

        <HUD
          hp={hp} maxHp={maxHp} ammo={ammo} maxAmmo={WEAPONS.find((w) => w.id === currentWeapon)?.ammo ?? 30}
          kills={kills} showSmoke={false} username={authUser?.username ?? ""}
          isFounder={authUser?.isFounder ?? false} roomId={currentRoom}
          playerClass={selectedClass}
          abilityCooldown={abilityCooldown} maxAbilityCooldown={ABILITY_COOLDOWN}
          level={level} xp={xp}
          radioToasts={radioToasts} isReloading={isReloading} flashActive={flashActive}
          hitmarkerActive={hitmarkerActive} criticalHit={criticalHit}
          currentWeapon={currentWeapon} money={money}
          hasSpike={hasSpike} spikeState={spikeState}
          isPlanting={isPlanting} plantProgress={plantProgress}
          isDefusing={isDefusing} defuseProgress={defuseProgress}
          spikeTimeLeft={spikeTimeLeft}
          redScore={redScore} blueScore={blueScore} round={round}
          roundMsg={roundMsg} rr={rr} rrChange={rrChange}
          isFly={isFly} isGod={isGod}
        />

        <KillFeed kills={killFeedEvents} />

        {socket && (
          <MiniMap
            socket={socket} myPosition={myPosition} myRotationY={myRotationY}
            spikePos={spikeState.position ? { x: spikeState.position.x, z: spikeState.position.z } : null}
            spikeArmed={spikeState.armed}
          />
        )}

        {socket && <Scoreboard socket={socket} visible={showScoreboard} localUsername={authUser?.username ?? ""} isFounder={authUser?.isFounder ?? false} />}

        {socket && (
          <>
            <div className="game-chat"><ChatOverlay socket={socket} username={authUser?.username ?? ""} isFounder={authUser?.isFounder ?? false} roomId={currentRoom} onFocusChange={setChatFocused} /></div>
            <VoiceChat socket={socket} roomId={currentRoom} username={authUser?.username ?? ""} />
          </>
        )}

        <BuyMenu money={money} currentWeapon={currentWeapon} hasArmor={hasArmor} isOpen={showBuyMenu}
          onBuyWeapon={handleBuyWeapon} onBuyArmor={handleBuyArmor} onClose={() => setShowBuyMenu(false)} />

        {/* Teammate hit notification */}
        {teammateHitToast && (
          <div key={teammateHitToast.id} className="teammate-hit-toast">
            💙 {teammateHitToast.name} vuruldu!
          </div>
        )}

        {/* Spectator HUD */}
        {isDead && socket && (
          <SpectatorHUD socket={socket} active={isDead} localUsername={authUser?.username ?? ""} />
        )}

        {/* Performance mode badge */}
        {perfMode && (
          <div className="perf-mode-badge">
            <span className="perf-mode-badge-dot" />
            ⚡ PERFORMANS MODU
          </div>
        )}

        {/* Bosna Coins badge */}
        <div className="bosnacoins-badge" title="Bosna Coin bakiyeniz">🪙 {bosnaCoins.toLocaleString()}</div>

        {/* Map explode flash */}
        {mapExplodeFlash && <div className="map-explode-flash" />}

        {/* Map mechanic HUD badges */}
        {MAP_CONFIGS[currentMap]?.gravityMultiplier !== 1 && (
          <div className="map-mechanic-badge gravity">
            {currentMap === "mars" ? "🔴 Düşük Yerçekimi" : currentMap === "space" ? "🚀 Azaltılmış G" : "🌊 Su Direnci"}
          </div>
        )}
        {MAP_CONFIGS[currentMap]?.lavaDamageZones.length > 0 && (
          <div className="map-mechanic-badge lava">🔥 Lav Zonu Aktif — Uzak dur!</div>
        )}
        {MAP_CONFIGS[currentMap]?.portals.length > 0 && (
          <div className="map-mechanic-badge portal">🌀 Portallar Aktif</div>
        )}

        {/* Battle Royale HUD */}
        <BattleRoyaleHUD active={brActive} onStop={() => setBrActive(false)} />

        {/* Zombie HUD */}
        <ZombieHUD active={zombieActive} socket={socket} onStop={() => setZombieActive(false)} />

        {/* Slow-mo overlay */}
        {slowOverlayActive && (
          <div className="slowmo-overlay" style={{ "--slowmo": slowFactor } as React.CSSProperties}>
            <div className="slowmo-badge">🌀 MATRIX × {slowFactor.toFixed(2)}</div>
          </div>
        )}

        {/* Deathmatch HUD */}
        <DeathmatchHUD
          active={deathmatchActive}
          socket={socket}
          myUsername={authUser?.username ?? ""}
          onStop={() => setDeathmatchActive(false)}
        />

        {/* Auction House */}
        <AuctionHouse
          isOpen={showAuction}
          onClose={() => setShowAuction(false)}
          socket={socket}
          bosnaCoins={bosnaCoins}
          myUsername={authUser?.username ?? ""}
          onCoinsChange={(delta) => setBosnaCoins(c => Math.max(0, c + delta))}
        />

        {/* Game toolbar */}
        <div className="game-toolbar">
          <button className="toolbar-btn" onClick={cycleWeather} title="Hava Durumu Değiştir">
            {weather === "clear" ? "☀️" : weather === "rain" ? "🌧️" : weather === "snow" ? "❄️" : "🌪️"}
          </button>
          <button className="toolbar-btn" onClick={() => setShowMapSelect(true)} title="Harita Seç">🗺️</button>
          <button className="toolbar-btn" onClick={() => setShowDailyChallenges(true)} title="Günlük Görevler">📋</button>
          <button className="toolbar-btn" onClick={() => setShowBosnaMarket(true)} title="Bosna Pazaryeri">🛒</button>
          <button className="toolbar-btn" onClick={() => setShowAuction(true)} title="Açık Artırma">🏛️</button>
          <button className="toolbar-btn" onClick={() => setShowTradeWindow(true)} title="Skin Takas">🔄</button>
          <button className={`toolbar-btn${deathmatchActive ? " active" : ""}`} onClick={() => setDeathmatchActive(v => !v)} title="Deathmatch Modu">⚡</button>
        </div>

        <button className="back-to-lobby" onClick={goToLobby}>← Lobi</button>
        <button className="gear-btn" onClick={() => setShowSettings(true)} title="Ayarlar">⚙</button>

        {authUser?.isFounder && (
          <>
            <button className="admin-toggle-btn" onClick={() => setShowAdminPanel((v) => !v)} title="Admin Paneli">🛡️</button>
            <button className="creator-toggle-btn" onClick={() => setShowCreatorPanel((v) => !v)} title="Yaratıcı Paneli">⚡</button>
          </>
        )}
        {socket && authUser?.isFounder && (
          <AdminPanel socket={socket} isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} />
        )}
        {socket && authUser?.isFounder && (
          <CreatorPanel
            socket={socket}
            isOpen={showCreatorPanel}
            onClose={() => setShowCreatorPanel(false)}
            onStartBattleRoyale={() => setBrActive(true)}
            onStartZombieInvasion={() => setZombieActive(true)}
            currentMap={currentMap}
          />
        )}

        <SettingsPanel
          isOpen={showSettings} onClose={() => setShowSettings(false)}
          mobileMode={mobileMode} onMobileModeToggle={setMobileMode}
          sensitivity={sensitivity} onSensitivity={setSensitivity}
          isFounder={authUser?.isFounder ?? false} onOpenAdmin={() => setShowAdminPanel(true)}
          perfMode={perfMode} onPerfModeToggle={setPerfMode}
        />

        <MobileControls
          active={mobileMode} sensitivity={sensitivity}
          onInput={(inp) => {
            if (inp.dx !== undefined) mobileRefs.move.current.dx = inp.dx;
            if (inp.dy !== undefined) mobileRefs.move.current.dy = inp.dy;
            if (inp.lookDx !== undefined) mobileRefs.look.current.dx += inp.lookDx;
            if (inp.lookDy !== undefined) mobileRefs.look.current.dy += inp.lookDy;
          }}
          onFire={() => { mobileRefs.fire.current = true; }}
          onJump={() => { mobileRefs.jump.current = true; }}
          onAbility={() => { mobileRefs.ability.current = true; }}
          onReload={() => { mobileRefs.reload.current = true; }}
          isFounder={authUser?.isFounder ?? false}
          onOpenAdmin={() => setShowAdminPanel(true)}
        />

        {/* Last Kill Replay */}
        <LastKillReplay kill={lastKill} visible={showReplay} onEnd={() => setShowReplay(false)} />

        {/* Daily Challenges */}
        <DailyChallenges
          socket={socket}
          isOpen={showDailyChallenges}
          onClose={() => setShowDailyChallenges(false)}
          onCoinsEarned={(amt) => setBosnaCoins(c => c + amt)}
        />

        {/* Bosna Market */}
        {token && (
          <BosnaMarket
            isOpen={showBosnaMarket}
            onClose={() => setShowBosnaMarket(false)}
            token={token}
            bosnaCoins={bosnaCoins}
            onCoinsChange={setBosnaCoins}
          />
        )}

        {/* Map selector */}
        <MapSelect
          isOpen={showMapSelect}
          currentMap={currentMap}
          isHost={isHost || !currentRoom}
          onSelectMap={(m) => {
            setCurrentMap(m);
            socket?.emit("set_map", { map: m });
            setShowMapSelect(false);
          }}
          onClose={() => setShowMapSelect(false)}
        />

        {/* Skin trade window */}
        <TradeWindow
          isOpen={showTradeWindow}
          socket={socket}
          localUsername={authUser?.username ?? ""}
          onClose={() => setShowTradeWindow(false)}
        />

        {/* Rank-up cinematic */}
        <RankUpCinematic
          visible={showRankUp}
          newLevel={rankUpLevel}
          newRankName={rankUpLevel >= 50 ? "Radyant" : rankUpLevel >= 40 ? "Elmas" : rankUpLevel >= 30 ? "Platin" : rankUpLevel >= 20 ? "Altın" : rankUpLevel >= 10 ? "Gümüş" : rankUpLevel >= 5 ? "Bronz" : "Demir"}
          newRankColor={rankUpLevel >= 50 ? "#ff4422" : rankUpLevel >= 40 ? "#00eeff" : rankUpLevel >= 30 ? "#44ffaa" : rankUpLevel >= 20 ? "#ffcc00" : rankUpLevel >= 10 ? "#cccccc" : rankUpLevel >= 5 ? "#cc8844" : "#888888"}
          onEnd={() => setShowRankUp(false)}
        />

        {/* Death Screen */}
        {isDead && (
          <DeathScreen
            isMultiplayer={!!currentRoom}
            killedBy={killedBy}
            killedByIsFounder={killedByIsFounder}
            onRespawn={() => {
              setIsDead(false);
              setHp(100);
              setKilledBy(undefined);
            }}
          />
        )}

      </KeyboardControls>
    </div>
  );
}
