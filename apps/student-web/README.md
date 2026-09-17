# @children-ai/student-web

SvelteKit student UI. Local port **5175** (`127.0.0.1`).

```sh
# from children_ai/
bun run dev          # API + this app
# or
bun run dev:web      # UI only; needs API on :8787
```

`apps/student-web/.env`:

```
PUBLIC_API_URL=http://localhost:8787
PUBLIC_AUTH_URL=http://localhost:9900
```

Port 5175 is reserved for Children AI student-web (`edaya_web` webadmin uses 5174).

Full click-through: [../../README.md](../../README.md).
