# Edaya Spark — product contract (v1)

Edaya Spark is a **curriculum-faithful practice companion** with its own student web app. It is not a chatbot, not homework Q&A, and not an on-demand tutor.

## Locked rules

1. **Chapter names come from the official collège grade files** (6e, 5e, 4e, 3e). The Edaya Spark fixture copies those matters and owns the week, the progression, and the evaluations. Live exercise text comes from Cloudflare AI Search. The collège-maths JSON pack is not consulted when planning. CAFOP `mathematique.pdf` is not the syllabus.
2. **EDAYA = personalization only.** Marks, rank, observations, class coverage, attendance steer *which official leçon* to practice. They do not invent topics.
3. **Generate once per snapshot.** Opening the app versions `LearnerAcademicSnapshot`. The student may generate **one** `ExerciseSet` per snapshot version. No regenerate. Parents never generate.
4. **Same artefact.** Student and guardian open the same stored sets. No solutions / no correction in v1.
5. **Own designed student web app** (child-facing). Not embedded in the EDAYA staff webapp.
6. **Two LLM ports.** `PracticeFocusPort` plans the end of day from the timetable, between 110 and 130 minutes: `prepare_next_day` for today's lessons, and `upcoming_work` for an evaluation due within 14 days. Cloudflare AI Search chooses the split, the lessons, and the exercise propositions. `ExerciseGeneratorPort` writes the questions from that plan. Without Cloudflare, the stub follows the same timetable rules. `FIXTURE_TODAY` pins the fixture demo clock. Keys are never committed.
7. **HTTP = Hono.** The API is a Hono app (local Bun and Cloudflare Worker entry both call `createHttpApp`).
8. **Cloudflare lives in the Worker runtime**, not in the domain. Snapshots, sets, settings, codes, sessions, and the school vault are Postgres (`@edaya-spark/adaptor-postgres`): PGlite locally, Hyperdrive in staging and prod. The student web deploys with `@sveltejs/adapter-cloudflare`.

## EDAYA mapping

A timetable slot matches a chapter already present on the learner snapshot. The fixture stores that chapter list from the official grade file. A weak mark does not choose the lesson.
