import type {
	EdayaContextPort,
	EdayaCredentialsPort,
	LearnerContext,
	LearnerContextQuery,
	Palier,
} from "@children-ai/domain";
import {
	assertEdayaOriginAllowed,
	resolvePalierEdayaOrigin,
	SchoolIntegrationMissingError,
} from "@children-ai/domain";
import {
	FixtureEdayaContext,
	FIXTURE_ACADEMIC_YEAR_ID,
	FIXTURE_SCHOOL_ID,
} from "./edaya-fixture.ts";
import {
	assertProdRejectsDemoSeed,
	resolveEdayaContextMode,
	type EdayaContextMode,
} from "./edaya-context-mode.ts";
import { HttpEdayaContext, type EdayaFetch } from "./edaya-http.ts";
import {
	demoSchoolCredentials,
	MemorySchoolIntegrationVault,
} from "./school-integration-vault.ts";
import { FixtureGuardianChildrenPort } from "./access-fixture.ts";

/**
 * Resolves the school's EDAYA credentials on this palier, then delegates.
 * Inner adaptor (fixture or HTTP) never receives a palier-wide key.
 */
export class SchoolScopedEdayaContext implements EdayaContextPort {
	constructor(
		private readonly palier: Palier,
		private readonly credentials: EdayaCredentialsPort,
		private readonly inner: EdayaContextPort,
	) {}

	async pullLearnerContext(query: LearnerContextQuery): Promise<LearnerContext> {
		const active = await this.credentials.getActive(query.schoolId);
		if (!active) throw new SchoolIntegrationMissingError(query.schoolId);
		assertEdayaOriginAllowed(this.palier, active.integration.edayaApiBaseUrl);
		return this.inner.pullLearnerContext(query);
	}
}

export type CreateSchoolEdayaOptions = {
	palier?: Palier;
	schoolId?: string;
	edayaApiBaseUrl?: string;
	academicYearId?: string;
	apiKey?: string;
	contextMode?: string;
	credentials?: MemorySchoolIntegrationVault | EdayaCredentialsPort;
	fetchImpl?: EdayaFetch;
	seedDemoSchool?: boolean;
};

export function createSchoolEdayaStack(options: CreateSchoolEdayaOptions = {}) {
	const palier = options.palier ?? "in-memory";
	const shouldSeed = options.seedDemoSchool ?? palier !== "prod";
	assertProdRejectsDemoSeed(palier, {
		demoApiKey: options.apiKey,
		seedDemoSchool: shouldSeed && palier === "prod",
	});
	const edayaApiBaseUrl = resolvePalierEdayaOrigin(palier, options.edayaApiBaseUrl);
	const schoolId = options.schoolId?.trim() || FIXTURE_SCHOOL_ID;
	const apiKey = options.apiKey;
	const contextMode = resolveEdayaContextMode(palier, options.contextMode, apiKey);
	const vault = options.credentials ?? new MemorySchoolIntegrationVault();
	if (shouldSeed && "put" in vault && typeof vault.put === "function") {
		vault.put(
			demoSchoolCredentials({
				schoolId,
				edayaApiBaseUrl,
				academicYearId: options.academicYearId ?? FIXTURE_ACADEMIC_YEAR_ID,
				apiKey,
			}),
		);
	}

	const inner: EdayaContextPort =
		contextMode === "http"
			? new HttpEdayaContext({
					credentials: vault,
					schoolId,
					fetchImpl: options.fetchImpl,
				})
			: new FixtureEdayaContext();

	const children =
		contextMode === "http" && inner instanceof HttpEdayaContext
			? inner
			: new FixtureGuardianChildrenPort(schoolId);

	return {
		palier,
		schoolId,
		vault,
		contextMode,
		children,
		edaya: new SchoolScopedEdayaContext(palier, vault, inner),
	};
}

export function createDemoEdayaContext(options: {
	palier?: Palier;
	schoolId?: string;
	edayaApiBaseUrl?: string;
	academicYearId?: string;
	apiKey?: string;
	contextMode?: EdayaContextMode | string;
	fetchImpl?: EdayaFetch;
} = {}) {
	return createSchoolEdayaStack({
		...options,
		contextMode: options.contextMode ?? "fixture",
		seedDemoSchool: true,
	});
}
