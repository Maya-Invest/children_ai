# @children-ai/student-web

SvelteKit student UI. Local port **5174** (`127.0.0.1`).

```sh
# from children_ai/
bun run dev          # API + this app
# or
bun run dev:web      # UI only; needs API on :8787
```

`apps/student-web/.env`:

```
PUBLIC_API_URL=http://localhost:8787
```

Port 5174 is also used by `edaya_web` webadmin — do not run both at once.

Full click-through: [../../README.md](../../README.md).
