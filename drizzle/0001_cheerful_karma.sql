PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `diary_logs_user_client_mutation_unique` ON `diary_logs` (`user_id`,`client_mutation_id`) WHERE "diary_logs"."client_mutation_id" is not null;--> statement-breakpoint
CREATE INDEX `diary_logs_dashboard_idx` ON `diary_logs` (`user_id`,`diary_date`,`meal_slot`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `diary_logs_recency_idx` ON `diary_logs` (`user_id`,`food_id`,`deleted_at`,`"logged_at" desc`);--> statement-breakpoint
CREATE INDEX `diary_logs_shortcut_undo_idx` ON `diary_logs` (`user_id`,`shortcut_batch_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `__new_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`amount_unit` text NOT NULL,
	`basis_amount` integer NOT NULL,
	`serving_amount` integer,
	`container_amount` integer,
	`energy_mkcal_per_basis` integer NOT NULL,
	`protein_mg_per_basis` integer NOT NULL,
	`carbs_mg_per_basis` integer NOT NULL,
	`fat_mg_per_basis` integer NOT NULL,
	`additional_nutrition_json` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "foods_amount_unit_check" CHECK("__new_foods"."amount_unit" in ('mg', 'ul')),
	CONSTRAINT "foods_basis_amount_positive_check" CHECK("__new_foods"."basis_amount" > 0),
	CONSTRAINT "foods_optional_amounts_positive_check" CHECK(("__new_foods"."serving_amount" is null or "__new_foods"."serving_amount" > 0) and ("__new_foods"."container_amount" is null or "__new_foods"."container_amount" > 0)),
	CONSTRAINT "foods_core_nutrition_non_negative_check" CHECK("__new_foods"."energy_mkcal_per_basis" >= 0 and "__new_foods"."protein_mg_per_basis" >= 0 and "__new_foods"."carbs_mg_per_basis" >= 0 and "__new_foods"."fat_mg_per_basis" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_foods`("id", "user_id", "name", "brand", "barcode", "amount_unit", "basis_amount", "serving_amount", "container_amount", "energy_mkcal_per_basis", "protein_mg_per_basis", "carbs_mg_per_basis", "fat_mg_per_basis", "additional_nutrition_json", "notes", "created_at", "updated_at", "deleted_at") SELECT "id", "user_id", "name", "brand", "barcode", "amount_unit", "basis_amount", "serving_amount", "container_amount", "energy_mkcal_per_basis", "protein_mg_per_basis", "carbs_mg_per_basis", "fat_mg_per_basis", "additional_nutrition_json", "notes", "created_at", "updated_at", "deleted_at" FROM `foods`;--> statement-breakpoint
DROP TABLE `foods`;--> statement-breakpoint
ALTER TABLE `__new_foods` RENAME TO `foods`;--> statement-breakpoint
CREATE INDEX `foods_user_active_name_idx` ON `foods` (`user_id`,`deleted_at`,`name`);--> statement-breakpoint
CREATE INDEX `foods_user_active_brand_idx` ON `foods` (`user_id`,`deleted_at`,`brand`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_user_active_barcode_unique` ON `foods` (`user_id`,`barcode`) WHERE "foods"."barcode" is not null and "foods"."deleted_at" is null;