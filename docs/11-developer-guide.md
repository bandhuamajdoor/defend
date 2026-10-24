# Developer guide
## Current repository
Only specifications and documentation validation exist. The commands below are the package-script contract to implement in B01, not working setup instructions today. Existing command: node scripts/check-docs.mjs.

## Planned stack and layout
TypeScript; Next.js App Router; PostgreSQL; Prisma; independent Node worker. Node 24 LTS working baseline. Browser SpeechSynthesis behind an interface. Structured model adapter selected after day-one evaluation.
```text
src/app/                 routes, screens and API transport
src/components/          UI and evidence/report components
src/domain/              pure state, budgets, rubric and DTOs
src/services/            ingestion, preparation, interview, reporting
src/providers/           mock and chosen model; optional speech provider
src/db/                  Prisma client and owner-scoped repositories
src/jobs/                claim, lease, retry and handlers
src/worker.ts            long-running worker entry
prisma/                  schema, migrations and sample seed
tests/                   domain, API, DB and browser tests
evals/                   fixtures, runners and human review records
docs/                    specifications/contracts/prompts
```

## Environment
Copy [.env.example](../.env.example) into a gitignored .env.local after scaffolding. Web and worker must load the same validated configuration explicitly; a Node worker does not automatically inherit Next's env-file behaviour.
Required local: DATABASE_URL, APP_ORIGIN, APP_SECRET, MODEL_PROVIDER=mock. Provider key/model/token-price config plus positive spend ceilings required in paid mode. Never put secrets in NEXT_PUBLIC variables.

## Planned commands
| Command | Required behaviour |
| --- | --- |
| npm ci | Reproducible dependency install from committed lockfile |
| npm run dev | Next development web server |
| npm run worker:dev | Worker with explicit local env loading |
| npm run db:migrate | Development migration workflow |
| npm run db:deploy | Apply checked-in production migrations |
| npm run db:seed | Idempotent sample seed only; no user-data reset |
| npm run build | Type-safe web and worker production builds |
| npm run start | Production web |
| npm run worker | Compiled production worker |
| npm run lint / typecheck / test | Static checks and domain tests |
| npm run test:integration / test:e2e | Real DB invariants and browser tests |
| npm run eval | Mock or explicitly enabled real-model evaluation |
| npm run docs:check | Run documentation/contract validator |

Scaffold must supply Docker Compose for local PostgreSQL and the two processes, while allowing native Node web/worker development on Windows. Do not require Bash-only scripts. Port and DB values in examples are local defaults, not credentials.

## Coding rules
Validate inputs at the boundary and model output before state mutation. Domain functions have no provider SDK or browser audio imports. Use typed enums consistent with contracts. Never hide failure with fixture output. Store canonical results before rendering.
Queries require owner context. Source/report HTML must be escaped. Use transactions for state+job writes. Unit tests target behaviour; integration tests own concurrency guarantees.
Keep prompt templates versioned. Evidence references are stable IDs; avoid regenerated line numbers from model summaries.

## Development order
First build the vertical slice in mock mode: sample -> prepare -> confirm -> first answer -> report. Then prove persistence/races, then connect one real provider, then finish UX/retest/deletion. Include actual model behaviour before visual polish.
Changing a contract requires schema, OpenAPI, examples, validators, API DTOs, tests and affected prose in one change. Product runtime DTOs should be generated from or tested against the JSON schema.

## Git / delivery
Inspect git state before changes. Use codex/ prefix for a new branch unless user specifies otherwise. Do not commit credentials or actual classmate data. PR description should name the user-visible behaviour, validation and remaining limits. No deployment/paid account creation is implied by this guide.

