CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"train_id" text NOT NULL,
	"name" text NOT NULL,
	"short_label" text NOT NULL,
	"color" text NOT NULL,
	"kind" text NOT NULL,
	"semantic_role" text,
	"default_pct" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "categories_name_nonempty" CHECK (length(trim("categories"."name")) > 0),
	CONSTRAINT "categories_short_label_nonempty" CHECK (length(trim("categories"."short_label")) > 0),
	CONSTRAINT "categories_color_valid" CHECK ("categories"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "categories_kind_valid" CHECK ("categories"."kind" in ('development', 'overhead')),
	CONSTRAINT "categories_record_status_valid" CHECK ("categories"."record_status" in ('active', 'archived')),
	CONSTRAINT "categories_sort_order_valid" CHECK ("categories"."sort_order" >= 0),
	CONSTRAINT "categories_kind_fields_valid" CHECK ((
        "categories"."kind" = 'development'
        and "categories"."semantic_role" is not null
        and "categories"."semantic_role" in ('feature', 'maintenance_bugs', 'standard')
        and "categories"."default_pct" is not null
        and "categories"."default_pct" between 0 and 100
      ) or (
        "categories"."kind" = 'overhead'
        and "categories"."semantic_role" is null
        and "categories"."default_pct" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "team_category_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"team_id" text NOT NULL,
	"pi_id" text NOT NULL,
	"category_id" text NOT NULL,
	"override_pct" integer NOT NULL,
	CONSTRAINT "team_cat_alloc_override_pct_valid" CHECK ("team_category_allocations"."override_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_category_allocations" ADD CONSTRAINT "team_category_allocations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_category_allocations" ADD CONSTRAINT "team_category_allocations_pi_id_pis_id_fk" FOREIGN KEY ("pi_id") REFERENCES "public"."pis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_category_allocations" ADD CONSTRAINT "team_category_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_train_name_ci_unique" ON "categories" USING btree ("train_id",lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_train_active_bugs_unique" ON "categories" USING btree ("train_id") WHERE "categories"."record_status" = 'active' and "categories"."semantic_role" = 'maintenance_bugs';--> statement-breakpoint
CREATE INDEX "categories_train_kind_sort_idx" ON "categories" USING btree ("train_id","kind","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "team_cat_alloc_unique" ON "team_category_allocations" USING btree ("team_id","pi_id","category_id");--> statement-breakpoint
CREATE INDEX "team_cat_alloc_category_idx" ON "team_category_allocations" USING btree ("category_id");