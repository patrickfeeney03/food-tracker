ALTER TABLE `foods` ADD `client_mutation_id` text;--> statement-breakpoint
ALTER TABLE `foods` ADD `client_request_fingerprint` text;--> statement-breakpoint
CREATE UNIQUE INDEX `foods_user_client_mutation_unique` ON `foods` (`user_id`,`client_mutation_id`) WHERE "foods"."client_mutation_id" is not null;