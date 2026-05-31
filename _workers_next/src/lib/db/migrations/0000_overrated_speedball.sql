CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`card_key` text NOT NULL,
	`is_used` integer DEFAULT false,
	`reserved_order_id` text,
	`reserved_at` integer,
	`used_at` integer,
	`created_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `daily_checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `login_users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `login_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text,
	`points` integer DEFAULT 0 NOT NULL,
	`is_blocked` integer DEFAULT false,
	`created_at` integer,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`order_id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`amount` text NOT NULL,
	`email` text,
	`status` text DEFAULT 'pending',
	`trade_no` text,
	`card_key` text,
	`paid_at` integer,
	`delivered_at` integer,
	`user_id` text,
	`username` text,
	`payee` text,
	`points_used` integer DEFAULT 0,
	`quantity` integer DEFAULT 1 NOT NULL,
	`current_payment_id` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` text NOT NULL,
	`compare_at_price` text,
	`max_points_discount` text,
	`category` text,
	`image` text,
	`is_hot` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`purchase_limit` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `refund_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text,
	`username` text,
	`reason` text,
	`status` text DEFAULT 'pending',
	`admin_username` text,
	`admin_note` text,
	`created_at` integer,
	`updated_at` integer,
	`processed_at` integer
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer
);
