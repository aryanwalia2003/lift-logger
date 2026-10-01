# lift-log

Personal workout tracker + analysis. Next.js (App Router) + Drizzle + SQLite.

- `lib/exercises.ts` — exercise enum (exercise → day type). Yahin edit karo.
- `db/schema.ts` — `workouts` (date, day) → `sets` (exercise, weight, reps)
- `lib/actions.ts` — `startWorkout`, `logSet` (day ke bahar ki exercise reject)
- `lib/analytics.ts` — `dayHistory`, `exerciseProgress`, `schedule`

```
pnpm db:generate && pnpm db:migrate   # lift.db banao
pnpm check                            # smoke test
pnpm dev
```
