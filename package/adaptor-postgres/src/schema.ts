import { index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type {
	ExerciseSet,
	LearnerAcademicSnapshot,
	PracticeSessionPlan,
	PracticeSettings,
	SchoolIntegration,
	SessionActor,
	StudentAccessCode,
} from "@edaya-spark/domain";

export const snapshots = pgTable(
	"snapshots",
	{
		id: text("id").primaryKey(),
		schoolId: text("school_id").notNull(),
		studentId: text("student_id").notNull(),
		createdAt: text("created_at").notNull(),
		payload: jsonb("payload").$type<LearnerAcademicSnapshot>().notNull(),
	},
	(table) => [
		index("snapshots_learner_idx").on(table.schoolId, table.studentId, table.createdAt),
	],
);

export const exerciseSets = pgTable(
	"exercise_sets",
	{
		id: text("id").primaryKey(),
		snapshotId: text("snapshot_id").notNull(),
		schoolId: text("school_id").notNull(),
		studentId: text("student_id").notNull(),
		generatedAt: text("generated_at").notNull(),
		payload: jsonb("payload").$type<ExerciseSet>().notNull(),
	},
	(table) => [
		index("exercise_sets_snapshot_idx").on(table.snapshotId),
		index("exercise_sets_learner_idx").on(table.schoolId, table.studentId, table.generatedAt),
	],
);

export const practiceSettings = pgTable(
	"practice_settings",
	{
		schoolId: text("school_id").notNull(),
		studentId: text("student_id").notNull(),
		payload: jsonb("payload").$type<PracticeSettings>().notNull(),
	},
	(table) => [primaryKey({ columns: [table.schoolId, table.studentId] })],
);

export const practicePlans = pgTable(
	"practice_plans",
	{
		schoolId: text("school_id").notNull(),
		studentId: text("student_id").notNull(),
		planningDate: text("planning_date").notNull(),
		payload: jsonb("payload").$type<PracticeSessionPlan>().notNull(),
	},
	(table) => [primaryKey({ columns: [table.schoolId, table.studentId, table.planningDate] })],
);

export const accessCodes = pgTable(
	"access_codes",
	{
		id: text("id").primaryKey(),
		schoolId: text("school_id").notNull(),
		studentId: text("student_id").notNull(),
		codeHash: text("code_hash").notNull(),
		revokedAt: text("revoked_at"),
		payload: jsonb("payload").$type<StudentAccessCode>().notNull(),
	},
	(table) => [
		index("access_codes_hash_idx").on(table.codeHash),
		index("access_codes_student_idx").on(table.studentId),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		token: text("token").primaryKey(),
		studentId: text("student_id"),
		actor: jsonb("actor").$type<SessionActor>().notNull(),
		expiresAt: text("expires_at").notNull(),
	},
	(table) => [index("sessions_student_idx").on(table.studentId)],
);

export const schoolIntegrations = pgTable("school_integrations", {
	schoolId: text("school_id").primaryKey(),
	status: text("status").notNull(),
	integration: jsonb("integration").$type<SchoolIntegration>().notNull(),
	secretIv: text("secret_iv").notNull(),
	secretCiphertext: text("secret_ciphertext").notNull(),
});
