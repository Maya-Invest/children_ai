CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX snapshots_learner_idx ON snapshots (school_id, student_id, created_at);
--> statement-breakpoint
CREATE TABLE exercise_sets (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  payload JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX exercise_sets_snapshot_idx ON exercise_sets (snapshot_id);
--> statement-breakpoint
CREATE INDEX exercise_sets_learner_idx ON exercise_sets (school_id, student_id, generated_at);
--> statement-breakpoint
CREATE TABLE practice_settings (
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (school_id, student_id)
);
--> statement-breakpoint
CREATE TABLE access_codes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  revoked_at TEXT,
  payload JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX access_codes_hash_idx ON access_codes (code_hash);
--> statement-breakpoint
CREATE INDEX access_codes_student_idx ON access_codes (student_id);
--> statement-breakpoint
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  student_id TEXT,
  actor JSONB NOT NULL,
  expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX sessions_student_idx ON sessions (student_id);
--> statement-breakpoint
CREATE TABLE school_integrations (
  school_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  integration JSONB NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL
);
