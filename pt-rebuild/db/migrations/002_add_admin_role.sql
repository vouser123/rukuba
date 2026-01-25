-- Migration: Add admin role and update constraint
-- Run this in Supabase SQL Editor

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'therapist', 'admin'));

UPDATE users SET role = 'admin' WHERE email = 'cindi@puppyraiser.com';
