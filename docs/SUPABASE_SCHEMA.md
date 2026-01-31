# Supabase Database Schema

This document describes the database schema for the PT Tracker application.

**Project ID:** `zvgoaxdpkgfxklotqwpz`
**Region:** `us-east-1`

---

## Core Tables

### users
User accounts linked to Supabase Auth.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| auth_id | uuid | NO | - | References auth.users - Supabase Auth integration (UNIQUE) |
| email | text | NO | - | User email |
| role | text | NO | - | Must be: 'patient', 'therapist', or 'admin' |
| therapist_id | uuid | YES | - | For patients only - their assigned therapist |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### exercises
Shared exercise library - canonical exercise definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | NO | - | Primary key (e.g., 'bridge_double_leg') |
| canonical_name | text | NO | - | Display name |
| description | text | NO | - | Exercise description |
| pt_category | text | NO | - | High-level PT category: back_sij, knee, ankle, hip, vestibular, foot, shoulder, other |
| pattern | text | NO | - | Execution pattern: 'side' (per-side) or 'both' (bilateral) |
| archived | boolean | NO | false | Soft-delete flag |
| lifecycle_status | text | YES | - | active, archived, deprecated |
| lifecycle_effective_start_date | date | YES | - | |
| lifecycle_effective_end_date | date | YES | - | |
| supersedes_exercise_id | text | YES | - | FK to exercises.id |
| superseded_by_exercise_id | text | YES | - | FK to exercises.id |
| superseded_date | timestamptz | YES | - | |
| added_date | date | YES | - | |
| updated_date | date | YES | - | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### exercise_equipment
Equipment per exercise (required or optional).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| equipment_name | text | NO | - | |
| is_required | boolean | NO | true | true = intrinsic, false = comfort/modification |
| created_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### exercise_muscles
Muscles targeted per exercise.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| muscle_name | text | NO | - | |
| is_primary | boolean | NO | true | true = primary mover, false = stabilizer |
| created_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### exercise_pattern_modifiers
Pattern-level dosage modifiers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| modifier | text | NO | - | duration_seconds, hold_seconds, or distance_feet |
| created_at | timestamptz | NO | now() | |

**Modifier semantics:**
- `duration_seconds`: REPLACES reps with time
- `hold_seconds`: MODIFIES reps to add isometric hold
- `distance_feet`: REPLACES reps with distance

**RLS:** Enabled

---

### exercise_form_parameters
Variable configuration parameters for exercises (e.g., band_resistance, surface, eyes, distance).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| parameter_name | text | NO | - | Parameter name (fully mutable, no enum) |
| created_at | timestamptz | NO | now() | |

**Common parameter_name values:** distance, band_resistance, band_location, band_position, eyes, surface, weight, strap_position, slope

**RLS:** Enabled

---

### exercise_guidance
Exercise performance guidance organized by section.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| section | text | NO | - | motor_cues, compensation_warnings, safety_flags, external_cues |
| content | text | NO | - | Guidance text |
| sort_order | integer | NO | 0 | Display order |
| created_at | timestamptz | NO | now() | |

**Section meanings:**
- `motor_cues`: How to move
- `compensation_warnings`: Common mistakes to avoid
- `safety_flags`: Stop/modify conditions
- `external_cues`: Visual/tactile cues

**RLS:** Enabled

---

### exercise_roles
Rehab coverage roles assigned to exercises (region × capacity × focus × contribution).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| exercise_id | text | NO | - | FK to exercises.id |
| region | text | NO | - | core, back, hip, knee, ankle, foot, vestibular |
| capacity | text | NO | - | strength, control, stability, tolerance, mobility |
| focus | text | YES | - | Specific focus within capacity (e.g., anti_rotation) |
| contribution | text | NO | - | low, medium, high |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

## Patient Data Tables

### patient_programs
Therapist-prescribed exercise dosages per patient.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| patient_id | uuid | NO | - | FK to users.id |
| exercise_id | text | NO | - | FK to exercises.id |
| dosage_type | text | NO | - | reps, hold, duration, distance |
| sets | integer | YES | - | Number of sets (must be > 0) |
| reps_per_set | integer | YES | - | Reps per set (for reps/hold types) |
| seconds_per_rep | integer | YES | - | Hold duration (for hold type) |
| seconds_per_set | integer | YES | - | Set duration (for duration type) |
| distance_feet | integer | YES | - | Distance per set (for distance type) |
| is_favorite | boolean | NO | false | |
| assigned_at | timestamptz | NO | now() | |
| assigned_by_therapist_id | uuid | YES | - | FK to users.id |
| archived_at | timestamptz | YES | - | Soft-delete timestamp |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Unique constraint:** (patient_id, exercise_id)

**Dosage type determines which fields are used:**
- `reps`: sets × reps_per_set
- `hold`: sets × reps_per_set × seconds_per_rep
- `duration`: sets × seconds_per_set
- `distance`: sets × distance_feet

**RLS:** Enabled

---

### patient_program_history
Audit trail of dosage changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| patient_id | uuid | NO | - | FK to users.id |
| exercise_id | text | NO | - | FK to exercises.id |
| dosage_type | text | NO | - | |
| sets | integer | YES | - | |
| reps_per_set | integer | YES | - | |
| seconds_per_rep | integer | YES | - | |
| seconds_per_set | integer | YES | - | |
| distance_feet | integer | YES | - | |
| changed_by_therapist_id | uuid | YES | - | FK to users.id |
| change_summary | text | YES | - | |
| changed_at | timestamptz | NO | now() | |
| created_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### patient_activity_logs
Patient exercise performance logs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| patient_id | uuid | NO | - | FK to users.id |
| exercise_id | text | YES | - | FK to exercises.id |
| exercise_name | text | NO | - | Denormalized for display reliability |
| client_mutation_id | text | NO | - | Client UUID for deduplication |
| activity_type | text | NO | - | reps, hold, duration, distance |
| notes | text | YES | - | |
| performed_at | timestamptz | NO | - | When patient performed the exercise |
| client_created_at | timestamptz | YES | - | For offline reconciliation |
| client_updated_at | timestamptz | YES | - | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | - | Soft-delete |

**Unique constraint:** (patient_id, client_mutation_id)

**RLS:** Enabled

---

### patient_activity_sets
Individual sets within a patient activity log.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| activity_log_id | uuid | NO | - | FK to patient_activity_logs.id |
| set_number | integer | NO | - | Must be > 0 |
| reps | integer | YES | - | Actual reps achieved |
| seconds | integer | YES | - | Actual seconds achieved |
| distance_feet | integer | YES | - | Actual distance achieved |
| side | text | YES | - | left, right, or both |
| manual_log | boolean | NO | false | true = manually entered |
| partial_rep | boolean | NO | false | true = incomplete rep |
| performed_at | timestamptz | NO | - | |
| created_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

### patient_activity_set_form_data
Variable form parameter values logged per set.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| activity_set_id | uuid | NO | - | FK to patient_activity_sets.id |
| parameter_name | text | NO | - | Parameter name |
| parameter_value | text | NO | - | Value |
| parameter_unit | text | YES | - | Unit (ft, inch, cm, degree) |
| created_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

## Messaging

### clinical_messages
Bidirectional patient-therapist messaging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| patient_id | uuid | NO | - | FK to users.id |
| sender_id | uuid | NO | - | FK to users.id |
| recipient_id | uuid | NO | - | FK to users.id |
| subject | text | YES | - | |
| body | text | NO | - | |
| read_by_recipient | boolean | NO | false | |
| archived_by_sender | boolean | NO | false | |
| archived_by_recipient | boolean | NO | false | |
| deleted_at | timestamptz | YES | - | Soft delete (1-hour undo window) |
| deleted_by | uuid | YES | - | FK to users.id |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**RLS:** Enabled

---

## Offline Support

### offline_mutations
Server-side record of offline queue submissions (for debugging/audit only).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| user_id | uuid | NO | - | FK to users.id |
| mutation_type | text | NO | - | create_activity_log, update_program, create_message |
| mutation_payload | jsonb | NO | - | JSONB payload |
| created_at | timestamptz | NO | now() | |
| processed_at | timestamptz | YES | - | |
| processing_error | text | YES | - | |

**RLS:** Enabled

---

## Vocabulary Tables

All vocabulary tables share the same structure and are used for dropdown/enum values that can be edited by therapists.

### vocab_region, vocab_capacity, vocab_contribution, vocab_focus, vocab_pt_category, vocab_pattern

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| code | text | NO | - | Primary key |
| definition | text | NO | - | Human-readable description |
| sort_order | integer | NO | 0 | Display order |
| active | boolean | NO | true | Whether this value is currently in use |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**Note:** `vocab_pattern` also has a `dosage_semantics` column.

**RLS:** Enabled (SELECT only for authenticated users)

---

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

- **users**: Users can see their own row
- **exercises/exercise_***: Anyone authenticated can SELECT; therapists/admins can INSERT/UPDATE/DELETE
- **patient_programs**: Patients see own; therapists see their patients'; therapists/admins can modify
- **patient_activity_***: Patients can INSERT/SELECT own data
- **clinical_messages**: Users can see messages where they are sender or recipient
- **vocab_***: Anyone authenticated can SELECT

---

## Indexes

Key performance indexes:
- `idx_users_auth_id` - Lookup by Supabase Auth ID
- `idx_exercises_canonical_name` - Exercise search
- `idx_patient_programs_patient` - Programs by patient
- `idx_activity_logs_performed_at` - Activity timeline
- `idx_activity_sets_log` - Sets by log
- `idx_clinical_messages_sender/recipient` - Message lookup

---

*Last updated: 2026-01-31*
