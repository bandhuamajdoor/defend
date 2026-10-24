# Development documentation
Version 0.1 — 24 October 2026. These documents define the release target. A local mock preview is now implemented; see [implementation status and evidence](16-implementation-status.md) for what works and what remains unverified.

## Read in this order
1. [Product requirements](01-product-requirements.md): users, scope, requirement IDs and acceptance.
2. [UX specification](02-user-experience.md): screens, states, accessibility and copy.
3. [Architecture](03-architecture.md): modules, async work and sequence.
4. [Data model](04-data-model.md): entities, ownership, constraints and lifecycle.
5. [API behaviour](05-api-contract.md), [OpenAPI](contracts/openapi.json), and [JSON Schema](contracts/domain.schema.json).
6. [Interview controller](06-interview-controller.md) and [AI specification](07-ai-and-evaluation.md).
7. [Project ingestion](08-project-ingestion.md), [security and privacy](09-security-and-privacy.md).
8. [Testing and release gates](10-testing-and-quality.md).
9. [Developer setup](11-developer-guide.md), [deployment and operations](12-deployment-and-operations.md).
10. [Implementation plan](13-implementation-plan.md), [pilot and submission](14-pilot-and-submission.md), [decisions and risks](15-decisions-and-risks.md).

## Supporting assets
- Prompt templates: [preparation](prompts/preparation.md), [interviewer](prompts/interviewer.md), [evaluation](prompts/evaluation.md).
- [Contract examples](fixtures/contract-examples.json).
- [Behavioural evaluation cases](fixtures/evaluation-cases.json).
- [Example environment](../.env.example).
- [Research and source links](defend-architecture-research.md).

## Authority and change control
Requirements define product scope; domain schema defines field names/enums; OpenAPI defines routes; controller spec defines transitions; data spec defines persistence. Research is background, not a competing specification. Contradictions are defects: update the affected documents and examples together, never silently choose one.

Default engineering decisions are approved working assumptions for implementation, not new user requirements. Record changed defaults in the decision log. No document authorizes purchases, public disclosure of private projects, or contacting classmates.

## Definition of a functional release
A fresh visitor can try the sample, upload supported files, confirm the project brief, finish or stop an interview, reload without losing accepted answers, inspect feedback evidence, retest a weak area, export their report, and delete their data. All mandatory release gates must have recorded evidence. A mock model is valid for development only and must be clearly labelled in demonstrations.

