# Developer guide

## Current implementation
Next.js 16.4.3, React 19, strict TypeScript, PostgreSQL and Prisma 7.10.1, with an independent Node worker. Dependencies and lockfile are pinned. Native verification uses Node 22.20.0 on Windows; CI/container configuration uses Node 24.22.1. See [implementation status](16-implementation-status.md) for the scope and remaining release gates.

## Setup and commands
Follow the [README](../README.md). npm ci uses the checked-in .npmrc to avoid an observed npm 11.3 optional-peer resolver crash. npm run setup generates .env.local with a random secret and preserves existing configuration. Next loads it automatically; worker/integration/evaluation scripts load it explicitly. Host environment values take precedence.

Use npm run db:local for a persistent local PostgreSQL cluster under .data/postgres, or configure DATABASE_URL. Keep DB running, apply npm run db:deploy, then npx prisma generate. db:migrate creates reviewed development migrations; never reset production. db:seed validates the fixture without resetting user data; guest copies are created on demand.

| Command | Behaviour |
| --- | --- |
| npm run setup | Create local env and random secret if missing |
| npm run db:local | Persistent native development PostgreSQL |
| npm run db:migrate / db:deploy | Development migrations / apply checked-in migrations |
| npm run db:seed | Validate original sample fixture |
| npm run dev / worker:dev | Web and separate development worker |
| npm run build | Generate Prisma, type-check/build web, bundle production worker |
| npm run start / worker | Production web / compiled worker |
| npm run lint / typecheck / test | Static checks and domain tests |
| npm run test:integration | Real PostgreSQL invariants; stop normal worker first |
| npm run test:e2e | Browser sample/upload, recovery, controls, report/export/retest/deletion |
| npm run eval | Mechanical mock checks; no semantic-quality claims |
| npm run docs:check | Local links, examples, contract structure and references |

Open http://localhost:3000 to match APP_ORIGIN. Health checks DB access and a worker heartbeat newer than 60 seconds. Browser checks require npx playwright install chromium and running web + worker. Generated artifacts are under output/. Successful smoke runs delete their workspace; failed runs may leave test guests until expiry. Never run tests against production.

## Layout and rules
- src/app: entry points, HTTP transport and styles.
- src/components/screens: separate screens; shared hooks/controls in src/components.
- src/domain: pure controller, types and runtime contract validation.
- src/services: API orchestration, ingestion, evidence and exports.
- src/providers: guided sample/structure coaching, free/local structured transports and orchestration. See [free AI setup](17-free-ai-setup.md).
- src/jobs, src/db and src/worker.ts: persistence, queue, worker and maintenance.
- prisma: schema/migrations; tests: domain and real DB integration.
- evals: ground truth and mechanical fixtures; scripts/browser-smoke.mjs: browser acceptance checks.

Owner context is required in queries; foreign IDs return 404. Answer, state, event and job writes are atomic. Owner-scoped PostgreSQL advisory locks serialize mutations and publication. No provider work runs inside transactions. Uncertain retries use the same idempotency key. Browser drafts clear only after server acceptance. Source/report HTML is escaped.

Runtime validation reads the committed JSON schema; integration tests validate public DTOs against it. Update schema, OpenAPI, examples, tests and prose together. Record refinements in [decisions](15-decisions-and-risks.md).

## Git workflow
The original specification is on main; implementation is on codex/product-mvp. Make focused commits when a coherent change is ready and push regularly. Never add .env.local, .data, actual user projects, credentials or generated test output. Draft PRs should explain actual behaviour, validation and remaining limitations.
