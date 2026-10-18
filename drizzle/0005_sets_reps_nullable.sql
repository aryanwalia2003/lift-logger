DROP INDEX "body_parts_name_unique";--> statement-breakpoint
DROP INDEX "exercises_name_unique";--> statement-breakpoint
DROP INDEX "sets_rev";--> statement-breakpoint
DROP INDEX "sets_exercise";--> statement-breakpoint
DROP INDEX "workouts_rev";--> statement-breakpoint
ALTER TABLE `sets` ALTER COLUMN "reps" TO "reps" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `body_parts_name_unique` ON `body_parts` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE INDEX `sets_rev` ON `sets` (`rev`);--> statement-breakpoint
CREATE INDEX `sets_exercise` ON `sets` (`exercise_id`);--> statement-breakpoint
CREATE INDEX `workouts_rev` ON `workouts` (`rev`);