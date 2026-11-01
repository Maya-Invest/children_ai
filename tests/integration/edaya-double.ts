import {
	createTestIdentityKeys,
	signTestIdentityToken,
	type TestIdentityKeys,
} from "../../apps/api/src/identity-testing.ts";
import {
	ACADEMIC_YEAR_ID,
	PARENT_SUBJECT_ID,
	RESOLVE_SECRET,
	S2S_API_KEY,
	STAFF_SUBJECT_ID,
	entityRows,
	resolveEmpty,
	resolveParent,
	utcTimetableDay,
} from "./edaya-contract.ts";

/**
 * Local palier only accepts http://127.0.0.1:9999 and http://localhost:9999.
 * A random port would be rejected as PALIER_ORIGIN_MISMATCH before any call.
 */
export const EDAYA_STAND_IN_ORIGIN = "http://127.0.0.1:9999";
const STAND_IN_PORT = 9999;

export type EdayaDouble = {
	origin: string;
	signParentJwt(subjectId: string, email: string): Promise<string>;
	stop(): Promise<void>;
};

export async function startEdayaDouble(): Promise<EdayaDouble> {
	const keys = await createTestIdentityKeys();
	const origin = EDAYA_STAND_IN_ORIGIN;
	const challenges = new Map<string, { email: string; code: string; subjectId: string }>();
	const sessions = new Map<string, { email: string; subjectId: string }>();

	let server: ReturnType<typeof Bun.serve>;
	try {
		server = Bun.serve({
			hostname: "127.0.0.1",
			port: STAND_IN_PORT,
			idleTimeout: 0,
			async fetch(request) {
				const url = new URL(request.url);
				if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
					return json(keys.jwks);
				}
				if (url.pathname === "/auth/edaya/terms" && request.method === "GET") {
					if (url.searchParams.get("locale") !== "fr") return json({ code: "invalid_request" }, 400);
					return json({ enforced: true, document: { version: "spark-terms-v1", locale: "fr", status: "published", title: "Conditions d’utilisation", documentHash: "fixture-fr", html: "<h1>Conditions d’utilisation</h1><p>Conditions de test.</p>", sections: [{ heading: "Conditions d’utilisation", paragraphs: ["Conditions de test."] }] } });
				}
				if (url.pathname.startsWith("/auth/edaya/")) {
					if (request.method !== "POST") return methodNotAllowed();
					return handleAuth(url.pathname, request, {
						origin,
						keys,
						challenges,
						sessions,
					});
				}
				if (url.pathname === "/internal/edaya-spark/resolve-guardian") {
					if (request.method !== "POST") return methodNotAllowed();
					if (request.headers.get("x-edaya-spark-resolve-secret") !== RESOLVE_SECRET) {
						return json({ message: "Unauthorized" }, 401);
					}
					const body = await readJson(request);
					const subjectId = typeof body.subjectId === "string" ? body.subjectId.trim() : "";
					if (subjectId === PARENT_SUBJECT_ID) return json(resolveParent);
					if (subjectId === STAFF_SUBJECT_ID) return json(resolveEmpty);
					return json(resolveEmpty);
				}
				const entity = url.pathname.match(/^\/core\/entities\/([^/]+)\/list$/);
				if (entity) {
					if (request.method !== "POST") return methodNotAllowed();
					const bearer = request.headers.get("authorization") ?? "";
					const year = request.headers.get("x-academic-year-id") ?? "";
					if (bearer !== `Bearer ${S2S_API_KEY}` || year !== ACADEMIC_YEAR_ID) {
						return json({ message: "Unauthorized" }, 401);
					}
					return json(entityRows(decodeURIComponent(entity[1] ?? ""), utcTimetableDay()));
				}
				return json({ message: "Not found" }, 404);
			},
		});
		server.unref();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Edaya stand-in could not listen on ${origin}. Stop anything already bound to port ${STAND_IN_PORT}. ${message}`,
		);
	}

	return {
		origin,
		signParentJwt(subjectId, email) {
			return signParent(keys, origin, subjectId, email);
		},
		async stop() {
			await server.stop(true);
		},
	};
}

const PARENT_EMAIL = "m.kone@mail.ci";
const STAFF_EMAIL = "a.toure@ecole-ci.edaya.dev";

function subjectForEmail(email: string): string {
	const normalized = email.trim().toLowerCase();
	if (normalized === PARENT_EMAIL) return PARENT_SUBJECT_ID;
	if (normalized === STAFF_EMAIL) return STAFF_SUBJECT_ID;
	return "";
}

function sessionIdFrom(request: Request): string {
	const match = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)cai_session=([^;]+)/);
	return match?.[1] ? decodeURIComponent(match[1]) : "";
}

async function handleAuth(
	pathname: string,
	request: Request,
	deps: {
		origin: string;
		keys: TestIdentityKeys;
		challenges: Map<string, { email: string; code: string; subjectId: string }>;
		sessions: Map<string, { email: string; subjectId: string }>;
	},
): Promise<Response> {
	const body = await readJson(request);
	if (pathname === "/auth/edaya/otp/start") {
		const acceptance = body.termsAcceptance as { version?: string; locale?: string; accepted?: boolean } | undefined;
		if (acceptance?.accepted !== true || acceptance.locale !== 'fr') return json({ code: 'terms_acceptance_required' }, 400);
		if (acceptance.version !== 'spark-terms-v1') return json({ code: 'terms_version_changed' }, 409);
		const email = typeof body.value === "string" ? body.value.trim().toLowerCase() : "";
		const subjectId = subjectForEmail(email);
		if (!subjectId) return json({ message: "Compte introuvable" }, 404);
		const challenge = crypto.randomUUID();
		deps.challenges.set(challenge, {
			email,
			code: String(100000 + Math.floor(Math.random() * 900000)),
			subjectId,
		});
		return json({ state: "primary_required", challenge });
	}
	if (pathname === "/auth/edaya/testing/otp") {
		const challenge = typeof body.challenge === "string" ? deps.challenges.get(body.challenge) : undefined;
		if (!challenge) return json({ message: "Code indisponible" }, 404);
		return json({ otp: challenge.code });
	}
	if (pathname === "/auth/edaya/otp/verify") {
		const challengeId = typeof body.challenge === "string" ? body.challenge : "";
		const challenge = deps.challenges.get(challengeId);
		const code = typeof body.code === "string" ? body.code.trim() : "";
		if (!challenge || code !== challenge.code) return json({ message: "Code refusé" }, 401);
		const sessionId = crypto.randomUUID();
		deps.sessions.set(sessionId, { email: challenge.email, subjectId: challenge.subjectId });
		return json(
			{ state: "complete", user: { id: challenge.subjectId, email: challenge.email } },
			200,
			`cai_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`,
		);
	}
	const session = deps.sessions.get(sessionIdFrom(request));
	if (!session) return json({ message: "Session absente" }, 401);
	if (pathname === "/auth/edaya/session") {
		return json({ user: { id: session.subjectId, email: session.email } });
	}
	if (pathname === "/auth/edaya/access-token") {
		const accessToken = await signParent(deps.keys, deps.origin, session.subjectId, session.email);
		return json({
			accessToken,
			expiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
		});
	}
	return json({ message: "Not found" }, 404);
}

function signParent(
	keys: TestIdentityKeys,
	origin: string,
	subjectId: string,
	email: string,
): Promise<string> {
	return signTestIdentityToken(keys, {
		sub: subjectId,
		email,
		iss: origin,
		aud: origin,
	});
}

function json(body: unknown, status = 200, setCookie?: string): Response {
	const headers = new Headers({ connection: "close" });
	if (setCookie) headers.set("set-cookie", setCookie);
	return Response.json(body, { status, headers });
}

function methodNotAllowed(): Response {
	return json({ message: "Method not allowed" }, 405);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const parsed: unknown = await request.json();
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		return {};
	}
	return {};
}
