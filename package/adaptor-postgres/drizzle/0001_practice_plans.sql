CREATE TABLE practice_plans (
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  planning_date TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (school_id, student_id, planning_date)
);
