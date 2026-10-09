CREATE TABLE `rock_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rock_events_token_unique` ON `rock_events` (`token`);--> statement-breakpoint
CREATE TABLE `rock_limits` (
	`id` integer PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rock_names` (
	`name` text PRIMARY KEY NOT NULL,
	`born` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rock` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`observed_at` integer NOT NULL,
	`token` text NOT NULL
);
