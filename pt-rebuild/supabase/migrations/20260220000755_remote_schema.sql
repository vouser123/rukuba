


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clinical_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "read_by_recipient" boolean DEFAULT false NOT NULL,
    "archived_by_sender" boolean DEFAULT false NOT NULL,
    "archived_by_recipient" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clinical_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."clinical_messages" IS 'Bidirectional patient-therapist messaging';



COMMENT ON COLUMN "public"."clinical_messages"."deleted_at" IS 'Soft delete timestamp - allows 1-hour undo window';



CREATE TABLE IF NOT EXISTS "public"."exercise_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "equipment_name" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_equipment" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_equipment" IS 'Equipment per exercise (required or optional)';



COMMENT ON COLUMN "public"."exercise_equipment"."is_required" IS 'true = intrinsic to exercise, false = comfort/modification';



CREATE TABLE IF NOT EXISTS "public"."exercise_form_parameters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "parameter_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_form_parameters" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_form_parameters" IS 'Variable configuration parameters required for this exercise (e.g., band_resistance, surface, eyes, distance). Values are logged per-set in patient_activity_set_form_data.';



COMMENT ON COLUMN "public"."exercise_form_parameters"."parameter_name" IS 'Parameter name - fully mutable, no enum constraint. Common values: distance, band_resistance, band_location, band_position, eyes, surface, weight, strap_position, slope';



CREATE TABLE IF NOT EXISTS "public"."exercise_guidance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "section" "text" NOT NULL,
    "content" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercise_guidance_section_check" CHECK (("section" = ANY (ARRAY['motor_cues'::"text", 'compensation_warnings'::"text", 'safety_flags'::"text", 'external_cues'::"text"])))
);


ALTER TABLE "public"."exercise_guidance" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_guidance" IS 'Exercise performance guidance organized by section';



COMMENT ON COLUMN "public"."exercise_guidance"."section" IS 'motor_cues = how to move, compensation_warnings = common mistakes to avoid, safety_flags = stop/modify conditions, external_cues = visual/tactile cues';



CREATE TABLE IF NOT EXISTS "public"."exercise_muscles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "muscle_name" "text" NOT NULL,
    "is_primary" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_muscles" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_muscles" IS 'Muscles targeted per exercise';



COMMENT ON COLUMN "public"."exercise_muscles"."is_primary" IS 'true = primary mover, false = stabilizer/synergist';



CREATE TABLE IF NOT EXISTS "public"."exercise_pattern_modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "modifier" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercise_pattern_modifiers_modifier_check" CHECK (("modifier" = ANY (ARRAY['duration_seconds'::"text", 'hold_seconds'::"text", 'distance_feet'::"text"])))
);


ALTER TABLE "public"."exercise_pattern_modifiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_pattern_modifiers" IS 'Pattern-level dosage modifiers';



COMMENT ON COLUMN "public"."exercise_pattern_modifiers"."modifier" IS 'duration_seconds = REPLACES reps with time, hold_seconds = MODIFIES reps to add isometric hold, distance_feet = REPLACES reps with distance. Can combine: hold_seconds + distance_feet';



CREATE TABLE IF NOT EXISTS "public"."exercise_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "text" NOT NULL,
    "region" "text" NOT NULL,
    "capacity" "text" NOT NULL,
    "focus" "text",
    "contribution" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "exercise_roles_capacity_check" CHECK (("capacity" = ANY (ARRAY['strength'::"text", 'control'::"text", 'stability'::"text", 'tolerance'::"text", 'mobility'::"text"]))),
    CONSTRAINT "exercise_roles_contribution_check" CHECK (("contribution" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "exercise_roles_region_check" CHECK (("region" = ANY (ARRAY['core'::"text", 'back'::"text", 'hip'::"text", 'knee'::"text", 'ankle'::"text", 'foot'::"text", 'vestibular'::"text"])))
);


ALTER TABLE "public"."exercise_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_roles" IS 'Rehab coverage roles assigned to exercises (region × capacity × focus × contribution)';



COMMENT ON COLUMN "public"."exercise_roles"."region" IS 'Anatomical region targeted';



COMMENT ON COLUMN "public"."exercise_roles"."capacity" IS 'Functional capacity addressed';



COMMENT ON COLUMN "public"."exercise_roles"."focus" IS 'Optional specific focus within capacity (e.g., anti_rotation for back stability)';



COMMENT ON COLUMN "public"."exercise_roles"."contribution" IS 'Relative contribution of this exercise to the role (low/medium/high)';



CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "text" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "pt_category" "text" NOT NULL,
    "pattern" "text" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "lifecycle_status" "text",
    "lifecycle_effective_start_date" "date",
    "lifecycle_effective_end_date" "date",
    "supersedes_exercise_id" "text",
    "superseded_by_exercise_id" "text",
    "superseded_date" timestamp with time zone,
    "added_date" "date",
    "updated_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercises_lifecycle_status_check" CHECK (("lifecycle_status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deprecated'::"text"]))),
    CONSTRAINT "exercises_pattern_check" CHECK (("pattern" = ANY (ARRAY['side'::"text", 'both'::"text"]))),
    CONSTRAINT "exercises_pt_category_check" CHECK (("pt_category" = ANY (ARRAY['back_sij'::"text", 'knee'::"text", 'ankle'::"text", 'hip'::"text", 'vestibular'::"text", 'foot'::"text", 'shoulder'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercises" IS 'Shared exercise library - canonical exercise definitions';



COMMENT ON COLUMN "public"."exercises"."pt_category" IS 'High-level PT category for scheduling and grouping';



COMMENT ON COLUMN "public"."exercises"."pattern" IS 'side = per-side execution (e.g., 10 reps left + 10 reps right), both = bilateral simultaneous';



CREATE TABLE IF NOT EXISTS "public"."offline_mutations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mutation_type" "text" NOT NULL,
    "mutation_payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processing_error" "text",
    CONSTRAINT "offline_mutations_mutation_type_check" CHECK (("mutation_type" = ANY (ARRAY['create_activity_log'::"text", 'update_program'::"text", 'create_message'::"text"])))
);


ALTER TABLE "public"."offline_mutations" OWNER TO "postgres";


COMMENT ON TABLE "public"."offline_mutations" IS 'Server-side record of offline queue submissions (for debugging/audit only)';



COMMENT ON COLUMN "public"."offline_mutations"."mutation_type" IS 'Type of mutation submitted from offline queue';



COMMENT ON COLUMN "public"."offline_mutations"."mutation_payload" IS 'JSONB payload (minimal use - only for queue reconciliation)';



CREATE TABLE IF NOT EXISTS "public"."patient_activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "exercise_id" "text",
    "exercise_name" "text" NOT NULL,
    "client_mutation_id" "text" NOT NULL,
    "activity_type" "text" NOT NULL,
    "notes" "text",
    "performed_at" timestamp with time zone NOT NULL,
    "client_created_at" timestamp with time zone,
    "client_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "patient_activity_logs_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['reps'::"text", 'hold'::"text", 'duration'::"text", 'distance'::"text"])))
);


ALTER TABLE "public"."patient_activity_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_activity_logs" IS 'Patient exercise performance logs (replaces Firebase "sessions" collection)';



COMMENT ON COLUMN "public"."patient_activity_logs"."exercise_name" IS 'Denormalized for display reliability (exercise may be archived/deleted)';



COMMENT ON COLUMN "public"."patient_activity_logs"."client_mutation_id" IS 'Client-generated UUID for deduplication. Prevents duplicate logs when offline queue retries submission.';



COMMENT ON COLUMN "public"."patient_activity_logs"."activity_type" IS 'Type of activity logged (matches dosage_type from patient_programs)';



COMMENT ON COLUMN "public"."patient_activity_logs"."performed_at" IS 'When the patient performed the exercise (user-supplied timestamp)';



COMMENT ON COLUMN "public"."patient_activity_logs"."client_created_at" IS 'Client timestamp when log was created (for offline reconciliation)';



CREATE TABLE IF NOT EXISTS "public"."patient_activity_set_form_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_set_id" "uuid" NOT NULL,
    "parameter_name" "text" NOT NULL,
    "parameter_value" "text" NOT NULL,
    "parameter_unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient_activity_set_form_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_activity_set_form_data" IS 'Variable form parameter values logged per set (e.g., band_resistance=blue, distance=8 inch, eyes=closed)';



COMMENT ON COLUMN "public"."patient_activity_set_form_data"."parameter_unit" IS 'Unit for distance-type parameters (ft, inch, cm, degree). NULL for non-distance parameters.';



CREATE TABLE IF NOT EXISTS "public"."patient_activity_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_log_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "reps" integer,
    "seconds" integer,
    "distance_feet" integer,
    "side" "text",
    "manual_log" boolean DEFAULT false NOT NULL,
    "partial_rep" boolean DEFAULT false NOT NULL,
    "performed_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "patient_activity_sets_distance_feet_check" CHECK (("distance_feet" >= 0)),
    CONSTRAINT "patient_activity_sets_reps_check" CHECK (("reps" >= 0)),
    CONSTRAINT "patient_activity_sets_seconds_check" CHECK (("seconds" >= 0)),
    CONSTRAINT "patient_activity_sets_set_number_check" CHECK (("set_number" > 0)),
    CONSTRAINT "patient_activity_sets_side_check" CHECK (("side" = ANY (ARRAY['left'::"text", 'right'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."patient_activity_sets" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_activity_sets" IS 'Individual sets within a patient activity log';



COMMENT ON COLUMN "public"."patient_activity_sets"."reps" IS 'Actual reps achieved (NULL if activity_type is duration or distance)';



COMMENT ON COLUMN "public"."patient_activity_sets"."seconds" IS 'Actual seconds achieved (NULL unless activity_type is hold or duration)';



COMMENT ON COLUMN "public"."patient_activity_sets"."distance_feet" IS 'Actual distance achieved in feet (NULL unless activity_type is distance)';



COMMENT ON COLUMN "public"."patient_activity_sets"."side" IS 'Which side performed (for pattern=side exercises)';



COMMENT ON COLUMN "public"."patient_activity_sets"."manual_log" IS 'true = user manually entered value, false = counted by app';



COMMENT ON COLUMN "public"."patient_activity_sets"."partial_rep" IS 'true = incomplete rep logged (for tracking partial ROM)';



CREATE TABLE IF NOT EXISTS "public"."patient_program_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "exercise_id" "text" NOT NULL,
    "dosage_type" "text" NOT NULL,
    "sets" integer,
    "reps_per_set" integer,
    "seconds_per_rep" integer,
    "seconds_per_set" integer,
    "distance_feet" integer,
    "changed_by_therapist_id" "uuid",
    "change_summary" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient_program_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_program_history" IS 'Audit trail of dosage changes (replaces Firebase "history" array)';



CREATE TABLE IF NOT EXISTS "public"."patient_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "exercise_id" "text" NOT NULL,
    "dosage_type" "text" NOT NULL,
    "sets" integer,
    "reps_per_set" integer,
    "seconds_per_rep" integer,
    "seconds_per_set" integer,
    "distance_feet" integer,
    "is_favorite" boolean DEFAULT false NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by_therapist_id" "uuid",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "patient_programs_distance_feet_check" CHECK (("distance_feet" > 0)),
    CONSTRAINT "patient_programs_dosage_type_check" CHECK (("dosage_type" = ANY (ARRAY['reps'::"text", 'hold'::"text", 'duration'::"text", 'distance'::"text"]))),
    CONSTRAINT "patient_programs_reps_per_set_check" CHECK (("reps_per_set" > 0)),
    CONSTRAINT "patient_programs_seconds_per_rep_check" CHECK (("seconds_per_rep" >= 0)),
    CONSTRAINT "patient_programs_seconds_per_set_check" CHECK (("seconds_per_set" >= 0)),
    CONSTRAINT "patient_programs_sets_check" CHECK (("sets" > 0))
);


ALTER TABLE "public"."patient_programs" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_programs" IS 'Therapist-prescribed exercise dosages per patient (replaces Firebase "current" field)';



COMMENT ON COLUMN "public"."patient_programs"."dosage_type" IS 'Determines which fields are used: reps = sets×reps, hold = sets×reps×seconds_per_rep, duration = sets×seconds_per_set, distance = sets×distance_feet';



COMMENT ON COLUMN "public"."patient_programs"."sets" IS 'Number of sets prescribed';



COMMENT ON COLUMN "public"."patient_programs"."reps_per_set" IS 'Repetitions per set (for reps/hold dosage types)';



COMMENT ON COLUMN "public"."patient_programs"."seconds_per_rep" IS 'Hold duration per rep (for hold dosage type)';



COMMENT ON COLUMN "public"."patient_programs"."seconds_per_set" IS 'Total duration per set (for duration dosage type)';



COMMENT ON COLUMN "public"."patient_programs"."distance_feet" IS 'Distance per set in feet (for distance dosage type)';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "therapist_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['patient'::"text", 'therapist'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'User accounts linked to Supabase Auth';



COMMENT ON COLUMN "public"."users"."auth_id" IS 'References auth.users - Supabase Auth integration';



COMMENT ON COLUMN "public"."users"."therapist_id" IS 'For patients only - their assigned therapist';



CREATE TABLE IF NOT EXISTS "public"."vocab_capacity" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_capacity" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_capacity" IS 'Therapist can edit definitions via vocab editor';



CREATE TABLE IF NOT EXISTS "public"."vocab_contribution" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_contribution" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_contribution" IS 'Original from exercise_roles_vocabulary.json';



CREATE TABLE IF NOT EXISTS "public"."vocab_focus" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_focus" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_focus" IS 'Focus values can be added/edited by therapist';



CREATE TABLE IF NOT EXISTS "public"."vocab_pattern" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "dosage_semantics" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_pattern" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_pattern" IS 'Exercise execution patterns (side vs both)';



CREATE TABLE IF NOT EXISTS "public"."vocab_pt_category" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_pt_category" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_pt_category" IS 'PT categories for exercise classification';



CREATE TABLE IF NOT EXISTS "public"."vocab_region" (
    "code" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_region" OWNER TO "postgres";


COMMENT ON TABLE "public"."vocab_region" IS 'Vocabularies are mutable. Frontend fetches from /api/vocab';



ALTER TABLE ONLY "public"."clinical_messages"
    ADD CONSTRAINT "clinical_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_equipment"
    ADD CONSTRAINT "exercise_equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_form_parameters"
    ADD CONSTRAINT "exercise_form_parameters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_guidance"
    ADD CONSTRAINT "exercise_guidance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_muscles"
    ADD CONSTRAINT "exercise_muscles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_pattern_modifiers"
    ADD CONSTRAINT "exercise_pattern_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_roles"
    ADD CONSTRAINT "exercise_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offline_mutations"
    ADD CONSTRAINT "offline_mutations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_activity_logs"
    ADD CONSTRAINT "patient_activity_logs_patient_id_client_mutation_id_key" UNIQUE ("patient_id", "client_mutation_id");



ALTER TABLE ONLY "public"."patient_activity_logs"
    ADD CONSTRAINT "patient_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_activity_set_form_data"
    ADD CONSTRAINT "patient_activity_set_form_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_activity_sets"
    ADD CONSTRAINT "patient_activity_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_program_history"
    ADD CONSTRAINT "patient_program_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_programs"
    ADD CONSTRAINT "patient_programs_patient_id_exercise_id_key" UNIQUE ("patient_id", "exercise_id");



ALTER TABLE ONLY "public"."patient_programs"
    ADD CONSTRAINT "patient_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vocab_capacity"
    ADD CONSTRAINT "vocab_capacity_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."vocab_contribution"
    ADD CONSTRAINT "vocab_contribution_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."vocab_focus"
    ADD CONSTRAINT "vocab_focus_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."vocab_pattern"
    ADD CONSTRAINT "vocab_pattern_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."vocab_pt_category"
    ADD CONSTRAINT "vocab_pt_category_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."vocab_region"
    ADD CONSTRAINT "vocab_region_pkey" PRIMARY KEY ("code");



CREATE INDEX "exercise_form_parameters_exercise_id_idx" ON "public"."exercise_form_parameters" USING "btree" ("exercise_id");



CREATE INDEX "exercise_pattern_modifiers_exercise_id_idx" ON "public"."exercise_pattern_modifiers" USING "btree" ("exercise_id");



CREATE INDEX "idx_activity_logs_created_at" ON "public"."patient_activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_exercise" ON "public"."patient_activity_logs" USING "btree" ("exercise_id");



CREATE INDEX "idx_activity_logs_patient" ON "public"."patient_activity_logs" USING "btree" ("patient_id");



CREATE INDEX "idx_activity_logs_performed_at" ON "public"."patient_activity_logs" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_activity_sets_log" ON "public"."patient_activity_sets" USING "btree" ("activity_log_id");



CREATE INDEX "idx_activity_sets_set_number" ON "public"."patient_activity_sets" USING "btree" ("activity_log_id", "set_number");



CREATE INDEX "idx_clinical_messages_created_at" ON "public"."clinical_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_clinical_messages_deleted_by" ON "public"."clinical_messages" USING "btree" ("deleted_by");



CREATE INDEX "idx_clinical_messages_patient" ON "public"."clinical_messages" USING "btree" ("patient_id");



CREATE INDEX "idx_clinical_messages_recipient" ON "public"."clinical_messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_clinical_messages_sender" ON "public"."clinical_messages" USING "btree" ("sender_id");



CREATE UNIQUE INDEX "idx_exercise_equipment_unique" ON "public"."exercise_equipment" USING "btree" ("exercise_id", "equipment_name", "is_required");



CREATE INDEX "idx_exercise_guidance_exercise" ON "public"."exercise_guidance" USING "btree" ("exercise_id", "section");



CREATE INDEX "idx_exercise_guidance_sort_order" ON "public"."exercise_guidance" USING "btree" ("sort_order");



CREATE INDEX "idx_exercise_muscles_exercise" ON "public"."exercise_muscles" USING "btree" ("exercise_id");



CREATE UNIQUE INDEX "idx_exercise_muscles_unique" ON "public"."exercise_muscles" USING "btree" ("exercise_id", "muscle_name", "is_primary");



CREATE INDEX "idx_exercise_roles_active" ON "public"."exercise_roles" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_exercise_roles_exercise_id" ON "public"."exercise_roles" USING "btree" ("exercise_id");



CREATE INDEX "idx_exercises_canonical_name" ON "public"."exercises" USING "btree" ("canonical_name");



CREATE INDEX "idx_exercises_superseded_by" ON "public"."exercises" USING "btree" ("superseded_by_exercise_id");



CREATE INDEX "idx_exercises_supersedes" ON "public"."exercises" USING "btree" ("supersedes_exercise_id");



CREATE UNIQUE INDEX "idx_form_parameters_unique" ON "public"."exercise_form_parameters" USING "btree" ("exercise_id", "parameter_name");



CREATE INDEX "idx_offline_mutations_pending" ON "public"."offline_mutations" USING "btree" ("processed_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_offline_mutations_user" ON "public"."offline_mutations" USING "btree" ("user_id");



CREATE INDEX "idx_patient_activity_sets_set_number" ON "public"."patient_activity_sets" USING "btree" ("set_number");



CREATE INDEX "idx_patient_program_history_changed_by" ON "public"."patient_program_history" USING "btree" ("changed_by_therapist_id");



CREATE INDEX "idx_patient_programs_archived_at" ON "public"."patient_programs" USING "btree" ("archived_at");



CREATE INDEX "idx_patient_programs_assigned_at" ON "public"."patient_programs" USING "btree" ("assigned_at" DESC);



CREATE INDEX "idx_patient_programs_assigned_by" ON "public"."patient_programs" USING "btree" ("assigned_by_therapist_id");



CREATE INDEX "idx_patient_programs_exercise" ON "public"."patient_programs" USING "btree" ("exercise_id");



CREATE INDEX "idx_patient_programs_patient" ON "public"."patient_programs" USING "btree" ("patient_id");



CREATE UNIQUE INDEX "idx_pattern_modifiers_unique" ON "public"."exercise_pattern_modifiers" USING "btree" ("exercise_id", "modifier");



CREATE INDEX "idx_program_history_changed_at" ON "public"."patient_program_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_program_history_exercise" ON "public"."patient_program_history" USING "btree" ("exercise_id");



CREATE INDEX "idx_program_history_patient" ON "public"."patient_program_history" USING "btree" ("patient_id");



CREATE INDEX "idx_set_form_data_set" ON "public"."patient_activity_set_form_data" USING "btree" ("activity_set_id");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_users_therapist" ON "public"."users" USING "btree" ("therapist_id");



ALTER TABLE ONLY "public"."clinical_messages"
    ADD CONSTRAINT "clinical_messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinical_messages"
    ADD CONSTRAINT "clinical_messages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinical_messages"
    ADD CONSTRAINT "clinical_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinical_messages"
    ADD CONSTRAINT "clinical_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_equipment"
    ADD CONSTRAINT "exercise_equipment_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_form_parameters"
    ADD CONSTRAINT "exercise_form_parameters_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_guidance"
    ADD CONSTRAINT "exercise_guidance_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_muscles"
    ADD CONSTRAINT "exercise_muscles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_pattern_modifiers"
    ADD CONSTRAINT "exercise_pattern_modifiers_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_roles"
    ADD CONSTRAINT "exercise_roles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_superseded_by_exercise_id_fkey" FOREIGN KEY ("superseded_by_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_supersedes_exercise_id_fkey" FOREIGN KEY ("supersedes_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."offline_mutations"
    ADD CONSTRAINT "offline_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_activity_logs"
    ADD CONSTRAINT "patient_activity_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_activity_logs"
    ADD CONSTRAINT "patient_activity_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_activity_set_form_data"
    ADD CONSTRAINT "patient_activity_set_form_data_activity_set_id_fkey" FOREIGN KEY ("activity_set_id") REFERENCES "public"."patient_activity_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_activity_sets"
    ADD CONSTRAINT "patient_activity_sets_activity_log_id_fkey" FOREIGN KEY ("activity_log_id") REFERENCES "public"."patient_activity_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_program_history"
    ADD CONSTRAINT "patient_program_history_changed_by_therapist_id_fkey" FOREIGN KEY ("changed_by_therapist_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_program_history"
    ADD CONSTRAINT "patient_program_history_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_program_history"
    ADD CONSTRAINT "patient_program_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_programs"
    ADD CONSTRAINT "patient_programs_assigned_by_therapist_id_fkey" FOREIGN KEY ("assigned_by_therapist_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_programs"
    ADD CONSTRAINT "patient_programs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_programs"
    ADD CONSTRAINT "patient_programs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



CREATE POLICY "activity_logs_delete_own" ON "public"."patient_activity_logs" FOR DELETE TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "activity_logs_select" ON "public"."patient_activity_logs" FOR SELECT TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR ("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."therapist_id" = ( SELECT "users_1"."id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "activity_logs_update_own" ON "public"."patient_activity_logs" FOR UPDATE TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "activity_sets_delete" ON "public"."patient_activity_sets" FOR DELETE TO "authenticated" USING ((("activity_log_id" IN ( SELECT "patient_activity_logs"."id"
   FROM "public"."patient_activity_logs"
  WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "activity_sets_select" ON "public"."patient_activity_sets" FOR SELECT TO "authenticated" USING ((("activity_log_id" IN ( SELECT "patient_activity_logs"."id"
   FROM "public"."patient_activity_logs"
  WHERE (("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"()))) OR ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."therapist_id" = ( SELECT "users_1"."id"
                   FROM "public"."users" "users_1"
                  WHERE ("users_1"."auth_id" = "auth"."uid"())))))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "activity_sets_update" ON "public"."patient_activity_sets" FOR UPDATE TO "authenticated" USING ((("activity_log_id" IN ( SELECT "patient_activity_logs"."id"
   FROM "public"."patient_activity_logs"
  WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."clinical_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clinical_messages_insert" ON "public"."clinical_messages" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "clinical_messages_select" ON "public"."clinical_messages" FOR SELECT TO "authenticated" USING ((("sender_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("recipient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."exercise_equipment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_equipment_delete" ON "public"."exercise_equipment" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_equipment_insert" ON "public"."exercise_equipment" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_equipment_select" ON "public"."exercise_equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_equipment_update" ON "public"."exercise_equipment" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercise_form_parameters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_form_parameters_delete" ON "public"."exercise_form_parameters" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_form_parameters_insert" ON "public"."exercise_form_parameters" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_form_parameters_select" ON "public"."exercise_form_parameters" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_form_parameters_update" ON "public"."exercise_form_parameters" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercise_guidance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_guidance_delete" ON "public"."exercise_guidance" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_guidance_insert" ON "public"."exercise_guidance" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_guidance_select" ON "public"."exercise_guidance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_guidance_update" ON "public"."exercise_guidance" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercise_muscles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_muscles_delete" ON "public"."exercise_muscles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_muscles_insert" ON "public"."exercise_muscles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_muscles_select" ON "public"."exercise_muscles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_muscles_update" ON "public"."exercise_muscles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercise_pattern_modifiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_pattern_modifiers_delete" ON "public"."exercise_pattern_modifiers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_pattern_modifiers_insert" ON "public"."exercise_pattern_modifiers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_pattern_modifiers_select" ON "public"."exercise_pattern_modifiers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_pattern_modifiers_update" ON "public"."exercise_pattern_modifiers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercise_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_roles_delete" ON "public"."exercise_roles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_roles_insert" ON "public"."exercise_roles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercise_roles_select" ON "public"."exercise_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercise_roles_update" ON "public"."exercise_roles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercises_delete" ON "public"."exercises" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercises_insert" ON "public"."exercises" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "exercises_select" ON "public"."exercises" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "exercises_update" ON "public"."exercises" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "messages_delete" ON "public"."clinical_messages" FOR DELETE TO "authenticated" USING ((("sender_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "messages_update" ON "public"."clinical_messages" FOR UPDATE TO "authenticated" USING ((("sender_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("recipient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."offline_mutations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offline_mutations_modify_own" ON "public"."offline_mutations" TO "authenticated" USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."patient_activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_activity_logs_insert_own" ON "public"."patient_activity_logs" FOR INSERT TO "authenticated" WITH CHECK (("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "patient_activity_logs_select_own" ON "public"."patient_activity_logs" FOR SELECT TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role" = 'therapist'::"text") AND ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."therapist_id" = "u"."id"))))))));



ALTER TABLE "public"."patient_activity_set_form_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_activity_set_form_data_insert" ON "public"."patient_activity_set_form_data" FOR INSERT TO "authenticated" WITH CHECK (("activity_set_id" IN ( SELECT "patient_activity_sets"."id"
   FROM "public"."patient_activity_sets"
  WHERE ("patient_activity_sets"."activity_log_id" IN ( SELECT "patient_activity_logs"."id"
           FROM "public"."patient_activity_logs"
          WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "patient_activity_set_form_data_select" ON "public"."patient_activity_set_form_data" FOR SELECT TO "authenticated" USING (("activity_set_id" IN ( SELECT "patient_activity_sets"."id"
   FROM "public"."patient_activity_sets"
  WHERE ("patient_activity_sets"."activity_log_id" IN ( SELECT "patient_activity_logs"."id"
           FROM "public"."patient_activity_logs"
          WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



ALTER TABLE "public"."patient_activity_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_activity_sets_insert" ON "public"."patient_activity_sets" FOR INSERT TO "authenticated" WITH CHECK (("activity_log_id" IN ( SELECT "patient_activity_logs"."id"
   FROM "public"."patient_activity_logs"
  WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "patient_activity_sets_select" ON "public"."patient_activity_sets" FOR SELECT TO "authenticated" USING (("activity_log_id" IN ( SELECT "patient_activity_logs"."id"
   FROM "public"."patient_activity_logs"
  WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."patient_program_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_program_history_select" ON "public"."patient_program_history" FOR SELECT TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role" = 'therapist'::"text") AND ("patient_program_history"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."therapist_id" = "u"."id"))))))));



ALTER TABLE "public"."patient_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_programs_delete" ON "public"."patient_programs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "patient_programs_insert" ON "public"."patient_programs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "patient_programs_select_own" ON "public"."patient_programs" FOR SELECT TO "authenticated" USING ((("patient_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("u"."role" = 'therapist'::"text") AND ("patient_programs"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."therapist_id" = "u"."id"))))))));



CREATE POLICY "patient_programs_update" ON "public"."patient_programs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'therapist'::"text"]))))));



CREATE POLICY "set_form_data_delete" ON "public"."patient_activity_set_form_data" FOR DELETE TO "authenticated" USING ((("activity_set_id" IN ( SELECT "patient_activity_sets"."id"
   FROM "public"."patient_activity_sets"
  WHERE ("patient_activity_sets"."activity_log_id" IN ( SELECT "patient_activity_logs"."id"
           FROM "public"."patient_activity_logs"
          WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."auth_id" = "auth"."uid"()))))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "set_form_data_select" ON "public"."patient_activity_set_form_data" FOR SELECT TO "authenticated" USING ((("activity_set_id" IN ( SELECT "pas"."id"
   FROM ("public"."patient_activity_sets" "pas"
     JOIN "public"."patient_activity_logs" "pal" ON (("pas"."activity_log_id" = "pal"."id")))
  WHERE (("pal"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"()))) OR ("pal"."patient_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."therapist_id" = ( SELECT "users_1"."id"
                   FROM "public"."users" "users_1"
                  WHERE ("users_1"."auth_id" = "auth"."uid"())))))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "set_form_data_update" ON "public"."patient_activity_set_form_data" FOR UPDATE TO "authenticated" USING ((("activity_set_id" IN ( SELECT "patient_activity_sets"."id"
   FROM "public"."patient_activity_sets"
  WHERE ("patient_activity_sets"."activity_log_id" IN ( SELECT "patient_activity_logs"."id"
           FROM "public"."patient_activity_logs"
          WHERE ("patient_activity_logs"."patient_id" IN ( SELECT "users"."id"
                   FROM "public"."users"
                  WHERE ("users"."auth_id" = "auth"."uid"()))))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_by_role" ON "public"."users" FOR SELECT TO "authenticated" USING ((("auth_id" = "auth"."uid"()) OR (("public"."get_user_role"() = 'therapist'::"text") AND ("therapist_id" = "public"."get_user_id"())) OR ("public"."get_user_role"() = 'admin'::"text")));



ALTER TABLE "public"."vocab_capacity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_capacity_modify" ON "public"."vocab_capacity" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_capacity_select" ON "public"."vocab_capacity" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vocab_contribution" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_contribution_modify" ON "public"."vocab_contribution" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_contribution_select" ON "public"."vocab_contribution" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vocab_focus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_focus_modify" ON "public"."vocab_focus" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_focus_select" ON "public"."vocab_focus" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vocab_pattern" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_pattern_modify" ON "public"."vocab_pattern" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_pattern_select" ON "public"."vocab_pattern" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vocab_pt_category" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_pt_category_modify" ON "public"."vocab_pt_category" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_pt_category_select" ON "public"."vocab_pt_category" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vocab_region" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vocab_region_modify" ON "public"."vocab_region" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['therapist'::"text", 'admin'::"text"]))))));



CREATE POLICY "vocab_region_select" ON "public"."vocab_region" FOR SELECT TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."get_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";
























GRANT ALL ON TABLE "public"."clinical_messages" TO "anon";
GRANT ALL ON TABLE "public"."clinical_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."clinical_messages" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_equipment" TO "anon";
GRANT ALL ON TABLE "public"."exercise_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_form_parameters" TO "anon";
GRANT ALL ON TABLE "public"."exercise_form_parameters" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_form_parameters" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_guidance" TO "anon";
GRANT ALL ON TABLE "public"."exercise_guidance" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_guidance" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_muscles" TO "anon";
GRANT ALL ON TABLE "public"."exercise_muscles" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_muscles" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_pattern_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."exercise_pattern_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_pattern_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_roles" TO "anon";
GRANT ALL ON TABLE "public"."exercise_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_roles" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."offline_mutations" TO "anon";
GRANT ALL ON TABLE "public"."offline_mutations" TO "authenticated";
GRANT ALL ON TABLE "public"."offline_mutations" TO "service_role";



GRANT ALL ON TABLE "public"."patient_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."patient_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."patient_activity_set_form_data" TO "anon";
GRANT ALL ON TABLE "public"."patient_activity_set_form_data" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_activity_set_form_data" TO "service_role";



GRANT ALL ON TABLE "public"."patient_activity_sets" TO "anon";
GRANT ALL ON TABLE "public"."patient_activity_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_activity_sets" TO "service_role";



GRANT ALL ON TABLE "public"."patient_program_history" TO "anon";
GRANT ALL ON TABLE "public"."patient_program_history" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_program_history" TO "service_role";



GRANT ALL ON TABLE "public"."patient_programs" TO "anon";
GRANT ALL ON TABLE "public"."patient_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_programs" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_capacity" TO "anon";
GRANT ALL ON TABLE "public"."vocab_capacity" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_capacity" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_contribution" TO "anon";
GRANT ALL ON TABLE "public"."vocab_contribution" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_contribution" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_focus" TO "anon";
GRANT ALL ON TABLE "public"."vocab_focus" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_focus" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_pattern" TO "anon";
GRANT ALL ON TABLE "public"."vocab_pattern" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_pattern" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_pt_category" TO "anon";
GRANT ALL ON TABLE "public"."vocab_pt_category" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_pt_category" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_region" TO "anon";
GRANT ALL ON TABLE "public"."vocab_region" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_region" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


