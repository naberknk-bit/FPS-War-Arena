import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db, gameUsers, marketListings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import { JWT_SECRET } from "./routes/auth";

const FOUNDER_EMAIL = "muhammedali.bosna@stu.enka.k12.tr";

interface Player {
  id: string;
  userId: number | null;
  username: string;
  email: string;
  isFounder: boolean;
  roomId: string | null;
  team: "red" | "blue" | "none";
  hp: number;
  money: number;
  bosnaCoins: number;
  position: { x: number; y: number; z: number };
  playerClass: "assault" | "scout" | "support" | null;
  kills: number;
  deaths: number;
  assists: number;
  connectedAt: number;
  isFly: boolean;
  isGod: boolean;
  rr: number;
  weapon: string;
  chatBans: number;
  gameBans: number;
  dayBans: number;
  yearBans: number;
  banUntil: number | null;
}

type MapId = "astral" | "canyon" | "frost" | "ruins" | "mars" | "volcano" | "space" | "egypt" | "cyberpunk" | "underwater";
const ALL_MAPS: MapId[] = ["astral","canyon","frost","ruins","mars","volcano","space","egypt","cyberpunk","underwater"];

interface Room {
  id: string;
  name: string;
  hostId: string;
  players: string[];
  vsMode: boolean;
  maxPlayers: number;
  spikeArmed: boolean;
  spikePos: { x: number; y: number; z: number } | null;
  spikeOwner: string | null;
  round: number;
  redScore: number;
  blueScore: number;
  isRanked: boolean;
  map: MapId;
}

const players       = new Map<string, Player>();
const rooms         = new Map<string, Room>();
const rankedQueue: string[] = [];
const bannedUsernames = new Set<string>();

function banMs(duration: string) {
  if (duration === "game-hour") return 60 * 60 * 1000;
  if (duration === "day") return 24 * 60 * 60 * 1000;
  if (duration === "year") return 365 * 24 * 60 * 60 * 1000;
  return 0;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // ── Register ─────────────────────────────────────────────────
    socket.on("register", async ({ token, username, email }: { token?: string; username?: string; email?: string }) => {
      let userId: number | null = null;
      let resolvedUsername = username || "Player";
      let resolvedEmail = email || "";
      let isFounder = resolvedEmail.toLowerCase() === FOUNDER_EMAIL.toLowerCase();
      let rr = 0;

      if (token) {
        try {
          const payload = jwt.verify(token, JWT_SECRET) as { id: number; username: string; isFounder: boolean };
          userId = payload.id;
          resolvedUsername = payload.username;
          isFounder = payload.isFounder;
          const [u] = await db.select({ rr: gameUsers.rr, lastSeen: gameUsers.lastSeen })
            .from(gameUsers).where(eq(gameUsers.id, userId)).limit(1);
          if (u) { rr = u.rr ?? 0; db.update(gameUsers).set({ lastSeen: new Date() }).where(eq(gameUsers.id, userId)).catch(() => {}); }
        } catch { logger.warn({ socketId: socket.id }, "Invalid token on register"); }
      }

      let bosnaCoins = 0;
      if (userId) {
        try {
          const [cu] = await db.select({ bosnaCoins: gameUsers.bosnaCoins }).from(gameUsers).where(eq(gameUsers.id, userId)).limit(1);
          if (cu) bosnaCoins = cu.bosnaCoins ?? 0;
        } catch { /* ignore */ }
      }

      const player: Player = {
        id: socket.id, userId, username: resolvedUsername, email: resolvedEmail,
        isFounder, roomId: null, team: "none",
        hp: 100, money: 800, bosnaCoins,
        position: { x: 0, y: 1.65, z: 0 },
        playerClass: null, kills: 0, deaths: 0, assists: 0,
        connectedAt: Date.now(), isFly: false, isGod: false, rr, weapon: "pistol",
        chatBans: 0, gameBans: 0, dayBans: 0, yearBans: 0, banUntil: null,
      };
      socket.emit("bosnacoins_update", { bosnaCoins });
      players.set(socket.id, player);
      socket.emit("registered", { playerId: socket.id, isFounder, username: player.username, userId, rr });
      io.emit("lobby_players", Array.from(players.values()).filter((p) => p.roomId === null));

      // Founder entry broadcast
      if (isFounder) {
        socket.broadcast.emit("founder_joined", { username: resolvedUsername });
        logger.info({ username: resolvedUsername }, "Founder joined — broadcasting");
      }
    });

    // ── Class ────────────────────────────────────────────────────
    socket.on("select_class", ({ playerClass }: { playerClass: string }) => {
      const p = players.get(socket.id);
      if (!p) return;
      p.playerClass = playerClass as Player["playerClass"];
      if (p.roomId) io.to(p.roomId).emit("player_class_update", { playerId: socket.id, username: p.username, playerClass });
    });

    // ── Weapon update ────────────────────────────────────────────
    socket.on("weapon_update", ({ weapon }: { weapon: string }) => {
      const p = players.get(socket.id);
      if (p) p.weapon = weapon;
    });

    // ── Radio ────────────────────────────────────────────────────
    socket.on("radio_command", ({ message, color, roomId }: { message: string; color: string; roomId: string | null }) => {
      const p = players.get(socket.id);
      if (!p) return;
      const msg = { from: socket.id, username: p.username, text: `📻 ${message}`, isFounder: p.isFounder, isSystem: false, isRadio: true, radioColor: color, timestamp: Date.now() };
      if (roomId) io.to(roomId).emit("chat_message", msg);
      else io.emit("chat_message", msg);
    });

    // ── Admin: get players ───────────────────────────────────────
    socket.on("admin_get_players", () => {
      const admin = players.get(socket.id);
      if (!admin?.isFounder) return;
      socket.emit("admin_players_list", Array.from(players.values()).map((p) => ({
        socketId: p.id, username: p.username, isFounder: p.isFounder,
        roomId: p.roomId, hp: p.hp, money: p.money, position: p.position,
      })));
    });

    socket.on("admin_set_hp", ({ targetId, hp }: { targetId: string; hp: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const t = players.get(targetId); if (!t) return;
      t.hp = Math.max(0, Math.min(200, hp));
      io.to(targetId).emit("admin_hp_set", { hp: t.hp });
    });

    socket.on("admin_set_money", ({ targetId, money }: { targetId: string; money: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const t = players.get(targetId); if (!t) return;
      t.money = Math.max(0, Math.min(99999, money));
      io.to(targetId).emit("admin_money_set", { money: t.money });
    });

    socket.on("admin_kick", ({ targetId }: { targetId: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const s = io.sockets.sockets.get(targetId);
      if (s) { io.to(targetId).emit("kicked", { reason: "Admin tarafından atıldınız." }); s.disconnect(true); }
    });

    socket.on("admin_teleport", ({ targetId, x, y, z }: { targetId: string; x: number; y: number; z: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      io.to(targetId).emit("admin_teleport", { x, y, z });
    });

    socket.on("admin_fly", ({ targetId }: { targetId: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const t = players.get(targetId); if (!t) return;
      t.isFly = !t.isFly;
      io.to(targetId).emit("admin_fly_toggle", { fly: t.isFly });
    });

    socket.on("admin_god", ({ targetId }: { targetId: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const t = players.get(targetId); if (!t) return;
      t.isGod = !t.isGod;
      io.to(targetId).emit("admin_god_toggle", { god: t.isGod });
    });

    socket.on("admin_giveall", ({ money }: { money: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      for (const p of players.values()) {
        p.money += money;
        io.to(p.id).emit("admin_money_set", { money: p.money });
      }
    });

    socket.on("admin_ban", ({ username, reason, duration }: { username: string; reason: string; duration?: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const d = duration ?? "chat";
      const until = banMs(d);
      for (const [sid, p] of players.entries()) {
        if (p.username.toLowerCase() === username.toLowerCase()) {
          if (d === "chat") p.chatBans++;
          if (d === "game-hour") p.gameBans++;
          if (d === "day") p.dayBans++;
          if (d === "year") p.yearBans++;
          p.banUntil = until ? Date.now() + until : null;
          io.to(sid).emit("kicked", { reason: `Banlandınız (${d}). Sebep: ${reason}` });
          const s = io.sockets.sockets.get(sid);
          if (s) s.disconnect(true);
          break;
        }
      }
      logger.info({ admin: players.get(socket.id)?.username, username, reason }, "Ban issued");
    });

    socket.on("admin_broadcast", ({ message }: { message: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const from = players.get(socket.id)?.username ?? "Admin";
      io.emit("admin_broadcast", { message, from });
      logger.info({ from, message }, "Admin broadcast");
    });

    socket.on("admin_event", ({ message }: { message: string }) => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("admin_event_announce", { message });
      // Also send as chat message
      io.emit("chat_message", {
        from: "SYSTEM", username: "⚡ ETKİNLİK", text: message,
        isFounder: false, isSystem: true, timestamp: Date.now(),
      });
      logger.info({ message }, "Admin event");
    });

    socket.on("admin_force_map", ({ map }: { map: MapId }) => {
      if (!players.get(socket.id)?.isFounder) return;
      if (!ALL_MAPS.includes(map)) return;
      for (const room of rooms.values()) {
        room.map = map;
        io.to(room.id).emit("map_changed", { map });
      }
      logger.info({ map }, "Admin force map");
    });

    // ── Room: Create ─────────────────────────────────────────────
    socket.on("set_map", ({ map }: { map: MapId }) => {
      if (!ALL_MAPS.includes(map)) return;
      const p = players.get(socket.id);
      if (!p) return;
      if (!p.roomId) {
        // Solo player — just confirm back to them
        socket.emit("map_changed", { map });
        return;
      }
      const room = rooms.get(p.roomId);
      if (!room || room.hostId !== socket.id || room.isRanked) return;
      room.map = map;
      io.to(room.id).emit("map_changed", { map });
    });

    socket.on("create_room", ({ name, vsMode }: { name: string; vsMode: boolean }) => {
      const p = players.get(socket.id); if (!p) return;
      const roomId = generateRoomCode();
      const room: Room = {
        id: roomId, name: name || `${p.username}'s Room`, hostId: socket.id,
        players: [socket.id], vsMode: vsMode ?? false, maxPlayers: 10,
        spikeArmed: false, spikePos: null, spikeOwner: null,
        round: 1, redScore: 0, blueScore: 0, isRanked: false, map: "astral",
      };
      // Give spike to first player
      room.spikeOwner = socket.id;
      rooms.set(roomId, room);
      p.roomId = roomId;
      socket.join(roomId);
      socket.emit("room_joined", { room, isHost: true });
      socket.emit("spike_owner", { hasSpike: true });
      io.emit("rooms_updated", getRoomList());
    });

    // ── Room: Join ───────────────────────────────────────────────
    socket.on("join_room", ({ roomId }: { roomId: string }) => {
      const p = players.get(socket.id); if (!p) return;
      const room = rooms.get(roomId.toUpperCase());
      if (!room) { socket.emit("error_msg", "Oda bulunamadı: " + roomId); return; }
      if (room.players.length >= room.maxPlayers) { socket.emit("error_msg", "Oda dolu!"); return; }
      if (p.roomId && p.roomId !== roomId) leaveRoom(socket, p);
      room.players.push(socket.id);
      p.roomId = room.id;
      socket.join(room.id);
      socket.emit("room_joined", { room, isHost: false });
      socket.emit("spike_owner", { hasSpike: false });
      io.to(room.id).emit("room_update", { room, members: room.players.map((pid) => players.get(pid)?.username ?? "?") });
      io.emit("rooms_updated", getRoomList());
      io.to(room.id).emit("chat_message", { from: "SYSTEM", username: "SYSTEM", text: `${p.username} odaya katıldı.`, isSystem: true, timestamp: Date.now() });
    });

    socket.on("leave_room", () => { const p = players.get(socket.id); if (p) leaveRoom(socket, p); });

    socket.on("toggle_vs_mode", ({ vsMode }: { vsMode: boolean }) => {
      const p = players.get(socket.id); if (!p?.roomId) return;
      const room = rooms.get(p.roomId);
      if (!room || room.hostId !== socket.id) return;
      room.vsMode = vsMode;
      io.to(room.id).emit("room_update", { room, members: room.players.map((pid) => players.get(pid)?.username ?? "?") });
    });

    socket.on("select_team", ({ team }: { team: "red" | "blue" }) => {
      const p = players.get(socket.id); if (!p?.roomId) return;
      const room = rooms.get(p.roomId); if (!room?.vsMode) return;
      p.team = team;
      io.to(room.id).emit("team_update", { playerId: socket.id, username: p.username, team });
    });

    // ── Chat ─────────────────────────────────────────────────────
    socket.on("chat_message", ({ text, roomId }: { text: string; roomId: string | null }) => {
      const p = players.get(socket.id); if (!p) return;
      if (p.banUntil && p.banUntil > Date.now()) return;
      const msg = { from: socket.id, username: p.username, text: text.slice(0, 300), isFounder: p.isFounder, isSystem: false, timestamp: Date.now() };
      if (roomId) io.to(roomId).emit("chat_message", msg);
      else io.emit("chat_message", msg);
    });

    // ── Voice ────────────────────────────────────────────────────
    socket.on("peer_id", ({ peerId, roomId }: { peerId: string; roomId: string | null }) => {
      if (roomId) socket.to(roomId).emit("peer_joined", { peerId, socketId: socket.id });
    });

    // ── Position ─────────────────────────────────────────────────
    socket.on("position", (data: { x: number; y: number; z: number; ry: number }) => {
      const p = players.get(socket.id); if (!p) return;
      p.position = { x: data.x, y: data.y, z: data.z };
      if (!p.roomId) return;
      socket.to(p.roomId).emit("player_moved", { id: socket.id, username: p.username, isFounder: p.isFounder, team: p.team, ...data });
      // Broadcast full players_state for spectator mode (throttled per socket in room)
      const allInRoom = rooms.get(p.roomId)?.players.map(pid => {
        const pl = players.get(pid);
        if (!pl) return null;
        return { socketId: pl.id, username: pl.username, x: pl.position.x, y: pl.position.y, z: pl.position.z, rotY: 0, team: pl.team, hp: pl.hp };
      }).filter(Boolean);
      if (allInRoom) io.to(p.roomId).emit("players_state", { players: allInRoom });
    });

    // ── Scoreboard ───────────────────────────────────────────────
    socket.on("get_scoreboard", () => {
      const p = players.get(socket.id); if (!p?.roomId) return;
      const room = rooms.get(p.roomId); if (!room) return;
      const data = room.players.map((pid) => {
        const pl = players.get(pid);
        if (!pl) return null;
        const ping = Math.round(Math.random() * 40 + 20); // simulated ping
        return { socketId: pid, username: pl.username, isFounder: pl.isFounder, kills: pl.kills, deaths: pl.deaths, assists: pl.assists, ping, team: pl.team };
      }).filter(Boolean);
      socket.emit("scoreboard_data", data);
    });

    // ── Spike ────────────────────────────────────────────────────
    socket.on("spike_plant", ({ x, y, z, roomId }: { x: number; y: number; z: number; roomId: string | null }) => {
      const p = players.get(socket.id);
      const room = roomId ? rooms.get(roomId) : null;
      if (!room || room.spikeOwner !== socket.id || room.spikeArmed) return;
      room.spikeArmed = true;
      room.spikePos = { x, y, z };
      io.to(room.id).emit("spike_armed", { x, y, z });
      io.to(room.id).emit("chat_message", { from: "SYSTEM", username: "SYSTEM", text: `🧨 Spike kuruldu! İmha et!`, isSystem: true, timestamp: Date.now() });

      // Auto-explode after 45s
      setTimeout(() => {
        const r = rooms.get(room.id);
        if (!r || !r.spikeArmed) return;
        r.spikeArmed = false;
        r.spikePos = null;
        io.to(r.id).emit("spike_exploded");
        io.to(r.id).emit("chat_message", { from: "SYSTEM", username: "SYSTEM", text: "💥 Spike patladı! Saldırganlar kazandı!", isSystem: true, timestamp: Date.now() });
        endRound(r, "red");
      }, 45000);
    });

    socket.on("spike_defuse", ({ roomId }: { roomId: string | null }) => {
      const room = roomId ? rooms.get(roomId) : null;
      if (!room || !room.spikeArmed) return;
      room.spikeArmed = false;
      room.spikePos = null;
      io.to(room.id).emit("spike_defused");
      io.to(room.id).emit("chat_message", { from: "SYSTEM", username: "SYSTEM", text: "✅ Spike imha edildi! Savunma kazandı!", isSystem: true, timestamp: Date.now() });
      endRound(room, "blue");
    });

    // ── Kill/XP ──────────────────────────────────────────────────
    socket.on("kill_recorded", async ({ victimId, weapon, isHeadshot }: { victimId?: string; weapon?: string; isHeadshot?: boolean } = {}) => {
      const p = players.get(socket.id);
      if (!p) return;
      p.kills++;
      p.money = Math.min(99999, p.money + 200);
      io.to(socket.id).emit("admin_money_set", { money: p.money });

      if (victimId) {
        const victim = players.get(victimId);
        if (victim) {
          victim.deaths++;
          if (p.roomId) {
            const killEvt = {
              id: Date.now(),
              killer: p.username,
              victim: victim.username,
              weapon: weapon ?? "pistol",
              isHeadshot: isHeadshot ?? false,
              killerIsFounder: p.isFounder,
            };
            io.to(p.roomId).emit("kill_feed", killEvt);
            // Track last kill per room for replay
            const room = rooms.get(p.roomId);
            if (room) (room as any).lastKill = killEvt;
          }
        }
      }

      // Award Bosna Coins per kill
      const killCoins = isHeadshot ? 25 : 10;
      p.bosnaCoins += killCoins;
      socket.emit("bosnacoins_update", { bosnaCoins: p.bosnaCoins });
      // Emit kill_confirmed for challenge tracking
      socket.emit("kill_confirmed", { isHeadshot: isHeadshot ?? false });

      if (!p.userId) return;
      try {
        const [current] = await db.select({ xp: gameUsers.xp, bosnaCoins: gameUsers.bosnaCoins }).from(gameUsers).where(eq(gameUsers.id, p.userId)).limit(1);
        const newXp = (current?.xp ?? 0) + (isHeadshot ? 150 : 100);
        const newLevel = Math.floor(Math.pow(newXp / 600, 0.72)) + 1;
        const newCoins = (current?.bosnaCoins ?? 0) + killCoins;
        const [updated] = await db.update(gameUsers)
          .set({ totalKills: sql`${gameUsers.totalKills} + 1`, xp: newXp, level: newLevel, bosnaCoins: newCoins })
          .where(eq(gameUsers.id, p.userId)).returning({ xp: gameUsers.xp, level: gameUsers.level });
        if (updated) socket.emit("xp_update", { xp: updated.xp, level: updated.level });
      } catch (err) { logger.error({ err }, "Failed to update kill/xp"); }
    });

    // ── Challenge reward claim ────────────────────────────────────
    socket.on("claim_challenge_reward", async ({ challengeId, reward }: { challengeId: number; reward: number }) => {
      const p = players.get(socket.id);
      if (!p) return;
      const safeReward = Math.max(0, Math.min(500, reward)); // sanity cap
      p.bosnaCoins += safeReward;
      socket.emit("bosnacoins_update", { bosnaCoins: p.bosnaCoins });
      if (p.userId) {
        try {
          await db.update(gameUsers)
            .set({ bosnaCoins: sql`${gameUsers.bosnaCoins} + ${safeReward}` })
            .where(eq(gameUsers.id, p.userId));
          logger.info({ username: p.username, challengeId, reward: safeReward }, "Challenge reward claimed");
        } catch (err) { logger.error({ err }, "Failed to save challenge reward"); }
      }
    });

    // ── Ranked queue ─────────────────────────────────────────────
    socket.on("join_ranked_queue", () => {
      if (!rankedQueue.includes(socket.id)) rankedQueue.push(socket.id);
      broadcastQueueUpdate();
      if (rankedQueue.length >= 2) {
        const matchPlayers = rankedQueue.splice(0, 2);
        const roomId = "RNK-" + generateRoomCode();
        const room: Room = {
          id: roomId, name: "Ranked Match", hostId: matchPlayers[0],
          players: matchPlayers, vsMode: true, maxPlayers: 10,
          spikeArmed: false, spikePos: null, spikeOwner: matchPlayers[0],
          round: 1, redScore: 0, blueScore: 0, isRanked: true, map: "astral",
        };
        rooms.set(roomId, room);
        matchPlayers.forEach((pid, i) => {
          const pl = players.get(pid);
          if (!pl) return;
          pl.roomId = roomId;
          pl.team = i % 2 === 0 ? "red" : "blue";
          const s = io.sockets.sockets.get(pid);
          s?.join(roomId);
          io.to(pid).emit("ranked_match_found", { roomId });
          io.to(pid).emit("room_joined", { room, isHost: i === 0 });
        });
        broadcastQueueUpdate();
      }
    });

    socket.on("leave_ranked_queue", () => {
      const idx = rankedQueue.indexOf(socket.id);
      if (idx !== -1) rankedQueue.splice(idx, 1);
      broadcastQueueUpdate();
    });

    socket.on("round_result", async ({ won }: { won: boolean }) => {
      const p = players.get(socket.id);
      if (!p?.userId) return;
      const rrChange = won ? 25 : -20;
      const newRr = Math.max(0, p.rr + rrChange);
      p.rr = newRr;
      p.money = Math.min(99999, p.money + (won ? 3000 : 1900));
      const winCoins = won ? 200 : 50;
      p.bosnaCoins += winCoins;
      socket.emit("bosnacoins_update", { bosnaCoins: p.bosnaCoins });
      try {
        await db.update(gameUsers)
          .set({
            rr: newRr,
            ranked_wins: won ? sql`${gameUsers.ranked_wins} + 1` : gameUsers.ranked_wins,
            ranked_losses: won ? gameUsers.ranked_losses : sql`${gameUsers.ranked_losses} + 1`,
            bosnaCoins: sql`${gameUsers.bosnaCoins} + ${winCoins}`,
          })
          .where(eq(gameUsers.id, p.userId));
        socket.emit("rr_update", { rr: newRr, change: rrChange });
        socket.emit("admin_money_set", { money: p.money });
      } catch (err) { logger.error({ err }, "Failed to update RR"); }
    });

    // ── Super-Admin "Evrensel Kontrol" powers ────────────────────
    socket.on("creator_slowmo", ({ factor }: { factor: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const safe = Math.max(0.05, Math.min(1, factor));
      io.emit("slow_motion", { factor: safe });
      io.emit("chat_message", { from: "SYSTEM", username: "⚡ KURUCU", text: `🌀 ZAMAN YAVAŞLADI × ${safe} — Matrix modu aktif!`, isSystem: true, timestamp: Date.now() });
      logger.info({ factor: safe }, "SlowMo activated");
    });

    socket.on("creator_nuke", () => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("nuke_effect");
      io.emit("chat_message", { from: "SYSTEM", username: "☢ KURUCU", text: "☢ ATOM BOMBASI! Tüm alan yerle bir edildi!", isSystem: true, timestamp: Date.now() });
      for (const [sid, pl] of players.entries()) {
        if (!pl.isFounder && pl.roomId) {
          io.to(sid).emit("admin_kill");
        }
      }
      logger.info({}, "Nuke triggered");
    });

    socket.on("creator_spawn", ({ entity }: { entity: "robot" | "dragon" }) => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("spawn_entity", { entity, x: 0, y: 0, z: 0 });
      io.emit("chat_message", { from: "SYSTEM", username: "⚡ KURUCU", text: `🤖 KURUCU bir ${entity === "robot" ? "ROBOT" : "EJDERHA"} yayınladı!`, isSystem: true, timestamp: Date.now() });
    });

    socket.on("creator_blackhole", ({ active }: { active: boolean }) => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("blackhole_effect", { active });
      io.emit("chat_message", { from: "SYSTEM", username: "🌀 KURUCU", text: active ? "🕳 KARA DELİK AÇILDI! Her şey içine çekiliyor..." : "🌀 Kara delik kapatıldı.", isSystem: true, timestamp: Date.now() });
    });

    socket.on("creator_reset_slowmo", () => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("slow_motion", { factor: 1.0 });
    });

    // ── Deathmatch mode ───────────────────────────────────────────
    socket.on("dm_kill_event", ({ killer, victim }: { killer: string; victim: string }) => {
      const p = players.get(socket.id); if (!p?.roomId) return;
      io.to(p.roomId).emit("dm_kill", { killer, victim });
    });

    // ── Auction house ─────────────────────────────────────────────
    const auctionListings: Map<string, { id: string; sellerUsername: string; skinName: string; skinEmoji: string; skinRarity: string; startPrice: number; currentBid: number; currentBidder: string | null; endsAt: number }> = new Map();

    socket.on("auction_get_listings", () => {
      socket.emit("auction_listings", Array.from(auctionListings.values()));
    });

    socket.on("auction_bid", ({ listingId, amount }: { listingId: string; amount: number }) => {
      const p = players.get(socket.id); if (!p) return;
      const listing = auctionListings.get(listingId);
      if (!listing || amount <= listing.currentBid) return;
      listing.currentBid    = amount;
      listing.currentBidder = p.username;
      io.emit("auction_bid_update", { id: listingId, currentBid: amount, currentBidder: p.username });
    });

    // ── Creator powers (founder only) ────────────────────────────
    socket.on("creator_gravity", ({ multiplier }: { multiplier: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const safe = Math.max(-2, Math.min(3, multiplier));
      io.emit("gravity_changed", { multiplier: safe });
      logger.info({ multiplier: safe }, "Creator gravity changed");
    });

    socket.on("creator_size_all", ({ scale }: { scale: number }) => {
      if (!players.get(socket.id)?.isFounder) return;
      const safe = Math.max(0.1, Math.min(5, scale));
      io.emit("player_scale_changed", { scale: safe });
    });

    socket.on("creator_map_explode", () => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("creator_map_explode");
      io.emit("admin_broadcast", { message: "💥 KURUCU HARİTAYI PATLATTI!", from: "KURUCU" });
    });

    socket.on("creator_shield", ({ visible }: { visible: boolean }) => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("creator_shield_changed", { visible });
    });

    socket.on("creator_zombie_invasion", () => {
      if (!players.get(socket.id)?.isFounder) return;
      io.emit("zombie_invasion_start");
      io.emit("chat_message", { from: "SYSTEM", username: "⚡ KURUCU", text: "🧟 ZOMBİ İSTİLASI BAŞLADI! Portallar açılıyor...", isSystem: true, timestamp: Date.now() });
      logger.info({}, "Zombie invasion started by founder");
    });

    // ── Skin trading ─────────────────────────────────────────────
    socket.on("trade_request", ({ toUsername, offeredSkin, wantedSkinName }: { toUsername: string; offeredSkin: object; wantedSkinName: string }) => {
      const p = players.get(socket.id); if (!p) return;
      for (const [sid, pl] of players.entries()) {
        if (pl.username.toLowerCase() === toUsername.toLowerCase()) {
          io.to(sid).emit("trade_request", {
            fromSocketId: socket.id,
            fromUsername: p.username,
            offeredSkin,
            wantedSkin: { name: wantedSkinName },
          });
          return;
        }
      }
      socket.emit("error_msg", `${toUsername} bulunamadı veya çevrimdışı.`);
    });

    socket.on("trade_accept", ({ fromSocketId }: { fromSocketId: string }) => {
      const p = players.get(socket.id); if (!p) return;
      io.to(fromSocketId).emit("trade_accepted", { fromUsername: p.username });
      socket.emit("trade_accepted", { fromUsername: players.get(fromSocketId)?.username ?? "?" });
    });

    socket.on("trade_decline", ({ fromSocketId }: { fromSocketId: string }) => {
      const p = players.get(socket.id); if (!p) return;
      io.to(fromSocketId).emit("trade_declined", { fromUsername: p.username });
    });

    socket.on("trade_cancel", ({ toSocketId }: { toSocketId: string }) => {
      io.to(toSocketId).emit("trade_cancelled");
    });

    // ── Zombie kill tracking ──────────────────────────────────────
    socket.on("zombie_killed", () => {
      const p = players.get(socket.id); if (!p?.roomId) return;
      io.to(p.roomId).emit("zombie_killed");
    });

    // ── Spray ────────────────────────────────────────────────────
    socket.on("spray", ({ x, y, z, nx, ny, nz, isFounder: sprayFounder, username: sprayUser, roomId: sprayRoom }: { x: number; y: number; z: number; nx: number; ny: number; nz: number; isFounder: boolean; username: string; roomId: string | null }) => {
      const p = players.get(socket.id);
      if (!p) return;
      const payload = { x, y, z, nx, ny, nz, isFounder: sprayFounder, username: sprayUser };
      if (sprayRoom) socket.to(sprayRoom).emit("spray_placed", payload);
      else socket.broadcast.emit("spray_placed", payload);
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on("disconnect", () => {
      const p = players.get(socket.id);
      if (p) {
        leaveRoom(socket, p);
        players.delete(socket.id);
        const qIdx = rankedQueue.indexOf(socket.id);
        if (qIdx !== -1) { rankedQueue.splice(qIdx, 1); broadcastQueueUpdate(); }
      }
      io.emit("lobby_players", Array.from(players.values()).filter((p) => p.roomId === null));
    });

    // ── Helpers ──────────────────────────────────────────────────
    function leaveRoom(sock: Socket, p: Player) {
      if (!p.roomId) return;
      const room = rooms.get(p.roomId);
      if (room) {
        room.players = room.players.filter((pid) => pid !== sock.id);
        sock.leave(room.id);
        io.to(room.id).emit("chat_message", { from: "SYSTEM", username: "SYSTEM", text: `${p.username} odadan ayrıldı.`, isSystem: true, timestamp: Date.now() });
        io.to(room.id).emit("player_left", { id: sock.id });
        if (room.players.length === 0) { rooms.delete(room.id); }
        else {
          if (room.hostId === sock.id) room.hostId = room.players[0];
          io.to(room.id).emit("room_update", { room, members: room.players.map((pid) => players.get(pid)?.username ?? "?") });
        }
        io.emit("rooms_updated", getRoomList());
      }
      p.roomId = null;
      p.team = "none";
    }

    function endRound(room: Room, winner: "red" | "blue") {
      if (winner === "red") room.redScore++; else room.blueScore++;
      room.round++;
      // Give spike to opposite team next round
      const nextOwner = room.players.find((pid) => {
        const pl = players.get(pid);
        return pl && pl.team !== winner;
      });
      room.spikeOwner = nextOwner ?? room.players[0] ?? null;
      // Broadcast last kill replay before round over
      const lastKill = (room as any).lastKill;
      if (lastKill) {
        io.to(room.id).emit("last_kill_replay", lastKill);
        (room as any).lastKill = null;
      }
      room.players.forEach((pid) => {
        const pl = players.get(pid);
        if (pl) {
          pl.hp = 100;
          pl.position = { x: 0, y: 1.65, z: 5 };
        }
      });
      io.to(room.id).emit("round_over", { winner, redScore: room.redScore, blueScore: room.blueScore, round: room.round });
      if (room.spikeOwner) io.to(room.spikeOwner).emit("spike_owner", { hasSpike: true });
      // RR update for ranked
      if (room.isRanked) {
        room.players.forEach((pid) => {
          const pl = players.get(pid);
          if (pl) {
            const won = pl.team === winner;
            io.to(pid).emit("round_result_client", { won });
          }
        });
      }
    }
  });

  function broadcastQueueUpdate() {
    const queueData = rankedQueue.map((id) => {
      const p = players.get(id);
      return { username: p?.username ?? "?", rr: p?.rr ?? 0 };
    });
    rankedQueue.forEach((id) => io.to(id).emit("ranked_queue_update", queueData));
  }

  function getRoomList() {
    return Array.from(rooms.values()).map((r) => ({
      id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, vsMode: r.vsMode, isRanked: r.isRanked,
    }));
  }

  return io;
}
