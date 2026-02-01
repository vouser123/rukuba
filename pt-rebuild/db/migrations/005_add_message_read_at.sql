-- Migration: Add read_at timestamp for clinical_messages

ALTER TABLE clinical_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
