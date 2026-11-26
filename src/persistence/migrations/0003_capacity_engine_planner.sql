CREATE TABLE "overhead_deductions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"member_id" text NOT NULL,
	"team_id" text NOT NULL,
	"iteration_id" text NOT NULL,
	"category_id" text NOT NULL,
	"deducted_hours" double precision NOT NULL,
	"source" text DEFAULT 'pi_plan' NOT NULL,
	CONSTRAINT "overhead_deductions_hours_valid" CHECK ("overhead_deductions"."deducted_hours" >= 0 and "overhead_deductions"."deducted_hours" <= 744 and ("overhead_deductions"."deducted_hours" * 4) = floor("overhead_deductions"."deducted_hours" * 4)),
	CONSTRAINT "overhead_deductions_source_valid" CHECK ("overhead_deductions"."source" in ('pi_plan', 'sprint_adjusted'))
);
--> statement-breakpoint
CREATE TABLE "team_pi_velocity_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"team_id" text NOT NULL,
	"pi_id" text NOT NULL,
	"velocity" double precision NOT NULL,
	CONSTRAINT "team_pi_velocity_override_velocity_valid" CHECK ("team_pi_velocity_overrides"."velocity" >= 0 and "team_pi_velocity_overrides"."velocity" <= 1000)
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "deduction_mode" text DEFAULT 'fixed_days' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "seed_normalized_velocity" double precision;--> statement-breakpoint
ALTER TABLE "overhead_deductions" ADD CONSTRAINT "overhead_deductions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overhead_deductions" ADD CONSTRAINT "overhead_deductions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overhead_deductions" ADD CONSTRAINT "overhead_deductions_iteration_id_iterations_id_fk" FOREIGN KEY ("iteration_id") REFERENCES "public"."iterations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overhead_deductions" ADD CONSTRAINT "overhead_deductions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_pi_velocity_overrides" ADD CONSTRAINT "team_pi_velocity_overrides_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_pi_velocity_overrides" ADD CONSTRAINT "team_pi_velocity_overrides_pi_id_pis_id_fk" FOREIGN KEY ("pi_id") REFERENCES "public"."pis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "overhead_deductions_member_team_iter_cat_unique" ON "overhead_deductions" USING btree ("member_id","team_id","iteration_id","category_id");--> statement-breakpoint
CREATE INDEX "overhead_deductions_team_iter_idx" ON "overhead_deductions" USING btree ("team_id","iteration_id");--> statement-breakpoint
CREATE INDEX "overhead_deductions_iteration_idx" ON "overhead_deductions" USING btree ("iteration_id");--> statement-breakpoint
CREATE INDEX "overhead_deductions_category_idx" ON "overhead_deductions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_pi_velocity_override_unique" ON "team_pi_velocity_overrides" USING btree ("team_id","pi_id");--> statement-breakpoint
CREATE INDEX "team_pi_velocity_override_pi_idx" ON "team_pi_velocity_overrides" USING btree ("pi_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_deduction_mode_valid" CHECK ("teams"."deduction_mode" in ('fixed_days', 'percent'));--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_seed_normalized_velocity_valid" CHECK ("teams"."seed_normalized_velocity" is null or ("teams"."seed_normalized_velocity" >= 0 and "teams"."seed_normalized_velocity" <= 1000));--> statement-breakpoint
UPDATE "teams"
SET "hours_per_day" = GREATEST(1.0, LEAST(24.0, ROUND(("hours_per_day" * 2)::numeric) / 2.0))
WHERE "hours_per_day" < 1 OR ("hours_per_day" * 2) <> floor("hours_per_day" * 2);
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_hours_per_day_valid";--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_hours_per_day_valid" CHECK ("teams"."hours_per_day" >= 1 and "teams"."hours_per_day" <= 24 and ("teams"."hours_per_day" * 2) = floor("teams"."hours_per_day" * 2));
