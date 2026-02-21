-- Migration 014: Fix create_activity_log_atomic to handle JSON null form_data
--
-- Bug: when the client sends "form_data": null inside a set object, the JSONB
-- value v_set->'form_data' is a JSON null (not a SQL NULL). The previous
-- check `v_set->'form_data' IS NOT NULL` was true for JSON null values,
-- causing jsonb_array_length() to be called on a non-array and raising an error.
--
-- Fix: use jsonb_typeof() to confirm form_data is an array before iterating.
-- This safely handles "form_data": null, "form_data": [], and absent form_data
-- keys without raising an error.

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
  v_log_id       UUID;
  v_set_id       UUID;
  v_set          JSONB;
  v_form_item    JSONB;
  v_set_number   INT;
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
  -- On unique constraint violation (race condition), PL/pgSQL raises an
  -- exception which rolls back this transaction.
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
  -- Capture each set's generated id, then insert its form_data using that id
  -- (matched by set_number, not array index position — DN-004 fix).
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

    -- Step 3: Insert form_data only if it is a non-empty JSON array.
    -- Use jsonb_typeof() to distinguish JSON null / missing / non-array values
    -- from actual arrays. Handles "form_data": null, "form_data": [],
    -- and absent form_data keys without error.
    IF jsonb_typeof(v_set->'form_data') = 'array' AND jsonb_array_length(v_set->'form_data') > 0 THEN
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
