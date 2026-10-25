# Children AI — launch and test

Children AI is a **student practice app** (collège Maths, programme DPFC). It is not the EDAYA staff UI and not a chatbot.

Parents sign in with their **Edaya account** on the unified API (`:9999`). Students have **no Edaya account**: a parent issues a revocable access code (shown once). Codes live only in Children AI, hashed. Children AI talks to Edaya with a machine key (`s2s_live_…`), never with the parent JWT.

---

## Do I have to seed EDAYA?

| What you want | What to do |
|---------------|------------|
| Your school’s students after Edaya login | **Path live**: unified API. Parent lists the children linked in Edaya (including a school you just created). |
| Try Léa without a school | **Path demo**: landing button **Essayer la démo**. Fixture notes only. Not attached to Edaya parents. |
| Parent account with no guardian links | `/parent` shows an empty list (no Léa). |

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

On macOS/Linux: `cp .env.example .env`.

Keep these aligned with `edaya_backend/apps/api/.env`:

```
EDAYA_API_ORIGIN=http://localhost:9999
EDAYA_CONTEXT=http
CHILDREN_AI_RESOLVE_SECRET=local-children-ai-resolve-secret
```

`apps/student-web/.env` should contain:

```
PUBLIC_API_URL=http://localhost:8787
PUBLIC_AUTH_URL=http://localhost:9999
```

The parent JWT is issued by the unified API: issuer and audience are `EDAYA_API_ORIGIN` (`http://localhost:9999`). `apps/api/.env` `TRUSTED_ORIGINS` must include `http://127.0.0.1:5175` so the session cookie is accepted. Login is a one-time code (`POST /auth/edaya/otp/start`), not a password.

---

## Path live — Edaya account + your school’s students

Start the unified API (accounts and school data on `:9999`). Create a school in the webapp (or seed Cocody). Register-school mints a **read** S2S client `children-ai`. Locally the key is deterministic: `s2s_live_local_<schoolIdWithoutDashes>_children_ai01`. Children AI derives the same secret when the vault has no row.

```bash
# Terminal 1
cd edaya_backend && bun repo dev      # :9999

# Terminal 2
cd children_ai
bun test
bun run dev
```

| App | URL |
|-----|-----|
| Student / parent web | http://127.0.0.1:5175 |
| API health | http://localhost:8787/health |

Health should look like `palier: local`, `schoolTenancy: per-school`, `contextMode: http`, `generator: stub` (unless you set `GEMINI_API_KEY`).

### What to click

1. Open http://127.0.0.1:5175
2. **Parent → Me connecter** with the Edaya account that is a **linked guardian**. Enter the email, then the one-time code from the API logs (`EMAIL_TRANSPORT=log`). You should see **your** students, never Léa unless she is actually linked.
3. On the parent dashboard: **Générer un code**. Copy the `A123-B456-C789-D125` value — it is shown **once**. Hint afterwards is the last four characters.
4. **Révoquer** invalidates that code and any student session.
5. **J’ai un code** (or `/student`): paste the code → espace élève (accueil, génération, historique). The code’s `schoolId` + `studentId` drive live Edaya marks.

A teacher login is not a guardian: the live list stays empty unless that account is also linked as a guardian.

Seeded guardian email: `m.kone@mail.ci`. Sign-in uses the one-time code, not a password.

### Seeded Cocody (optional)

`bun repo seed` on Edaya mints `s2s_live_dev_edaya_ci_cocody_children_ai_key01` for `sch-edaya-ci-cocody`. Put that value in `EDAYA_DEMO_API_KEY` (already in `.env.example`) so the vault does not need to derive a local key for Cocody.

Local API `.env` needs `PLATFORM_BOOTSTRAP_EMAILS=a.kone@ecole-ci.edaya.dev` so seed can mint that key as a platform actor, and `CHILDREN_AI_RESOLVE_SECRET` matching Children AI.

### Optional: change marks in EDAYA

1. In EDAYA, open the linked student and change a **Mathématiques** assessment score.
2. Wait ~5 minutes or call `POST http://localhost:8787/snapshots/sync` with the **student** Bearer token from code login.
3. If the academic picture changed, a **new snapshot** is stored and the student can generate **one new** exercise set.

---

## Path demo — landing button (Léa fixture)

No Edaya account and no code. On the landing page, **Essayer la démo** calls `POST /auth/demo` (blocked on palier `prod`) and opens Léa’s fixture notes.

Parent `/parent/*` still uses live Edaya resolve. Léa is **not** attached to Edaya parents.

There are **no** global demo logins `STUDENT-LEA` / `PARENT-LEA`.

---

## Gemini Flash (optional)

Without a key, generate uses the **stub** (deterministic questions from the official leçon). With a key in `children_ai/.env`:

```
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.5-flash
```

Restart the API. `/health` → `generator: gemini-flash`. Only **Créer mes exercices** (élève) calls Gemini. Still no solutions in the JSON.

---

## Integration

`bun run test:integration` runs the Children AI API against a local HTTP stand-in for Edaya. It does not start `edaya_backend` and it does not seed a school. The stand-in listens on `http://127.0.0.1:9999` (the origin the local palier allows) and answers the parent signing keys, guardian resolve, and the small set of entity lists the student home reads. Stop anything already bound to port 9999 before the run. The API under test uses port 18787 (`CHILDREN_AI_TEST_PORT`).

```bash
cd children_ai
bun run test:integration
```

`bun test` stays the unit suite and does not include this command. A later GitHub qualify job runs `bun run test:integration` in this repository only and gates deploy on it.

`bun run test:integration:ui` opens the student web and walks a live session in Chromium: parent login, the two children, an access code, the student home, and one exercise generation. It uses the same Edaya stand-in on port 9999. The web server uses port 15175. The first run installs Playwright Chromium into `.cache/ms-playwright`.

## Checks and troubleshooting

```bash
cd children_ai
bun test
curl http://localhost:8787/health
```

| Symptom | Likely cause |
|---------|----------------|
| Student web cannot login / CORS | API not on 8787, or `PUBLIC_API_URL` / Edaya `TRUSTED_ORIGINS` missing `:5175` |
| Parent login cookie rejected | Unified API not on `:9999`, or `http://127.0.0.1:5175` missing from `TRUSTED_ORIGINS` |
| `POST /auth/edaya/access-token` 401 after a successful login | Restart student-web so the Vite `/auth` proxy targets `:9999`. The session cookie is first-party on `127.0.0.1:5175`. The token `resource` must be `http://localhost:9999`. |
| Parent JWT 401 on `/parent/*` | Children AI verifier `iss`/`aud` must both be `EDAYA_API_ORIGIN` |
| `PALIER_ORIGIN_MISMATCH` | `EDAYA_API_ORIGIN` is staging/prod while `PALIER=local` |
| `SCHOOL_INTEGRATION_MISSING` | New UUID school not minted, or vault cannot derive the local key |
| Live home empty / fetch error | EDAYA not running, resolve secret mismatch, or missing `s2s_live_` for that school |
| Empty children in live mode | Guardian account not linked in Edaya, or teacher-only login (expected) |
| Parent still sees Léa | Old `EDAYA_CONTEXT=fixture` / empty origin; set `EDAYA_CONTEXT=http` and restart |
| Generate stuck on stub | `GEMINI_API_KEY` empty or API not restarted |
| Parent can see sets but no generate button | Expected |
| Demo button 403 | Palier `prod` |

Local snapshots, sets, codes, sessions, and the school vault live in PGlite at `children_ai/.data/spark` (`DATABASE_URL=pglite:.data/spark`). Delete that folder if you want a clean generate-once cycle. Stop the API first: PGlite keeps a lock on the directory.

---

## Architecture (short)

Tenancy is two axes: **palier** (this deployment: local / staging / prod) and **school**. Demo Cocody is a **dataset**, not a palier. One read-only EDAYA `s2s_live_` **per school** in that palier’s vault. LLM key is per palier.

```
Parent browser  →  Edaya cookie on :9999  →  JWT iss=aud=Edaya API  →  /parent/*
Student browser →  code or demo      →  opaque session       →  /home, /exercise-sets
Children AI API →  resolve secret    →  Edaya POST /internal/children-ai/resolve-guardian
Children AI API →  Bearer s2s_live_  →  Edaya /core/entities/*/list  (marks / progress)
```

| Palier | EDAYA origin |
|--------|----------------|
| local | `http://localhost:9999` |
| staging | `https://staging.api.edayaplus.com` |
| prod | `https://api.edayaplus.com` |

Never point prod Children AI at staging EDAYA (or the reverse). Never forward a human JWT to the school API.

### Cloudflare Worker

`apps/api/wrangler.jsonc`: top-level, `env.staging`, and `env.prod` each bind `HYPERDRIVE`. Replace the placeholder Hyperdrive ids before deploy. `RUNTIME=local` (`bun dev`) uses PGlite and does not open Hyperdrive. Secrets (never git):

```bash
wrangler secret put VAULT_MASTER_KEY --env staging
wrangler secret put GEMINI_API_KEY --env staging
wrangler secret put EDAYA_DEMO_API_KEY --env staging
wrangler secret put CHILDREN_AI_RESOLVE_SECRET --env staging
```

Do not set `EDAYA_DEMO_API_KEY` on prod. Do not enable `/auth/demo` on palier prod.

```
package/domain              ports and types
package/app                 ChildrenAiApp
package/adaptors            fixture + HTTP EDAYA, focus stub, Gemini, Cloudflare RAG
package/adaptor-postgres    PGlite + Postgres (Hyperdrive) repositories
apps/api                    Hono (Bun + Worker). RUNTIME, FOCUS, and GENERATOR pick adapters
apps/student-web            SvelteKit (parent Edaya OTP + student codes)
```
