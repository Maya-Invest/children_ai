import { createIdentityClient, type IdentityClient } from "@maya-invest/edaya-identity-client";

export type IdentityEnv = {
	IDENTITY_ISSUER?: string;
	IDENTITY_JWKS_URL?: string;
	IDENTITY_DIRECTORY_SECRET?: string;
	CHILDREN_API_ORIGIN?: string;
	PUBLIC_API_URL?: string;
};

export function canonicalHttpOrigin(value: string): string {
	const parsed = new URL(value);
	if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
		throw new Error("Invalid API origin");
	}
	return parsed.origin;
}

export function createIdentityVerifier(env: IdentityEnv = process.env as IdentityEnv): IdentityClient {
	const issuer = (env.IDENTITY_ISSUER ?? "http://localhost:9900").replace(/\/+$/, "");
	const audience = canonicalHttpOrigin(
		env.CHILDREN_API_ORIGIN || env.PUBLIC_API_URL || "http://localhost:8787",
	);
	return createIdentityClient({
		issuer,
		audience,
		jwksUrl: env.IDENTITY_JWKS_URL ?? `${issuer}/.well-known/jwks.json`,
		directoryBaseUrl: issuer,
		directorySecret: env.IDENTITY_DIRECTORY_SECRET ?? "local-directory-secret",
	});
}
