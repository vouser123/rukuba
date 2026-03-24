
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS supersedes_exercise_id TEXT
  REFERENCES exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_supersedes
  ON exercises(supersedes_exercise_id);
;
