import type {
	EdayaContextPort,
	EdayaCredentialsPort,
	LearnerContext,
	LearnerContextQuery,
	Palier,
	SchoolCredentials,
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
	isLocalFixtureApiKey,
	resolveEdayaContextMode,
	type EdayaContextMode,
} from "./edaya-context-mode.ts";
import { HttpEdayaContext, type EdayaFetch } from "./edaya-http.ts";
import {
	demoSchoolCredentials,
	LocalDerivingCredentialsPort,
	MemorySchoolIntegrationVault,
} from "./school-integration-vault.ts";
import { EmptyGuardianChildrenPort } from "./access-fixture.ts";

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

/** Demo-issued codes use fixture academic data; Identity/live codes use HTTP/S2S. */
export class DualEdayaContext implements EdayaContextPort {
	constructor(
		private readonly live: EdayaContextPort,
		private readonly fixture: EdayaContextPort,
	) {}

	async pullLearnerContext(query: LearnerContextQuery): Promise<LearnerContext> {
		if (query.contextSource === "fixture") {
			return this.fixture.pullLearnerContext(query);
		}
		const live = await this.live.pullLearnerContext(query);
		if ((live.timetable?.length ?? 0) > 0) return live;
		try {
			const fallback = await this.fixture.pullLearnerContext(query);
			if ((fallback.timetable?.length ?? 0) === 0) return live;
			return { ...live, timetable: fallback.timetable };
		} catch {
			return live;
		}
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
	resolveGuardianSecret?: string;
	deriveLocalS2sKey?: boolean;
};

export function createSchoolEdayaStack(options: CreateSchoolEdayaOptions = {}) {
	const palier = options.palier ?? "in-memory";
	const shouldSeed = options.seedDemoSchool ?? palier !== "prod";
	assertProdRejectsDemoSeed(palier, {
		demoApiKey: options.apiKey,
		seedDemoSchool: shouldSeed && palier === "prod",
	});
	const configuredOrigin = options.edayaApiBaseUrl;
	const edayaApiBaseUrl = resolvePalierEdayaOrigin(palier, configuredOrigin);
	const schoolId = options.schoolId?.trim() || FIXTURE_SCHOOL_ID;
	const apiKey = options.apiKey;
	const contextMode = resolveEdayaContextMode(
		palier,
		options.contextMode,
		apiKey,
		configuredOrigin,
	);
	const innerVault = options.credentials ?? new MemorySchoolIntegrationVault();
	const liveApiKey = apiKey?.trim() ?? "";
	const mutable = isMutableVault(innerVault);
	const shouldPutDemoRow =
		shouldSeed
		&& mutable
		&& (
			contextMode === "fixture"
			|| (Boolean(liveApiKey) && !isLocalFixtureApiKey(liveApiKey))
		);
	const ready =
		shouldPutDemoRow && mutable
			? Promise.resolve(
					innerVault.put(
						demoSchoolCredentials({
							schoolId,
							edayaApiBaseUrl,
							academicYearId: options.academicYearId ?? FIXTURE_ACADEMIC_YEAR_ID,
							apiKey,
						}),
					),
				)
			: Promise.resolve();

	const deriveLocalS2sKey = options.deriveLocalS2sKey ?? palier === "local";
	const vault =
		deriveLocalS2sKey && mutable
			? new LocalDerivingCredentialsPort(innerVault, {
					edayaApiBaseUrl,
					academicYearId: options.academicYearId ?? FIXTURE_ACADEMIC_YEAR_ID,
				})
			: innerVault;

	const fixture = new FixtureEdayaContext();
	const liveInner: EdayaContextPort =
		contextMode === "http"
			? new HttpEdayaContext({
					credentials: vault,
					fetchImpl: options.fetchImpl,
					resolveGuardian: {
						origin: edayaApiBaseUrl,
						secret: options.resolveGuardianSecret ?? "",
					},
				})
			: fixture;

	const children =
		contextMode === "http" && liveInner instanceof HttpEdayaContext
			? liveInner
			: new EmptyGuardianChildrenPort();

	return {
		palier,
		schoolId,
		vault,
		ready,
		contextMode,
		children,
		edaya: new DualEdayaContext(
			new SchoolScopedEdayaContext(palier, vault, liveInner),
			fixture,
		),
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
	resolveGuardianSecret?: string;
} = {}) {
	return createSchoolEdayaStack({
		...options,
		contextMode: options.contextMode ?? "fixture",
		seedDemoSchool: true,
		deriveLocalS2sKey: false,
	});
}

function isMutableVault(
	value: EdayaCredentialsPort,
): value is EdayaCredentialsPort & { put: (record: SchoolCredentials) => void | Promise<void> } {
	return "put" in value && typeof (value as { put?: unknown }).put === "function";
}
