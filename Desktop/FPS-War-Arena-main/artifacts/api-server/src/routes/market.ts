import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { gameUsers, marketListings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const JWT_SECRET = process.env["SESSION_SECRET"] ?? "tactical-shooter-secret-key-2026";

function getUser(req: import("express").Request): { id: number; username: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { id: number; username: string };
    return decoded;
  } catch { return null; }
}

// GET /api/market — list all active listings
router.get("/market", async (_req, res) => {
  try {
    const listings = await db
      .select()
      .from(marketListings)
      .orderBy(marketListings.listedAt);
    res.json({ listings });
  } catch (err) {
    logger.error({ err }, "Market list error");
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/market/sell — create listing
router.post("/market/sell", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  const { skinId, skinName, price } = req.body as { skinId?: string; skinName?: string; price?: number };
  if (!skinId || !skinName || !price || price < 50 || price > 99999) {
    res.status(400).json({ error: "Geçersiz istek" }); return;
  }
  try {
    await db.insert(marketListings).values({
      sellerId: user.id, sellerName: user.username,
      skinId, skinName, price,
    });
    logger.info({ user: user.username, skinId, price }, "Market listing created");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Market sell error");
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/market/buy/:id — buy listing
router.post("/market/buy/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  const listingId = parseInt(req.params["id"]);
  if (isNaN(listingId)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  try {
    const [listing] = await db.select().from(marketListings).where(eq(marketListings.id, listingId));
    if (!listing) { res.status(404).json({ error: "Listeleme bulunamadı" }); return; }
    if (listing.sellerId === user.id) { res.status(400).json({ error: "Kendi skinini satın alamazsın" }); return; }

    const [buyer] = await db.select({ bosnaCoins: gameUsers.bosnaCoins }).from(gameUsers).where(eq(gameUsers.id, user.id));
    if (!buyer || buyer.bosnaCoins < listing.price) {
      res.status(400).json({ error: "Yetersiz Bosna Coin" }); return;
    }

    // Deduct coins from buyer, add 90% to seller (10% market fee)
    const sellerGain = Math.floor(listing.price * 0.9);
    await db.update(gameUsers).set({ bosnaCoins: buyer.bosnaCoins - listing.price }).where(eq(gameUsers.id, user.id));
    await db.update(gameUsers).set({ bosnaCoins: sellerGain }).where(eq(gameUsers.id, listing.sellerId));
    await db.delete(marketListings).where(eq(marketListings.id, listingId));

    logger.info({ buyer: user.username, listing: listing.skinName, price: listing.price }, "Market purchase");
    res.json({ ok: true, skinId: listing.skinId, skinName: listing.skinName });
  } catch (err) {
    logger.error({ err }, "Market buy error");
    res.status(500).json({ error: "DB error" });
  }
});

// DELETE /api/market/:id — remove own listing
router.delete("/market/:id", async (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Giriş yapılmamış" }); return; }
  const listingId = parseInt(req.params["id"]);
  if (isNaN(listingId)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const [listing] = await db.select().from(marketListings).where(eq(marketListings.id, listingId));
    if (!listing || listing.sellerId !== user.id) { res.status(403).json({ error: "Yetkisiz" }); return; }
    await db.delete(marketListings).where(eq(marketListings.id, listingId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Market delete error");
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
