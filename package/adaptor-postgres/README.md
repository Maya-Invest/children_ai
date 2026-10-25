# @children-ai/adaptor-postgres

One Postgres schema for Edaya Spark. Local and tests use PGlite. The Worker uses Postgres through Hyperdrive.

| `DATABASE_URL` | Driver |
|---|---|
| `pglite`, `memory` | Ephemeral PGlite (tests). Refused when `RUNTIME=local`. |
| `pglite:.data/spark` | Persisted PGlite. Migrates on open. |
| `postgres://…` | `node-postgres`. Apply migrations with `bun --filter @children-ai/adaptor-postgres db:migrate` before the Worker boots. |
