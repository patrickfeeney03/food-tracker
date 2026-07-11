CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'google' NOT NULL,
	`provider_subject` text NOT NULL,
	`email_at_link` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_accounts_provider_check" CHECK("auth_accounts"."provider" in ('google'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_provider_subject_unique` ON `auth_accounts` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_user_provider_unique` ON `auth_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `diary_logs` (
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
	CONSTRAINT "diary_logs_diary_date_check" CHECK(length("diary_logs"."diary_date") = 10 and "diary_logs"."diary_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "diary_logs_meal_slot_check" CHECK("diary_logs"."meal_slot" in ('breakfast', 'lunch', 'dinner', 'snacks')),
	CONSTRAINT "diary_logs_amount_unit_check" CHECK("diary_logs"."amount_unit" in ('mg', 'ml')),
	CONSTRAINT "diary_logs_portion_kind_check" CHECK("diary_logs"."portion_kind" in ('unit', 'hundred', 'serving', 'container')),
	CONSTRAINT "diary_logs_amounts_positive_check" CHECK("diary_logs"."basis_amount" > 0 and "diary_logs"."portion_amount" > 0 and "diary_logs"."portion_count_milli" > 0 and "diary_logs"."resolved_amount" > 0),
	CONSTRAINT "diary_logs_basis_nutrition_non_negative_check" CHECK("diary_logs"."energy_mkcal_per_basis" >= 0 and "diary_logs"."protein_mg_per_basis" >= 0 and "diary_logs"."carbs_mg_per_basis" >= 0 and "diary_logs"."fat_mg_per_basis" >= 0),
	CONSTRAINT "diary_logs_total_nutrition_non_negative_check" CHECK("diary_logs"."energy_mkcal" >= 0 and "diary_logs"."protein_mg" >= 0 and "diary_logs"."carbs_mg" >= 0 and "diary_logs"."fat_mg" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diary_logs_user_client_mutation_unique` ON `diary_logs` (`user_id`,`client_mutation_id`) WHERE "diary_logs"."client_mutation_id" is not null;--> statement-breakpoint
CREATE INDEX `diary_logs_dashboard_idx` ON `diary_logs` (`user_id`,`diary_date`,`meal_slot`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `diary_logs_recency_idx` ON `diary_logs` (`user_id`,`food_id`,`deleted_at`,"logged_at" desc);--> statement-breakpoint
CREATE INDEX `diary_logs_shortcut_undo_idx` ON `diary_logs` (`user_id`,`shortcut_batch_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `foods` (
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
	CONSTRAINT "foods_amount_unit_check" CHECK("foods"."amount_unit" in ('mg', 'ml')),
	CONSTRAINT "foods_basis_amount_positive_check" CHECK("foods"."basis_amount" > 0),
	CONSTRAINT "foods_optional_amounts_positive_check" CHECK(("foods"."serving_amount" is null or "foods"."serving_amount" > 0) and ("foods"."container_amount" is null or "foods"."container_amount" > 0)),
	CONSTRAINT "foods_core_nutrition_non_negative_check" CHECK("foods"."energy_mkcal_per_basis" >= 0 and "foods"."protein_mg_per_basis" >= 0 and "foods"."carbs_mg_per_basis" >= 0 and "foods"."fat_mg_per_basis" >= 0)
);
--> statement-breakpoint
CREATE INDEX `foods_user_active_name_idx` ON `foods` (`user_id`,`deleted_at`,`name`);--> statement-breakpoint
CREATE INDEX `foods_user_active_brand_idx` ON `foods` (`user_id`,`deleted_at`,`brand`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_user_active_barcode_unique` ON `foods` (`user_id`,`barcode`) WHERE "foods"."barcode" is not null and "foods"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `meal_shortcut_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shortcut_id` text NOT NULL,
	`food_id` text NOT NULL,
	`position` integer NOT NULL,
	`default_amount` integer NOT NULL,
	`default_portion_kind` text,
	`default_portion_label` text,
	`default_portion_amount` integer,
	`default_portion_count_milli` integer,
	FOREIGN KEY (`shortcut_id`) REFERENCES `meal_shortcuts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "meal_shortcut_items_position_non_negative_check" CHECK("meal_shortcut_items"."position" >= 0),
	CONSTRAINT "meal_shortcut_items_default_amount_positive_check" CHECK("meal_shortcut_items"."default_amount" > 0),
	CONSTRAINT "meal_shortcut_items_portion_kind_check" CHECK("meal_shortcut_items"."default_portion_kind" is null or "meal_shortcut_items"."default_portion_kind" in ('unit', 'hundred', 'serving', 'container')),
	CONSTRAINT "meal_shortcut_items_portion_snapshot_check" CHECK(("meal_shortcut_items"."default_portion_kind" is null and "meal_shortcut_items"."default_portion_label" is null and "meal_shortcut_items"."default_portion_amount" is null and "meal_shortcut_items"."default_portion_count_milli" is null) or ("meal_shortcut_items"."default_portion_kind" is not null and "meal_shortcut_items"."default_portion_label" is not null and "meal_shortcut_items"."default_portion_amount" is not null and "meal_shortcut_items"."default_portion_amount" > 0 and "meal_shortcut_items"."default_portion_count_milli" is not null and "meal_shortcut_items"."default_portion_count_milli" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_shortcut_items_shortcut_position_unique` ON `meal_shortcut_items` (`shortcut_id`,`position`);--> statement-breakpoint
CREATE INDEX `meal_shortcut_items_food_idx` ON `meal_shortcut_items` (`food_id`);--> statement-breakpoint
CREATE TABLE `meal_shortcuts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_shortcuts_user_active_name_idx` ON `meal_shortcuts` (`user_id`,`deleted_at`,`name`);--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`target_energy_mkcal` integer NOT NULL,
	`target_protein_mg` integer NOT NULL,
	`target_carbs_mg` integer NOT NULL,
	`target_fat_mg` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "nutrition_goals_effective_from_check" CHECK(length("nutrition_goals"."effective_from") = 10 and "nutrition_goals"."effective_from" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "nutrition_goals_targets_non_negative_check" CHECK("nutrition_goals"."target_energy_mkcal" >= 0 and "nutrition_goals"."target_protein_mg" >= 0 and "nutrition_goals"."target_carbs_mg" >= 0 and "nutrition_goals"."target_fat_mg" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nutrition_goals_user_effective_from_unique` ON `nutrition_goals` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `nutrition_goals_user_effective_from_idx` ON `nutrition_goals` (`user_id`,"effective_from" desc);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_revoked_expires_idx` ON `sessions` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
