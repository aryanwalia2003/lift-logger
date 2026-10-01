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
  CHEST_DAY: { name: "Chest day", parts: ["chest", "shoulders", "tricep"] },
  BACK_DAY: { name: "Back day", parts: ["back", "bicep"] },
  LEG_DAY: { name: "Leg day", parts: ["legs"] },
  ARM_DAY: { name: "Arm day", parts: ["bicep", "tricep"] },
  PUSH: { name: "Push", parts: ["chest", "shoulders", "tricep"] },
  PULL: { name: "Pull", parts: ["back", "bicep"] },
  LEGS: { name: "Legs", parts: ["legs"] },
  UPPER: { name: "Upper", parts: ["chest", "back", "shoulders", "bicep", "tricep"] },
  LOWER: { name: "Lower", parts: ["legs"] },
} as const;

export type Label = keyof typeof LABELS;
export const LABEL_KEYS = Object.keys(LABELS) as [Label, ...Label[]];
