// Yahi poori exercise list hai — exercise → muscle group
export const EXERCISES = {
  INCLINE_DUMBBELL_CHEST_PRESS: "CHEST",
  FLAT_DUMBBELL_CHEST_PRESS: "CHEST",
  INCLINE_BENCH_PRESS: "CHEST",
  FLAT_BENCH_PRESS: "CHEST",
  CHEST_PRESS: "CHEST",
  DUMBBELL_FLYES: "CHEST",
  CABLE_CROSSOVER: "CHEST",
  PEC_DECK_FLY: "CHEST",
  LAT_PULLDOWN: "BACK",
  LAT_PULLDOWN_WITH_A_SINGLE_D_HANDLE: "BACK",
  CHEST_SUPPORTED_ROWS: "BACK",
  SEATED_ROWS: "BACK",
  T_BAR_ROWS: "BACK",
  DUMBBELL_ROWS: "BACK",
  RACK_PULLS: "BACK",
  BARBELL_ROWS: "BACK",
  SINGLE_D_BAR_PUSHDOWNS: "TRICEP",
  EASY_BAR_PUSHDOWNS: "TRICEP",
  FLAT_BAR_PUSHDOWNS: "TRICEP",
  V_BAR_PUSHDOWNS: "TRICEP",
  LOW_TO_HIGH_PULLEY_TRICEP: "TRICEP",
  SKULL_CRUSHERS: "TRICEP",
  JM_PRESS: "TRICEP",
  JM_PRESS_ON_SMITH_MACHINE: "TRICEP",
  PREACHER_CURLS: "BICEP",
  DUMBBELL_CURLS: "BICEP",
  EZ_BAR_CURLS: "BICEP",
  FLAT_BAR_CURLS: "BICEP",
  LEG_EXTENSIONS: "LEGS",
  HAMSTRING_CURLS: "LEGS",
  SQUATS: "LEGS",
  FRONT_SQUATS: "LEGS",
  REAR_CHAIR_SQUATS: "LEGS",
  HACK_SQUAT: "LEGS",
  LEG_PRESS: "LEGS",
  BULGARIAN_SPLIT_SQUATS: "LEGS",
  LUNGES: "LEGS",
  SHOULDER_DUMBBELL_PRESS: "FRONT_DELT",
  SMITH_MACHINE_PRESS: "FRONT_DELT",
  MACHINE_PRESS: "FRONT_DELT",
  SIDE_LATERAL_RAISES: "SIDE_DELT",
  SINGLE_ARM_LATERAL_RAISES: "SIDE_DELT",
  PULLEY_LATERAL_RAISES: "SIDE_DELT",
  INCLINE_BENCH_LATERAL_RAISES: "SIDE_DELT",
} as const;

export type Exercise = keyof typeof EXERCISES;
export type MuscleGroup = (typeof EXERCISES)[Exercise];

// Din → kaunse muscle groups us din hote hain (split badalna ho to yahin)
export const DAYS = {
  CHEST: ["CHEST"],
  BACK: ["BACK"],
  SHOULDERS: ["FRONT_DELT", "SIDE_DELT"],
  ARMS: ["BICEP", "TRICEP"],
  LEGS: ["LEGS"],
} as const satisfies Record<string, readonly MuscleGroup[]>;

export type DayType = keyof typeof DAYS;

export const EXERCISE_LIST = Object.keys(EXERCISES) as [Exercise, ...Exercise[]];
export const DAY_TYPES = Object.keys(DAYS) as [DayType, ...DayType[]];

export const inDay = (e: Exercise, day: DayType) =>
  (DAYS[day] as readonly MuscleGroup[]).includes(EXERCISES[e]);

// Us din ki exercises dropdown ke liye
export const exercisesFor = (day: DayType) => EXERCISE_LIST.filter((e) => inDay(e, day));
