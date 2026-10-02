ALTER TABLE `sets` ADD `parent_set_id` integer REFERENCES sets(id);--> statement-breakpoint
ALTER TABLE `sets` ADD `superset_id` integer;