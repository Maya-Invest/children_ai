import type { SessionActor, SessionStore, StudentActor } from "@children-ai/domain";

export type { SessionStore };

export class MemorySessionStore implements SessionStore {
	private readonly items = new Map<string, SessionActor>();
	private readonly tokensByStudent = new Map<string, Set<string>>();

	async get(token: string): Promise<SessionActor | null> {
		return this.items.get(token) ?? null;
	}

	async set(token: string, actor: SessionActor): Promise<void> {
		this.items.set(token, actor);
		if (actor.role !== "student") return;
		const tokens = this.tokensByStudent.get(actor.studentId) ?? new Set<string>();
		tokens.add(token);
		this.tokensByStudent.set(actor.studentId, tokens);
	}

	async deleteByStudentId(studentId: string): Promise<void> {
		const tokens = this.tokensByStudent.get(studentId);
		if (!tokens) return;
		for (const token of tokens) {
			const actor = this.items.get(token);
			if (isStudent(actor) && actor.studentId === studentId) {
				this.items.delete(token);
			}
		}
		this.tokensByStudent.delete(studentId);
	}
}

function isStudent(actor: SessionActor | undefined): actor is StudentActor {
	return actor?.role === "student";
}
