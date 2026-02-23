-- Migration 015: Fix mutable search_path on create_activity_log_atomic
--
-- Supabase security advisor flagged: "Function public.create_activity_log_atomic
-- has a role mutable search_path". Adding SET search_path = public, pg_temp
-- and explicit SECURITY INVOKER prevents schema injection attacks.
-- No behavioral change — function logic is identical.

CREATE OR REPLACE FUNCTION public.create_activity_log_atomic(
  p_patient_id uuid,
  p_exercise_id text,
  p_exercise_name text,
  p_client_mutation_id text,
  p_activity_type text,
  p_notes text,
  p_performed_at timestamp with time zone,
  p_client_created_at timestamp with time zone,
  p_sets jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
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
    -- from actual arrays. This handles "form_data": null, "form_data": [],
    -- and absent form_data keys safely without raising an error.
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

  RETURN json_build_object('log_id', v_log_id);

END;
$function$;
