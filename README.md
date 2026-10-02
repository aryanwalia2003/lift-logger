# lift-log

Personal workout tracker + analysis. Next.js (App Router) + Drizzle + SQLite.

- `lib/catalog.ts` — body parts, exercises, day labels (seed data). Edit karo, phir `pnpm db:seed`
- `db/schema.ts` — `body_parts` → `exercises`; `workouts` (date, label) → `sets`
- `lib/analytics.ts` — saari analytics ek flat rows list se (weekly, byLabel, byPart, exercise sessions + PRs)
- `app/analytics/` — overview, label, body part, exercise pages (SVG charts, no chart lib)

```
pnpm db:migrate && pnpm db:seed   # lift.db banao
pnpm check                            # smoke test
DB_FILE=demo.db pnpm tsx scripts/demo.ts   # demo data, phir DB_FILE=demo.db pnpm dev
pnpm dev
```
