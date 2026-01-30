-- Migration: Add missing UPDATE and DELETE RLS policies for clinical_messages
-- The original schema only had SELECT and INSERT policies, blocking all updates

-- Drop if exists (in case of re-run)
DROP POLICY IF EXISTS messages_update ON clinical_messages;
DROP POLICY IF EXISTS messages_delete ON clinical_messages;

-- Allow sender and recipient to update their own flags (archive, read status)
CREATE POLICY messages_update ON clinical_messages FOR UPDATE TO authenticated
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Allow sender to soft-delete (for undo functionality)
CREATE POLICY messages_delete ON clinical_messages FOR DELETE TO authenticated
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );
