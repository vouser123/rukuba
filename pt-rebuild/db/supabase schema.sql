-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clinical_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text,
  body text NOT NULL,
  read_by_recipient boolean NOT NULL DEFAULT false,
  archived_by_sender boolean NOT NULL DEFAULT false,
  archived_by_recipient boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinical_messages_pkey PRIMARY KEY (id),
  CONSTRAINT clinical_messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id),
  CONSTRAINT clinical_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id),
  CONSTRAINT clinical_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id),
  CONSTRAINT clinical_messages_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id)
);
CREATE TABLE public.exercise_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  equipment_name text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_equipment_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_equipment_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_form_parameters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  parameter_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_form_parameters_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_form_parameters_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_guidance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  section text NOT NULL CHECK (section = ANY (ARRAY['motor_cues'::text, 'compensation_warnings'::text, 'safety_flags'::text, 'external_cues'::text])),
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_guidance_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_guidance_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_muscles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  muscle_name text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_muscles_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_muscles_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_pattern_modifiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  modifier text NOT NULL CHECK (modifier = ANY (ARRAY['duration_seconds'::text, 'hold_seconds'::text, 'distance_feet'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_pattern_modifiers_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_pattern_modifiers_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercise_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id text NOT NULL,
  region text NOT NULL CHECK (region = ANY (ARRAY['core'::text, 'back'::text, 'hip'::text, 'knee'::text, 'ankle'::text, 'foot'::text, 'vestibular'::text])),
  capacity text NOT NULL CHECK (capacity = ANY (ARRAY['strength'::text, 'control'::text, 'stability'::text, 'tolerance'::text, 'mobility'::text])),
  focus text,
  contribution text NOT NULL CHECK (contribution = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT exercise_roles_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_roles_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.exercises (
  id text NOT NULL,
  canonical_name text NOT NULL,
  description text NOT NULL,
  pt_category text NOT NULL CHECK (pt_category = ANY (ARRAY['back_sij'::text, 'knee'::text, 'ankle'::text, 'hip'::text, 'vestibular'::text, 'foot'::text, 'shoulder'::text, 'other'::text])),
  pattern text NOT NULL CHECK (pattern = ANY (ARRAY['side'::text, 'both'::text])),
  archived boolean NOT NULL DEFAULT false,
  lifecycle_status text CHECK (lifecycle_status = ANY (ARRAY['active'::text, 'archived'::text, 'deprecated'::text])),
  lifecycle_effective_start_date date,
  lifecycle_effective_end_date date,
  supersedes_exercise_id text,
  superseded_by_exercise_id text,
  superseded_date timestamp with time zone,
  added_date date,
  updated_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_supersedes_exercise_id_fkey FOREIGN KEY (supersedes_exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT exercises_superseded_by_exercise_id_fkey FOREIGN KEY (superseded_by_exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.offline_mutations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mutation_type text NOT NULL CHECK (mutation_type = ANY (ARRAY['create_activity_log'::text, 'update_program'::text, 'create_message'::text])),
  mutation_payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  processing_error text,
  CONSTRAINT offline_mutations_pkey PRIMARY KEY (id),
  CONSTRAINT offline_mutations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.patient_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  exercise_id text,
  exercise_name text NOT NULL,
  client_mutation_id text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['reps'::text, 'hold'::text, 'duration'::text, 'distance'::text])),
  notes text,
  performed_at timestamp with time zone NOT NULL,
  client_created_at timestamp with time zone,
  client_updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT patient_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT patient_activity_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id),
  CONSTRAINT patient_activity_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.patient_activity_set_form_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_set_id uuid NOT NULL,
  parameter_name text NOT NULL,
  parameter_value text NOT NULL,
  parameter_unit text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patient_activity_set_form_data_pkey PRIMARY KEY (id),
  CONSTRAINT patient_activity_set_form_data_activity_set_id_fkey FOREIGN KEY (activity_set_id) REFERENCES public.patient_activity_sets(id)
);
CREATE TABLE public.patient_activity_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_log_id uuid NOT NULL,
  set_number integer NOT NULL CHECK (set_number > 0),
  reps integer CHECK (reps >= 0),
  seconds integer CHECK (seconds >= 0),
  distance_feet integer CHECK (distance_feet >= 0),
  side text CHECK (side = ANY (ARRAY['left'::text, 'right'::text, 'both'::text])),
  manual_log boolean NOT NULL DEFAULT false,
  partial_rep boolean NOT NULL DEFAULT false,
  performed_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patient_activity_sets_pkey PRIMARY KEY (id),
  CONSTRAINT patient_activity_sets_activity_log_id_fkey FOREIGN KEY (activity_log_id) REFERENCES public.patient_activity_logs(id)
);
CREATE TABLE public.patient_program_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  exercise_id text NOT NULL,
  dosage_type text NOT NULL,
  sets integer,
  reps_per_set integer,
  seconds_per_rep integer,
  seconds_per_set integer,
  distance_feet integer,
  changed_by_therapist_id uuid,
  change_summary text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patient_program_history_pkey PRIMARY KEY (id),
  CONSTRAINT patient_program_history_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id),
  CONSTRAINT patient_program_history_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT patient_program_history_changed_by_therapist_id_fkey FOREIGN KEY (changed_by_therapist_id) REFERENCES public.users(id)
);
CREATE TABLE public.patient_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  exercise_id text NOT NULL,
  dosage_type text NOT NULL CHECK (dosage_type = ANY (ARRAY['reps'::text, 'hold'::text, 'duration'::text, 'distance'::text])),
  sets integer CHECK (sets > 0),
  reps_per_set integer CHECK (reps_per_set > 0),
  seconds_per_rep integer CHECK (seconds_per_rep >= 0),
  seconds_per_set integer CHECK (seconds_per_set >= 0),
  distance_feet integer CHECK (distance_feet > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by_therapist_id uuid,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patient_programs_pkey PRIMARY KEY (id),
  CONSTRAINT patient_programs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id),
  CONSTRAINT patient_programs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id),
  CONSTRAINT patient_programs_assigned_by_therapist_id_fkey FOREIGN KEY (assigned_by_therapist_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['patient'::text, 'therapist'::text, 'admin'::text])),
  therapist_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id),
  CONSTRAINT users_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.users(id)
);
CREATE TABLE public.vocab_capacity (
  code text NOT NULL,
  definition text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_capacity_pkey PRIMARY KEY (code)
);
CREATE TABLE public.vocab_contribution (
  code text NOT NULL,
  definition text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_contribution_pkey PRIMARY KEY (code)
);
CREATE TABLE public.vocab_focus (
  code text NOT NULL,
  definition text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_focus_pkey PRIMARY KEY (code)
);
CREATE TABLE public.vocab_pattern (
  code text NOT NULL,
  definition text NOT NULL,
  dosage_semantics text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_pattern_pkey PRIMARY KEY (code)
);
CREATE TABLE public.vocab_pt_category (
  code text NOT NULL,
  definition text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_pt_category_pkey PRIMARY KEY (code)
);
CREATE TABLE public.vocab_region (
  code text NOT NULL,
  definition text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vocab_region_pkey PRIMARY KEY (code)
);