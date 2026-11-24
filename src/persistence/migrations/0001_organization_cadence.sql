CREATE TABLE "iterations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"pi_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'development' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	CONSTRAINT "iterations_name_nonempty" CHECK (length(trim("iterations"."name")) > 0),
	CONSTRAINT "iterations_kind_valid" CHECK ("iterations"."kind" in ('development', 'ip')),
	CONSTRAINT "iterations_start_date_valid" CHECK ("iterations"."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "iterations_end_date_valid" CHECK ("iterations"."end_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and "iterations"."start_date" <= "iterations"."end_date")
);
--> statement-breakpoint
CREATE TABLE "member_team_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"member_id" text NOT NULL,
	"team_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	CONSTRAINT "member_team_assignments_start_date_valid" CHECK ("member_team_assignments"."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "member_team_assignments_end_date_valid" CHECK ("member_team_assignments"."end_date" is null or ("member_team_assignments"."end_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and "member_team_assignments"."start_date" <= "member_team_assignments"."end_date"))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"location_id" text NOT NULL,
	"full_name" text NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"initials" text NOT NULL,
	"role" text NOT NULL,
	"fte_factor" double precision DEFAULT 1 NOT NULL,
	"avatar_color" text DEFAULT '#2F62C8' NOT NULL,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "members_full_name_nonempty" CHECK (length(trim("members"."full_name")) > 0),
	CONSTRAINT "members_initials_valid" CHECK (length(trim("members"."initials")) between 1 and 4),
	CONSTRAINT "members_role_valid" CHECK ("members"."role" in ('Admin', 'RTE', 'SM', 'PO', 'Team member')),
	CONSTRAINT "members_fte_valid" CHECK ("members"."fte_factor" > 0 and "members"."fte_factor" <= 1),
	CONSTRAINT "members_avatar_color_valid" CHECK ("members"."avatar_color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "members_record_status_valid" CHECK ("members"."record_status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "pis" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"train_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"lifecycle_status" text DEFAULT 'planning' NOT NULL,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "pis_name_nonempty" CHECK (length(trim("pis"."name")) > 0),
	CONSTRAINT "pis_start_date_valid" CHECK ("pis"."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "pis_end_date_valid" CHECK ("pis"."end_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and "pis"."start_date" <= "pis"."end_date"),
	CONSTRAINT "pis_lifecycle_status_valid" CHECK ("pis"."lifecycle_status" in ('planning', 'in_progress', 'closed')),
	CONSTRAINT "pis_record_status_valid" CHECK ("pis"."record_status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"train_id" text NOT NULL,
	"name" text NOT NULL,
	"hours_per_day" double precision DEFAULT 8 NOT NULL,
	"sprint_offset_workdays" integer DEFAULT 0 NOT NULL,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "teams_name_nonempty" CHECK (length(trim("teams"."name")) > 0),
	CONSTRAINT "teams_record_status_valid" CHECK ("teams"."record_status" in ('active', 'archived')),
	CONSTRAINT "teams_hours_per_day_valid" CHECK ("teams"."hours_per_day" > 0 and "teams"."hours_per_day" <= 24),
	CONSTRAINT "teams_offset_valid" CHECK ("teams"."sprint_offset_workdays" in (-1, 0, 1))
);
--> statement-breakpoint
CREATE TABLE "trains" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"name" text NOT NULL,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "trains_name_nonempty" CHECK (length(trim("trains"."name")) > 0),
	CONSTRAINT "trains_record_status_valid" CHECK ("trains"."record_status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "absence_types" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"affects_capacity" boolean NOT NULL,
	CONSTRAINT "absence_types_code_nonempty" CHECK (length(trim("absence_types"."code")) > 0),
	CONSTRAINT "absence_types_name_nonempty" CHECK (length(trim("absence_types"."name")) > 0),
	CONSTRAINT "absence_types_color_valid" CHECK ("absence_types"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "absences" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"member_id" text NOT NULL,
	"absence_type_id" text NOT NULL,
	"date" text NOT NULL,
	"portion" text DEFAULT 'full' NOT NULL,
	"planned" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"extra_hours" double precision,
	"note" text,
	CONSTRAINT "absences_date_valid" CHECK ("absences"."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "absences_portion_valid" CHECK ("absences"."portion" in ('full', 'am', 'pm')),
	CONSTRAINT "absences_status_valid" CHECK ("absences"."status" in ('active', 'cancelled')),
	CONSTRAINT "absences_extra_hours_valid" CHECK ("absences"."extra_hours" is null or "absences"."extra_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"location_id" text NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"portion" text DEFAULT 'full' NOT NULL,
	"source" text DEFAULT 'library' NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	CONSTRAINT "holidays_date_valid" CHECK ("holidays"."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "holidays_name_nonempty" CHECK (length(trim("holidays"."name")) > 0),
	CONSTRAINT "holidays_portion_valid" CHECK ("holidays"."portion" in ('full', 'half')),
	CONSTRAINT "holidays_source_valid" CHECK ("holidays"."source" in ('library', 'company', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'local:sm' NOT NULL,
	"updated_by" text DEFAULT 'local:sm' NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"subdivision_code" text,
	"time_zone" text NOT NULL,
	"calendar_source" text NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"seeded_years" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"library_seed_cutoff_date" text,
	"record_status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "locations_code_nonempty" CHECK (length(trim("locations"."code")) > 0),
	CONSTRAINT "locations_name_nonempty" CHECK (length(trim("locations"."name")) > 0),
	CONSTRAINT "locations_country_code_valid" CHECK ("locations"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "locations_subdivision_code_valid" CHECK ("locations"."subdivision_code" is null or "locations"."subdivision_code" ~ '^[A-Z0-9]{1,3}$'),
	CONSTRAINT "locations_seed_cutoff_valid" CHECK ("locations"."library_seed_cutoff_date" is null or "locations"."library_seed_cutoff_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "locations_record_status_valid" CHECK ("locations"."record_status" in ('active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "iterations" ADD CONSTRAINT "iterations_pi_id_pis_id_fk" FOREIGN KEY ("pi_id") REFERENCES "public"."pis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_team_assignments" ADD CONSTRAINT "member_team_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_team_assignments" ADD CONSTRAINT "member_team_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pis" ADD CONSTRAINT "pis_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_absence_type_id_absence_types_id_fk" FOREIGN KEY ("absence_type_id") REFERENCES "public"."absence_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "iterations_pi_name_ci_unique" ON "iterations" USING btree ("pi_id",lower(trim("name")));--> statement-breakpoint
CREATE INDEX "iterations_pi_id_dates_idx" ON "iterations" USING btree ("pi_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "member_team_assignments_member_open_unique" ON "member_team_assignments" USING btree ("member_id") WHERE "member_team_assignments"."end_date" is null;--> statement-breakpoint
CREATE INDEX "member_team_assignments_member_idx" ON "member_team_assignments" USING btree ("member_id","start_date");--> statement-breakpoint
CREATE INDEX "member_team_assignments_team_idx" ON "member_team_assignments" USING btree ("team_id","start_date");--> statement-breakpoint
CREATE INDEX "members_location_id_idx" ON "members" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pis_train_name_ci_unique" ON "pis" USING btree ("train_id",lower(trim("name")));--> statement-breakpoint
CREATE INDEX "pis_train_id_dates_idx" ON "pis" USING btree ("train_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_train_name_ci_unique" ON "teams" USING btree ("train_id",lower(trim("name")));--> statement-breakpoint
CREATE INDEX "teams_train_id_idx" ON "teams" USING btree ("train_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trains_name_ci_unique" ON "trains" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "absence_types_code_ci_unique" ON "absence_types" USING btree (lower(trim("code")));--> statement-breakpoint
CREATE INDEX "absences_member_date_idx" ON "absences" USING btree ("member_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_library_identity_unique" ON "holidays" USING btree ("location_id","date","name") WHERE "holidays"."source" = 'library';--> statement-breakpoint
CREATE INDEX "holidays_location_date_idx" ON "holidays" USING btree ("location_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_code_ci_unique" ON "locations" USING btree (lower(trim("code")));