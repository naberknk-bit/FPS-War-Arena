import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, gameUsers, emailVerifications } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendVerificationEmail } from "../lib/email";

const router = Router();

const FOUNDER_EMAIL = "muhammedali.bosna@stu.enka.k12.tr";

// GET /api/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const users = await db
      .select({ username: gameUsers.username, rr: gameUsers.rr, level: gameUsers.level, totalKills: gameUsers.totalKills, email: gameUsers.email })
      .from(gameUsers)
      .orderBy(gameUsers.rr);
    const sorted = users
      .map((u) => ({ ...u, isFounder: u.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase() }))
      .sort((a, b) => {
        if (a.isFounder && !b.isFounder) return -1;
        if (!a.isFounder && b.isFounder) return 1;
        return (b.rr ?? 0) - (a.rr ?? 0);
      })
      .map((u, i) => ({ rank: i + 1, username: u.username, rr: u.rr ?? 0, level: u.level ?? 1, totalKills: u.totalKills ?? 0, isFounder: u.isFounder }));
    res.json({ leaderboard: sorted });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "tactical-shooter-secret-key-2026";
const SALT_ROUNDS = 10;

function makeToken(user: { id: number; username: string; isFounder: boolean; isVerified: boolean }) {
  return jwt.sign(
    { id: user.id, username: user.username, isFounder: user.isFounder, isVerified: user.isVerified },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  if (!username || username.trim().length < 2 || username.trim().length > 30) {
    res.status(400).json({ error: "Kullanıcı adı 2-30 karakter olmalı." });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Şifre en az 6 karakter olmalı." });
    return;
  }
  if (!email || !email.trim()) {
    res.status(400).json({ error: "E-posta doğrulama için gerekli." });
    return;
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const isFounder = cleanEmail === FOUNDER_EMAIL.toLowerCase();

  try {
    // Check for existing username or email BEFORE insert to give a clear error
    const [existingUser] = await db
      .select({ id: gameUsers.id, username: gameUsers.username, email: gameUsers.email })
      .from(gameUsers)
      .where(eq(gameUsers.username, cleanUsername))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "Bu kullanıcı adı zaten alınmış." });
      return;
    }

    const [existingEmail] = await db
      .select({ id: gameUsers.id })
      .from(gameUsers)
      .where(eq(gameUsers.email, cleanEmail))
      .limit(1);

    if (existingEmail) {
      res.status(409).json({ error: "Bu e-posta adresi zaten kayıtlı." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db
      .insert(gameUsers)
      .values({ username: cleanUsername, email: cleanEmail, passwordHash, isFounder, isVerified: false })
      .returning();

    // Send verification email
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db.insert(emailVerifications).values({ userId: user.id, code, expiresAt });

    const emailSent = await sendVerificationEmail(cleanEmail, cleanUsername, code);
    logger.info({ username: cleanUsername, isFounder, emailSent }, "User registered");

    res.json({
      needsVerification: true,
      userId: user.id,
      emailSent,
      message: emailSent
        ? `Doğrulama kodu ${cleanEmail} adresine gönderildi.`
        : "E-posta gönderilemedi, lütfen tekrar dene.",
    });
  } catch (err: unknown) {
    // Catch any remaining constraint violations as fallback
    const anyErr = err as { message?: string; code?: string };
    const msg = anyErr?.message ?? "";
    if (anyErr?.code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      res.status(409).json({ error: "Bu kullanıcı adı veya e-posta zaten kullanımda." });
    } else {
      logger.error({ err }, "Registration error");
      res.status(500).json({ error: "Sunucu hatası." });
    }
  }
});

// POST /api/auth/verify-email
router.post("/auth/verify-email", async (req, res) => {
  const { userId, code } = req.body as { userId?: number; code?: string };

  if (!userId || !code) {
    res.status(400).json({ error: "Kullanıcı ID ve kod gerekli." });
    return;
  }

  try {
    const now = new Date();
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.code, code.trim()),
          eq(emailVerifications.used, false),
          gt(emailVerifications.expiresAt, now)
        )
      )
      .limit(1);

    if (!verification) {
      res.status(400).json({ error: "Kod hatalı veya süresi dolmuş." });
      return;
    }

    // Mark used & verify user
    await db
      .update(emailVerifications)
      .set({ used: true })
      .where(eq(emailVerifications.id, verification.id));

    const [user] = await db
      .update(gameUsers)
      .set({ isVerified: true })
      .where(eq(gameUsers.id, userId))
      .returning();

    logger.info({ userId, username: user.username }, "Email verified");

    res.json({
      token: makeToken(user),
      user: {
        id: user.id,
        username: user.username,
        isFounder: user.isFounder,
        isVerified: true,
        totalKills: user.totalKills,
        totalGames: user.totalGames,
        xp: user.xp,
        level: user.level,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error({ err }, "Verify email error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// POST /api/auth/resend-code
router.post("/auth/resend-code", async (req, res) => {
  const { userId } = req.body as { userId?: number };
  if (!userId) { res.status(400).json({ error: "userId gerekli." }); return; }

  try {
    const [user] = await db.select().from(gameUsers).where(eq(gameUsers.id, userId)).limit(1);
    if (!user || !user.email) { res.status(404).json({ error: "Kullanıcı bulunamadı." }); return; }
    if (user.isVerified) { res.status(400).json({ error: "Hesap zaten doğrulanmış." }); return; }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(emailVerifications).values({ userId: user.id, code, expiresAt });

    const emailSent = await sendVerificationEmail(user.email, user.username, code);
    res.json({ emailSent, message: emailSent ? "Kod tekrar gönderildi." : "E-posta gönderilemedi." });
  } catch (err) {
    logger.error({ err }, "Resend code error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(gameUsers)
      .where(eq(gameUsers.username, username.trim()))
      .limit(1);

    if (!user) { res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." }); return; }

    if (!user.isVerified) {
      // Resend a fresh code
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.insert(emailVerifications).values({ userId: user.id, code, expiresAt });
      if (user.email) await sendVerificationEmail(user.email, user.username, code);

      res.status(403).json({
        error: "E-posta doğrulanmamış.",
        needsVerification: true,
        userId: user.id,
        email: user.email,
      });
      return;
    }

    await db.update(gameUsers).set({ lastSeen: new Date() }).where(eq(gameUsers.id, user.id));
    logger.info({ username: user.username }, "User logged in");

    res.json({
      token: makeToken(user),
      user: {
        id: user.id,
        username: user.username,
        isFounder: user.isFounder,
        isVerified: user.isVerified,
        totalKills: user.totalKills,
        totalGames: user.totalGames,
        xp: user.xp,
        level: user.level,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Token gerekli." }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      id: number; username: string; isFounder: boolean; isVerified: boolean;
    };
    const [user] = await db.select().from(gameUsers).where(eq(gameUsers.id, payload.id)).limit(1);
    if (!user) { res.status(401).json({ error: "Kullanıcı bulunamadı." }); return; }
    res.json({
      user: {
        id: user.id, username: user.username, isFounder: user.isFounder, isVerified: user.isVerified,
        totalKills: user.totalKills, totalGames: user.totalGames,
        xp: user.xp, level: user.level, rr: user.rr, createdAt: user.createdAt,
      },
    });
  } catch {
    res.status(401).json({ error: "Geçersiz token." });
  }
});

// GET /api/leaderboard
router.get("/leaderboard", async (_req, res) => {
  try {
    const rows = await db
      .select({ username: gameUsers.username, isFounder: gameUsers.isFounder, totalKills: gameUsers.totalKills, totalGames: gameUsers.totalGames })
      .from(gameUsers)
      .orderBy(gameUsers.totalKills)
      .limit(20);
    res.json(rows.reverse());
  } catch (err) {
    logger.error({ err }, "Leaderboard error");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

export { JWT_SECRET };
export default router;
