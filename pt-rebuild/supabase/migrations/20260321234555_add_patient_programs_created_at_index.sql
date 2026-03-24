-- Index to support ORDER BY created_at DESC on patient_programs
-- Suggested by index_advisor for the programs+exercises join query (78% cost reduction)
CREATE INDEX idx_patient_programs_created_at ON public.patient_programs USING btree (created_at);;
