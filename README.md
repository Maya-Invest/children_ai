# Children AI — launch and test

Children AI is a **student practice app** (collège Maths, programme DPFC). It is not the EDAYA staff UI and not a chatbot.

Parents sign in with their **Edaya Identity** account. Students have **no Identity account**: a parent issues a revocable access code (shown once). Codes live only in Children AI, hashed. Children AI talks to Edaya with a machine key (`s2s_live_…`), never with the parent JWT.

---

## Do I have to seed EDAYA?

| What you want | What to do |
|---------------|------------|
| Your school’s students after Identity login | **Path live**: Identity + school API. Parent lists the children linked in Edaya (including a school you just created). |
| Try Aminata without a school | **Path demo**: landing button **Essayer la démo**. Fixture notes only. Not attached to Identity parents. |
| Parent Identity with no guardian links | `/parent` shows an empty list (no Aminata). |

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
PUBLIC_AUTH_URL=http://localhost:9900
```

Identity must allow the Children AI API as a JWT audience and the student-web origin as a trusted cookie origin (`FIRST_PARTY_API_ORIGINS` includes `http://localhost:8787`, `TRUSTED_ORIGINS` includes `http://localhost:5175`).

---

## Path live — Identity + your school’s students

Start Identity and the school API. Create a school in the webapp (or seed Cocody). Register-school mints a **read** S2S client `children-ai`. Locally the key is deterministic: `s2s_live_local_<schoolIdWithoutDashes>_children_ai01`. Children AI derives the same secret when the vault has no row.

```bash
# Terminal 1
cd edaya_identity && bun repo dev     # :9900

# Terminal 2
cd edaya_backend && bun repo dev      # :9999

# Terminal 3
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
2. **Parent → Me connecter** with the Identity account that is a **linked guardian** in Edaya. You should see **your** students, never Aminata unless she is actually linked.
3. On the parent dashboard: **Générer un code**. Copy the `A123-B456-C789-D125` value — it is shown **once**. Hint afterwards is the last four characters.
4. **Révoquer** invalidates that code and any student session.
5. **J’ai un code** (or `/student`): paste the code → espace élève (accueil, génération, historique). The code’s `schoolId` + `studentId` drive live Edaya marks.

A teacher Identity login is not a guardian: the live list stays empty unless that account is also linked as a guardian.

Staff login in EDAYA (optional): after seed, `a.kone@ecole-ci.edaya.dev` / `DevPassword1!`. Demo guardian after seed: `m.kone@mail.ci` / `DevPassword1!`.

### Seeded Cocody (optional)

`bun repo seed` on Edaya mints `s2s_live_dev_edaya_ci_cocody_children_ai_key01` for `sch-edaya-ci-cocody`. Put that value in `EDAYA_DEMO_API_KEY` (already in `.env.example`) so the vault does not need to derive a local key for Cocody.

Local API `.env` needs `PLATFORM_BOOTSTRAP_EMAILS=a.kone@ecole-ci.edaya.dev` so seed can mint that key as a platform actor, and `CHILDREN_AI_RESOLVE_SECRET` matching Children AI.

### Optional: change marks in EDAYA

1. In EDAYA, open the linked student and change a **Mathématiques** assessment score.
2. Wait ~5 minutes or call `POST http://localhost:8787/snapshots/sync` with the **student** Bearer token from code login.
3. If the academic picture changed, a **new snapshot** is stored and the student can generate **one new** exercise set.

---

## Path demo — landing button (Aminata fixture)

No Identity and no code. On the landing page, **Essayer la démo** calls `POST /auth/demo` (blocked on palier `prod`) and opens Aminata’s fixture notes.

Parent `/parent/*` still uses live Edaya resolve. Aminata is **not** attached to Identity parents.

There are **no** global demo logins `STUDENT-AMINA` / `PARENT-AMINA`.

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
| `SCHOOL_INTEGRATION_MISSING` | New UUID school not minted, or vault cannot derive the local key |
| Live home empty / fetch error | EDAYA not running, resolve secret mismatch, or missing `s2s_live_` for that school |
| Empty children in live mode | Guardian Identity subject not linked in Edaya, or teacher-only login (expected) |
| Parent still sees Aminata | Old `EDAYA_CONTEXT=fixture` / empty origin; set `EDAYA_CONTEXT=http` and restart |
| Generate stuck on stub | `GEMINI_API_KEY` empty or API not restarted |
| Parent can see sets but no generate button | Expected |
| Demo button 403 | Palier `prod` |

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

### Cloudflare later

`apps/api/wrangler.jsonc`: top-level = local, `env.staging`, `env.prod` (separate KV ids). Secrets (never git):

```bash
wrangler secret put VAULT_MASTER_KEY --env staging
wrangler secret put GEMINI_API_KEY --env staging
wrangler secret put EDAYA_DEMO_API_KEY --env staging
wrangler secret put IDENTITY_DIRECTORY_SECRET --env staging
wrangler secret put CHILDREN_AI_RESOLVE_SECRET --env staging
```

Do not set `EDAYA_DEMO_API_KEY` on prod. Do not enable `/auth/demo` on palier prod.

```
package/domain              ports and types
package/app                 ChildrenAiApp
package/adaptors            fixture + HTTP EDAYA, stub, Gemini, file store
package/adaptor-cloudflare  KV + encrypted vault
apps/api                    Hono (Bun + Worker)
apps/student-web            SvelteKit (parent Identity + student codes)
```
