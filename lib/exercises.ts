// Yahi poori exercise list hai — apni list se replace karo
export const EXERCISES = {
  INCLINE_BENCH_PRESS: "CHEST",
  FLAT_BENCH_PRESS: "CHEST",
  CABLE_FLY: "CHEST",
  PULL_UP: "BACK",
  BARBELL_ROW: "BACK",
  LAT_PULLDOWN: "BACK",
  OVERHEAD_PRESS: "SHOULDERS",
  LATERAL_RAISE: "SHOULDERS",
  BARBELL_CURL: "ARMS",
  TRICEP_PUSHDOWN: "ARMS",
  SQUAT: "LEGS",
  ROMANIAN_DEADLIFT: "LEGS",
  LEG_PRESS: "LEGS",
  CRUNCH: "ABS",
  PLANK: "ABS",
} as const;

export type Exercise = keyof typeof EXERCISES;
export type DayType = (typeof EXERCISES)[Exercise];

export const EXERCISE_LIST = Object.keys(EXERCISES) as [Exercise, ...Exercise[]];
export const DAY_TYPES = [...new Set(Object.values(EXERCISES))] as [DayType, ...DayType[]];

// Us din ki exercises dropdown ke liye
export const exercisesFor = (day: DayType) =>
  EXERCISE_LIST.filter((e) => EXERCISES[e] === day);
