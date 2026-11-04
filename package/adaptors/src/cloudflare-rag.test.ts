import { describe, expect, test } from "bun:test";
import {
	NOTHING_TO_PRACTICE_MESSAGE,
	PracticePlanError,
	PRACTICE_MINUTES_MESSAGE,
	PRACTICE_NO_PROGRAMME_MESSAGE,
	PRACTICE_TIMETABLE_MISMATCH_MESSAGE,
	type CurriculumLesson,
	type ExerciseProposal,
	type LearnerAcademicSnapshot,
} from "@edaya-spark/domain";
import {
	AI_SEARCH_PACK_VERSION,
	CloudflarePracticeFocus,
	CloudflareRagExerciseGenerator,
	DEFAULT_FOCUS_MODEL,
	DEFAULT_RAG_GENERATOR_MODEL,
	createCloudflareRagClient,
	type RagClient,
} from "./cloudflare-rag.ts";
import { createPracticeFocus, resolveFocusName } from "./focus.ts";
import { createRuntimeClock, CryptoIdGenerator, SystemClock } from "./runtime.ts";
import { StubPracticeFocus } from "./focus-stub.ts";

const snapshot: LearnerAcademicSnapshot = {
	id: "snap-1",
	schoolId: "school",
	studentId: "student-1",
	fingerprint: "abc",
	packVersion: "pack",
	createdAt: "2026-09-07T10:00:00.000Z",
	context: {
		student: {
			edayaStudentId: "student-1",
			firstName: "Léa",
			lastName: "Mercier",
			gradeLevel: { id: "demo-6eme", name: "Sixième", label: "6ème", order: 1, cycle: "Collège" },
			classLabel: "6ème 1",
		},
		academicYearId: "2025-ci",
		periodId: "T1",
		marks: [{ id: "m1", subject: "MATH", title: "Fractions", score: 4, maxScore: 20, date: "2026-09-01" }],
		classProgress: [
			{ subject: "Mathématiques", subjectMatter: "Fractions", completedPercentage: 45, slotId: "math-mon" },
		],
		timetable: [],
		observations: [],
	},
};

const lessonJson = {
	lesson: {
		id: "ci.college.6e.math.fractions",
		title: "Fractions",
		grade: "6e",
		subject: "MATH",
		themeTitle: "Nombres",
		competenceTitle: "Calculs",
		skills: ["Comparer deux fractions"],
		contents: ["Fractions égales"],
		exampleSituation: "Partager un plat.",
	},
	focus: {
		rationale: "La note de fractions est faible.",
		brief: "On revoit les fractions.",
	},
};

const FRACTIONS_ID = "math-mon";
const monday = new Date("2026-10-05T18:00:00.000Z");

function proposals(minutes: number): ExerciseProposal[] {
	const half = Math.floor(minutes / 2);
	return [
		{
			objective: "Comparer deux fractions",
			theme: "Nombres",
			exerciseType: "comprehension",
			difficulty: "medium",
			minutes: half,
			promptHint: "Comparer 1/2 et 1/3",
		},
		{
			objective: "Additionner des fractions",
			theme: "Nombres",
			exerciseType: "problem_solving",
			difficulty: "medium",
			minutes: minutes - half,
			promptHint: "Calculer 1/4 + 1/4",
		},
	];
}

function trackJson(input: {
	available: boolean;
	minutes: number;
	lessonId: string;
}): string {
	return JSON.stringify({
		available: input.available,
		minutes: input.minutes,
		lessonId: input.lessonId,
		rationale: input.available ? "D'après l'emploi du temps." : "",
		brief: input.available ? "Série de fin de journée." : "",
		proposals: input.available ? proposals(input.minutes) : [],
	});
}

function mondaySnapshot(overrides: Partial<LearnerAcademicSnapshot["context"]> = {}): LearnerAcademicSnapshot {
	return {
		...snapshot,
		context: {
			...snapshot.context,
			timetable: [
				{
					id: "math-mon",
					dayOfWeek: "monday",
					startTime: "08:15",
					endTime: "09:00",
					title: "Mathématiques — fractions",
					kind: "lesson",
				},
				{
					id: "math-tue",
					dayOfWeek: "tuesday",
					startTime: "08:15",
					endTime: "09:00",
					title: "Mathématiques — droites et points",
					kind: "lesson",
				},
			],
			upcomingAssessments: [
				{
					id: "hw",
					subject: "Mathématiques",
					title: "Devoir Fractions",
					kind: "homework",
					dueAt: "2026-10-08",
				},
			],
			...overrides,
		},
	};
}

function rag(hits: string[], completion: string): RagClient {
	return {
		async chat() {
			return { text: completion, hits: hits.map((text) => ({ text })) };
		},
	};
}

describe("practice focus selection", () => {
	test("defaults to the stub and keeps the JSON pack behind it", async () => {
		expect(resolveFocusName(undefined)).toBe("stub");
		const focus = createPracticeFocus({});
		expect(focus).toBeInstanceOf(StubPracticeFocus);
		expect(focus.packVersion()).toBe("snapshot");
		await expect(focus.recommend({ snapshot, now: monday })).rejects.toMatchObject({
			message: NOTHING_TO_PRACTICE_MESSAGE,
		});
	});

	test("cloudflare focus refuses to boot without a RAG client", () => {
		expect(() => createPracticeFocus({ focus: "cloudflare" })).toThrow(/RAG client/);
	});

	test("cloudflare plan calls the model and keeps its split inside 2 h", async () => {
		let chats = 0;
		let user = "";
		const focus = new CloudflarePracticeFocus({
			rag: {
				async chat(input) {
					chats += 1;
					user = input.user;
					return {
						text: JSON.stringify({
							revision: JSON.parse(trackJson({ available: true, minutes: 40, lessonId: FRACTIONS_ID })),
							homework: JSON.parse(trackJson({ available: true, minutes: 80, lessonId: FRACTIONS_ID })),
						}),
						hits: [{ text: "Leçon Fractions du programme DPFC." }],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({ snapshot: mondaySnapshot(), now: monday });
		expect(focus.packVersion()).toBe(AI_SEARCH_PACK_VERSION);
		expect(chats).toBe(1);
		expect(user).toContain("Total à répartir entre les deux pistes : de 110 à 130 minutes.");
		expect(user).toContain("lundi");
		expect(user).toContain("Mathématiques — fractions");
		expect(user).not.toContain("Mathématiques — droites et points");
		expect(user).not.toContain("Demain");
		expect(user).toContain("Devoir Fractions");
		expect(user).not.toContain("2026-11-20");
		expect(plan.totalMinutes).toBe(120);
		expect(plan.tracks.map((track) => [track.kind, track.minutes, track.focus?.intent])).toEqual([
			["revision", 40, "prepare_next_day"],
			["homework", 80, "upcoming_work"],
		]);
		expect(plan.tracks[0]?.focus?.proposals).toHaveLength(2);
		expect(plan.summary).toBe(
			"La révision du jour reprend la leçon de fractions en mathématiques. Le devoir intitulé devoir Fractions est aussi à préparer pour le 8 octobre.",
		);
	});

	test("cloudflare plan reads the session range from its input", async () => {
		let user = "";
		const focus = new CloudflarePracticeFocus({
			rag: {
				async chat(input) {
					user = input.user;
					return {
						text: JSON.stringify({
							revision: JSON.parse(trackJson({ available: true, minutes: 40, lessonId: FRACTIONS_ID })),
							homework: JSON.parse(trackJson({ available: true, minutes: 50, lessonId: FRACTIONS_ID })),
						}),
						hits: [{ text: "extrait" }],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({
			snapshot: mondaySnapshot(),
			now: monday,
			sessionMinutes: { min: 80, max: 90 },
		});
		expect(user).toContain("Total à répartir entre les deux pistes : de 80 à 90 minutes.");
		expect(plan.totalMinutes).toBe(90);
		expect(plan.promptVersion).toBe("1.3");
	});

	test("cloudflare plan rejects a lesson scheduled for the next day", async () => {
		const focus = new CloudflarePracticeFocus({
			rag: rag(["extrait"], JSON.stringify({
				revision: {
					available: true,
					minutes: 40,
					rationale: "Deux leçons du jour et de demain.",
					brief: "Reste sur le titre de chaque leçon.",
					proposals: [
						{
							lessonId: "math-mon",
							subject: "Mathématiques",
							mode: "consolidation",
							objective: "Comparer deux fractions",
							theme: "Fractions",
							exerciseType: "recognition",
							difficulty: "easy",
							minutes: 15,
							promptHint: "Reconnaître la plus grande de 1/2 et 1/3.",
							grounding: "candidate_only",
						},
						{
							lessonId: "math-tue",
							subject: "Mathématiques",
							mode: "consolidation",
							objective: "Repérer un point sur une droite",
							theme: "Droites",
							exerciseType: "application",
							difficulty: "medium",
							minutes: 25,
							promptHint: "Placer un point sur une droite graduée.",
							grounding: "dpfc_verified",
						},
					],
				},
				homework: {
					available: false,
					minutes: 0,
					rationale: "Aucune évaluation dans la fenêtre.",
					brief: "",
					proposals: [],
				},
			})),
			model: DEFAULT_FOCUS_MODEL,
		});
		await expect(focus.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
			sessionMinutes: { min: 40, max: 40 },
		})).rejects.toMatchObject({
			message: PRACTICE_TIMETABLE_MISMATCH_MESSAGE,
		});
	});

	test("cloudflare plan keeps a lesson named on today's proposal", async () => {
		const focus = new CloudflarePracticeFocus({
			rag: rag(["extrait"], JSON.stringify({
				revision: {
					available: true,
					minutes: 40,
					rationale: "Leçon du jour.",
					brief: "Reste sur le titre de la leçon.",
					proposals: [
						{
							lessonId: "math-mon",
							subject: "Mathématiques",
							mode: "consolidation",
							objective: "Comparer deux fractions",
							theme: "Fractions",
							exerciseType: "recognition",
							difficulty: "easy",
							minutes: 40,
							promptHint: "Reconnaître la plus grande de 1/2 et 1/3.",
							grounding: "candidate_only",
						},
					],
				},
				homework: {
					available: false,
					minutes: 0,
					rationale: "Aucune évaluation dans la fenêtre.",
					brief: "",
					proposals: [],
				},
			})),
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
			sessionMinutes: { min: 40, max: 40 },
		});
		expect(plan.tracks[0]?.items.map((item) => [item.lesson.id, item.minutes])).toEqual([
			["math-mon", 40],
		]);
		expect(plan.tracks[0]?.items[0]?.focus.proposals[0]?.promptHint).toContain("sans ajouter d'objectif officiel DPFC");
		expect(plan.tracks[1]?.available).toBe(false);
	});

	test("cloudflare plan accepts a loose recommendation and retries an unreadable one", async () => {
		const fencedPlan = [
			"```json",
			JSON.stringify({
				plan: {
					revision: {
						available: "true",
						minutes: 110.4,
						lessonId: FRACTIONS_ID,
						reason: "Leçon du jour.",
						proposals: {
							objective: "Comparer",
							minutes: "110",
							promptHint: "Comparer deux fractions",
						},
					},
				},
			}),
		].join("\n");
		const loose = new CloudflarePracticeFocus({
			rag: rag(["extrait"], fencedPlan),
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await loose.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
		});
		expect(plan.tracks.map((track) => [track.kind, track.minutes])).toEqual([
			["revision", 110],
			["homework", 0],
		]);
		expect(plan.tracks[0]?.focus?.brief).toContain("Fractions");

		let chats = 0;
		const retry = new CloudflarePracticeFocus({
			rag: {
				async chat() {
					chats += 1;
					if (chats === 1) return { text: "pas un plan", hits: [{ text: "extrait" }] };
					return {
						text: JSON.stringify({
							revision: JSON.parse(trackJson({ available: true, minutes: 120, lessonId: FRACTIONS_ID })),
							homework: JSON.parse(trackJson({ available: false, minutes: 0, lessonId: "" })),
						}),
						hits: [{ text: "extrait" }],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const recovered = await retry.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
		});
		expect(chats).toBe(2);
		expect(recovered.tracks[0]?.minutes).toBe(120);
	});

	test("cloudflare plan leaves an evaluation outside two weeks out of the prompt", async () => {
		let user = "";
		const focus = new CloudflarePracticeFocus({
			rag: {
				async chat(input) {
					user = input.user;
					return {
						text: JSON.stringify({
							revision: JSON.parse(trackJson({ available: true, minutes: 120, lessonId: FRACTIONS_ID })),
							homework: JSON.parse(trackJson({ available: false, minutes: 0, lessonId: "" })),
						}),
						hits: [{ text: "Fractions." }],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({
			snapshot: mondaySnapshot({
				upcomingAssessments: [
					{
						id: "later",
						subject: "Mathématiques",
						title: "Devoir lointain",
						kind: "homework",
						dueAt: "2026-11-20",
					},
				],
			}),
			now: monday,
		});
		expect(user).not.toContain("Devoir lointain");
		expect(plan.tracks[1]).toMatchObject({ available: false, minutes: 0 });
		expect(plan.tracks[0]?.minutes).toBe(120);
	});

	test("cloudflare focus rejects an unknown lesson and a weak mark that is not on the timetable", async () => {
		const unknown = new CloudflarePracticeFocus({
			rag: rag(["extrait"], JSON.stringify({
				revision: JSON.parse(trackJson({ available: true, minutes: 120, lessonId: "Leçon 1" })),
				homework: JSON.parse(trackJson({ available: false, minutes: 0, lessonId: "" })),
			})),
			model: DEFAULT_FOCUS_MODEL,
		});
		await expect(unknown.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
		})).rejects.toBeInstanceOf(PracticePlanError);
		await expect(unknown.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
		})).rejects.toMatchObject({
			message: PRACTICE_TIMETABLE_MISMATCH_MESSAGE,
		});

		const weakMark = new CloudflarePracticeFocus({
			rag: rag(["extrait"], JSON.stringify({
				revision: JSON.parse(trackJson({ available: true, minutes: 120, lessonId: FRACTIONS_ID })),
				homework: JSON.parse(trackJson({ available: false, minutes: 0, lessonId: "" })),
			})),
			model: DEFAULT_FOCUS_MODEL,
		});
		await expect(weakMark.plan({
			snapshot: mondaySnapshot({
				timetable: [
					{
						id: "lines",
						dayOfWeek: "monday",
						startTime: "08:15",
						endTime: "09:00",
						title: "Mathématiques — droites et points",
						kind: "lesson",
					},
				],
				upcomingAssessments: [],
				marks: [{ id: "m1", subject: "MATH", title: "Fractions", score: 4, maxScore: 20, date: "2026-09-01" }],
			}),
			now: monday,
		})).rejects.toMatchObject({ message: PRACTICE_TIMETABLE_MISMATCH_MESSAGE });
	});

	test("cloudflare plan keeps the recommendation total", async () => {
		const focus = new CloudflarePracticeFocus({
			rag: rag(["extrait"], JSON.stringify({
				revision: JSON.parse(trackJson({ available: true, minutes: 55, lessonId: FRACTIONS_ID })),
				homework: JSON.parse(trackJson({ available: true, minutes: 60, lessonId: FRACTIONS_ID })),
			})),
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({ snapshot: mondaySnapshot(), now: monday });
		expect(plan.totalMinutes).toBe(115);
		expect(plan.summary).toContain("fractions en mathématiques");
		expect(plan.summary).toContain("devoir Fractions");
		expect(plan.summary).not.toContain("«");
	});

	test("cloudflare plan rejects a total outside the requested range", async () => {
		let chats = 0;
		const short = new CloudflarePracticeFocus({
			rag: {
				async chat() {
					chats += 1;
					return {
						text: JSON.stringify({
							revision: JSON.parse(trackJson({ available: true, minutes: 50, lessonId: FRACTIONS_ID })),
							homework: JSON.parse(trackJson({ available: true, minutes: 50, lessonId: FRACTIONS_ID })),
						}),
						hits: [{ text: "extrait" }],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		await expect(short.plan({ snapshot: mondaySnapshot(), now: monday })).rejects.toMatchObject({
			message: PRACTICE_MINUTES_MESSAGE,
		});
		expect(chats).toBe(2);

		const empty = new CloudflarePracticeFocus({
			rag: rag([], JSON.stringify({})),
			model: DEFAULT_FOCUS_MODEL,
		});
		await expect(empty.plan({ snapshot: mondaySnapshot(), now: monday })).rejects.toMatchObject({
			message: PRACTICE_NO_PROGRAMME_MESSAGE,
		});

		let quietChats = 0;
		const quiet = new CloudflarePracticeFocus({
			rag: {
				async chat() {
					quietChats += 1;
					return { text: "{}", hits: [] };
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await quiet.plan({ snapshot, now: monday });
		expect(quietChats).toBe(0);
		expect(plan.summary).toBe(NOTHING_TO_PRACTICE_MESSAGE);
	});

	test("cloudflare plan without RAG accepts an empty-hit reply from the pupil input", async () => {
		let system = "";
		let user = "";
		const focus = new CloudflarePracticeFocus({
			ragEnabled: false,
			rag: {
				async chat(input) {
					system = input.system;
					user = input.user;
					return {
						text: JSON.stringify({
							revision: {
								available: true,
								minutes: 40,
								rationale: "Leçon du jour.",
								brief: "Reste sur le titre de la leçon.",
								proposals: [
									{
										lessonId: "math-mon",
										subject: "Mathématiques",
										mode: "consolidation",
										objective: "Comparer deux fractions",
										theme: "Fractions",
										exerciseType: "recognition",
										difficulty: "easy",
										minutes: 40,
										promptHint: "Reconnaître la plus grande de 1/2 et 1/3.",
										grounding: "dpfc_verified",
									},
								],
							},
							homework: {
								available: false,
								minutes: 0,
								rationale: "Aucune évaluation dans la fenêtre.",
								brief: "",
								proposals: [],
							},
						}),
						hits: [],
					};
				},
			},
			model: DEFAULT_FOCUS_MODEL,
		});
		const plan = await focus.plan({
			snapshot: mondaySnapshot({ upcomingAssessments: [] }),
			now: monday,
			sessionMinutes: { min: 40, max: 40 },
		});
		expect(plan.tracks[0]?.items.map((item) => [item.lesson.id, item.minutes])).toEqual([
			["math-mon", 40],
		]);
		const hint = plan.tracks[0]?.items[0]?.focus.proposals[0]?.promptHint ?? "";
		expect(hint).toContain("Reste sur le niveau, la leçon et la consigne fournis.");
		expect(hint).not.toContain("DPFC");
		expect(system).toContain("exercices génériques");
		expect(system).not.toContain("DPFC");
		expect(user).not.toContain("DPFC");
	});

	test("chat posts to the namespace instance endpoint", async () => {
		let url = "";
		let body: unknown;
		const client = createCloudflareRagClient({
			accountId: "acct",
			apiToken: "token",
			namespace: "default",
			instance: "edaya_spark_rag",
			ragEnabled: true,
			fetchImpl: async (input, init) => {
				url = String(input);
				body = JSON.parse(String(init?.body));
				return new Response(JSON.stringify({
					result: {
						choices: [{ message: { content: "{\"ok\":true}" } }],
						chunks: [{ text: "extrait" }],
					},
				}));
			},
		});
		const reply = await client.chat({ model: "m", system: "sys", user: "user" });
		expect(url).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acct/ai-search/namespaces/default/instances/edaya_spark_rag/chat/completions",
		);
		expect(body).toMatchObject({
			model: "m",
			max_completion_tokens: 8192,
			messages: [
				{ role: "system", content: "sys" },
				{ role: "user", content: "user" },
			],
			ai_search_options: { retrieval: { max_num_results: 6 } },
		});
		expect(reply.text).toContain("ok");
		expect(reply.hits).toEqual([{ text: "extrait" }]);

		let aliased = "";
		const withAlias = createCloudflareRagClient({
			accountId: "acct",
			apiToken: "token",
			namespace: "default",
			instance: "edaya_spark_rag",
			byokAlias: "byok",
			ragEnabled: true,
			fetchImpl: async (input) => {
				aliased = String(input);
				return new Response(JSON.stringify({
					result: { choices: [{ message: { content: "{\"ok\":true}" } }] },
				}));
			},
		});
		await withAlias.chat({ model: "m", system: "sys", user: "user" });
		expect(aliased).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acct/ai-search/namespaces/default/instances/edaya_spark_rag/chat/completions?cf-aig-byok-alias=byok",
		);

		let workersAi = "";
		let workersBody: unknown;
		const llm = createCloudflareRagClient({
			accountId: "acct",
			apiToken: "token",
			byokAlias: "byok",
			fetchImpl: async (input, init) => {
				workersAi = String(input);
				workersBody = JSON.parse(String(init?.body));
				return new Response(JSON.stringify({
					result: { choices: [{ message: { content: "{\"ok\":true}" } }] },
				}));
			},
		});
		await llm.chat({ model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", system: "sys", user: "user" });
		expect(workersAi).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acct/ai/v1/chat/completions",
		);
		expect(workersBody).toMatchObject({
			model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
		});
		expect(workersBody).not.toHaveProperty("ai_search_options");
	});

	test("retries once when Cloudflare answers 502", async () => {
		let calls = 0;
		const client = createCloudflareRagClient({
			accountId: "acct",
			apiToken: "token",
			namespace: "default",
			instance: "edaya_spark_rag",
			fetchImpl: async () => {
				calls += 1;
				if (calls === 1) return new Response("bad gateway", { status: 502 });
				return new Response(JSON.stringify({
					result: {
						choices: [{ message: { content: "{\"ok\":true}" } }],
						chunks: [{ text: "extrait" }],
					},
				}));
			},
		});
		const reply = await client.chat({ model: "m", system: "sys", user: "user" });
		expect(calls).toBe(2);
		expect(reply.text).toContain("ok");
	});
});

describe("cloudflare exercise generator", () => {
	test("writes a set from RAG excerpts and the already chosen lesson", async () => {
		let user = "";
		const generator = new CloudflareRagExerciseGenerator({
			rag: {
				async chat(input) {
					user = input.user;
					return {
						text: JSON.stringify({
							questions: [
								{ prompt: "Compare 1/2 et 1/3.", kind: "written", expectedAnswer: "1/2 > 1/3" },
								{ prompt: "Calcule 1/4 + 1/4.", kind: "written", expectedAnswer: "1/2" },
								{
									prompt: "Quelle fraction est la plus grande ?",
									kind: "mcq",
									choices: ["1/5", "1/2", "1/8"],
									expectedAnswer: "1/2",
								},
							],
						}),
						hits: [{ text: "Comparer 1/2 et 1/3." }],
					};
				},
			},
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		const set = await generator.generate({
			snapshot,
			lesson: {
				id: lessonJson.lesson.id,
				packVersion: "rag-index-2026",
				country: "CI",
				cycle: "college",
				grade: "6e",
				subject: "MATH",
				competence: { id: "rag", title: "Calculs" },
				theme: { id: "rag", title: "Nombres" },
				title: "Fractions",
				sequence: 0,
				exampleSituation: "Partager un plat.",
				skills: ["Comparer deux fractions"],
				contents: ["Fractions égales"],
				sourcePdf: "cloudflare-rag",
			},
			focus: {
				lessonId: lessonJson.lesson.id,
				subject: "MATH",
				rationale: "note faible",
				brief: "On revoit les fractions.",
				intent: "prepare_next_day",
				proposals: [
					{
						objective: "Comparer deux fractions",
						theme: "Nombres",
						exerciseType: "comprehension",
						difficulty: "medium",
						minutes: 15,
						promptHint: "Comparer 1/2 et 1/3",
					},
				],
			},
			plannedMinutes: 40,
		});
		expect(set.generator).toBe("llm");
		expect(set.promptVersion).toBe(`1.3:${DEFAULT_RAG_GENERATOR_MODEL}`);
		expect(user).toContain("Durée recommandée pour cette série : 15 minutes.");
		expect(user).toContain("Consigne : On revoit les fractions.");
		expect(user).toContain("Proposition :");
		expect(set.questions).toHaveLength(3);
	});

	test("writes questions without retrieved excerpts when RAG is off", async () => {
		const generator = new CloudflareRagExerciseGenerator({
			ragEnabled: false,
			rag: {
				async chat() {
					return {
						text: JSON.stringify({
							questions: [
								{ prompt: "Compare 1/2 et 1/3.", kind: "written", expectedAnswer: "1/2 > 1/3" },
							],
						}),
						hits: [],
					};
				},
			},
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		const set = await generator.generate({
			snapshot,
			lesson: {
				id: lessonJson.lesson.id,
				packVersion: "rag-index-2026",
				country: "CI",
				cycle: "college",
				grade: "6e",
				subject: "MATH",
				competence: { id: "rag", title: "Calculs" },
				theme: { id: "rag", title: "Nombres" },
				title: "Fractions",
				sequence: 0,
				exampleSituation: "Partager un plat.",
				skills: ["Comparer deux fractions"],
				contents: ["Fractions égales"],
				sourcePdf: "cloudflare-rag",
			},
			focus: {
				lessonId: lessonJson.lesson.id,
				subject: "MATH",
				rationale: "note faible",
				brief: "On revoit les fractions.",
				intent: "prepare_next_day",
				proposals: [
					{
						objective: "Comparer deux fractions",
						theme: "Nombres",
						exerciseType: "comprehension",
						difficulty: "medium",
						minutes: 15,
						promptHint: "Comparer 1/2 et 1/3",
					},
				],
			},
			plannedMinutes: 40,
		});
		expect(set.questions.map((question) => question.prompt)).toEqual(["Compare 1/2 et 1/3."]);
	});

	test("collapses repeated QCM choices and keeps a one-choice QCM as a written question", async () => {
		const codes = "Le code historique, le code gestuel, le code chromatique";
		const generator = new CloudflareRagExerciseGenerator({
			rag: rag(
				["Les codes de l'image."],
				JSON.stringify({
					questions: [
						{
							prompt: "Quel ensemble regroupe ces codes ?",
							kind: "mcq",
							choices: [codes, "Un seul code", codes, "Aucun code"],
							expectedAnswer: codes,
						},
						{
							prompt: "Recopie la liste des codes.",
							kind: "mcq",
							choices: [codes, ` ${codes} `],
							expectedAnswer: codes,
						},
					],
				}),
			),
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		const set = await generator.generate({
			snapshot,
			lesson: {
				id: lessonJson.lesson.id,
				packVersion: "rag-index-2026",
				country: "CI",
				cycle: "college",
				grade: "6e",
				subject: "ARTS",
				competence: { id: "rag", title: "Lecture de l'image" },
				theme: { id: "rag", title: "Codes" },
				title: "Les codes de l'image",
				sequence: 0,
				exampleSituation: "Lire une affiche.",
				skills: ["Reconnaître un code"],
				contents: [codes],
				sourcePdf: "cloudflare-rag",
			},
			focus: {
				lessonId: lessonJson.lesson.id,
				subject: "ARTS",
				rationale: "Leçon du jour.",
				brief: "Revoir les codes.",
				intent: "prepare_next_day",
				proposals: [
				{
					objective: "Reconnaître les codes",
					theme: "Codes",
					exerciseType: "recognition",
					difficulty: "easy",
					minutes: 12,
					promptHint: "Quel ensemble regroupe ces codes ?",
				},
			],
			},
			plannedMinutes: 20,
		});
		expect(set.questions).toHaveLength(2);
		expect(set.questions[0]).toMatchObject({
			kind: "mcq",
			choices: [codes, "Un seul code", "Aucun code"],
			expectedAnswer: codes,
		});
		expect(set.questions[1]).toMatchObject({ kind: "written", expectedAnswer: codes });
		expect(set.questions[1]?.choices).toBeUndefined();
	});

	test("completes a short homework reply and keeps a partial series", async () => {
		const lesson: CurriculumLesson = {
			id: lessonJson.lesson.id,
			packVersion: "rag-index-2026",
			country: "CI",
			cycle: "college",
			grade: "6e",
			subject: "FR",
			competence: { id: "rag", title: "Lecture" },
			theme: { id: "rag", title: "Texte" },
			title: "Le texte argumentatif",
			sequence: 0,
			exampleSituation: "Lire une consigne de devoir.",
			skills: ["Repérer une thèse"],
			contents: ["Thèse", "Argument"],
			sourcePdf: "cloudflare-rag",
		};
		const focus = {
			lessonId: lessonJson.lesson.id,
			subject: "FR",
			rationale: "Devoir dans 5 jours.",
			brief: "Préparer l'évaluation.",
			intent: "upcoming_work" as const,
			proposals: proposals(40),
		};
		let calls = 0;
		const filling = new CloudflareRagExerciseGenerator({
			rag: {
				async chat() {
					calls += 1;
					const questions = calls === 1
						? [{ prompt: "Quelle est la thèse ?", kind: "written", answer: "L'idée défendue." }]
						: [{ prompt: "Cite un argument.", kind: "written", expectedAnswer: "Un fait qui appuie la thèse." }];
					return { text: `Exercices:\n${JSON.stringify({ questions })}`, hits: [{ text: "extrait" }] };
				},
			},
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		const filled = await filling.generate({
			snapshot,
			lesson,
			focus,
			plannedMinutes: 40,
		});
		expect(calls).toBe(2);
		expect(filled.questions.map((question) => question.expectedAnswer)).toEqual([
			"L'idée défendue.",
			"Un fait qui appuie la thèse.",
		]);

		let partialCalls = 0;
		const partial = new CloudflareRagExerciseGenerator({
			rag: {
				async chat() {
					partialCalls += 1;
					const questions = partialCalls === 1
						? [{ prompt: "Quelle est la thèse ?", kind: "written", answer: "L'idée défendue." }]
						: [];
					return {
						text: JSON.stringify({ questions }),
						hits: [{ text: "extrait" }],
					};
				},
			},
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		const short = await partial.generate({
			snapshot,
			lesson,
			focus,
			plannedMinutes: 40,
		});
		expect(short.questions).toHaveLength(1);
	});

	test("rejects a recommendation without propositions in a French sentence", async () => {
		const generator = new CloudflareRagExerciseGenerator({
			rag: rag(["extrait"], "{}"),
			model: DEFAULT_RAG_GENERATOR_MODEL,
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		await expect(generator.generate({
			snapshot,
			lesson: {
				id: FRACTIONS_ID,
				packVersion: "pack",
				country: "CI",
				cycle: "college",
				grade: "6e",
				subject: "MATH",
				competence: { id: "c", title: "Calculs" },
				theme: { id: "t", title: "Nombres" },
				title: "Fractions",
				sequence: 1,
				exampleSituation: "Partager.",
				skills: ["Comparer"],
				contents: ["Fraction"],
				sourcePdf: "01.pdf",
			},
			focus: {
				lessonId: FRACTIONS_ID,
				subject: "MATH",
				rationale: "Emploi du temps.",
				brief: "Fin de journée.",
				intent: "prepare_next_day",
				proposals: [],
			},
			plannedMinutes: 40,
		})).rejects.toMatchObject({
			message: "La recommandation ne propose aucun exercice.",
		});
	});
});

describe("fixture day clock", () => {
	test("pins the fixture demo to the end of the given school day and ignores a live context", () => {
		expect(createRuntimeClock({ contextMode: "fixture", fixtureToday: "2026-10-05" }).nowIso()).toBe(
			"2026-10-05T18:00:00.000Z",
		);
		expect(createRuntimeClock({ contextMode: "http", fixtureToday: "2026-10-05" })).toBeInstanceOf(SystemClock);
		expect(() => createRuntimeClock({ contextMode: "fixture", fixtureToday: "lundi" })).toThrow(
			/AAAA-MM-JJ/,
		);
	});

	test("an empty practice weekday follows the calendar", () => {
		expect(createRuntimeClock({ contextMode: "http", practiceWeekday: "" })).toBeInstanceOf(SystemClock);
		expect(createRuntimeClock({ contextMode: "http", practiceWeekday: "   " })).toBeInstanceOf(SystemClock);
	});

	test("a practice weekday moves the clock onto that day of the current school week", () => {
		const saturday = { contextMode: "fixture" as const, fixtureToday: "2026-10-17" };
		expect(createRuntimeClock({ ...saturday, practiceWeekday: "lundi" }).nowIso()).toBe(
			"2026-10-12T18:00:00.000Z",
		);
		expect(createRuntimeClock({ ...saturday, practiceWeekday: "Vendredi" }).nowIso()).toBe(
			"2026-10-16T18:00:00.000Z",
		);
		expect(createRuntimeClock({ ...saturday, practiceWeekday: "samedi" }).nowIso()).toBe(
			"2026-10-17T18:00:00.000Z",
		);
		expect(createRuntimeClock({ contextMode: "http", practiceWeekday: "mardi" }).nowIso().length).toBeGreaterThan(0);
		expect(new Date(createRuntimeClock({ contextMode: "http", practiceWeekday: "mardi" }).nowIso()).getUTCDay()).toBe(2);
		expect(() => createRuntimeClock({ contextMode: "http", practiceWeekday: "lundii" })).toThrow(
			/PRACTICE_WEEKDAY/,
		);
	});
});
