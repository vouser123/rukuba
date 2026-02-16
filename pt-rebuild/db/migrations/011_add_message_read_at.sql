-- Add read_at timestamp to clinical_messages
-- Records when a message was first read by the recipient
-- Nullable: NULL means unread

ALTER TABLE clinical_messages ADD COLUMN read_at TIMESTAMPTZ;

COMMENT ON COLUMN clinical_messages.read_at IS 'Timestamp when the recipient first read this message';
