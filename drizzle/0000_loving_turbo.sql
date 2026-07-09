CREATE TABLE `diary_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`weight_mg` integer NOT NULL,
	`calories` integer NOT NULL,
	`protein_mg` integer NOT NULL,
	`carbs_mg` integer NOT NULL,
	`fat_mg` integer NOT NULL,
	`additional_nutrition` text,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `diary_user_id_idx` ON `diary_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `diary_logged_at_idx` ON `diary_logs` (`logged_at`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`calories_per_100g` integer NOT NULL,
	`protein_mg_per_100g` integer NOT NULL,
	`carbs_mg_per_100g` integer NOT NULL,
	`fat_mg_per_100g` integer NOT NULL,
	`additional_nutrition` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `barcode_idx` ON `foods` (`barcode`);--> statement-breakpoint
CREATE INDEX `deleted_at_idx` ON `foods` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `meal_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`food_id` text NOT NULL,
	`weight_mg` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_ingredients_meal_id_idx` ON `meal_ingredients` (`meal_id`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meals_user_id_idx` ON `meals` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings` text DEFAULT '{"targetCalories":2900,"targetProteinMg":200000,"targetCarbsMg":300000,"targetFatMg":90000,"darkMode":false}' NOT NULL,
	`created_at` integer NOT NULL
);
