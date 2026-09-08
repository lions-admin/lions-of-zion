---
name: create-migration
description: Author a numbered SQL migration and apply it safely to Preview then Production before the code that needs it is pushed. Use when adding or changing database schema, a trigger, a constraint, or an enum value.
disable-model-invocation: true
---

# Create and apply a migration

This is the most dangerous repeated operation in this repository. It is
user-invoked only, on purpose.

**Why it is dangerous:** a push to `main` is live on `lionsofzion.io` in about
two minutes, with no manual step. `scripts/check-deployment-schema.ts` runs
inside `npm run build` and refuses to build when the schema does not match. So
the schema must lead the code, never follow it.

The failure has already happened: migration `0051` added an `entity_type` value
the operations console writes on every tool call. The code reached Production
first, and the audit write would have failed on first use.

## Order — never vary it

```
1. author the migration file
2. apply to Preview
3. apply to Production
4. push the code
```

## 1. Author

Two kinds of migration live in `server/db/migrations/`:

- **Generated** — a schema change in `server/db/schema*.ts`, then
  `npm run db:generate`. Needs no database.
- **Hand-written** — a trigger, policy, constraint or data change. Create the
  file yourself.

Either way the file is numbered, and **the number must be the next free one**.
Check both the directory and the journal, which must agree:

```bash
ls server/db/migrations/*.sql | tail -3
tail -20 server/db/migrations/meta/_journal.json
```

Both are applied in filename order by `db:migrate` **and** by the PGlite test
harness — so a trigger cannot exist in one and not the other.

A hand-written file also needs its journal entry, or drizzle will not consider
it applied. Append to the `entries` array in `meta/_journal.json`:

```json
{ "idx": <next>, "version": "7", "when": <epoch ms>, "tag": "<filename without .sql>", "breakpoints": true }
```

## 2 & 3. Apply

`npm run db:migrate` is unreliable here. When it fails, apply by hand — and
**both halves are required**:

1. Run the DDL against the target branch.
2. Insert drizzle's receipt row into its migrations table.

Skipping the receipt leaves the database correct but the schema preflight
convinced the migration is missing, and it will refuse to deploy.

**Credentials.** Production credentials are **not readable from this machine** —
every one is a Vercel *sensitive* variable, which is write-only by design.
`vercel env pull` and the decrypt API both return empty.

- `.env.local` holds a real connection string, but it is the **Preview** branch
  (`DATABASE_RESOURCE_ENV=preview`, endpoint `ep-old-feather-…`).
- **Production is the Neon `main` branch on a different endpoint.** Get it from
  the Neon Console, or authenticate `neonctl`.

If a Production credential is needed and unavailable, do not guess and do not
improvise a workaround: prepare the exact statement to run and hand it over.

Verify after each environment:

```bash
npm run schema:check
```

## 4. Push

Only once both environments report clean. `vercel rollback` is the fast undo.

## Before you finish

- `npx vitest run` — the harness applies migrations per test, so a broken file
  fails loudly here first.
- If the change alters a rule described in prose, run the `doc-drift-auditor`
  agent. Documents here have described enforcement that later migrations had
  already removed.
