# Ingestion and project evidence
## v0.1 input contract
Selected UTF-8 text files plus title, brief and contribution via JSON. No repositories fetched by URL, archives, PDFs, binaries or code execution.
Allowed extensions: .md, .txt, .js, .jsx, .ts, .tsx, .json, .py, .sql, .css, .html, .yaml, .yml.
Limits: 20 files, 64 KiB UTF-8/file, 512 KiB aggregate, 120,000 aggregate characters. Request body cap 2 MiB accounts for JSON escaping. Title <=100, brief <=4,000, contribution <=2,000 characters. Filename path <=200 characters. Reject unsupported encodings and embedded NUL. Validate server-side before provider calls.

Disallow secrets/config keys: .env and variants, private-key files, credential stores, .git, node_modules, lockfiles, build output and vendor directories. Reject suspected credential content with file+line metadata, never echo values. Detection is best-effort; UI tells users to upload only material they are authorised to share and review exclusions.

## Pipeline
1. Authenticate owner, validate consent and quota, normalise relative paths.
2. Reject absolute paths, traversal, control characters, duplicate normalised/case-folded names and forbidden files.
3. Normalise CRLF/CR to LF; hash exact normalised text. Preserve display spelling and immutable line numbering.
4. Validate limits and secret patterns. Reject upload atomically with actionable metadata; do not silently drop files.
5. Persist project/version/files and preparation job in one transaction.
6. Index headings, imports/exports and function/type boundaries. Use a JS/TS parser where available; safely fall back to line windows when parse fails and label reduced precision. Do not execute.
7. Build bounded evidence windows (typically 10–80 lines), with overlaps at function boundaries; each has version/file/span/hash.
8. Model produces summary, uncertainties and topic cards; verify every citation against server-created evidence.
9. Present summary for student confirmation; changes create a new plan revision. Confirm freezes plan for session creation.

## Coverage
Track accepted files, analysed spans and omitted/unsupported semantic analysis. A source parser failure does not mean the file is empty. If the provider context/call cap prevents full intended analysis, fail preparation or require a reduced upload; never label a partial pass complete.
The model sees evidence packs with explicit IDs and file locations. Returned IDs must be a subset of provided IDs. Additional retrieval within accepted files may expand the evidence catalogue before generation.

## Updates
An uploaded correction creates a new immutable version. Existing sessions/reports retain their original sources. Re-preparation never changes line numbers under an existing report. A retest uses the original version by default; testing changed code starts a new normal session and cannot imply directly comparable improvement.

## Sample fixture
Create a small original TypeScript “Campus Tickets” project with README, route handler, price calculation, ownership middleware and tests. Include one demonstrable stale-price bug, one correctly handled edge case, and one missing-context scenario. Provide a separate ground-truth manifest for evaluation, never visible to the interview model as a student's answer.
The fixture is implemented in [sample source](../src/fixtures/sample.ts), with a separate [ground-truth manifest](../evals/ground-truth.json). Each guest receives an isolated copy. No live model output is substituted by this mock fixture.

