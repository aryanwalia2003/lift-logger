import { EXERCISE_ROWS, LABELS, LABEL_KEYS, PART_ROWS, exerciseById, partById, topPartOf, type Label } from "./catalog";
import type { Row } from "./analytics";
import type { LiftDB, LSet, LWorkout } from "./local-db";

export const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // code-unit order (ids ke liye)

// Time-ordered id: sort = creation order, offline bhi unique (ms + counter + random)
let lastTs = 0, counter = 0;
export function newId() {
  const ts = Date.now();
  counter = ts === lastTs ? counter + 1 : 0;
  lastTs = ts;
  return ts.toString(36).padStart(9, "0") + counter.toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}

const check = (weightKg: number, reps: number) => {
  if (!Number.isFinite(weightKg) || weightKg < 0 || !Number.isInteger(reps) || reps < 1) throw new Error("Invalid weight or reps");
};
const cleanNote = (s?: string | null) => {
  const t = (s ?? "").trim();
  if (t.length > 500) throw new Error("Note is too long (max 500 characters)");
  return t || null;
};
const alive = <T extends { deletedAt: number | null }>(r: T) => !r.deletedAt;
const byId = (a: { id: string }, b: { id: string }) => cmp(a.id, b.id);

export type Store = ReturnType<typeof makeStore>;

// Saari reads/writes local DB pe. Har write dirty=1 + updatedAt; onChange = sync schedule
export function makeStore(db: LiftDB, onChange: () => void = () => {}) {
  const exerciseSets = (workoutId: string, exerciseId: number) =>
    db.sets.where("workoutId").equals(workoutId).filter((s) => s.exerciseId === exerciseId && alive(s)).toArray();

  async function buildSet(workoutId: string, exerciseId: number, weightKg: number, reps: number, o: { drop?: boolean; supersetId?: string }): Promise<LSet> {
    check(weightKg, reps);
    const w = await db.workouts.get(workoutId);
    if (!w || w.deletedAt) throw new Error("Workout not found");
    if (!exerciseById(exerciseId)) throw new Error("Invalid exercise");
    const mains = (await exerciseSets(workoutId, exerciseId)).filter((s) => !s.parentSetId).sort(byId);
    const parent = o.drop ? mains.at(-1) : undefined;
    if (o.drop && !parent) throw new Error("Log a main set before adding a drop");
    return {
      id: newId(), workoutId, exerciseId, setNo: parent?.setNo ?? Math.max(0, ...mains.map((m) => m.setNo)) + 1,
      weightKg, reps, parentSetId: parent?.id ?? null, supersetId: o.supersetId ?? null, note: null,
      updatedAt: Date.now(), deletedAt: null, dirty: 1,
    };
  }

  return {
    async createWorkout(label: Label, date = localDate()) {
      if (!LABEL_KEYS.includes(label)) throw new Error("Invalid label");
      const w: LWorkout = { id: newId(), date, label, notes: null, updatedAt: Date.now(), deletedAt: null, dirty: 1 };
      await db.workouts.add(w);
      onChange();
      return w;
    },

    // Drop set = us exercise ke latest main set se attach; setNo parent wala hi
    async addSet(workoutId: string, exerciseId: number, weightKg: number, reps: number, o: { drop?: boolean; supersetId?: string } = {}) {
      const s = await buildSet(workoutId, exerciseId, weightKg, reps, o);
      await db.sets.add(s);
      onChange();
      return s;
    },

    // Superset round: dono sets same supersetId, ek saath (sab validate hone ke baad hi insert)
    async addRound(workoutId: string, items: { exerciseId: number; weightKg: number; reps: number }[]) {
      if (items.length !== 2 || items[0].exerciseId === items[1].exerciseId) throw new Error("A superset needs 2 different exercises");
      const supersetId = newId();
      const rows = [];
      for (const i of items) rows.push(await buildSet(workoutId, i.exerciseId, i.weightKg, i.reps, { supersetId }));
      await db.sets.bulkAdd(rows);
      onChange();
      return rows;
    },

    async updateSet(id: string, weightKg: number, reps: number, note?: string) {
      check(weightKg, reps);
      const s = await db.sets.get(id);
      if (!s || s.deletedAt) throw new Error("Set not found");
      const next: LSet = { ...s, weightKg, reps, note: cleanNote(note), updatedAt: Date.now(), dirty: 1 };
      await db.sets.put(next);
      onChange();
      return next;
    },

    // Soft delete (tombstone) — main set ke saath uske drops bhi
    async deleteSet(id: string) {
      const s = await db.sets.get(id);
      if (!s) return;
      const now = Date.now();
      const rows = await db.sets.where("workoutId").equals(s.workoutId).filter((x) => (x.id === id || x.parentSetId === id) && alive(x)).toArray();
      await db.sets.bulkPut(rows.map((x) => ({ ...x, deletedAt: now, updatedAt: now, dirty: 1 as const })));
      onChange();
    },

    async setWorkoutNotes(id: string, notes?: string) {
      const w = await db.workouts.get(id);
      if (!w || w.deletedAt) throw new Error("Workout not found");
      await db.workouts.put({ ...w, notes: cleanNote(notes), updatedAt: Date.now(), dirty: 1 });
      onChange();
    },

    // ---- reads ----
    async getWorkout(id: string) {
      const w = await db.workouts.get(id);
      return w && alive(w) ? w : undefined;
    },

    async recentWorkouts() {
      const ws = await db.workouts.filter(alive).toArray();
      return ws.sort((a, b) => cmp(b.date, a.date) || cmp(b.id, a.id)).slice(0, 7);
    },

    async workoutSets(workoutId: string) {
      const ss = (await db.sets.where("workoutId").equals(workoutId).filter(alive).toArray()).sort(byId);
      return ss.map((s) => ({ ...s, exercise: exerciseById(s.exerciseId)!.name }));
    },

    // Is exercise ka sabse recent main set (prefill ke liye, drop nahi)
    async lastSet(exerciseId: number) {
      const ss = await db.sets.where("exerciseId").equals(exerciseId).filter((s) => alive(s) && !s.parentSetId).sortBy("id");
      return ss.at(-1);
    },

    // Drop mode ka prefill: is workout me exercise ka latest set (drop ya main)
    async latestInWorkout(workoutId: string, exerciseId: number) {
      return (await exerciseSets(workoutId, exerciseId)).sort(byId).at(-1);
    },

    // Analytics ke liye flat rows (catalog code se, baaki local DB se)
    async loadRows(): Promise<Row[]> {
      const [ws, ss] = await Promise.all([db.workouts.filter(alive).toArray(), db.sets.filter(alive).toArray()]);
      const wm = new Map(ws.map((w) => [w.id, w]));
      return ss
        .filter((s) => wm.has(s.workoutId))
        .sort((a, b) => cmp(wm.get(a.workoutId)!.date, wm.get(b.workoutId)!.date) || cmp(a.workoutId, b.workoutId) || cmp(a.id, b.id))
        .map((s) => {
          const w = wm.get(s.workoutId)!, e = exerciseById(s.exerciseId)!, leaf = partById(e.bodyPartId)!, top = topPartOf(leaf.id);
          return {
            workoutId: w.id, date: w.date, label: w.label, exerciseId: e.id, exercise: e.name,
            partId: leaf.id, part: leaf.name, topId: top.id, top: top.name,
            setNo: s.setNo, weight: s.weightKg, reps: s.reps, isDrop: !!s.parentSetId, supersetId: s.supersetId, note: s.note,
          };
        });
    },
  };
}

// ---- catalog helpers (pure, code se) ----
// Top-level body parts: label ke parts pehle, baaki baad me
export function orderedBodyParts(label: Label) {
  const first = LABELS[label].parts as readonly string[];
  const rank = (n: string) => (first.includes(n) ? first.indexOf(n) : 99);
  const sorted = PART_ROWS.filter((p) => !p.parentId).sort((a, b) => rank(a.name) - rank(b.name));
  return { suggested: sorted.filter((p) => rank(p.name) < 99), others: sorted.filter((p) => rank(p.name) === 99) };
}

// Body part (aur uske children) ki exercises, sub-part ke naam ke saath
export function exercisesOf(bodyPartId: number) {
  const ids = new Set([bodyPartId, ...PART_ROWS.filter((p) => p.parentId === bodyPartId).map((p) => p.id)]);
  return EXERCISE_ROWS.filter((e) => ids.has(e.bodyPartId))
    .map((e) => ({ id: e.id, name: e.name, part: partById(e.bodyPartId)!.name, bodyPartId: e.bodyPartId }))
    .sort((a, b) => a.bodyPartId - b.bodyPartId || a.id - b.id);
}
