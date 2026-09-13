# Children AI — product contract (v1)

Children AI is a **curriculum-faithful practice companion** with its own student web app. It is not a chatbot, not homework Q&A, and not an on-demand tutor.

## Locked rules

1. **Syllabus = DPFC programmes éducatifs** (collège Maths 6e–3e, CND 0923). CAFOP `mathematique.pdf` and EDAYA ivory-coast fixtures are not the syllabus.
2. **EDAYA = personalization only.** Marks, rank, observations, class coverage, attendance steer *which official leçon* to practice. They do not invent topics.
3. **Generate once per snapshot.** CRON (or fixture sync) versions `LearnerAcademicSnapshot`. The student may generate **one** `ExerciseSet` per snapshot version. No regenerate. Parents never generate.
4. **Same artefact.** Student and guardian open the same stored sets. No solutions / no correction in v1.
5. **Own designed student web app** (child-facing). Not embedded in the EDAYA staff webapp.
6. **LLM = Gemini Flash**, behind `ExerciseGeneratorPort`. Without `GEMINI_API_KEY` the stub adaptor is used. The key is supplied later; it is never committed.
7. **HTTP = Hono.** The API is a Hono app (local Bun and Cloudflare Worker entry both call `createHttpApp`).
8. **Cloudflare lives in adaptors**, not in domain. KV snapshots/sets/sessions and the Worker `scheduled()` CRON are `@children-ai/adaptor-cloudflare`. The student web deploys with `@sveltejs/adapter-cloudflare`.

## EDAYA mapping

Official leçons map to school subject code **`MATH`**. Class chapter titles in EDAYA (`class-subject-matters`) are matched by name to DPFC leçon titles when suggesting focus.
