import {
	ExerciseGenerationError,
	displaySubjectLabel,
	normalizeAnswer,
	questionKind,
	type Clock,
	type CurriculumLesson,
	type ExerciseGeneratorPort,
	type ExerciseQuestion,
	type ExerciseSet,
	type IdGenerator,
	type LearnerAcademicSnapshot,
	type PracticeFocus,
} from "@children-ai/domain";

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-3.5-flash";
export const GEMINI_PROMPT_VERSION = "gemini-flash-v3";

export type GeminiFetch = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export type GeminiFlashOptions = {
	apiKey: string;
	ids: IdGenerator;
	clock: Clock;
	model?: string;
	fetchImpl?: GeminiFetch;
};

type GeminiQuestion = {
	prompt?: unknown;
	kind?: unknown;
	choices?: unknown;
	expectedAnswer?: unknown;
	answer?: unknown;
	solution?: unknown;
	correction?: unknown;
};

type GeminiPayload = {
	questions?: unknown;
};

type GeminiApiResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
	error?: { message?: string };
};

const QUESTION_SCHEMA = {
	type: "object",
	properties: {
		questions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					prompt: { type: "string" },
					kind: { type: "string", enum: ["written", "mcq"] },
					choices: { type: "array", items: { type: "string" } },
					expectedAnswer: { type: "string" },
				},
				required: ["prompt", "kind", "expectedAnswer"],
			},
		},
	},
	required: ["questions"],
};

export class GeminiFlashExerciseGenerator implements ExerciseGeneratorPort {
	private readonly apiKey: string;
	private readonly model: string;
	private readonly fetchImpl: GeminiFetch;

	constructor(private readonly options: GeminiFlashOptions) {
		this.apiKey = options.apiKey.trim();
		if (!this.apiKey) {
			throw new ExerciseGenerationError("GEMINI_API_KEY est vide.");
		}
		this.model = options.model?.trim() || DEFAULT_GEMINI_FLASH_MODEL;
		this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
	}

	async generate(input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
	}): Promise<ExerciseSet> {
		const { snapshot, lesson, focus } = input;
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
		const response = await this.fetchImpl(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": this.apiKey,
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: systemPrompt(lesson) }],
				},
				contents: [
					{
						role: "user",
						parts: [{ text: userPrompt(snapshot, lesson, focus) }],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					responseSchema: QUESTION_SCHEMA,
				},
			}),
		});

		const rawText = await response.text();
		if (!response.ok) {
			throw new ExerciseGenerationError(
				`Gemini Flash a renvoyé ${response.status}.`,
			);
		}

		let api: GeminiApiResponse;
		try {
			api = JSON.parse(rawText) as GeminiApiResponse;
		} catch {
			throw new ExerciseGenerationError("Réponse Gemini illisible.");
		}
		if (api.error?.message) {
			throw new ExerciseGenerationError(api.error.message);
		}

		const text = api.candidates
			?.flatMap((candidate) => candidate.content?.parts ?? [])
			.map((part) => part.text ?? "")
			.join("")
			.trim();
		if (!text) {
			throw new ExerciseGenerationError("Gemini Flash n'a renvoyé aucun texte.");
		}

		const payload = parsePayload(text);
		const questions = mapQuestions(payload, this.options.ids);
		if (questions.length < 3) {
			throw new ExerciseGenerationError(
				"Gemini Flash n'a pas produit assez d'exercices.",
			);
		}

		return {
			id: this.options.ids.next(),
			snapshotId: snapshot.id,
			schoolId: snapshot.schoolId,
			studentId: snapshot.studentId,
			lessonId: lesson.id,
			generatedAt: this.options.clock.nowIso(),
			generator: "llm",
			promptVersion: `${GEMINI_PROMPT_VERSION}:${this.model}`,
			questions,
		};
	}
}

function systemPrompt(lesson: CurriculumLesson): string {
	const subject = displaySubjectLabel(lesson.subject) || "la matière visée";
	return [
		`Tu génères des exercices de ${subject} pour le collège ivoirien, fidèles au programme DPFC.`,
		"Tu n'inventes pas de leçon hors du thème et des habiletés fournis.",
		"Deux types seulement : QCM (kind=mcq) et réponse rédigée (kind=written).",
		"Fournis expectedAnswer pour le scoring interne. Ce n'est jamais montré à l'élève tant qu'un parent n'a pas ouvert le corrigé.",
		"Ne mets pas de champ solution ni correction.",
		"Réponds uniquement en JSON avec le champ questions.",
	].join(" ");
}

function userPrompt(
	snapshot: LearnerAcademicSnapshot,
	lesson: CurriculumLesson,
	focus: PracticeFocus,
): string {
	const name = snapshot.context.student.firstName;
	return [
		`Élève : ${name}, classe ${snapshot.context.student.classLabel} (${lesson.grade}).`,
		`Matière : ${displaySubjectLabel(lesson.subject) || lesson.subject}.`,
		`Leçon officielle : ${lesson.title} (${lesson.theme.title}).`,
		`Pourquoi cette leçon : ${focus.rationale}`,
		`Situation d'apprentissage : ${lesson.exampleSituation}`,
		`Habiletés : ${lesson.skills.join(" | ")}`,
		`Contenus : ${lesson.contents.join(" | ")}`,
		"Produis 4 à 6 questions en français, contextualisées en Côte d'Ivoire.",
		"Mélange QCM et réponses rédigées : au moins 2 kind=mcq et 2 kind=written.",
		"QCM : 3 ou 4 choices, et expectedAnswer identique à l'un des choix.",
		"Réponse rédigée : expectedAnswer courte (une phrase ou une égalité), pour le scoring.",
		"Aucun champ solution ou correction.",
	].join("\n");
}

function parsePayload(text: string): GeminiPayload {
	const stripped = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();
	try {
		return JSON.parse(stripped) as GeminiPayload;
	} catch {
		throw new ExerciseGenerationError("JSON d'exercices invalide.");
	}
}

function mapQuestions(payload: GeminiPayload, ids: IdGenerator): ExerciseQuestion[] {
	if (!Array.isArray(payload.questions)) {
		throw new ExerciseGenerationError("Le JSON Gemini n'a pas de questions.");
	}

	const questions: ExerciseQuestion[] = [];
	for (const item of payload.questions) {
		const raw = item as GeminiQuestion;
		if (typeof raw.prompt !== "string" || raw.prompt.trim() === "") continue;
		const expected = firstString(raw.expectedAnswer, raw.answer, raw.solution);
		if (!expected) continue;
		const kind = questionKind(typeof raw.kind === "string" ? raw.kind : "written");
		const question: ExerciseQuestion = {
			id: ids.next(),
			kind,
			prompt: raw.prompt.trim(),
			expectedAnswer: expected,
		};
		if (kind === "mcq") {
			const choices = Array.isArray(raw.choices)
				? raw.choices.filter(
					(choice): choice is string =>
						typeof choice === "string" && choice.trim() !== "",
				)
				: [];
			const match = choices.find(
				(choice) => normalizeAnswer(choice) === normalizeAnswer(expected),
			);
			if (!match || choices.length < 2) continue;
			question.choices = choices;
			question.expectedAnswer = match;
		}
		questions.push(question);
		if (questions.length >= 6) break;
	}
	return questions;
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim() !== "") return value.trim();
	}
	return undefined;
}
