-- Normalize form parameter names: remove underscores and fix capitalization
-- Renames: band_resistance → resistance band, band_location → band location, strap_position → strap position
-- Also fixes inconsistent capitalization in logged values (Blue → blue)

-- exercise_form_parameters: rename parameter_name values
UPDATE exercise_form_parameters SET parameter_name = 'resistance band' WHERE parameter_name = 'band_resistance';
UPDATE exercise_form_parameters SET parameter_name = 'band location'   WHERE parameter_name = 'band_location';
UPDATE exercise_form_parameters SET parameter_name = 'strap position'  WHERE parameter_name = 'strap_position';

-- patient_activity_set_form_data: rename parameter_name values
UPDATE patient_activity_set_form_data SET parameter_name = 'resistance band' WHERE parameter_name = 'band_resistance';
UPDATE patient_activity_set_form_data SET parameter_name = 'band location'   WHERE parameter_name = 'band_location';
UPDATE patient_activity_set_form_data SET parameter_name = 'strap position'  WHERE parameter_name = 'strap_position';

-- Fix inconsistent capitalization in stored values for resistance band (Blue → blue)
UPDATE patient_activity_set_form_data
SET parameter_value = LOWER(parameter_value)
WHERE parameter_name = 'resistance band'
  AND parameter_value != LOWER(parameter_value);
