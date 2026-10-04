CREATE TABLE `atomic_guards` (
  `operation_id` text NOT NULL,
  `valid` integer NOT NULL,
  CONSTRAINT `atomic_guard_valid` CHECK (`valid` = 1)
);
