# Defend
A project interview coach that helps students explain, defend, and improve their understanding of their own software.

**Repository status:** development specification only. No application, database, provider integration, deployment, or product tests have been implemented. The documentation checks are executable; the product commands are a planned contract.

Start with [the documentation index](docs/README.md), then [requirements](docs/01-product-requirements.md) and [the implementation plan](docs/13-implementation-plan.md).

## Product commitments
- An adaptive project interview, followed by evidence-linked feedback and a fresh retest.
- Typing, Wispr, and other external dictation tools use the same answer composer.
- Dictation and speech output are replaceable. No Wispr runtime dependency.
- No claim of official grades, verified authorship, or guaranteed interview success.
- Real classmate validation and a public sample experience for the hackathon.

## Documentation check
Run from this repository with Node.js:
```text
node scripts/check-docs.mjs
```

## Build readiness
The seven-day release scope, contracts, prompts, state transitions, acceptance gates, and operations are specified. Choose provider credentials, hosting account, and a spend ceiling before enabling paid integrations. Defaults and remaining choices are recorded in [decisions](docs/15-decisions-and-risks.md).

Research: [existing-system analysis](docs/defend-architecture-research.md). Specifications dated 24 October 2026, version 0.1.

