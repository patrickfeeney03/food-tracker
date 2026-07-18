CREATE TABLE `meal_shortcut_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shortcut_id` text NOT NULL,
	`shortcut_name` text NOT NULL,
	`client_mutation_id` text NOT NULL,
	`diary_date` text NOT NULL,
	`meal_slot` text NOT NULL,
	`created_at` integer NOT NULL,
	`undone_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shortcut_id`) REFERENCES `meal_shortcuts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "meal_shortcut_applications_diary_date_check" CHECK(length("meal_shortcut_applications"."diary_date") = 10 and "meal_shortcut_applications"."diary_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "meal_shortcut_applications_meal_slot_check" CHECK("meal_shortcut_applications"."meal_slot" in ('breakfast', 'lunch', 'dinner', 'snacks'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_shortcut_applications_user_client_mutation_unique` ON `meal_shortcut_applications` (`user_id`,`client_mutation_id`);--> statement-breakpoint
CREATE INDEX `meal_shortcut_applications_user_created_idx` ON `meal_shortcut_applications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `meal_shortcuts_id_user_unique` ON `meal_shortcuts` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_id_user_unique` ON `foods` (`id`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meal_shortcut_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shortcut_id` text NOT NULL,
	`food_id` text NOT NULL,
	`amount_unit` text NOT NULL,
	`position` integer NOT NULL,
	`default_amount` integer NOT NULL,
	`default_portion_kind` text,
	`default_portion_label` text,
	`default_portion_amount` integer,
	`default_portion_count_milli` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shortcut_id`,`user_id`) REFERENCES `meal_shortcuts`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`,`user_id`) REFERENCES `foods`(`id`,`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "meal_shortcut_items_amount_unit_check" CHECK("__new_meal_shortcut_items"."amount_unit" in ('mg', 'ul')),
	CONSTRAINT "meal_shortcut_items_position_non_negative_check" CHECK("__new_meal_shortcut_items"."position" >= 0),
	CONSTRAINT "meal_shortcut_items_default_amount_positive_check" CHECK("__new_meal_shortcut_items"."default_amount" > 0),
	CONSTRAINT "meal_shortcut_items_portion_kind_check" CHECK("__new_meal_shortcut_items"."default_portion_kind" is null or "__new_meal_shortcut_items"."default_portion_kind" in ('unit', 'hundred', 'serving', 'container')),
	CONSTRAINT "meal_shortcut_items_portion_snapshot_check" CHECK(("__new_meal_shortcut_items"."default_portion_kind" is null and "__new_meal_shortcut_items"."default_portion_label" is null and "__new_meal_shortcut_items"."default_portion_amount" is null and "__new_meal_shortcut_items"."default_portion_count_milli" is null) or ("__new_meal_shortcut_items"."default_portion_kind" is not null and "__new_meal_shortcut_items"."default_portion_label" is not null and "__new_meal_shortcut_items"."default_portion_amount" is not null and "__new_meal_shortcut_items"."default_portion_amount" > 0 and "__new_meal_shortcut_items"."default_portion_count_milli" is not null and "__new_meal_shortcut_items"."default_portion_count_milli" > 0))
);
--> statement-breakpoint
INSERT INTO `__new_meal_shortcut_items`("id", "user_id", "shortcut_id", "food_id", "amount_unit", "position", "default_amount", "default_portion_kind", "default_portion_label", "default_portion_amount", "default_portion_count_milli")
SELECT item."id", shortcut."user_id", item."shortcut_id", item."food_id", food."amount_unit", item."position", item."default_amount", item."default_portion_kind", item."default_portion_label", item."default_portion_amount", item."default_portion_count_milli"
FROM `meal_shortcut_items` item
INNER JOIN `meal_shortcuts` shortcut ON shortcut."id" = item."shortcut_id"
INNER JOIN `foods` food ON food."id" = item."food_id";--> statement-breakpoint
DROP TABLE `meal_shortcut_items`;--> statement-breakpoint
ALTER TABLE `__new_meal_shortcut_items` RENAME TO `meal_shortcut_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `meal_shortcut_items_shortcut_position_unique` ON `meal_shortcut_items` (`shortcut_id`,`position`);--> statement-breakpoint
CREATE INDEX `meal_shortcut_items_food_idx` ON `meal_shortcut_items` (`food_id`);--> statement-breakpoint
ALTER TABLE `meal_shortcuts` ADD `client_mutation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `meal_shortcuts_user_client_mutation_unique` ON `meal_shortcuts` (`user_id`,`client_mutation_id`) WHERE "meal_shortcuts"."client_mutation_id" is not null;--> statement-breakpoint
CREATE TABLE `__new_diary_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`food_id` text,
	`diary_date` text NOT NULL,
	`meal_slot` text NOT NULL,
	`source_shortcut_id` text,
	`shortcut_batch_id` text,
	`client_mutation_id` text,
	`food_name` text NOT NULL,
	`food_brand` text,
	`amount_unit` text NOT NULL,
	`basis_amount` integer NOT NULL,
	`energy_mkcal_per_basis` integer NOT NULL,
	`protein_mg_per_basis` integer NOT NULL,
	`carbs_mg_per_basis` integer NOT NULL,
	`fat_mg_per_basis` integer NOT NULL,
	`additional_nutrition_per_basis_json` text,
	`portion_kind` text NOT NULL,
	`portion_label` text NOT NULL,
	`portion_amount` integer NOT NULL,
	`portion_count_milli` integer NOT NULL,
	`resolved_amount` integer NOT NULL,
	`energy_mkcal` integer NOT NULL,
	`protein_mg` integer NOT NULL,
	`carbs_mg` integer NOT NULL,
	`fat_mg` integer NOT NULL,
	`additional_nutrition_total_json` text,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_shortcut_id`) REFERENCES `meal_shortcuts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shortcut_batch_id`) REFERENCES `meal_shortcut_applications`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "diary_logs_diary_date_check" CHECK(length("__new_diary_logs"."diary_date") = 10 and "__new_diary_logs"."diary_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "diary_logs_meal_slot_check" CHECK("__new_diary_logs"."meal_slot" in ('breakfast', 'lunch', 'dinner', 'snacks')),
	CONSTRAINT "diary_logs_amount_unit_check" CHECK("__new_diary_logs"."amount_unit" in ('mg', 'ul')),
	CONSTRAINT "diary_logs_portion_kind_check" CHECK("__new_diary_logs"."portion_kind" in ('unit', 'hundred', 'serving', 'container')),
	CONSTRAINT "diary_logs_amounts_positive_check" CHECK("__new_diary_logs"."basis_amount" > 0 and "__new_diary_logs"."portion_amount" > 0 and "__new_diary_logs"."portion_count_milli" > 0 and "__new_diary_logs"."resolved_amount" > 0),
	CONSTRAINT "diary_logs_basis_nutrition_non_negative_check" CHECK("__new_diary_logs"."energy_mkcal_per_basis" >= 0 and "__new_diary_logs"."protein_mg_per_basis" >= 0 and "__new_diary_logs"."carbs_mg_per_basis" >= 0 and "__new_diary_logs"."fat_mg_per_basis" >= 0),
	CONSTRAINT "diary_logs_total_nutrition_non_negative_check" CHECK("__new_diary_logs"."energy_mkcal" >= 0 and "__new_diary_logs"."protein_mg" >= 0 and "__new_diary_logs"."carbs_mg" >= 0 and "__new_diary_logs"."fat_mg" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_diary_logs`("id", "user_id", "food_id", "diary_date", "meal_slot", "source_shortcut_id", "shortcut_batch_id", "client_mutation_id", "food_name", "food_brand", "amount_unit", "basis_amount", "energy_mkcal_per_basis", "protein_mg_per_basis", "carbs_mg_per_basis", "fat_mg_per_basis", "additional_nutrition_per_basis_json", "portion_kind", "portion_label", "portion_amount", "portion_count_milli", "resolved_amount", "energy_mkcal", "protein_mg", "carbs_mg", "fat_mg", "additional_nutrition_total_json", "logged_at", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "food_id", "diary_date", "meal_slot", "source_shortcut_id", "shortcut_batch_id", "client_mutation_id", "food_name", "food_brand", "amount_unit", "basis_amount", "energy_mkcal_per_basis", "protein_mg_per_basis", "carbs_mg_per_basis", "fat_mg_per_basis", "additional_nutrition_per_basis_json", "portion_kind", "portion_label", "portion_amount", "portion_count_milli", "resolved_amount", "energy_mkcal", "protein_mg", "carbs_mg", "fat_mg", "additional_nutrition_total_json", "logged_at", "created_at", "updated_at", "deleted_at" FROM `diary_logs`;--> statement-breakpoint
DROP TABLE `diary_logs`;--> statement-breakpoint
ALTER TABLE `__new_diary_logs` RENAME TO `diary_logs`;--> statement-breakpoint
CREATE UNIQUE INDEX `diary_logs_user_client_mutation_unique` ON `diary_logs` (`user_id`,`client_mutation_id`) WHERE "diary_logs"."client_mutation_id" is not null;--> statement-breakpoint
CREATE INDEX `diary_logs_dashboard_idx` ON `diary_logs` (`user_id`,`diary_date`,`meal_slot`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `diary_logs_recency_idx` ON `diary_logs` (`user_id`,`food_id`,`deleted_at`,`logged_at`);--> statement-breakpoint
CREATE INDEX `diary_logs_shortcut_undo_idx` ON `diary_logs` (`user_id`,`shortcut_batch_id`,`deleted_at`);
