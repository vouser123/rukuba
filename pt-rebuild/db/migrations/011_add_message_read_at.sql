-- Add read_at timestamp to clinical_messages
-- Records when a message was first read by the recipient
-- Nullable: NULL means unread
-- Idempotent: safe to run if column already exists

ALTER TABLE clinical_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN clinical_messages.read_at IS 'Timestamp when the recipient first read this message';
