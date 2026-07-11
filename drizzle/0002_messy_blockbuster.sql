DROP INDEX `diary_logs_recency_idx`;--> statement-breakpoint
CREATE INDEX `diary_logs_recency_idx` ON `diary_logs` (`user_id`,`food_id`,`deleted_at`,`logged_at`);--> statement-breakpoint
DROP INDEX `nutrition_goals_user_effective_from_idx`;--> statement-breakpoint
CREATE INDEX `nutrition_goals_user_effective_from_idx` ON `nutrition_goals` (`user_id`,`effective_from`);