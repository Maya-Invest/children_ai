export const CASTOR_SEEN_KEY = "edaya-spark.castor.seen";

export type CastorGuide = {
	id: string;
	tour: string;
	hint: string;
};

const screens = {
	accueil: {
		id: "accueil",
		tour: "Pour réviser, choisis J’ai un code. Le code vient d’un parent.",
		hint: "Entre avec le code donné par un parent.",
	},
	code: {
		id: "code",
		tour: "Colle le code, par exemple A123-B456-C789-D125, puis Entrée.",
		hint: "Le code ressemble à A123-B456-C789-D125.",
	},
	serie: {
		id: "serie",
		tour: "Choisis une série, puis commence. Je ne donne pas les réponses.",
		hint: "Choisis une matière et lance une série.",
	},
	question: {
		id: "question",
		tour: "Réponds à la question, puis passe à la suivante. Je reste là, sans la réponse.",
		hint: "Réponds, puis passe à la question suivante.",
	},
	corrige: {
		id: "corrige",
		tour: "Ici tu vois ta réponse et la correction, quand elle est ouverte.",
		hint: "Compare ta réponse avec la correction.",
	},
} satisfies Record<string, CastorGuide>;

const guides = Object.values(screens);

export function allGuideIds(): string[] {
	return guides.map((guide) => guide.id);
}

export function guideFor(pathname: string): CastorGuide | null {
	const path = normalize(pathname);
	if (path.startsWith("/parent") || path === "/app/stats" || path === "/app/history") return null;
	if (path === "/") return screens.accueil;
	if (path === "/student") return screens.code;
	if (/^\/app\/sets\/[^/]+\/question\/[^/]+$/.test(path)) return screens.question;
	if (path === "/app" || /^\/app\/sets\/[^/]+$/.test(path)) return screens.serie;
	if (path.startsWith("/app/corriges/")) return screens.corrige;
	return null;
}

type SeenStorage = Pick<Storage, "getItem" | "setItem">;

export function readSeen(storage: Pick<Storage, "getItem">): string[] {
	const raw = storage.getItem(CASTOR_SEEN_KEY);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

export function remember(storage: SeenStorage, id: string): string[] {
	const next = readSeen(storage).includes(id) ? readSeen(storage) : [...readSeen(storage), id];
	storage.setItem(CASTOR_SEEN_KEY, JSON.stringify(next));
	return next;
}

export function rememberAll(storage: Pick<Storage, "setItem">): string[] {
	const next = allGuideIds();
	storage.setItem(CASTOR_SEEN_KEY, JSON.stringify(next));
	return next;
}

function normalize(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
	return pathname;
}
