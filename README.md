# Defend

A private project interview workspace for students: bring your source, confirm the context, practise explaining your decisions, and reflect with source-linked notes.

**Status: conversational V1 preview.** Sample/upload → brief → conversation with feedback after each answer → report → retest → export/delete is implemented, with light/dark/system themes, animations and optional browser dictation/speech. The included sample has a deterministic, source-linked coaching checklist. Your own project receives explanation-structure coaching until you configure **Groq Free or local Ollama**. Both adapters are implemented; external model quality has not been tested with credentials or a local model here. Public deployment and human trials remain open.

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

Open [the local workspace](http://localhost:3000). Use localhost, matching APP_ORIGIN, for cookie and Origin validation. Accept the visible storage consent and try the sample, or add your own UTF-8 files. No provider credentials are needed for guided practice.

Setup creates a gitignored .env.local with a random app secret. The local PostgreSQL launcher stores development data under gitignored .data/. For an existing PostgreSQL server, set DATABASE_URL and skip db:local.

## Free AI coaching and larger projects

Open [Coach setup](http://localhost:3000/settings) or follow the [free AI guide](docs/17-free-ai-setup.md). Groq Free needs a free account key; Ollama needs an installed local model and enough RAM/VRAM. There is no automatic paid fallback. Restart web and worker after changing provider settings, then prepare a fresh project to match the consent and saved plan.

Choose a folder or selected files: up to **500 files, 256 KiB/file, 8 MiB total and 2,000,000 characters**. C/C++ source, headers, templates, Makefiles and configuration text are accepted alongside JS/TS/Python. Folder selection respects root/nested **.gitignore** rules, shows exclusion reasons and skips common bundled libraries. Re-selecting a folder replaces the list; documentation-only context requires acknowledgement. JS/TS symbols and relative imports are indexed without executing code; other languages use text retrieval. Bounded source packs are retrieved per topic; coverage distinguishes indexed source from model-reviewed excerpts. This is focused interview preparation, not a claim that every line in an arbitrary large repository has been understood.

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

Integration tests need the database running and the normal worker **stopped**: tests exercise claims, races and failures directly. Model transport tests use synthetic responses and make no external inference calls. Browser checks need web and worker running:

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
- Optional browser dictation and speech; typing and external dictation share one textarea. Microphone starts only on request; review the transcript before sending. Browser recognition may use the browser vendor's service. Defend stores accepted text, not audio. No Wispr SDK, automatic send or numeric grade.

[Compose](compose.yaml) and the [Dockerfile](Dockerfile) are prepared. Set a URL-safe POSTGRES_PASSWORD and random APP_SECRET in a gitignored .env, then run docker compose up --build. This binds the preview to localhost and applies migrations before web/worker start. **Container execution is unverified here because Docker is not installed.** Public hosting is not configured.

Start with the [documentation index](docs/README.md), [developer guide](docs/11-developer-guide.md), and [implementation status](docs/16-implementation-status.md). The user's conversational-coaching, theme and free-provider revisions are recorded in the [decision log](docs/15-decisions-and-risks.md). Human-reviewed model quality and hosted operations remain release gates.
