import {
	DAILY_PRACTICE_MAX_MINUTES,
	DAILY_PRACTICE_MIN_MINUTES,
	ExerciseGenerationError,
	NothingToPracticeError,
	PRACTICE_INTENT_MESSAGE,
	PRACTICE_MINUTES_MESSAGE,
	PRACTICE_NO_PROGRAMME_MESSAGE,
	PRACTICE_NO_PROPOSALS_MESSAGE,
	PRACTICE_TIMETABLE_MISMATCH_MESSAGE,
	PRACTICE_UNREADABLE_MESSAGE,
	PracticePlanError,
	composeSessionPlan,
	displaySubjectLabel,
	endOfDaySnapshotLessons,
	revisionLessonsForDay,
	splitMinutes,
	exerciseProposalInstruction,
	distinctMcqChoices,
	questionKind,
	scanPracticeWindow,
	upcomingSnapshotLessons,
	type Clock,
	type CurriculumLesson,
	type ExerciseGeneratorPort,
	type ExerciseProposal,
	type ExerciseQuestion,
	type ExerciseSet,
	type IdGenerator,
	type LearnerAcademicSnapshot,
	type PracticeFocus,
	type PracticeFocusPort,
	type PracticeFocusRequest,
	type PracticeRecommendation,
	type PracticeSessionPlan,
} from "@children-ai/domain";
import { loadPracticePrompts, PRACTICE_PROMPT_VERSION } from "./prompts/load-practice-prompts.ts";

export const DEFAULT_FOCUS_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
//export const DEFAULT_FOCUS_MODEL = "google-ai-studio/gemini-3.6-flash";
//export const DEFAULT_RAG_GENERATOR_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const DEFAULT_RAG_GENERATOR_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const DEFAULT_RAG_PACK_VERSION = "cloudflare-rag";
export const AI_SEARCH_PACK_VERSION = "ai-search";
export const RAG_FOCUS_PROMPT_VERSION = PRACTICE_PROMPT_VERSION;
export const RAG_GENERATOR_PROMPT_VERSION = PRACTICE_PROMPT_VERSION;

export type RagHit = {
	text: string;
};

export type RagChatResult = {
	text: string;
	hits: RagHit[];
};

export type RagClient = {
	chat(input: { model: string; system: string; user: string }): Promise<RagChatResult>;
};

export type CloudflareFetch = (input: string, init: RequestInit) => Promise<Response>;

export type CloudflareRagConfig = {
	accountId?: string;
	apiToken?: string;
	namespace?: string;
	instance?: string;
	/** Stored AI Gateway key alias, sent as cf-aig-byok-alias. */
	byokAlias?: string;
	fetchImpl?: CloudflareFetch;
};

export function createCloudflareRagClient(config: CloudflareRagConfig): RagClient {
	const instance = config.instance?.trim() ?? "";
	const namespace = config.namespace?.trim() ?? "";
	const accountId = config.accountId?.trim() ?? "";
	const apiToken = config.apiToken?.trim() ?? "";
	if (!instance) {
		throw new Error("CLOUDFLARE_RAG_INSTANCE is required for a Cloudflare RAG client.");
	}
	if (!namespace) {
		throw new Error("CLOUDFLARE_RAG_NAMESPACE is required for a Cloudflare RAG client.");
	}
	if (!accountId || !apiToken) {
		throw new Error("Cloudflare RAG requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
	}
	return httpClient({
		accountId,
		apiToken,
		namespace,
		instance,
		byokAlias: config.byokAlias?.trim() ?? "",
		fetchImpl: config.fetchImpl ?? fetch,
	});
}

export class CloudflarePracticeFocus implements PracticeFocusPort {
	constructor(
		private readonly options: {
			rag: RagClient;
			model: string;
		},
	) {
		if (!options.rag || !options.model.trim()) {
			throw new Error("FOCUS=cloudflare requires a RAG client and a focus model.");
		}
	}

	packVersion(): string {
		return AI_SEARCH_PACK_VERSION;
	}

	promptVersion(): string {
		return PRACTICE_PROMPT_VERSION;
	}

	async recommend(input: PracticeFocusRequest): Promise<PracticeRecommendation> {
		const plan = await this.plan(input);
		const chosen = plan.tracks.find((track) => track.available && track.focus && track.lesson);
		if (!chosen?.focus || !chosen.lesson) throw new NothingToPracticeError();
		return { focus: chosen.focus, lesson: chosen.lesson };
	}

	async plan(input: PracticeFocusRequest): Promise<PracticeSessionPlan> {
		const now = input.now ?? new Date();
		const context = input.snapshot.context;
		const progress = context.classProgress ?? [];
		const grade = context.student.grade;
		const window = scanPracticeWindow(input.snapshot, now);
		const timetable = context.timetable ?? [];
		const revisionMatches = endOfDaySnapshotLessons(window, progress, grade);
		const homeworkMatches = upcomingSnapshotLessons(window, timetable, progress, grade);
		if (revisionMatches.length === 0 && homeworkMatches.length === 0) {
			return stampPromptVersion(composeSessionPlan({ snapshot: input.snapshot, revision: null, homework: null }));
		}

		const sessionMinutes = input.sessionMinutes ?? {
			min: DAILY_PRACTICE_MIN_MINUTES,
			max: DAILY_PRACTICE_MAX_MINUTES,
		};
		let sawProgramme = false;
		for (let attempt = 0; attempt < 2; attempt++) {
			const reply = await this.options.rag.chat({
				model: this.options.model,
				system: await focusSystemPrompt(),
				user: await focusUserPrompt(input.snapshot, window, revisionMatches, homeworkMatches, sessionMinutes),
			});
			if (reply.hits.length > 0) sawProgramme = true;
			if (!sawProgramme) {
				throw new ExerciseGenerationError(PRACTICE_NO_PROGRAMME_MESSAGE);
			}
			try {
				return stampPromptVersion(acceptPracticePlan({
					payload: parseJson(reply.text, PRACTICE_UNREADABLE_MESSAGE),
					snapshot: input.snapshot,
					today: window.today,
					revisionMatches,
					homeworkMatches,
				}));
			} catch (error) {
				const unreadable = (error instanceof PracticePlanError || error instanceof ExerciseGenerationError)
					&& error.message === PRACTICE_UNREADABLE_MESSAGE;
				if (!unreadable || attempt === 1) {
					if (unreadable) console.error("practice plan unreadable", reply.text.length, JSON.stringify(reply.text.slice(-180)));
					throw error;
				}
			}
		}
		throw new PracticePlanError(PRACTICE_UNREADABLE_MESSAGE);
	}
}

export class CloudflareRagExerciseGenerator implements ExerciseGeneratorPort {
	constructor(
		private readonly options: {
			rag: RagClient;
			model: string;
			ids: IdGenerator;
			clock: Clock;
		},
	) {}

	async generate(input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
		plannedMinutes: number;
	}): Promise<ExerciseSet> {
		const proposals = requireProposals(input.focus);
		const questions: ExerciseQuestion[] = [];
		let sawProgramme = false;
		for (let attempt = 0; attempt < 2 && questions.length < proposals.length; attempt++) {
			const pending = proposals.slice(questions.length);
			const reply = await this.options.rag.chat({
				model: this.options.model,
				system: await exerciseSystemPrompt(input.lesson, exerciseProposalInstruction(pending)),
				user: await exerciseUserPrompt({
					snapshot: input.snapshot,
					lesson: input.lesson,
					focus: { ...input.focus, proposals: pending },
					plannedMinutes: input.plannedMinutes,
				}),
			});
			if (reply.hits.length > 0) sawProgramme = true;
			if (!sawProgramme) {
				throw new ExerciseGenerationError("Le RAG n'a renvoyé aucun extrait pour cette leçon.");
			}
			try {
				const mapped = mapQuestions(parseJson(reply.text), this.options.ids, pending.length);
				questions.push(...mapped.questions);
			} catch (error) {
				if (questions.length === 0) throw error;
			}
		}
		if (questions.length === 0) {
			throw new ExerciseGenerationError("Le modèle d'exercices n'a pas produit assez de questions.");
		}
		return {
			id: this.options.ids.next(),
			snapshotId: input.snapshot.id,
			schoolId: input.snapshot.schoolId,
			studentId: input.snapshot.studentId,
			lessonId: input.lesson.id,
			generatedAt: this.options.clock.nowIso(),
			generator: "llm",
			promptVersion: `${RAG_GENERATOR_PROMPT_VERSION}:${this.options.model}`,
			questions,
		};
	}
}

function stampPromptVersion(plan: PracticeSessionPlan): PracticeSessionPlan {
	return { ...plan, promptVersion: PRACTICE_PROMPT_VERSION };
}

async function focusSystemPrompt(): Promise<string> {
	const prompts = await loadPracticePrompts();
	return prompts.fill("focus-system");
}

async function focusUserPrompt(
	snapshot: LearnerAcademicSnapshot,
	window: ReturnType<typeof scanPracticeWindow>,
	revisionMatches: ReturnType<typeof endOfDaySnapshotLessons>,
	homeworkMatches: ReturnType<typeof upcomingSnapshotLessons>,
	sessionMinutes: { min: number; max: number },
): Promise<string> {
	const prompts = await loadPracticePrompts();
	const student = snapshot.context.student;
	const revisionLines = revisionMatches.map((match) =>
		`${match.lesson.id} | ${match.lesson.title} | ${match.slot.dayOfWeek} ${match.slot.startTime} ${match.slot.title} | thème ${match.lesson.theme.title} | habiletés ${match.lesson.skills.join(", ")}`,
	);
	const homeworkLines = homeworkMatches.map((match) =>
		`${match.lesson.id} | ${match.assessment.title} le ${match.assessment.dueAt.slice(0, 10)} | emploi du temps ${match.slot.title} | thème ${match.lesson.theme.title}`,
	);
	return prompts.fill("focus-user", {
		studentName: student.firstName,
		classLabel: student.classLabel,
		grade: student.grade,
		minMinutes: String(sessionMinutes.min),
		maxMinutes: String(sessionMinutes.max),
		planningDate: window.planningDate,
		today: window.today,
		todayLessons: slotLine(window.todayLessons),
		nextDay: window.nextDay,
		nextDayLessons: slotLine(window.nextDayLessons),
		revisionBlock: revisionLines.length > 0
			? prompts.fill("focus-revision-list", { lines: revisionLines.join("\n") })
			: prompts.fill("focus-revision-empty"),
		homeworkBlock: homeworkLines.length > 0
			? prompts.fill("focus-homework-list", { lines: homeworkLines.join("\n") })
			: prompts.fill("focus-homework-empty"),
	});
}

function slotLine(slots: { startTime: string; title: string }[]): string {
	if (slots.length === 0) return "aucune leçon";
	return slots.map((slot) => `${slot.startTime} ${slot.title}`).join(" ; ");
}

function acceptPracticePlan(input: {
	payload: unknown;
	snapshot: LearnerAcademicSnapshot;
	today: ReturnType<typeof scanPracticeWindow>["today"];
	revisionMatches: ReturnType<typeof endOfDaySnapshotLessons>;
	homeworkMatches: ReturnType<typeof upcomingSnapshotLessons>;
}): PracticeSessionPlan {
	const root = planRoot(input.payload);
	if (!root) throw new PracticePlanError(PRACTICE_UNREADABLE_MESSAGE);
	const revisionAllowed = input.revisionMatches.length > 0;
	const homeworkAllowed = input.homeworkMatches.length > 0;
	const revision = presentTrack(
		readNamedTrack(root, ["revision", "révision", "prepare_next_day"], "prepare_next_day"),
		revisionAllowed,
		"prepare_next_day",
	);
	const homework = presentTrack(
		readNamedTrack(root, ["homework", "devoir", "upcoming_work"], "upcoming_work"),
		homeworkAllowed,
		"upcoming_work",
	);
	if (revision.intent !== "prepare_next_day" || homework.intent !== "upcoming_work") {
		throw new PracticePlanError(PRACTICE_INTENT_MESSAGE);
	}

	if (revision.available !== revisionAllowed || homework.available !== homeworkAllowed) {
		throw new PracticePlanError(PRACTICE_TIMETABLE_MISMATCH_MESSAGE);
	}
	if (!revision.available && revision.minutes !== 0) throw new PracticePlanError(PRACTICE_MINUTES_MESSAGE);
	if (!homework.available && homework.minutes !== 0) throw new PracticePlanError(PRACTICE_MINUTES_MESSAGE);

	const revisionSeriesItems = revision.available
		? proposalsNameLessons(revision)
			? seriesFromProposals(revision, input.revisionMatches)
			: revisionSeries(
				revision,
				resolveTrack(revision, input.revisionMatches),
				revisionLessonsForDay(input.revisionMatches, input.today),
			)
		: [];
	const homeworkSeries = homework.available
		? proposalsNameLessons(homework)
			? seriesFromProposals(homework, input.homeworkMatches)
			: [resolveTrack(homework, input.homeworkMatches)]
		: [];
	const homeworks = homeworkSeries.flatMap((choice) => {
		const assessment = input.homeworkMatches.find((match) => match.lesson.id === choice.lesson.id)?.assessment;
		return assessment ? [{ ...choice, assessment }] : [];
	});
	if (homework.available && homeworks.length === 0) throw new PracticePlanError(PRACTICE_TIMETABLE_MISMATCH_MESSAGE);

	return composeSessionPlan({
		snapshot: input.snapshot,
		revision: revisionSeriesItems[0] ?? null,
		revisions: revisionSeriesItems,
		homework: homeworks[0] ?? null,
		homeworks,
	});
}

function revisionSeries(
	track: ParsedTrack,
	chosen: { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number } | null,
	matches: ReturnType<typeof endOfDaySnapshotLessons>,
): { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number }[] {
	const slices = splitMinutes(track.minutes, matches.length);
	return matches.flatMap((match, index) => {
		const minutes = slices[index] ?? 0;
		if (minutes <= 0) return [];
		if (chosen && chosen.lesson.id === match.lesson.id) {
			return [{
				lesson: match.lesson,
				minutes,
				focus: {
					...chosen.focus,
					proposals: fitProposals(chosen.focus.proposals, minutes),
				},
			}];
		}
		const subject = match.slot.title || match.lesson.subject;
		return [{
			lesson: match.lesson,
			minutes,
			focus: {
				lessonId: match.lesson.id,
				subject: match.lesson.subject,
				rationale: track.rationale || `Emploi du temps : « ${subject} ».`,
				brief: track.brief || `Série pour « ${match.lesson.title} ».`,
				intent: "prepare_next_day",
				proposals: [{
					objective: match.lesson.title,
					theme: match.lesson.theme.title || subject,
					exerciseType: "comprehension",
					difficulty: "medium",
					minutes,
					promptHint: match.lesson.title,
				}],
			},
		}];
	});
}

type PlannedProposal = ExerciseProposal & {
	lessonId?: string;
	grounding?: string;
};

type ParsedTrack = {
	available: boolean;
	minutes: number;
	lessonId: string;
	rationale: string;
	brief: string;
	intent: "prepare_next_day" | "upcoming_work";
	proposals: PlannedProposal[];
};

function proposalsNameLessons(track: ParsedTrack): boolean {
	return track.proposals.some((proposal) => Boolean(proposal.lessonId));
}

function seriesFromProposals(
	track: ParsedTrack,
	matches: { lesson: CurriculumLesson }[],
): { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number }[] {
	const groups = new Map<string, PlannedProposal[]>();
	const order: string[] = [];
	for (const proposal of track.proposals) {
		const lessonId = proposal.lessonId;
		if (!lessonId || !matches.some((match) => match.lesson.id === lessonId)) continue;
		const group = groups.get(lessonId);
		if (group) {
			group.push(proposal);
			continue;
		}
		groups.set(lessonId, [proposal]);
		order.push(lessonId);
	}
	if (order.length === 0) throw new PracticePlanError(PRACTICE_TIMETABLE_MISMATCH_MESSAGE);
	return order.flatMap((lessonId) => {
		const lesson = matches.find((match) => match.lesson.id === lessonId)?.lesson;
		const grouped = groups.get(lessonId);
		if (!lesson || !grouped) return [];
		const proposals = grouped.map(publishedProposal);
		return [{
			lesson,
			minutes: proposals.reduce((sum, proposal) => sum + proposal.minutes, 0),
			focus: {
				lessonId: lesson.id,
				subject: lesson.subject,
				rationale: track.rationale || `Entraînement sur « ${lesson.title} ».`,
				brief: track.brief || `Série pour « ${lesson.title} ».`,
				intent: track.intent,
				proposals,
			},
		}];
	});
}

function publishedProposal(proposal: PlannedProposal): ExerciseProposal {
	const promptHint = proposal.grounding === "candidate_only"
		? `${proposal.promptHint} Reste sur les informations du candidat, sans ajouter d'objectif officiel DPFC.`
		: proposal.promptHint;
	return {
		objective: proposal.objective,
		theme: proposal.theme,
		exerciseType: proposal.exerciseType,
		difficulty: proposal.difficulty,
		minutes: proposal.minutes,
		promptHint,
	};
}

function planRoot(payload: unknown): Record<string, unknown> | undefined {
	const root = asRecord(payload);
	if (!root) return undefined;
	if (root.revision || root.homework || root.devoir || root["révision"]) return root;
	for (const key of ["plan", "result", "session", "recommendation"]) {
		const nested = asRecord(root[key]);
		if (nested?.revision || nested?.homework || nested?.devoir) return nested;
	}
	return root;
}

function readNamedTrack(
	root: Record<string, unknown>,
	names: string[],
	intent: ParsedTrack["intent"],
): ParsedTrack | "missing" | null {
	let found = false;
	for (const name of names) {
		if (!(name in root)) continue;
		found = true;
		const track = readTrack(root[name], intent);
		if (track) return track;
	}
	return found ? null : "missing";
}

function presentTrack(
	track: ParsedTrack | "missing" | null,
	allowed: boolean,
	intent: ParsedTrack["intent"],
): ParsedTrack {
	if (track === "missing" && !allowed) return emptyTrack(intent);
	if (!track || track === "missing") throw new PracticePlanError(PRACTICE_UNREADABLE_MESSAGE);
	return track;
}

function emptyTrack(intent: ParsedTrack["intent"]): ParsedTrack {
	return {
		available: false,
		minutes: 0,
		lessonId: "",
		rationale: "",
		brief: "",
		intent,
		proposals: [],
	};
}

function readTrack(value: unknown, intent: ParsedTrack["intent"]): ParsedTrack | null {
	const record = asRecord(value);
	if (!record) return null;
	const proposals = readProposals(record.proposals) ?? [];
	const available = readBool(record.available) ?? (proposals.length > 0 || (readMinutes(record.minutes) ?? 0) > 0);
	const minutes = readMinutes(record.minutes) ?? proposals.reduce((sum, proposal) => sum + proposal.minutes, 0);
	if (record.intent !== undefined && record.intent !== intent) {
		throw new PracticePlanError(PRACTICE_INTENT_MESSAGE);
	}
	if (available && proposals.length === 0) throw new PracticePlanError(PRACTICE_NO_PROPOSALS_MESSAGE);
	if (available && minutes <= 0) throw new PracticePlanError(PRACTICE_MINUTES_MESSAGE);
	return {
		available,
		minutes: available ? minutes : 0,
		lessonId: firstText(record.lessonId, record.lesson) ?? "",
		rationale: firstText(record.rationale, record.reason, record.why) ?? "",
		brief: firstText(record.brief, record.summary, record.description) ?? "",
		intent,
		proposals: available ? proposals : [],
	};
}

function readProposals(value: unknown): PlannedProposal[] | null {
	const list = Array.isArray(value) ? value : value ? [value] : [];
	if (list.length === 0) return null;
	const proposals: PlannedProposal[] = [];
	for (const item of list) {
		const record = asRecord(item);
		if (!record) continue;
		const objective = firstText(record.objective, record.title, record.promptHint, record.prompt);
		const promptHint = firstText(record.promptHint, record.prompt, record.hint, objective);
		const minutes = readMinutes(record.minutes);
		if (!objective || !promptHint || minutes === undefined || minutes <= 0) continue;
		const lessonId = firstText(record.lessonId, record.lesson);
		const grounding = firstText(record.grounding);
		proposals.push({
			objective,
			theme: firstText(record.theme, record.topic) ?? objective,
			exerciseType: firstText(record.exerciseType, record.type) ?? "comprehension",
			difficulty: firstText(record.difficulty) ?? "medium",
			minutes,
			promptHint,
			...(lessonId ? { lessonId } : {}),
			...(grounding ? { grounding } : {}),
		});
	}
	return proposals.length > 0 ? proposals : null;
}

function readBool(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (value === "true" || value === "yes" || value === 1) return true;
	if (value === "false" || value === "no" || value === 0) return false;
	return undefined;
}

function readMinutes(value: unknown): number | undefined {
	const parsed = typeof value === "number"
		? value
		: typeof value === "string" && value.trim()
			? Number(value.trim().replace(",", "."))
			: Number.NaN;
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return Math.round(parsed);
}

function resolveTrack(
	track: ParsedTrack,
	matches: { lesson: CurriculumLesson }[],
): { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number } {
	const lesson = matches.find((match) => match.lesson.id === track.lessonId)?.lesson;
	if (!lesson) throw new PracticePlanError(PRACTICE_TIMETABLE_MISMATCH_MESSAGE);
	return {
		minutes: track.minutes,
		lesson,
		focus: {
			lessonId: lesson.id,
			subject: lesson.subject,
			rationale: track.rationale || `Entraînement sur « ${lesson.title} ».`,
			brief: track.brief || `Série pour « ${lesson.title} ».`,
			intent: track.intent,
			proposals: fitProposals(track.proposals, track.minutes),
		},
	};
}

function fitProposals(proposals: ExerciseProposal[], trackMinutes: number): ExerciseProposal[] {
	if (proposals.length === 0) return proposals;
	const weights = proposals.map((proposal) => Math.max(proposal.minutes, 1));
	const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
	const floors = weights.map((weight) => Math.floor((weight / weightSum) * trackMinutes));
	let leftover = trackMinutes - floors.reduce((sum, minutes) => sum + minutes, 0);
	const ranked = weights
		.map((weight, index) => ({ index, fraction: (weight / weightSum) * trackMinutes - (floors[index] ?? 0) }))
		.sort((left, right) => right.fraction - left.fraction);
	const minutes = [...floors];
	for (const item of ranked) {
		if (leftover <= 0) break;
		minutes[item.index] = (minutes[item.index] ?? 0) + 1;
		leftover -= 1;
	}
	return proposals.map((proposal, index) => ({
		...proposal,
		minutes: Math.max(minutes[index] ?? 0, proposals.length <= trackMinutes ? 1 : 0),
	}));
}

function requireProposals(focus: PracticeFocus): ExerciseProposal[] {
	if (focus.proposals.length === 0) {
		throw new ExerciseGenerationError(PRACTICE_NO_PROPOSALS_MESSAGE);
	}
	return focus.proposals;
}

function httpClient(options: {
	accountId: string;
	apiToken: string;
	namespace: string;
	instance: string;
	byokAlias: string;
	fetchImpl: CloudflareFetch;
}): RagClient {
	const headers = {
		Authorization: `Bearer ${options.apiToken}`,
		"Content-Type": "application/json",
	};
	const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai-search/namespaces/${encodeURIComponent(options.namespace)}/instances/${encodeURIComponent(options.instance)}/chat/completions`);
	if (options.byokAlias) url.searchParams.set("cf-aig-byok-alias", options.byokAlias);
	const endpoint = url.toString();
	return {
		async chat(input) {
			const request = {
				method: "POST",
				headers,
				body: JSON.stringify({
					messages: [
						{ role: "system", content: input.system },
						{ role: "user", content: input.user },
					],
					model: input.model,
					max_completion_tokens: 8192,
					ai_search_options: { retrieval: { max_num_results: 6 } },
				}),
			};
			let response = await options.fetchImpl(endpoint, request);
			if (response.status === 502 || response.status === 503 || response.status === 504) {
				response = await options.fetchImpl(endpoint, request);
			}
			if (!response.ok) {
				const detail = await response.text();
				let message = "";
				try {
					const parsed = JSON.parse(detail) as {
						message?: unknown;
						errors?: Array<{ message?: unknown }>;
						error?: { message?: unknown };
					};
					const listed = Array.isArray(parsed) ? (parsed as Array<{ error?: { message?: unknown } }>)[0]?.error?.message : undefined;
					const raw = parsed.message ?? parsed.errors?.[0]?.message ?? parsed.error?.message ?? listed;
					if (typeof raw === "string" && raw.trim()) message = ` ${raw.trim().slice(0, 240)}`;
				} catch {
					if (detail.trim()) message = ` ${detail.trim().slice(0, 240)}`;
				}
				throw new ExerciseGenerationError(`Le modèle Cloudflare a renvoyé ${response.status}.${message}`);
			}
			return readChat(await response.json());
		},
	};
}

async function exerciseSystemPrompt(lesson: CurriculumLesson, lengthInstruction: string): Promise<string> {
	const prompts = await loadPracticePrompts();
	return prompts.fill("exercise-system", {
		subject: displaySubjectLabel(lesson.subject) || "la matière visée",
		lengthInstruction,
	});
}

async function exerciseUserPrompt(
	input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
		plannedMinutes: number;
	},
): Promise<string> {
	const prompts = await loadPracticePrompts();
	const name = input.snapshot.context.student.firstName;
	return prompts.fill("exercise-user", {
		studentName: name,
		classLabel: input.snapshot.context.student.classLabel,
		grade: input.lesson.grade,
		lessonTitle: input.lesson.title,
		themeTitle: input.lesson.theme.title,
		plannedMinutes: String(input.plannedMinutes),
		rationale: input.focus.rationale,
		proposals: input.focus.proposals.map((proposal) => `${proposal.exerciseType} (${proposal.difficulty}) — ${proposal.promptHint}`).join(" | "),
		skills: input.lesson.skills.join(", "),
		contents: input.lesson.contents.join(", "),
	});
}

function mapQuestions(payload: unknown, ids: IdGenerator, max: number): {
	questions: ExerciseQuestion[];
	rawCount: number;
	drops: Record<string, number>;
} {
	const questionsRaw = readQuestionList(payload);
	if (!questionsRaw) {
		throw new ExerciseGenerationError("Le JSON d'exercices n'a pas de questions.");
	}
	const questions: ExerciseQuestion[] = [];
	const drops: Record<string, number> = {};
	const drop = (reason: string) => {
		drops[reason] = (drops[reason] ?? 0) + 1;
	};
	for (const item of questionsRaw) {
		if (!item || typeof item !== "object") {
			drop("not-object");
			continue;
		}
		const raw = asRecord(item);
		const prompt = firstText(raw?.prompt, raw?.question, raw?.enonce);
		const expected = firstText(raw?.expectedAnswer, raw?.answer, raw?.solution, raw?.correction);
		if (!raw || !prompt) {
			drop(raw ? "empty-prompt" : "not-object");
			continue;
		}
		if (!expected) {
			drop("empty-answer");
			continue;
		}
		const kind = questionKind(typeof raw.kind === "string" ? raw.kind : "written");
		const question: ExerciseQuestion = {
			id: ids.next(),
			kind,
			prompt,
			expectedAnswer: expected,
		};
		if (kind === "mcq") {
			const accepted = Array.isArray(raw.choices)
				? distinctMcqChoices(raw.choices, question.expectedAnswer ?? "")
				: undefined;
			if (!accepted) {
				question.kind = "written";
			} else {
				question.choices = accepted.choices;
				question.expectedAnswer = accepted.expectedAnswer;
			}
		}
		questions.push(question);
		if (questions.length >= max) break;
	}
	return { questions, rawCount: questionsRaw.length, drops };
}

function parseJson(text: string, unreadable = "JSON Cloudflare illisible."): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) throw new ExerciseGenerationError(unreadable);
	try {
		return JSON.parse(text.slice(start, end + 1)) as unknown;
	} catch {
		throw new ExerciseGenerationError(unreadable);
	}
}

function readQuestionList(payload: unknown): unknown[] | undefined {
	if (Array.isArray(payload)) return payload;
	const root = asRecord(payload);
	if (!root) return undefined;
	for (const key of ["questions", "exercises", "exercices", "items"]) {
		if (Array.isArray(root[key])) return root[key];
	}
	return undefined;
}

function readHits(raw: unknown): RagHit[] {
	const root = asRecord(raw);
	const result = asRecord(root?.result) ?? root;
	const lists = [result?.chunks, result?.data, result?.matches, root?.chunks, root?.data];
	const hits: RagHit[] = [];
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const item of list) {
			const record = asRecord(item);
			const text = firstText(record?.text, record?.content, record?.snippet, typeof item === "string" ? item : undefined);
			if (text) hits.push({ text });
		}
	}
	return hits;
}

function readChat(raw: unknown): RagChatResult {
	const root = asRecord(raw);
	const result = asRecord(root?.result) ?? root;
	const choices = result?.choices ?? root?.choices;
	const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined;
	const message = asRecord(first?.message);
	const text = firstText(
		messageContent(message?.content),
		result?.response,
		root?.response,
		result?.text,
		root?.text,
	);
	if (!text) throw new ExerciseGenerationError("Le modèle Cloudflare n'a renvoyé aucun texte.");
	return { text, hits: readHits(raw) };
}

function messageContent(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (!Array.isArray(value)) return undefined;
	const parts = value
		.map((part) => {
			const record = asRecord(part);
			return firstText(record?.text, typeof part === "string" ? part : undefined);
		})
		.filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join("\n") : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function firstText(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

