CREATE TABLE `joinable_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `role_categories`(`name`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `joinable_roles_name_unique` ON `joinable_roles` (`name`);--> statement-breakpoint
CREATE TABLE `role_categories` (
	`name` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`image` text NOT NULL,
	`description` text NOT NULL,
	`location` text NOT NULL,
	`city` text NOT NULL,
	`location_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`type` text NOT NULL,
	`is_online` integer NOT NULL,
	`nocap` integer NOT NULL,
	`pr` integer DEFAULT false NOT NULL,
	`events` text NOT NULL,
	`prices` text NOT NULL,
	`stream_url` text,
	`stream_start_date` integer,
	`message_id` text,
	`guild_event_id` text,
	`participants` integer,
	`registration_closes_at` integer,
	CONSTRAINT "tournaments_end_after_start" CHECK("tournaments"."end_date" >= "tournaments"."start_date"),
	CONSTRAINT "tournaments_type" CHECK("tournaments"."type" IN ('smashgg', 'other')),
	CONSTRAINT "tournaments_is_online_bool" CHECK("is_online" IN (0, 1)),
	CONSTRAINT "tournaments_nocap_bool" CHECK("nocap" IN (0, 1)),
	CONSTRAINT "tournaments_pr_bool" CHECK("pr" IN (0, 1)),
	CONSTRAINT "tournaments_events_array" CHECK(json_type("tournaments"."events") = 'array'),
	CONSTRAINT "tournaments_prices_array" CHECK(json_type("tournaments"."prices") = 'array'),
	CONSTRAINT "tournaments_stream_pair" CHECK(("tournaments"."stream_url" IS NULL) = ("tournaments"."stream_start_date" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `tournaments_start_id` ON `tournaments` (`start_date`,`id`);--> statement-breakpoint
CREATE INDEX `tournaments_url` ON `tournaments` (`url`,`start_date`);