# Children AI — launch and test

Children AI is a **student practice app** (collège Maths, programme DPFC). It is not the EDAYA staff UI and not a chatbot.

Parents sign in with their **Edaya Identity** account. Students have **no Identity account**: a parent issues a revocable access code (shown once). Codes live only in Children AI, hashed. Children AI talks to Edaya with a machine key (`s2s_live_…`), never with the parent JWT.

---

## Do I have to seed EDAYA?

| What you want | What to do |
|---------------|------------|
| Exercise the parent UI + student app locally | **Path fixture**: Identity + Children AI. Academic data is the built-in Aminata demo. |
| Real notes / classe / bulletin from Cocody | **Path live**: Identity + seeded Edaya + `s2s_live_` in the Children AI vault. |
| Parent Identity with no guardian links | `/parent` shows an empty list (no demo child injected in `EDAYA_CONTEXT=http`). |

Children AI never writes back to EDAYA. The S2S key stays on the Children AI API; the browser never sees it.

---

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- From this folder: `children_ai`

```bash
cd children_ai
bun install
copy .env.example .env
```

On macOS/Linux: `cp .env.example .env`. Leave `EDAYA_DEMO_API_KEY` and `EDAYA_CONTEXT` empty for Path fixture.

`apps/student-web/.env` should contain:

```
PUBLIC_API_URL=http://localhost:8787
PUBLIC_AUTH_URL=http://localhost:9900
```

Identity must allow the Children AI API as a JWT audience and the student-web origin as a trusted cookie origin (`FIRST_PARTY_API_ORIGINS` includes `http://localhost:8787`, `TRUSTED_ORIGINS` includes `http://localhost:5175`).

---

## Path fixture — Identity + Children AI (no school API)

Identity can run **without** a school seed. Academic context for Aminata is in-process (`EDAYA_CONTEXT=fixture`).

```bash
# Terminal 1
cd edaya_identity && bun repo dev     # :9900

# Terminal 2
cd children_ai
bun test
bun run dev
```

| App | URL |
|-----|-----|
| Student / parent web | http://127.0.0.1:5175 |
| API health | http://localhost:8787/health |

Health should look like `palier: local`, `schoolTenancy: per-school`, `contextMode: fixture`, `generator: stub` (unless you set `GEMINI_API_KEY`).

### What to click

1. Open http://127.0.0.1:5175
2. **Parent → Me connecter** with an Identity account (after school seed, demo guardian `m.kone@mail.ci` / `DevPassword1!`). Fixture mode still attaches **Aminata** (`ci-s1`) to that parent so you can generate a code without `:9999`.
3. On the parent dashboard: **Générer un code**. Copy the `A123-B456-C789-D125` value — it is shown **once**. Hint afterwards is the last four characters.
4. **Révoquer** invalidates that code and any student session.
5. **J’ai un code** (or `/student`): paste the code → espace élève (accueil, génération, historique).
6. Parents cannot generate exercises. Students only see their own `studentId`.

There are **no** global demo logins `STUDENT-AMINA` / `PARENT-AMINA`.

---

## Path live — Identity + seeded Edaya + S2S key

Use this when you want home/marks/rank from the **seeded** École Cocody database.

### 1. Start identity, school API, and seed

```bash
# Terminal 1
cd edaya_identity && bun repo dev     # :9900

# Terminal 2
cd edaya_backend && bun repo dev      # :9999
```

Other terminal:

```bash
cd edaya_backend
bun repo seed
```

Default dataset is `demo-ci` (Cocody). Seed mints a **read** S2S client `children-ai` with the deterministic key:

`s2s_live_dev_edaya_ci_cocody_children_ai_key01`

Local API `.env` needs `PLATFORM_BOOTSTRAP_EMAILS=a.kone@ecole-ci.edaya.dev` so seed can mint that key as a platform actor. Without seed, a platform operator can `POST /core/s2s-clients` and put the key in the Children AI vault. A parent whose Identity subject is not linked to a guardian sees an empty children list.

Staff login in EDAYA (optional, inspect data): `a.kone@ecole-ci.edaya.dev` / `DevPassword1!`. Parent login in Children AI is an Identity guardian, e.g. `m.kone@mail.ci` / `DevPassword1!`.

### 2. Point Children AI at that API

In `children_ai/.env`:

```
PALIER=local
EDAYA_API_ORIGIN=http://localhost:9999
EDAYA_DEMO_SCHOOL_ID=sch-edaya-ci-cocody
EDAYA_DEMO_ACADEMIC_YEAR_ID=2025-ci
EDAYA_DEMO_API_KEY=s2s_live_dev_edaya_ci_cocody_children_ai_key01
EDAYA_CONTEXT=http
```

Restart `bun run dev` in `children_ai`. `/health` should show `contextMode: http`.

If the guardian has no children in Edaya, `/parent/children` is `[]` with an empty-state message — **no** Aminata injection.

### Optional: change marks in EDAYA

1. In EDAYA, open the linked student and change a **Mathématiques** assessment score.
2. Wait ~5 minutes or call `POST http://localhost:8787/snapshots/sync` with the **student** Bearer token from code login.
3. If the academic picture changed, a **new snapshot** is stored and the student can generate **one new** exercise set.

---

## Gemini Flash (optional)

Without a key, generate uses the **stub** (deterministic questions from the official leçon). With a key in `children_ai/.env`:

```
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.5-flash
```

Restart the API. `/health` → `generator: gemini-flash`. Only **Créer mes exercices** (élève) calls Gemini. Still no solutions in the JSON.

---

## Checks and troubleshooting

```bash
cd children_ai
bun test
curl http://localhost:8787/health
```

| Symptom | Likely cause |
|---------|----------------|
| Student web cannot login / CORS | API not on 8787, or `PUBLIC_API_URL` / Identity `TRUSTED_ORIGINS` missing `:5175` |
| Parent login cookie rejected | Identity not on `:9900`, or student-web origin not in `TRUSTED_ORIGINS` |
| `POST /auth/edaya/access-token` 401 after a successful login | Restart student-web so the Vite `/auth` proxy is active. `127.0.0.1:5175` and `localhost:9900` are different sites; the session cookie is not sent on a cross-site POST. |
| Parent JWT 401 on `/parent/*` | `FIRST_PARTY_API_ORIGINS` missing `http://localhost:8787`, or `CHILDREN_API_ORIGIN` mismatch |
| `PALIER_ORIGIN_MISMATCH` | `EDAYA_API_ORIGIN` is staging/prod while `PALIER=local` |
| `SCHOOL_INTEGRATION_MISSING` | Wrong `EDAYA_DEMO_SCHOOL_ID` or vault not seeded |
| Live home empty / fetch error | EDAYA not running, not seeded, or `EDAYA_CONTEXT=http` without the `s2s_live_` key |
| Empty children in live mode | Guardian Identity subject not linked in Edaya (expected) |
| Generate stuck on stub | `GEMINI_API_KEY` empty or API not restarted |
| Parent can see sets but no generate button | Expected |

Local file store (snapshots/sets/codes) lives in `children_ai/.data/`. Delete that folder if you want a clean generate-once cycle.

Manual CRON (force-sync students that currently have an **active** access code):

```bash
bun --filter @children-ai/api cron:local
```

---

## Architecture (short)

Tenancy is two axes: **palier** (this deployment: local / staging / prod) and **school**. Demo Cocody is a **dataset**, not a palier. One read-only EDAYA `s2s_live_` **per school** in that palier’s vault. LLM key is per palier.

```
Parent browser  →  Identity cookies  →  JWT aud=Children AI  →  /parent/*
Student browser →  code              →  opaque session       →  /home, /exercise-sets
Children AI API →  Bearer s2s_live_  →  Edaya /core/entities/*/list
```

| Palier | EDAYA origin |
|--------|----------------|
| local | `http://localhost:9999` |
| staging | `https://staging.api.edayaplus.com` |
| prod | `https://api.edayaplus.com` |

Never point prod Children AI at staging EDAYA (or the reverse). Never forward a human JWT to the school API.

### Cloudflare later

`apps/api/wrangler.jsonc`: top-level = local, `env.staging`, `env.prod` (separate KV ids). Secrets (never git):

```bash
wrangler secret put VAULT_MASTER_KEY --env staging
wrangler secret put GEMINI_API_KEY --env staging
wrangler secret put EDAYA_DEMO_API_KEY --env staging
wrangler secret put IDENTITY_DIRECTORY_SECRET --env staging
```

Do not set `EDAYA_DEMO_API_KEY` on prod.

```
package/domain              ports and types
package/app                 ChildrenAiApp
package/adaptors            fixture + HTTP EDAYA, stub, Gemini, file store
package/adaptor-cloudflare  KV + encrypted vault
apps/api                    Hono (Bun + Worker)
apps/student-web            SvelteKit (parent Identity + student codes)
```
