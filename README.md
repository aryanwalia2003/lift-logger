# lift-log

Personal workout tracker + analysis. Next.js (App Router) + Drizzle + libSQL (local file ya Turso). PWA, single-password gate.

- `lib/catalog.ts` — body parts, exercises, day labels (seed data). Edit karo, phir `pnpm db:seed`
- `db/schema.ts` — `body_parts` → `exercises`; `workouts` (date, label) → `sets`
- Drop set = parent set se attach (sets count nahi, volume count); superset = same `supersetId` wale sets ka round
- `lib/analytics.ts` — saari analytics ek flat rows list se (weekly, byLabel, byPart, exercise sessions + PRs)
- `app/analytics/` — overview, label, body part, exercise pages (SVG charts, no chart lib)

## Local
```
pnpm db:migrate && pnpm db:seed   # lift.db banao (DATABASE_URL na ho to file:lift.db)
pnpm check                        # smoke test (temp DB, backup/restore roundtrip bhi)
pnpm dev
DATABASE_URL=file:demo.db pnpm tsx scripts/demo.ts   # demo data
```

## Deploy (Vercel + Turso)
1. Turso: `turso db create lift-log` (Mumbai region), `turso db show lift-log --url`, `turso db tokens create lift-log`
2. Schema: `DATABASE_URL=… DATABASE_AUTH_TOKEN=… pnpm db:migrate && pnpm db:seed`
3. Vercel: repo import karo, env vars `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSWORD` (see `.env.example`). Function region Mumbai (bom1).
4. Phone: site kholo → Share → Add to Home Screen.

## Backup
`pnpm backup` → `backups/lift-<time>.json` (gitignored; repo public hai, data kabhi commit mat karo).
Restore: migrated **khali** DB pe `pnpm restore <file>` (seed mat chalao). Env ke liye `.env.local` (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`).
