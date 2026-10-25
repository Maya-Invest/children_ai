# @children-ai/api

Hono API for the student practice app (Bun locally, Cloudflare Worker in staging/prod).

Launch from the **repo root**:

```sh
cp .env.example .env
bun install
bun run dev          # API :8787 + student-web :5174
```

API only: `bun run dev:api`. Health: http://localhost:8787/health

Live parents vs demo button: [../../README.md](../../README.md).
