# lift-log

Personal workout tracker + analysis. Next.js (App Router) + Drizzle + SQLite.

- `lib/catalog.ts` — body parts, exercises, day labels (seed data). Edit karo, phir `pnpm db:seed`
- `db/schema.ts` — `body_parts` → `exercises`; `workouts` (date, label) → `sets`
- `lib/analytics.ts` — `labelHistory`, `bodyPartHistory`, `exerciseProgress`, `schedule`

```
pnpm db:migrate && pnpm db:seed   # lift.db banao
pnpm check                            # smoke test
pnpm dev
```
