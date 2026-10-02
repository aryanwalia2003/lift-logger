import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { db as Db } from "@/db";
import { sets, syncState, workouts } from "@/db/schema";
import { EXERCISE_ROWS, LABEL_KEYS } from "./catalog";
import { MAX_PUSH, PAGE } from "./sync-limits";
import type { SetRow, SyncRequest, SyncResponse, WorkoutRow } from "./types";

type DB = typeof Db;

export class SyncError extends Error {}
const bad = (msg: string): never => {
  throw new SyncError(msg);
};

// ---- validation (trust boundary: client data) ----
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EXERCISE_IDS = new Set(EXERCISE_ROWS.map((e) => e.id));
type Raw = Record<string, unknown>;
const obj = (v: unknown, what: string): Raw => (v && typeof v === "object" ? (v as Raw) : bad(`Invalid ${what}`));
const id = (v: unknown, what: string) => (typeof v === "string" && ID.test(v) ? v : bad(`Invalid ${what}`));
const idOrNull = (v: unknown, what: string) => (v === null ? null : id(v, what));
const textOrNull = (v: unknown, max: number, what: string) => (v === null ? null : typeof v === "string" && v.length <= max ? v : bad(`Invalid ${what}`));
const int = (v: unknown, min: number, max: number, what: string) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : bad(`Invalid ${what}`));

function workoutRow(v: unknown): WorkoutRow {
  const r = obj(v, "workout");
  const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : bad("Invalid workout date");
  const label = LABEL_KEYS.find((l) => l === r.label) ?? bad("Invalid label");
  return {
    id: id(r.id, "workout id"), date, label, notes: textOrNull(r.notes, 500, "notes"),
    updatedAt: int(r.updatedAt, 1, 1e15, "updatedAt"), deletedAt: r.deletedAt === null ? null : int(r.deletedAt, 1, 1e15, "deletedAt"),
  };
}

function setRow(v: unknown): SetRow {
  const r = obj(v, "set");
  if (typeof r.weightKg !== "number" || !(r.weightKg >= 0 && r.weightKg <= 5000)) bad("Invalid weight");
  return {
    id: id(r.id, "set id"), workoutId: id(r.workoutId, "workout id"),
    exerciseId: EXERCISE_IDS.has(r.exerciseId as number) ? (r.exerciseId as number) : bad("Invalid exercise"),
    setNo: int(r.setNo, 1, 1000, "set number"), weightKg: r.weightKg as number, reps: int(r.reps, 1, 1000, "reps"),
    parentSetId: idOrNull(r.parentSetId, "parent set id"), supersetId: idOrNull(r.supersetId, "superset id"),
    note: textOrNull(r.note, 500, "note"),
    updatedAt: int(r.updatedAt, 1, 1e15, "updatedAt"), deletedAt: r.deletedAt === null ? null : int(r.deletedAt, 1, 1e15, "deletedAt"),
  };
}

function parse(raw: unknown): SyncRequest {
  const r = obj(raw, "request");
  if (!Array.isArray(r.workouts) || !Array.isArray(r.sets)) bad("Invalid request");
  const ws = r.workouts as unknown[], ss = r.sets as unknown[];
  if (ws.length + ss.length > MAX_PUSH) bad("Too many rows in one request");
  return { since: int(r.since, 0, 1e15, "cursor"), workouts: ws.map(workoutRow), sets: ss.map(setRow) };
}

const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// FK enforced hai — push me jo parents nahi hain wo DB me hone chahiye
async function checkRefs(db: DB, req: SyncRequest) {
  const missing = async (table: typeof workouts | typeof sets, wanted: Set<string>) => {
    if (!wanted.size) return false;
    const found = await db.select({ id: table.id }).from(table).where(inArray(table.id, [...wanted]));
    return found.length !== wanted.size;
  };
  const pushedW = new Set(req.workouts.map((w) => w.id)), pushedS = new Set(req.sets.map((s) => s.id));
  if (await missing(workouts, new Set(req.sets.map((s) => s.workoutId).filter((x) => !pushedW.has(x))))) bad("Unknown workout");
  if (await missing(sets, new Set(req.sets.flatMap((s) => (s.parentSetId && !pushedS.has(s.parentSetId) ? [s.parentSetId] : []))))) bad("Unknown parent set");
}

// Push (last-write-wins by updatedAt, har row ko unique rev) + pull (rev > since), paginated
export async function applySync(db: DB, raw: unknown): Promise<SyncResponse> {
  const req = parse(raw);
  // FK order: workouts pehle, sets me parent (main) pehle
  const W = req.workouts;
  const S = [...req.sets.filter((s) => !s.parentSetId), ...req.sets.filter((s) => s.parentSetId)];
  const n = W.length + S.length;

  if (n > 0) {
    await checkRefs(db, req);
    // counter n se badhao, phir row k ko rev = (naya counter) - n + k + 1 → unique, ek hi transaction (batch)
    const rev = (k: number) => sql<number>`(select rev from sync_state where id = 1) + ${k + 1 - n}`;
    const stmts = [db.update(syncState).set({ rev: sql`${syncState.rev} + ${n}` }).where(eq(syncState.id, 1))] as unknown[];
    chunks(W, 100).forEach((c, ci) =>
      stmts.push(
        db.insert(workouts).values(c.map((r, i) => ({ ...r, rev: rev(ci * 100 + i) }))).onConflictDoUpdate({
          target: workouts.id,
          set: { date: sql`excluded.date`, label: sql`excluded.label`, notes: sql`excluded.notes`, updatedAt: sql`excluded.updated_at`, deletedAt: sql`excluded.deleted_at`, rev: sql`excluded.rev` },
          setWhere: sql`excluded.updated_at >= ${workouts.updatedAt}`,
        }),
      ),
    );
    chunks(S, 100).forEach((c, ci) =>
      stmts.push(
        db.insert(sets).values(c.map((r, i) => ({ ...r, rev: rev(W.length + ci * 100 + i) }))).onConflictDoUpdate({
          target: sets.id,
          set: {
            exerciseId: sql`excluded.exercise_id`, setNo: sql`excluded.set_no`, weightKg: sql`excluded.weight_kg`, reps: sql`excluded.reps`,
            parentSetId: sql`excluded.parent_set_id`, supersetId: sql`excluded.superset_id`, note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`, deletedAt: sql`excluded.deleted_at`, rev: sql`excluded.rev`,
          },
          setWhere: sql`excluded.updated_at >= ${sets.updatedAt}`,
        }),
      ),
    );
    await db.batch(stmts as unknown as Parameters<DB["batch"]>[0]);
  }

  const head = (await db.select().from(syncState).where(eq(syncState.id, 1)).get())!.rev;
  const since = req.since > head ? 0 : req.since; // server reset/restore hua to poora dobara
  const range = (rev: typeof workouts.rev | typeof sets.rev) => and(gt(rev, since), lte(rev, head));
  const [w, s] = await Promise.all([
    db.select().from(workouts).where(range(workouts.rev)).orderBy(asc(workouts.rev)).limit(PAGE + 1),
    db.select().from(sets).where(range(sets.rev)).orderBy(asc(sets.rev)).limit(PAGE + 1),
  ]);
  const merged = [...w.map((r) => ({ t: "w" as const, r })), ...s.map((r) => ({ t: "s" as const, r }))].sort((a, b) => a.r.rev - b.r.rev);
  const page = merged.slice(0, PAGE);
  const more = merged.length > PAGE;
  return {
    rev: head,
    cursor: more ? page[page.length - 1].r.rev : head,
    more,
    workouts: page.flatMap((p) => (p.t === "w" ? [{ id: p.r.id, date: p.r.date, label: p.r.label, notes: p.r.notes, updatedAt: p.r.updatedAt, deletedAt: p.r.deletedAt }] : [])),
    sets: page.flatMap((p) =>
      p.t === "s"
        ? [{ id: p.r.id, workoutId: p.r.workoutId, exerciseId: p.r.exerciseId, setNo: p.r.setNo, weightKg: p.r.weightKg, reps: p.r.reps, parentSetId: p.r.parentSetId, supersetId: p.r.supersetId, note: p.r.note, updatedAt: p.r.updatedAt, deletedAt: p.r.deletedAt }]
        : [],
    ),
  };
}
