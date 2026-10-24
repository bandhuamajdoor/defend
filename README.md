# Defend

A private project interview workspace for students: bring your source, confirm the context, practise explaining your decisions, and reflect with source-linked notes.

**Status: working local mock preview.** Sample/upload → brief → interview → report → retest → export/delete is implemented. No live AI provider is connected. The deterministic adapter does not assess correctness or competency; every criterion is honestly marked **not assessed**. Public deployment, real-provider evaluation, operational rehearsals, and classmate trials remain open.

## Run locally

Requires Node.js **22.12+** (Node 24 LTS recommended) and npm. Windows is supported without Docker.

```text
npm ci
npm run setup
npm run db:local
```

Keep the database terminal open. In another terminal:

```text
npm run db:deploy
npx prisma generate
npm run db:seed
npm run worker:dev
```

Keep the worker open. In a third terminal:

```text
npm run dev
```

Open [the local workspace](http://localhost:3000). Use localhost, matching APP_ORIGIN, for cookie and Origin validation. Accept the visible storage consent and try the sample, or add your own UTF-8 files. No provider credentials are needed.

Setup creates a gitignored .env.local with a random app secret. The local PostgreSQL launcher stores development data under gitignored .data/. For an existing PostgreSQL server, set DATABASE_URL and skip db:local.

## Verify

```text
npm run docs:check
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run eval
npm run build
```

Integration tests need the database running and the normal worker **stopped**: tests exercise claims, races and failures directly. Browser checks need web and worker running:

```text
npx playwright install chromium
npm run test:e2e
```

Screenshots, accessibility scans and evaluation results are saved under gitignored output/. The eval command checks schema and exact quotation integrity; it does **not** establish AI quality. GitHub Actions runs checks with PostgreSQL and a production web/worker smoke test.

## Architecture and delivery

- Next.js 16 / React 19, strict TypeScript, PostgreSQL and Prisma 7.
- Separate Node worker; transactional enqueue, expiring leases, conditional publication and bounded retries.
- Hashed guest credentials; exact Origin checks, ownership scopes, idempotent writes and database quotas.
- Source is never executed. Accepted answers live in PostgreSQL; unsent drafts stay in memory.
- Domain modules are independent of UI/providers; runtime validation uses the committed JSON schema.
- Optional browser speech; typing and external dictation share one textarea. No Wispr SDK, microphone capture, automatic send or numeric grade.

[Compose](compose.yaml) and the [Dockerfile](Dockerfile) are prepared. Set a URL-safe POSTGRES_PASSWORD and random APP_SECRET in a gitignored .env, then run docker compose up --build. This binds the preview to localhost and applies migrations before web/worker start. **Container execution is unverified here because Docker is not installed.** Public hosting is not configured.

Start with the [documentation index](docs/README.md), [developer guide](docs/11-developer-guide.md), and [implementation status](docs/16-implementation-status.md). Original requirements remain release targets; this is not the final hackathon release.
