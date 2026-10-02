// Seed data — body parts, exercises, day labels. Yahin edit karo, phir `pnpm db:seed`
export const BODY_PARTS: { name: string; parent?: string }[] = [
  { name: "chest" },
  { name: "back" },
  { name: "shoulders" },
  { name: "front delt", parent: "shoulders" },
  { name: "side delt", parent: "shoulders" },
  { name: "tricep" },
  { name: "bicep" },
  { name: "legs" },
];

// Sirf leaf body part ki exercises
export const EXERCISES: Record<string, string[]> = {
  chest: ["incline dumbbell chest press", "flat dumbbell chest press", "incline bench press", "flat bench press", "chest press", "dumbbell flyes", "cable crossover", "pec deck fly"],
  back: ["lat pulldown", "lat pulldown with a single d handle", "chest-supported rows", "seated rows", "t-bar rows", "dumbbell rows", "rack pulls", "barbell rows"],
  tricep: ["single d-bar pushdowns", "easy-bar pushdowns", "flat-bar pushdowns", "v-bar pushdowns", "low-to-high pulley tricep", "skull crushers", "jm press", "jm press on smith machine"],
  bicep: ["preacher curls", "dumbbell curls", "ez-bar curls", "flat-bar curls"],
  legs: ["leg extensions", "hamstring curls", "squats", "front squats", "rear chair squats", "hack squat", "leg press", "bulgarian split squats", "lunges"],
  "front delt": ["shoulder dumbbell press", "smith machine press", "machine press"],
  "side delt": ["side lateral raises", "single-arm lateral raises", "pulley lateral raises", "incline bench lateral raises"],
};

// Day label → pehle kaunse body parts dikhane hain (baaki bhi hamesha dikhte hain)
export const LABELS = {
  CHEST_DAY: { name: "Chest day", short: "CHEST", parts: ["chest", "shoulders", "tricep"] },
  BACK_DAY: { name: "Back day", short: "BACK", parts: ["back", "bicep"] },
  LEG_DAY: { name: "Leg day", short: "LEG", parts: ["legs"] },
  ARM_DAY: { name: "Arm day", short: "ARM", parts: ["bicep", "tricep"] },
  PUSH: { name: "Push", short: "PUSH", parts: ["chest", "shoulders", "tricep"] },
  PULL: { name: "Pull", short: "PULL", parts: ["back", "bicep"] },
  LEGS: { name: "Legs", short: "LEGS", parts: ["legs"] },
  UPPER: { name: "Upper", short: "UP", parts: ["chest", "back", "shoulders", "bicep", "tricep"] },
  LOWER: { name: "Lower", short: "LOW", parts: ["legs"] },
} as const;

export type Label = keyof typeof LABELS;
export const LABEL_KEYS = Object.keys(LABELS) as [Label, ...Label[]];

// Body part → chart color slot (entity ke saath fixed, rank ke saath nahi)
export const PART_COLOR: Record<string, string> = {
  chest: "var(--s1)", back: "var(--s2)", shoulders: "var(--s3)", tricep: "var(--s4)",
  bicep: "var(--s5)", legs: "var(--s6)", "front delt": "var(--s3)", "side delt": "var(--s7)",
};

// ---- Catalog rows: ids deterministic (client aur server dono same), DB ke autoincrement order jaisa ----
export type BodyPartRow = { id: number; name: string; parentId: number | null };
export type ExerciseRow = { id: number; name: string; bodyPartId: number };

export const PART_ROWS: BodyPartRow[] = (() => {
  const ordered = [...BODY_PARTS.filter((p) => !p.parent), ...BODY_PARTS.filter((p) => p.parent)]; // top-level pehle
  const idOf = (name: string) => ordered.findIndex((p) => p.name === name) + 1;
  return ordered.map((p, i) => ({ id: i + 1, name: p.name, parentId: p.parent ? idOf(p.parent) : null }));
})();

export const EXERCISE_ROWS: ExerciseRow[] = Object.entries(EXERCISES)
  .flatMap(([part, names]) => names.map((name) => ({ name, bodyPartId: PART_ROWS.find((p) => p.name === part)!.id })))
  .map((e, i) => ({ id: i + 1, ...e }));

export const partById = (id: number) => PART_ROWS.find((p) => p.id === id);
export const exerciseById = (id: number) => EXERCISE_ROWS.find((e) => e.id === id);
export const topPartOf = (id: number) => {
  const p = partById(id)!;
  return p.parentId ? partById(p.parentId)! : p;
};
