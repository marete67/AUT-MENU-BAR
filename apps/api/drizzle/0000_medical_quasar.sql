CREATE TABLE `public_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'Mi Menú',
	`slug` varchar(32) NOT NULL,
	`custom_domain` varchar(255),
	`page_count` int NOT NULL DEFAULT 0,
	`last_published_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `public_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_links_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`template_name` varchar(255),
	`email_to` varchar(255) NOT NULL,
	`subject` varchar(255),
	`send_at` datetime NOT NULL,
	`render_config` text NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`retry_count` int NOT NULL DEFAULT 0,
	`next_retry_at` datetime,
	`error_msg` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`template_name` varchar(255),
	`scheduled_at` datetime NOT NULL,
	`render_config` text NOT NULL,
	`status` enum('pending','published','failed') NOT NULL DEFAULT 'pending',
	`retry_count` int NOT NULL DEFAULT 0,
	`next_retry_at` datetime,
	`ig_media_id` varchar(128),
	`ig_post_url` varchar(512),
	`error_msg` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`config` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`instagram_id` varchar(64),
	`instagram_access_token` text,
	`instagram_token_expires_at` datetime,
	`instagram_username` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `public_links` ADD CONSTRAINT `public_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_emails` ADD CONSTRAINT `scheduled_emails_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD CONSTRAINT `scheduled_posts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templates` ADD CONSTRAINT `templates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;