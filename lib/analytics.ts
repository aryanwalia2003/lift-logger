import type { Label } from "./catalog";

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // ids ka code-unit order (store.ts jaisa)

// Poora analytics ek flat rows list se — client pe local data par chalta hai (offline bhi)
// ponytail: saari rows memory me; lakhon sets ho jaayein to aggregate/index chahiye
export type Row = {
  workoutId: string; date: string; label: Label;
  exerciseId: number; exercise: string;
  partId: number; part: string; topId: number; top: string;
  setNo: number; weight: number; reps: number;
  isDrop: boolean; supersetId: string | null; note: string | null;
};

export const vol = (r: Row) => r.weight * r.reps;
export const e1rm = (r: Row) => r.weight * (1 + r.reps / 30); // Epley
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
// Drop set alag "set" nahi — parent set ka hissa. Volume me count, sets/e1RM/rep-range me nahi
const work = (rs: Row[]) => rs.filter((r) => !r.isDrop);
const nSets = (rs: Row[]) => work(rs).length;

export function groupBy<T, K>(a: T[], f: (t: T) => K) {
  const m = new Map<K, T[]>();
  for (const x of a) {
    const k = f(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}
export const countBy = <T>(a: T[], f: (t: T) => string) =>
  Object.fromEntries([...groupBy(a, f)].map(([k, v]) => [k, v.length])) as Record<string, number>;

// ---- dates (sab YYYY-MM-DD, UTC math) ----
export const today = () => new Date().toLocaleDateString("en-CA");
export const addDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const weekStart = (d: string) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7)); // Monday

// ---- range ----
export const RANGES = { "30": "30d", "90": "90d", "365": "1y", all: "All" } as const;
export type Range = keyof typeof RANGES;
export const parseRange = (r?: string): Range => (r && r in RANGES ? (r as Range) : "90");
export const inRange = <T extends { date: string }>(rows: T[], r: Range) =>
  r === "all" ? rows : rows.filter((x) => x.date >= addDays(today(), -Number(r)));
export const weeksIn = (rows: Row[], r: Range) =>
  Math.max(1, r === "all" ? Math.ceil((daysBetween(rows[0]?.date ?? today(), today()) + 1) / 7) : Math.ceil(Number(r) / 7));

// ---- sessions / weeks ----
export function sessions(rows: Row[]) {
  return [...groupBy(rows, (r) => r.workoutId)]
    .map(([id, rs]) => ({
      id, date: rs[0].date, label: rs[0].label, sets: nSets(rs),
      volume: sum(rs.map(vol)), parts: countBy(rs, (r) => r.top),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || cmp(a.id, b.id));
}

// Continuous weeks (khali hafte bhi), aakhri `weeks` ke
export function weekly(rows: Row[], weeks: number, key: (r: Row) => string = (r) => r.top) {
  const end = weekStart(today());
  const byWeek = groupBy(rows, (r) => weekStart(r.date));
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(end, -7 * (weeks - 1 - i));
    const rs = byWeek.get(week) ?? [];
    return { week, workouts: new Set(rs.map((r) => r.workoutId)).size, sets: nSets(rs), volume: sum(rs.map(vol)), parts: countBy(rs, key) };
  });
}

export function summary(rows: Row[], range: Range) {
  const ss = sessions(rows);
  return {
    workouts: ss.length,
    sets: nSets(rows),
    drops: rows.length - nSets(rows),
    rounds: new Set(rows.flatMap((r) => (r.supersetId ? [r.supersetId] : []))).size,
    volume: sum(rows.map(vol)),
    perWeek: ss.length / weeksIn(rows, range),
    last: ss.at(-1)?.date,
  };
}

// Schedule grid: aakhri n hafte, har din ke labels
export function schedule(rows: Row[], weeks = 8) {
  const byDate = new Map([...groupBy(sessions(rows), (s) => s.date)].map(([d, ss]) => [d, ss.map((s) => s.label)]));
  const end = weekStart(today());
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(end, -7 * (weeks - 1 - i));
    return { week, days: Array.from({ length: 7 }, (_, d) => ({ date: addDays(week, d), labels: byDate.get(addDays(week, d)) ?? [] })) };
  });
}

export function byLabel(rows: Row[]) {
  return [...groupBy(sessions(rows), (s) => s.label)]
    .map(([label, ss]) => ({
      label, count: ss.length, last: ss.at(-1)!.date,
      avgSets: sum(ss.map((s) => s.sets)) / ss.length,
      avgVolume: sum(ss.map((s) => s.volume)) / ss.length,
      everyDays: ss.length > 1 ? daysBetween(ss[0].date, ss.at(-1)!.date) / (ss.length - 1) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export function byPart(rows: Row[]) {
  return [...groupBy(rows, (r) => r.topId)]
    .map(([id, rs]) => ({
      id, name: rs[0].top, sets: nSets(rs), volume: sum(rs.map(vol)),
      sessions: new Set(rs.map((r) => r.workoutId)).size, last: rs.at(-1)!.date,
    }))
    .sort((a, b) => b.sets - a.sets);
}

// ---- exercise ----
export function exerciseSessions(rows: Row[]) {
  let best = 0;
  return [...groupBy(rows, (r) => r.workoutId)]
    .map(([id, rs]) => {
      const ws = work(rs).length ? work(rs) : rs; // e1RM/top weight sirf main sets se
      const top = ws.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
      return { id, date: rs[0].date, sets: rs, volume: sum(rs.map(vol)), topWeight: Math.max(...ws.map((r) => r.weight)), e1rm: e1rm(top), best: top };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || cmp(a.id, b.id))
    .map((s, i) => {
      const pr = i > 0 && s.e1rm > best + 1e-9; // pehla session PR nahi
      best = Math.max(best, s.e1rm);
      return { ...s, pr };
    });
}

export function byExercise(rows: Row[]) {
  return [...groupBy(rows, (r) => r.exerciseId)]
    .map(([id, rs]) => {
      const ss = exerciseSessions(rs);
      return {
        id, name: rs[0].exercise, part: rs[0].part, top: rs[0].top, topId: rs[0].topId,
        sets: nSets(rs), sessions: ss.length, last: ss.at(-1)!.date,
        bestE1rm: Math.max(...ss.map((s) => s.e1rm)),
        change: ss.length > 1 ? (ss.at(-1)!.e1rm / ss[0].e1rm - 1) * 100 : null, // % e1RM, is range me
      };
    })
    .sort((a, b) => b.sets - a.sets);
}

// All-time rows chahiye (PR ka matlab pichhle best se zyada)
export function prs(all: Row[]) {
  return [...groupBy(all, (r) => r.exerciseId)]
    .flatMap(([, rs]) => exerciseSessions(rs).filter((s) => s.pr).map((s) => ({ exerciseId: rs[0].exerciseId, exercise: rs[0].exercise, date: s.date, e1rm: s.e1rm, best: s.best })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const REP_BUCKETS: [string, (r: number) => boolean][] = [
  ["1–5", (r) => r <= 5], ["6–8", (r) => r >= 6 && r <= 8], ["9–12", (r) => r >= 9 && r <= 12], ["13+", (r) => r >= 13],
];
export const repBuckets = (rows: Row[]) => REP_BUCKETS.map(([label, f]) => ({ label, value: work(rows).filter((r) => f(r.reps)).length }));

// Superset pairs: kaunsi exercises saath me kitne rounds
export function supersetPairs(rows: Row[]) {
  const rounds = [...groupBy(rows.filter((r) => r.supersetId), (r) => r.supersetId)].map(([, rs]) => rs.map((r) => r.exercise).sort().join(" + "));
  return Object.entries(countBy(rounds, (k) => k)).map(([pair, rounds]) => ({ pair, rounds })).sort((a, b) => b.rounds - a.rounds);
}
