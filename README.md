# lift-log

Personal workout tracker + analysis. Next.js (App Router) + Drizzle + libSQL (local file ya Turso). PWA, single-password gate.

- **Offline-first:** device pe IndexedDB (Dexie) poora data rakhta hai; logging aur analytics server ke bina chalte hain.
- `lib/catalog.ts` — body parts, exercises (ids deterministic, client+server same), day labels
- `lib/local-db.ts` + `lib/store.ts` — local DB + saari reads/writes (dirty=1, soft delete)
- `lib/sync.ts` (client) + `lib/sync-server.ts` + `app/api/sync` — push dirty rows, pull by rev cursor; last-write-wins (updatedAt), tombstones
- `public/sw.js` — service worker: pages + JS cache (offline shell)
- `db/schema.ts` — server tables (Turso): ids client banata hai (text), `rev` = sync cursor
- `lib/analytics.ts` — pure functions on rows; `app/analytics/` — pages (query params: `?key=`, `?id=`)

## Local
```
pnpm db:migrate && pnpm db:seed   # server DB (DATABASE_URL na ho to file:lift.db)
pnpm check                        # smoke test (temp DB, backup/restore roundtrip bhi)
pnpm dev
DATABASE_URL=file:demo.db pnpm tsx scripts/demo.ts   # demo data server pe; app kholte hi sync se aata hai
```

## Deploy (Vercel + Turso)
1. Turso: `turso db create lift-log` (Mumbai region), `turso db show lift-log --url`, `turso db tokens create lift-log`
2. Schema: `DATABASE_URL=… DATABASE_AUTH_TOKEN=… pnpm db:migrate && pnpm db:seed`
3. Vercel: repo import karo, env vars `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSWORD` (see `.env.example`). Function region Mumbai (bom1).
4. Phone: site kholo → Share → Add to Home Screen.

## Backup
`pnpm backup` → `backups/lift-<time>.json` (gitignored; repo public hai, data kabhi commit mat karo).
Restore: migrated **khali** DB pe `pnpm restore <file>` (seed mat chalao). Env ke liye `.env.local` (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`).
