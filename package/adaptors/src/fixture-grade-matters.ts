import type { ClassProgressItem } from "@edaya-spark/domain";

/** Official collège matters copied from the Edaya grade files. Edaya itself is not imported. */
export type GradeSubjectMatters = {
	subject: string;
	matters: readonly string[];
};

export const GRADE_6E_MATTERS: readonly GradeSubjectMatters[] = [
	{
		subject: "Mathématiques",
		matters: [
			"Arithmétique : PGCD, PPCM, division euclidienne, nombres premiers",
			"Nombres relatifs : addition, soustraction, repérage sur un axe",
			"Fractions : opérations simples, fractions équivalentes",
			"Géométrie plane : points, segments, droites sécantes, parallèles, perpendiculaires",
			"Angles : mesure, angles adjacents, complémentaires, supplémentaires",
			"Symétrie axiale et centrale : propriétés de conservation",
			"Les triangles : propriétés, inégalité triangulaire, droites remarquables",
			"Parallélogrammes particuliers",
			"Initiation aux probabilités et statistiques (tableaux d'effectifs)",
		],
	},
	{
		subject: "Français",
		matters: [
			"Lecture et compréhension de textes narratifs et documentaires",
			"Grammaire de la phrase simple : classes et fonctions",
			"Conjugaison des temps courants",
			"Expression écrite : récit et description",
		],
	},
	{
		subject: "Anglais",
		matters: [
			"Compréhension orale et expression orale",
			"Compréhension écrite de textes authentiques",
			"Vocabulaire thématique et expressions utiles",
			"Grammaire : temps, structures et concordance",
			"Production écrite guidée et libre",
			"Civilisation et documents culturels",
		],
	},
	{
		subject: "Histoire-Géographie",
		matters: [
			"Repères chronologiques et sociétés",
			"Territoires, populations et activités",
			"Lecture de cartes, frises et documents",
			"Afrique et Côte d'Ivoire dans le monde",
			"Enjeux contemporains",
			"Méthodologie de l'étude de documents",
		],
	},
	{
		subject: "Physique-Chimie",
		matters: [
			"Solides, liquides et gaz : propriétés physiques",
			"Température et changements d’état de l’eau",
			"Mesure de la masse et du volume",
			"Circuits électriques simples : générateur, récepteur, conducteurs",
			"Pollution de l’air et combustions",
		],
	},
	{
		subject: "Sciences de la Vie et de la Terre",
		matters: [
			"Organisation du vivant : cellule et organismes",
			"Nutrition et fonctions vitales chez les êtres vivants",
			"Milieux de vie et relations entre êtres vivants",
			"La Terre : structure et milieux naturels",
			"Hygiène, santé et prévention",
		],
	},
	{
		subject: "Éducation aux Droits de l'Homme et à la Citoyenneté",
		matters: [
			"Droits et devoirs du citoyen",
			"Vivre ensemble et respect de la diversité",
			"Institutions et vie démocratique",
			"Santé, hygiène et responsabilité sociale",
			"Développement durable",
			"Engagement et solidarité",
		],
	},
	{
		subject: "Éducation Physique et Sportive",
		matters: [
			"Activités athlétiques et motricité",
			"Sports collectifs",
			"Gymnastique et expression corporelle",
			"Condition physique et santé",
			"Règles de sécurité et fair-play",
			"Préparation et évaluation des APSA",
		],
	},
	{
		subject: "Arts Plastiques",
		matters: [
			"Dessin et représentation",
			"Couleurs, formes et composition",
			"Techniques plastiques",
			"Lecture d'œuvres",
			"Expression créative",
			"Projet plastique personnel",
		],
	},
	{
		subject: "Éducation Musicale",
		matters: [
			"Écoute et discrimination sonore",
			"Chant et rythme",
			"Notions de solfège de base",
			"Musiques traditionnelles et contemporaines",
			"Pratique collective",
			"Culture musicale",
		],
	},
	{
		subject: "Technologie",
		matters: [
			"Objets techniques et matériaux",
			"Mesure, dessin et représentation technique",
			"Énergie et systèmes simples",
			"Démarche de projet technologique",
			"Sécurité et usage des outils",
			"Innovation et design",
		],
	},
	{
		subject: "TICE",
		matters: [
			"Système d'exploitation et fichiers",
			"Traitement de texte et présentation",
			"Recherche d'information et sources",
			"Tableurs et multimédia",
			"Citoyenneté et sécurité numériques",
			"Collaboration et outils en ligne",
		],
	},
];

export const GRADE_5E_MATTERS: readonly GradeSubjectMatters[] = [
	GRADE_6E_MATTERS[0]!,
	GRADE_6E_MATTERS[1]!,
	GRADE_6E_MATTERS[2]!,
	GRADE_6E_MATTERS[3]!,
	{
		subject: "Physique-Chimie",
		matters: [
			"États de la matière et changements d'état",
			"Notions de masse, volume et température",
			"Circuits électriques simples",
			"Introduction aux forces et au mouvement",
		],
	},
	{
		subject: "Sciences de la Vie et de la Terre",
		matters: [
			"Organisation du vivant : cellule et organismes",
			"Nutrition et fonctions vitales chez les êtres vivants",
			"Environnement et écosystèmes de base",
			"Hygiène et prévention des maladies",
		],
	},
	...GRADE_6E_MATTERS.slice(6),
];

export function gradeProgress(
	subjects: readonly GradeSubjectMatters[],
	taught: Readonly<Record<string, { completedPercentage: number; slotId?: string }>>,
): ClassProgressItem[] {
	return subjects.flatMap((subject) =>
		subject.matters.map((subjectMatter) => {
			const lesson = taught[subjectMatter];
			return {
				subject: subject.subject,
				subjectMatter,
				completedPercentage: lesson?.completedPercentage ?? 0,
				...(lesson?.slotId ? { slotId: lesson.slotId } : {}),
			};
		}),
	);
}
