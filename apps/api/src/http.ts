import { IdentityTokenError, type IdentityClaims } from "@maya-invest/edaya-identity-client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	DomainError,
	PALIER_EDAYA_ORIGINS,
	type GuardianActor,
	type Palier,
	type StudentActor,
} from "@children-ai/domain";
import type { SessionStore } from "@children-ai/adaptors";
import { learnerRef, type ChildrenAiApp } from "@children-ai/app";

type Env = {
	Variables: {
		actor?: StudentActor;
		guardian?: GuardianActor;
	};
};

const publicPaths = new Set(["/health", "/auth/student-code"]);

export type IdentityVerifier = {
	verifyAccessToken(token: string): Promise<IdentityClaims>;
};

export type HttpOptions = {
	sessions: SessionStore;
	identity: IdentityVerifier;
	corsOrigins?: string[];
	generatorName?: "stub" | "gemini-flash";
	palier?: Palier;
	contextMode?: "fixture" | "http";
};

const DEFAULT_CORS = ["http://localhost:5175", "http://127.0.0.1:5175"];

export function createHttpApp(app: ChildrenAiApp, options: HttpOptions) {
	const http = new Hono<Env>();
	const origins = uniqueOrigins([
		...DEFAULT_CORS,
		...(options.corsOrigins ?? []),
	]);

	http.use(
		"/*",
		cors({
			origin: origins,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "OPTIONS"],
		}),
	);

	http.use("/*", async (c, next) => {
		if (c.req.method === "OPTIONS" || publicPaths.has(c.req.path)) {
			await next();
			return;
		}

		const header = c.req.header("authorization") ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!token) return c.json({ error: "UNAUTHENTICATED" }, 401);

		const parentRoute = c.req.path.startsWith("/parent");
		if (parentRoute) {
			if (!looksLikeJwt(token)) {
				return c.json({ error: "UNAUTHENTICATED", message: "JWT parent requis." }, 401);
			}
			try {
				const claims = await options.identity.verifyAccessToken(token);
				const guardian = await app.resolveGuardian({
					subjectId: claims.sub,
					email: claims.email,
				});
				c.set("guardian", guardian);
			} catch (error) {
				if (error instanceof IdentityTokenError) {
					return c.json({ error: "UNAUTHENTICATED", message: error.message }, 401);
				}
				throw error;
			}
			await next();
			return;
		}

		if (looksLikeJwt(token)) {
			return c.json(
				{ error: "FORBIDDEN", message: "Les routes élève n'acceptent pas le JWT parent." },
				403,
			);
		}

		const actor = await options.sessions.get(token);
		if (!actor || actor.role !== "student") {
			return c.json({ error: "UNAUTHENTICATED" }, 401);
		}
		c.set("actor", actor);
		await next();
	});

	http.get("/health", (c) => {
		const palier = options.palier ?? "local";
		return c.json({
			ok: true,
			framework: "hono",
			palier,
			edayaOrigins: PALIER_EDAYA_ORIGINS[palier],
			schoolTenancy: "per-school",
			contextMode: options.contextMode ?? "fixture",
			generator: options.generatorName ?? "stub",
			keysRequired: palier === "prod" || palier === "staging",
		});
	});

	http.post("/auth/student-code", async (c) => {
		const body = await c.req.json<{ code?: string }>();
		const actor = await app.signInStudent(body.code ?? "");
		const token = crypto.randomUUID();
		await options.sessions.set(token, actor);
		return c.json({ token, actor });
	});

	http.get("/me", (c) => c.json({ actor: c.get("actor") }));

	http.get("/home", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const home = await app.getHome(learnerRef(actor));
		return c.json(serializeHome(actor, home, true));
	});

	http.post("/snapshots/sync", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const snapshot = await app.syncSnapshot(learnerRef(actor));
		return c.json({ snapshotId: snapshot.id, fingerprint: snapshot.fingerprint });
	});

	http.post("/exercise-sets/generate", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const set = await app.generate(actor);
		return c.json({ set }, 201);
	});

	http.get("/exercise-sets", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const sets = await app.listSets(learnerRef(actor));
		return c.json({ sets });
	});

	http.get("/exercise-sets/:id", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const set = await app.getSet(learnerRef(actor), c.req.param("id"));
		if (!set) return c.json({ error: "NOT_FOUND" }, 404);
		return c.json({ set });
	});

	http.get("/parent/children", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		const listing = await app.listChildren(guardian);
		return c.json({
			guardian,
			schoolId: listing.schoolId,
			displayName: listing.displayName,
			children: listing.children,
			emptyMessage:
				listing.children.length === 0
					? "Aucun enfant n'est lié à votre compte à l'école."
					: undefined,
		});
	});

	http.get("/parent/children/:studentId", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		const studentId = c.req.param("studentId");
		const listing = await app.listChildren(guardian);
		const child = listing.children.find((item) => item.studentId === studentId);
		if (!child) {
			return c.json({ error: "CHILD_NOT_LINKED", message: "Cet élève n'est pas lié à votre compte parent." }, 403);
		}
		const home = await app.getHome({ schoolId: child.schoolId, studentId: child.studentId });
		return c.json({
			...serializeHome(
				{
					role: "guardian",
					subjectId: guardian.subjectId,
					schoolId: child.schoolId,
					displayName: guardian.displayName,
				},
				home,
				false,
			),
			child,
		});
	});

	http.post("/parent/children/:studentId/access-codes", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		const issued = await app.issueAccessCode(guardian, c.req.param("studentId"));
		return c.json(issued, 201);
	});

	http.post("/parent/children/:studentId/access-codes/revoke", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		await app.revokeAccessCode(guardian, c.req.param("studentId"));
		return c.json({ ok: true });
	});

	http.onError((error, c) => {
		if (error instanceof DomainError) {
			const status =
				error.code === "UNKNOWN_ACCESS_CODE" || error.code === "UNAUTHENTICATED"
					? 401
					: error.code === "ALREADY_GENERATED"
						? 409
						: error.code === "GUARDIAN_CANNOT_GENERATE" || error.code === "CHILD_NOT_LINKED"
							? 403
							: error.code === "PALIER_ORIGIN_MISMATCH" ||
								  error.code === "SCHOOL_INTEGRATION_MISSING"
								? 403
							: error.code === "GENERATION_FAILED" ||
								  error.code === "EDAYA_CONTEXT_FETCH_FAILED"
								? 502
							: 400;
			return c.json({ error: error.code, message: error.message }, status);
		}
		console.error(error);
		return c.json({ error: "INTERNAL", message: "Erreur inattendue" }, 500);
	});

	return http;
}

function serializeHome(
	actor: StudentActor | GuardianActor,
	home: Awaited<ReturnType<ChildrenAiApp["getHome"]>>,
	studentCanGenerate: boolean,
) {
	return {
		actor,
		student: home.snapshot.context.student,
		snapshot: {
			id: home.snapshot.id,
			createdAt: home.snapshot.createdAt,
			fingerprint: home.snapshot.fingerprint,
			packVersion: home.snapshot.packVersion,
		},
		marks: home.snapshot.context.marks,
		rank: home.snapshot.context.rank,
		focus: home.focus,
		lessonTitle: home.lessonTitle,
		canGenerate: studentCanGenerate && actor.role === "student" && home.currentSet === null,
		currentSet: home.currentSet,
		history: home.history,
	};
}

function requireStudent(actor: StudentActor | undefined): StudentActor {
	if (!actor || actor.role !== "student") {
		throw new DomainError("UNAUTHENTICATED", "Session élève requise.");
	}
	return actor;
}

function requireGuardian(guardian: GuardianActor | undefined): GuardianActor {
	if (!guardian || guardian.role !== "guardian") {
		throw new DomainError("UNAUTHENTICATED", "Session parent requise.");
	}
	return guardian;
}

function looksLikeJwt(token: string): boolean {
	return token.split(".").length === 3;
}

function uniqueOrigins(origins: string[]): string[] {
	return [...new Set(origins.map((item) => item.trim()).filter(Boolean))];
}
