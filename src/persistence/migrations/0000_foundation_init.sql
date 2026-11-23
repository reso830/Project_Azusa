CREATE TABLE "app_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "app_metadata_key_unique" UNIQUE("key")
);
