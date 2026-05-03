import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { dailyChallengeProgress, gameUsers } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const JWT_SECRET = process.env["SESSION_SECRET"] ?? "tactical-shooter-secret-key-2026";

function getUser(req: import("express").Request): { id: number; username: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as { id: number; username: string };
  } catch { return null; }
}

function today() { return new Date().toISOString().slice(0, 10); }

// GET /api/challenges — get today's progress for the authed user
router.get("/challenges", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  try {
    const rows = await db
      .select()
      .from(dailyChallengeProgress)
      .where(and(eq(dailyChallengeProgress.userId, user.id), eq(dailyChallengeProgress.date, today())));
    res.json({ progress: rows });
  } catch (err) {
    logger.error({ err }, "Challenges GET error");
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/challenges/progress — update progress for a challenge
router.post("/challenges/progress", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  const { challengeId, increment } = req.body as { challengeId?: number; increment?: number };
  if (typeof challengeId !== "number" || typeof increment !== "number") {
    res.status(400).json({ error: "Geçersiz istek" }); return;
  }
  try {
    const d = today();
    const [existing] = await db.select().from(dailyChallengeProgress)
      .where(and(eq(dailyChallengeProgress.userId, user.id), eq(dailyChallengeProgress.challengeId, challengeId), eq(dailyChallengeProgress.date, d)));
    if (existing) {
      await db.update(dailyChallengeProgress)
        .set({ progress: sql`${dailyChallengeProgress.progress} + ${increment}` })
        .where(eq(dailyChallengeProgress.id, existing.id));
    } else {
      await db.insert(dailyChallengeProgress).values({ userId: user.id, challengeId, date: d, progress: increment });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Challenges progress error");
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/challenges/claim — claim reward for completed challenge
router.post("/challenges/claim", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  const { challengeId, reward } = req.body as { challengeId?: number; reward?: number };
  if (typeof challengeId !== "number" || typeof reward !== "number") {
    res.status(400).json({ error: "Geçersiz istek" }); return;
  }
  try {
    const d = today();
    const [row] = await db.select().from(dailyChallengeProgress)
      .where(and(eq(dailyChallengeProgress.userId, user.id), eq(dailyChallengeProgress.challengeId, challengeId), eq(dailyChallengeProgress.date, d)));
    if (!row) { res.status(404).json({ error: "Görev bulunamadı" }); return; }
    if (row.claimedAt) { res.status(400).json({ error: "Ödül zaten alındı" }); return; }

    await db.update(dailyChallengeProgress)
      .set({ done: true, claimedAt: new Date() })
      .where(eq(dailyChallengeProgress.id, row.id));
    await db.update(gameUsers)
      .set({ bosnaCoins: sql`${gameUsers.bosnaCoins} + ${reward}` })
      .where(eq(gameUsers.id, user.id));

    logger.info({ user: user.username, challengeId, reward }, "Challenge reward claimed");
    res.json({ ok: true, reward });
  } catch (err) {
    logger.error({ err }, "Challenges claim error");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
