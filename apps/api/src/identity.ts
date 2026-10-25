import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

export interface IdentityClaims {
	auth_time?: number;
	mfa_time?: number;
	amr?: string[];
	sub: string;
	email?: string;
	phone?: string;
	email_verified?: boolean;
	phone_verified?: boolean;
	sid?: string;
}

export class IdentityTokenError extends Error {
	readonly code: "invalid" | "expired" | "audience" | "issuer" | "claims";

	constructor(code: IdentityTokenError["code"], message: string) {
		super(message);
		this.name = "IdentityTokenError";
		this.code = code;
	}
}

export interface VerifyIdentityTokenOptions {
	issuer: string;
	audience: string;
	jwks: JSONWebKeySet;
	clockTolerance?: number;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function normalizePhone(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.startsWith("+") ? trimmed : undefined;
}

/** Same evidence rules as the unified Edaya API verifier. */
export async function verifyIdentityToken(
	token: string,
	options: VerifyIdentityTokenOptions,
): Promise<IdentityClaims> {
	if (!token || token.split(".").length !== 3) {
		throw new IdentityTokenError("invalid", "Identity token must be a compact JWS");
	}

	let payload;
	try {
		const verified = await jwtVerify(token, createLocalJWKSet(options.jwks), {
			algorithms: ["ES256"],
			issuer: options.issuer,
			audience: options.audience,
			clockTolerance: options.clockTolerance ?? 0,
		});
		payload = verified.payload;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Identity token verification failed";
		if (message.toLowerCase().includes("expir")) {
			throw new IdentityTokenError("expired", message);
		}
		if (message.toLowerCase().includes("audience") || message.toLowerCase().includes("\"aud\"")) {
			throw new IdentityTokenError("audience", message);
		}
		if (message.toLowerCase().includes("issuer") || message.toLowerCase().includes("\"iss\"")) {
			throw new IdentityTokenError("issuer", message);
		}
		throw new IdentityTokenError("invalid", message);
	}

	const sub = optionalString(payload.sub);
	if (!sub) {
		throw new IdentityTokenError("claims", "Identity token is missing sub");
	}

	const email = optionalString(payload["email"]);
	const phone = normalizePhone(optionalString(payload["phone"]));
	const authTime = payload["auth_time"];
	const mfaTime = payload["mfa_time"];
	const methods = payload["amr"];
	if (
		typeof payload.iat !== "number"
		|| typeof payload.exp !== "number"
		|| payload.exp - payload.iat > 300
		|| typeof authTime !== "number"
		|| !Number.isInteger(authTime)
		|| authTime < 0
		|| authTime > payload.iat
		|| !Array.isArray(methods)
		|| !methods.every((method) => typeof method === "string")
		|| methods.length === 0
		|| (mfaTime !== undefined && (typeof mfaTime !== "number" || !Number.isInteger(mfaTime) || mfaTime < authTime || mfaTime > payload.iat || !methods.includes("totp")))
		|| (methods.includes("totp") && mfaTime === undefined)
	) {
		throw new IdentityTokenError("claims", "Invalid authentication evidence");
	}

	return {
		sub,
		auth_time: authTime,
		amr: methods,
		...(typeof mfaTime === "number" ? { mfa_time: mfaTime } : {}),
		...(email ? { email } : {}),
		...(phone ? { phone } : {}),
		...(optionalBoolean(payload["email_verified"]) !== undefined
			? { email_verified: payload["email_verified"] as boolean }
			: {}),
		...(optionalBoolean(payload["phone_verified"]) !== undefined
			? { phone_verified: payload["phone_verified"] as boolean }
			: {}),
		...(optionalString(payload["sid"]) ? { sid: optionalString(payload["sid"]) } : {}),
	};
}

export type IdentityEnv = {
	EDAYA_API_ORIGIN?: string;
	IDENTITY_JWKS_URL?: string;
};

export function canonicalHttpOrigin(value: string): string {
	const parsed = new URL(value);
	if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
		throw new Error("Invalid API origin");
	}
	return parsed.origin;
}

export function createIdentityVerifier(env: IdentityEnv = process.env as IdentityEnv) {
	const issuer = canonicalHttpOrigin(env.EDAYA_API_ORIGIN || "http://localhost:9999");
	let cachedJwks: { value: JSONWebKeySet; expiresAt: number } | undefined;

	async function loadJwks(): Promise<JSONWebKeySet> {
		const now = Date.now();
		if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.value;
		const jwksUrl = env.IDENTITY_JWKS_URL ?? `${issuer}/.well-known/jwks.json`;
		const response = await fetch(jwksUrl, { method: "GET" });
		if (!response.ok) {
			throw new Error(`Failed to fetch identity JWKS (${response.status})`);
		}
		const value = (await response.json()) as JSONWebKeySet;
		cachedJwks = { value, expiresAt: now + 60_000 };
		return value;
	}

	return {
		async verifyAccessToken(token: string): Promise<IdentityClaims> {
			return verifyIdentityToken(token, {
				issuer,
				audience: issuer,
				jwks: await loadJwks(),
			});
		},
	};
}
