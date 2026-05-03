# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## FPS Game — Artifact: `artifacts/3d-game`

Browser-based FPS (Valorant-inspired). Stack: React Three Fiber, Three.js, Socket.io, PeerJS, PostgreSQL.

### Feature Map

| Feature | Files |
|---|---|
| Authentication (JWT + bcrypt + email verify via Brevo) | `api-server/src/routes/auth.ts` |
| Socket multiplayer, rooms, VS mode, spike | `api-server/src/socketServer.ts` |
| Bosna Coin economy (kill +10/+25, win +200) | `socketServer.ts`, `lib/db/src/schema/index.ts` |
| Skin trading marketplace (10% fee) | `api-server/src/routes/market.ts`, `3d-game/src/game/BosnaMarket.tsx` |
| Daily challenges (date-seeded, 3/day, localStorage) | `3d-game/src/game/DailyChallenges.tsx` |
| Weather system (rain/snow/sandstorm, dynamic fog) | `3d-game/src/game/WeatherSystem.tsx` |
| AI Sportscaster (Web Speech API, Turkish/English) | `3d-game/src/game/Sportscaster.ts` |
| Spectator camera (dead player follows live players) | `3d-game/src/game/SpectatorCamera.tsx` |
| Advanced bot AI (crouch, peek-strafe) | `3d-game/src/game/Enemies.tsx` |
| Post-processing (Bloom, DoF, ChromAb, Vignette) | `Game.tsx` EffectComposer |
| Admin panel (God/Fly/Ban/Broadcast/Map) | `3d-game/src/game/AdminPanel.tsx` |
| Dragon/Legendary skin system | `3d-game/src/game/HumanoidModel.tsx` |
| Particle system (shell casings, blood, smoke) | `3d-game/src/game/ParticleSystem.tsx` |
| Ranked mode (RR system, matchmaking) | `socketServer.ts`, `RankedQueue.tsx` |

### DB Schema (PostgreSQL via Drizzle ORM)
- `game_users` — id, username, email, passwordHash, isFounder, isVerified, totalKills, xp, level, rr, ranked_wins, ranked_losses, **bosna_coins**, createdAt, lastSeen
- `email_verifications` — id, userId, code, expiresAt, used
- `market_listings` — id, sellerId, sellerName, skinId, skinName, price, listedAt

### Founder Recognition
- Email: `muhammedali.bosna@stu.enka.k12.tr` → KURUCU badge, aura, all admin powers

### In-Game Toolbar (bottom-right)
- ☀️/🌧️/❄️/🌪️ — cycle weather (clear→rain→snow→sandstorm)
- 📋 — daily challenges panel
- 🛒 — Bosna Pazaryeri (skin marketplace)
- 📣 — toggle AI sportscaster voice
