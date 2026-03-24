-- Index to support ORDER BY created_at on clinical_messages
-- Flagged by index_advisor in Supabase Query Performance
CREATE INDEX idx_clinical_messages_created_at ON public.clinical_messages USING btree (created_at);;
