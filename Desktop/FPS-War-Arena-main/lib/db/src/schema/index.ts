import { pgTable, serial, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameUsers = pgTable("game_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 30 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  isFounder: boolean("is_founder").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  totalKills: integer("total_kills").notNull().default(0),
  totalGames: integer("total_games").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  rr: integer("rr").notNull().default(0),
  ranked_wins: integer("ranked_wins").notNull().default(0),
  ranked_losses: integer("ranked_losses").notNull().default(0),
  bosnaCoins: integer("bosna_coins").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});

export const marketListings = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => gameUsers.id, { onDelete: "cascade" }),
  sellerName: varchar("seller_name", { length: 30 }).notNull(),
  skinId: varchar("skin_id", { length: 50 }).notNull(),
  skinName: varchar("skin_name", { length: 100 }).notNull(),
  price: integer("price").notNull(),
  listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => gameUsers.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyChallengeProgress = pgTable("daily_challenge_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => gameUsers.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  progress: integer("progress").notNull().default(0),
  done: boolean("done").notNull().default(false),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameUserSchema = createInsertSchema(gameUsers).omit({
  id: true, createdAt: true, lastSeen: true, totalKills: true,
  totalGames: true, xp: true, level: true, rr: true,
  ranked_wins: true, ranked_losses: true, isVerified: true, bosnaCoins: true,
});

export const selectGameUserSchema = createSelectSchema(gameUsers);

export type InsertGameUser = z.infer<typeof insertGameUserSchema>;
export type GameUser = typeof gameUsers.$inferSelect;
