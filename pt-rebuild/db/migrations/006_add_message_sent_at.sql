-- Migration: Add sent_at timestamp for clinical_messages

ALTER TABLE clinical_messages
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

UPDATE clinical_messages
SET sent_at = created_at
WHERE sent_at IS NULL;

ALTER TABLE clinical_messages
  ALTER COLUMN sent_at SET DEFAULT now(),
  ALTER COLUMN sent_at SET NOT NULL;
