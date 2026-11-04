import { IdentityTokenError, type IdentityClaims } from "./identity.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	DomainError,
	PALIER_EDAYA_ORIGINS,
	displaySubjectLabel,
	formatProgrammeLine,
	isDemoGuardian,
	isPracticeIntent,
	listLearnerSubjects,
	type GuardianActor,
	type Palier,
	type SessionStore,
	type StudentActor,
} from "@edaya-spark/domain";
import { learnerRef, type EdayaSparkApp } from "@edaya-spark/app";

type Env = {
	Variables: {
		actor?: StudentActor;
		guardian?: GuardianActor;
	};
};

const publicPaths = new Set(["/health", "/auth/student-code", "/auth/demo"]);

export type IdentityVerifier = {
	verifyAccessToken(token: string): Promise<IdentityClaims>;
};

export type HttpOptions = {
	sessions: SessionStore;
	identity: IdentityVerifier;
	corsOrigins?: string[];
	generatorName?: "stub" | "gemini-flash" | "rag";
	focusName?: "stub" | "cloudflare";
	palier?: Palier;
	contextMode?: "fixture" | "http";
	demoEnabled?: boolean;
};

const DEFAULT_CORS = ["http://localhost:5175", "http://127.0.0.1:5175"];

export function createHttpApp(app: EdayaSparkApp, options: HttpOptions) {
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
				const actor = await options.sessions.get(token);
				if (
					actor?.role === "guardian"
					&& isDemoGuardian(actor)
					&& demoIsOpen(options)
				) {
					c.set("guardian", actor);
					await next();
					return;
				}
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

	http.use("/parent/*", async (c, next) => {
		await next();
		c.header("Cache-Control", "private, no-store");
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
			focus: options.focusName ?? "stub",
			demoEnabled: demoIsOpen(options),
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

	http.post("/auth/demo", async (c) => {
		if (!demoIsOpen(options)) {
			return c.json(
				{
					error: "DEMO_DISABLED",
					message: (options.palier ?? "local") === "prod"
						? "La démo n'est pas disponible en production."
						: "La démo n'est pas disponible.",
				},
				403,
			);
		}
		const guardian = await app.signInDemoGuardian();
		const guardianToken = crypto.randomUUID();
		await options.sessions.set(guardianToken, guardian);
		return c.json({
			token: guardianToken,
			actor: guardian,
			guardian: { token: guardianToken, actor: guardian },
		});
	});

	http.get("/me", (c) => c.json({ actor: c.get("actor") }));

	http.get("/home", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const home = await app.getHome(learnerRef(actor), "student");
		return c.json(serializeHome(actor, home, true));
	});

	http.post("/snapshots/sync", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const snapshot = await app.syncSnapshot(learnerRef(actor));
		return c.json({ snapshotId: snapshot.id, fingerprint: snapshot.fingerprint });
	});

	http.post("/exercise-sets/generate", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const body = await c.req.json().catch(() => ({})) as { track?: unknown; lessonId?: unknown };
		const track = body.track === undefined ? "revision" : body.track;
		if (track !== "revision" && track !== "homework") {
			throw new DomainError("INVALID_TRACK", "Cette piste n'est pas reconnue.");
		}
		const lessonId = typeof body.lessonId === "string" && body.lessonId.trim()
			? body.lessonId.trim()
			: undefined;
		const set = await app.generate(actor, track, lessonId);
		return c.json({ set }, 201);
	});

	http.get("/exercise-sets", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const sets = await app.listSets(learnerRef(actor));
		return c.json({ sets });
	});

	http.get("/exercise-sets/:id", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const set = await app.getSet(learnerRef(actor), c.req.param("id"), "student");
		if (!set) return c.json({ error: "NOT_FOUND" }, 404);
		return c.json({ set });
	});

	http.post("/exercise-sets/:id/submit", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const body = await c.req.json().catch(() => ({}));
		const set = await app.submitSet(actor, c.req.param("id"), parseAnswers(body));
		return c.json({ set });
	});

	http.post("/exercise-sets/:id/progress", async (c) => {
		const actor = requireStudent(c.get("actor"));
		const body = await c.req.json().catch(() => ({}));
		const set = await app.saveSetProgress(actor, c.req.param("id"), parseAnswers(body));
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
		const home = await app.getHome(
			{
				schoolId: child.schoolId,
				studentId: child.studentId,
				...(isDemoGuardian(guardian) ? { contextSource: "fixture" as const } : {}),
			},
			"guardian",
		);
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

	http.post("/parent/children/:studentId/correction/release", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		const body = await c.req.json().catch(() => ({})) as { setId?: unknown };
		const setId = typeof body.setId === "string" ? body.setId : undefined;
		const set = await app.releaseCorrection(guardian, c.req.param("studentId"), setId);
		return c.json({ set });
	});

	http.post("/parent/children/:studentId/practice-settings", async (c) => {
		const guardian = requireGuardian(c.get("guardian"));
		const body = await c.req.json().catch(() => ({})) as {
			autoReleaseCorrection?: unknown;
			focusIntent?: unknown;
		};
		const patch: {
			autoReleaseCorrection?: boolean;
			focusIntent?: "upcoming_work" | "improve_results" | "prepare_next_day";
		} = {};
		if ("autoReleaseCorrection" in body) {
			patch.autoReleaseCorrection = body.autoReleaseCorrection === true;
		}
		if ("focusIntent" in body) {
			if (!isPracticeIntent(body.focusIntent)) {
				throw new DomainError(
					"INVALID_PRACTICE_INTENT",
					"Ce choix de focus n'est pas reconnu.",
				);
			}
			patch.focusIntent = body.focusIntent;
		}
		const settings = await app.updatePracticeSettings(
			guardian,
			c.req.param("studentId"),
			patch,
		);
		return c.json({ settings });
	});

	http.onError((error, c) => {
		if (error instanceof DomainError) {
			const status =
				error.code === "UNKNOWN_ACCESS_CODE" || error.code === "UNAUTHENTICATED"
					? 401
					: error.code === "ALREADY_GENERATED" || error.code === "ALREADY_SUBMITTED"
						? 409
					: error.code === "SET_NOT_SUBMITTED"
						? 409
					: error.code === "NOT_FOUND"
						? 404
					: error.code === "FORBIDDEN"
						|| error.code === "GUARDIAN_CANNOT_GENERATE"
						|| error.code === "CHILD_NOT_LINKED"
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
		const message =
			options.palier === "prod" || !(error instanceof Error) || !error.message
				? "Erreur inattendue"
				: error.message;
		return c.json({ error: "INTERNAL", message }, 500);
	});

	return http;
}

function serializeHome(
	actor: StudentActor | GuardianActor,
	home: Awaited<ReturnType<EdayaSparkApp["getHome"]>>,
	studentCanGenerate: boolean,
) {
	const subjects = listLearnerSubjects(home.snapshot.context);
	return {
		actor,
		student: home.snapshot.context.student,
		snapshot: {
			id: home.snapshot.id,
			createdAt: home.snapshot.createdAt,
			fingerprint: home.snapshot.fingerprint,
			packVersion: home.snapshot.packVersion,
		},
		marks: home.snapshot.context.marks.map((mark) => ({
			...mark,
			subject: displaySubjectLabel(mark.subject) || mark.subject,
		})),
		rank: home.snapshot.context.rank,
		classProgress: home.snapshot.context.classProgress.map((item) => ({
			...item,
			...(item.subject
				? { subject: displaySubjectLabel(item.subject) || item.subject }
				: {}),
		})),
		timetable: home.snapshot.context.timetable,
		attendance: home.snapshot.context.attendance,
		observations: home.snapshot.context.observations,
		subjects,
		programmeLine: formatProgrammeLine(
			home.snapshot.context.student.classLabel,
			subjects,
		),
		focus: home.focus,
		focusSubject: home.focus ? displaySubjectLabel(home.focus.subject) : "",
		focusIntent: home.focusIntent,
		planningDate: home.planningDate,
		lessonTitle: home.lessonTitle,
		session: home.session,
		canGenerate:
			studentCanGenerate
			&& actor.role === "student"
			&& home.session.tracks.some((track) => track.canGenerate),
		currentSet: home.currentSet,
		history: home.history,
		autoReleaseCorrection: home.autoReleaseCorrection,
	};
}

function requireStudent(actor: StudentActor | undefined): StudentActor {
	if (!actor || actor.role !== "student") {
		throw new DomainError("UNAUTHENTICATED", "Session élève requise.");
	}
	return actor;
}

function demoIsOpen(options: HttpOptions): boolean {
	return options.demoEnabled === true && (options.palier ?? "local") !== "prod";
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

export function corsPreflight(request: Request, corsOrigins: string[] = []): Response {
	const origin = request.headers.get("Origin");
	const allowed = uniqueOrigins([...DEFAULT_CORS, ...corsOrigins]);
	const headers = new Headers();
	if (origin && allowed.includes(origin)) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Vary", "Origin");
		headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
		headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		headers.set("Access-Control-Max-Age", "86400");
	}
	return new Response(null, { status: 204, headers });
}

function parseAnswers(body: unknown): Array<{ questionId: string; value: string }> {
	if (!body || typeof body !== "object" || !("answers" in body)) return [];
	const answers = (body as { answers: unknown }).answers;
	if (!Array.isArray(answers)) return [];
	const parsed: Array<{ questionId: string; value: string }> = [];
	for (const item of answers) {
		if (!item || typeof item !== "object") continue;
		const record = item as { questionId?: unknown; value?: unknown };
		if (typeof record.questionId !== "string") continue;
		parsed.push({
			questionId: record.questionId,
			value: typeof record.value === "string" ? record.value : "",
		});
	}
	return parsed;
}
