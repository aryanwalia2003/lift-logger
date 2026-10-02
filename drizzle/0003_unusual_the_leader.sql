-- Hand-written, data-preserving: int ids → text ids (-lw/-ls/-lss prefix, '-' sabse pehle sort hota hai), + sync columns.
-- drizzle-kit ki auto SQL purani rows se columns copy nahi kar sakti thi, isliye replace ki.
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `__new_workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`rev` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workouts`(`id`, `date`, `label`, `notes`, `updated_at`, `deleted_at`, `rev`)
SELECT printf('-lw%08d', `id`), `date`, `label`, `notes`, CAST(strftime('%s','now') AS integer) * 1000, NULL, `id` FROM `workouts`;
--> statement-breakpoint
CREATE TABLE `__new_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` integer NOT NULL,
	`set_no` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`parent_set_id` text,
	`superset_id` text,
	`note` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`rev` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `__new_workouts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_set_id`) REFERENCES `__new_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sets`(`id`, `workout_id`, `exercise_id`, `set_no`, `weight_kg`, `reps`, `parent_set_id`, `superset_id`, `note`, `updated_at`, `deleted_at`, `rev`)
SELECT printf('-ls%08d', `id`), printf('-lw%08d', `workout_id`), `exercise_id`, `set_no`, `weight_kg`, `reps`,
  CASE WHEN `parent_set_id` IS NULL THEN NULL ELSE printf('-ls%08d', `parent_set_id`) END,
  CASE WHEN `superset_id` IS NULL THEN NULL ELSE printf('-lss%08d', `superset_id`) END,
  `note`, CAST(strftime('%s','now') AS integer) * 1000, NULL,
  (SELECT coalesce(max(`id`), 0) FROM `workouts`) + `id`
FROM `sets`;
--> statement-breakpoint
DROP TABLE `sets`;
--> statement-breakpoint
DROP TABLE `workouts`;
--> statement-breakpoint
ALTER TABLE `__new_workouts` RENAME TO `workouts`;
--> statement-breakpoint
ALTER TABLE `__new_sets` RENAME TO `sets`;
--> statement-breakpoint
CREATE INDEX `workouts_rev` ON `workouts` (`rev`);
--> statement-breakpoint
CREATE INDEX `sets_rev` ON `sets` (`rev`);
--> statement-breakpoint
CREATE INDEX `sets_exercise` ON `sets` (`exercise_id`);
--> statement-breakpoint
INSERT INTO `sync_state`(`id`, `rev`)
SELECT 1, max(coalesce((SELECT max(`rev`) FROM `workouts`), 0), coalesce((SELECT max(`rev`) FROM `sets`), 0));
