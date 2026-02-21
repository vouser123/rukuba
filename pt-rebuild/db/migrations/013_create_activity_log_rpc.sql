-- Migration 013: Atomic activity log creation RPC
--
-- Creates a Postgres function that inserts into all three tables
-- (patient_activity_logs, patient_activity_sets, patient_activity_set_form_data)
-- in a single implicit PL/pgSQL transaction.
--
-- Fixes:
--   DN-003: Orphaned log rows when sets insert fails after log is created
--   DN-004: Form data matched to wrong set when Supabase returns rows in
--           different order than submitted (array-index vs set_number matching)
--
-- Design decisions:
--   SECURITY INVOKER: runs under caller's JWT identity — all RLS policies on
--   all three tables remain in full effect. No privilege escalation.
--
--   Form data matched by set_number (not array index): each set in p_sets carries
--   its own form_data array. After inserting a set row and capturing its generated
--   id, form_data rows are inserted using that captured id. This guarantees form
--   parameters attach to the correct set regardless of DB return order.
--
--   Idempotency: checks client_mutation_id before any insert. Returns
--   {duplicate: true} if already processed. client_mutation_id is never written
--   on failure because the transaction rolls back atomically.
--
-- p_sets JSONB array element shape:
-- {
--   "set_number":    INT,        -- required, positive integer
--   "reps":          INT|null,
--   "seconds":       INT|null,
--   "distance_feet": INT|null,
--   "side":          TEXT|null,  -- 'left', 'right', 'both', or null
--   "manual_log":    BOOL,
--   "partial_rep":   BOOL,
--   "performed_at":  TIMESTAMPTZ|null,  -- falls back to p_performed_at if null
--   "form_data":     [           -- may be empty array or absent
--     {
--       "parameter_name":  TEXT,
--       "parameter_value": TEXT,
--       "parameter_unit":  TEXT|null
--     }
--   ]
-- }

CREATE OR REPLACE FUNCTION create_activity_log_atomic(
  p_patient_id         UUID,
  p_exercise_id        TEXT,
  p_exercise_name      TEXT,
  p_client_mutation_id TEXT,
  p_activity_type      TEXT,
  p_notes              TEXT,
  p_performed_at       TIMESTAMPTZ,
  p_client_created_at  TIMESTAMPTZ,
  p_sets               JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
VOLATILE
AS $$
DECLARE
  v_log_id      UUID;
  v_set_id      UUID;
  v_set         JSONB;
  v_form_item   JSONB;
  v_set_number  INT;
  v_performed_at TIMESTAMPTZ;
BEGIN
  -- Idempotency check: if this client_mutation_id was already processed,
  -- return duplicate signal without touching any rows.
  SELECT id INTO v_log_id
    FROM patient_activity_logs
   WHERE patient_id = p_patient_id
     AND client_mutation_id = p_client_mutation_id;

  IF FOUND THEN
    RETURN json_build_object('duplicate', true);
  END IF;

  -- Step 1: Insert the activity log row.
  -- On unique constraint violation (race condition with concurrent insert of same
  -- client_mutation_id), PL/pgSQL raises an exception which rolls back this transaction.
  INSERT INTO patient_activity_logs (
    patient_id,
    exercise_id,
    exercise_name,
    client_mutation_id,
    activity_type,
    notes,
    performed_at,
    client_created_at
  ) VALUES (
    p_patient_id,
    p_exercise_id,
    p_exercise_name,
    p_client_mutation_id,
    p_activity_type,
    p_notes,
    p_performed_at,
    p_client_created_at
  )
  RETURNING id INTO v_log_id;

  -- Step 2: Insert each set from the p_sets JSONB array.
  -- For each set, capture the generated id keyed by set_number, then insert
  -- that set's form_data using the captured id (not array index position).
  FOR v_set IN SELECT * FROM jsonb_array_elements(p_sets)
  LOOP
    v_set_number   := (v_set->>'set_number')::INT;
    v_performed_at := COALESCE(
      NULLIF(v_set->>'performed_at', '')::TIMESTAMPTZ,
      p_performed_at
    );

    INSERT INTO patient_activity_sets (
      activity_log_id,
      set_number,
      reps,
      seconds,
      distance_feet,
      side,
      manual_log,
      partial_rep,
      performed_at
    ) VALUES (
      v_log_id,
      v_set_number,
      NULLIF((v_set->>'reps')::TEXT, '')::INT,
      NULLIF((v_set->>'seconds')::TEXT, '')::INT,
      NULLIF((v_set->>'distance_feet')::TEXT, '')::INT,
      NULLIF(v_set->>'side', ''),
      COALESCE((v_set->>'manual_log')::BOOLEAN, false),
      COALESCE((v_set->>'partial_rep')::BOOLEAN, false),
      v_performed_at
    )
    RETURNING id INTO v_set_id;

    -- Step 3: Insert form_data for this set using the captured set id.
    -- form_data may be absent (null) or an empty array — both are safe to skip.
    IF v_set->'form_data' IS NOT NULL AND jsonb_array_length(v_set->'form_data') > 0 THEN
      FOR v_form_item IN SELECT * FROM jsonb_array_elements(v_set->'form_data')
      LOOP
        INSERT INTO patient_activity_set_form_data (
          activity_set_id,
          parameter_name,
          parameter_value,
          parameter_unit
        ) VALUES (
          v_set_id,
          v_form_item->>'parameter_name',
          v_form_item->>'parameter_value',
          NULLIF(v_form_item->>'parameter_unit', '')
        );
      END LOOP;
    END IF;

  END LOOP;

  -- All inserts succeeded. Return the new log id.
  RETURN json_build_object('log_id', v_log_id);

END;
$$;
