-- Hand-written column CHECKs. A drizzle table-level check() would rebuild meal_shortcuts,
-- and dropping it on D1 would cascade-delete meal_shortcut_items. Adding the CHECKs to the
-- ADD COLUMN statements avoids any table rebuild. The portion_count check sits on the second
-- column because it references kind, which must already exist. IS NOT NULL is explicit because a
-- NULL check result would otherwise pass.
ALTER TABLE `meal_shortcuts` ADD `kind` text DEFAULT 'shortcut' NOT NULL CHECK (`kind` IN ('shortcut', 'batch'));--> statement-breakpoint
ALTER TABLE `meal_shortcuts` ADD `portion_count` integer CHECK ((`kind` = 'shortcut' AND `portion_count` IS NULL) OR (`kind` = 'batch' AND `portion_count` IS NOT NULL AND `portion_count` BETWEEN 1 AND 10));--> statement-breakpoint
CREATE INDEX `meal_shortcut_applications_user_shortcut_idx` ON `meal_shortcut_applications` (`user_id`,`shortcut_id`,`undone_at`);
