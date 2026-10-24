# Implementation status and verification

24 October 2026 · local mock preview. Original requirements remain the target release specification.

## Implemented
- Isolated guest sample and selected-text upload, consent, secret/path/encoding/size checks, immutable sources and complete line-window evidence.
- Editable brief, frozen confirmation revision and practice history.
- Persistent interview, answer-dependent template follow-ups, pause/resume/skip/clarify/end, active-time/event caps and optional browser speech.
- Idempotency, stale-tab rejection, durable jobs, lease/revision publication fences and bounded retries.
- Honest mock report with exact quotations/source excerpts, escaped JSON/HTML exports, disputed-feedback receipt and fresh two-topic retest.
- Ownership checks, exact Origin validation, opaque hashed cookies, shared rate limits, deletion revocation and worker purge.
- Responsive layout, keyboard focus, native dialogs, reduced motion and text fallback.

## Verification
| Check | Actual local result |
| --- | --- |
| Domain tests | 28 passing: upload boundaries, transitions, timing, budgets, quotations and escaping |
| PostgreSQL integration | 11 passing: contracts, isolation, confirmation, double submission, tab conflict, pause/end race, lease reclamation, retries, exports, retest, deletion |
| Chromium browser | Seven scenarios passed: sample, keyboard input, recovery/controls, report/export/dispute, retest, own upload, mobile/delete-all |
| Accessibility | Automated WCAG A/AA overview scan passed after contrast fixes; full manual audit remains open |
| Build | Optimized Next.js web and independent worker compile locally |
| Dependency audit | No known vulnerabilities reported at this build |
| Evaluation | Twelve mechanical schema/quotation checks; semantic quality explicitly not evaluated |

Generated evidence: output/playwright/ and output/evals/, gitignored to prevent accidental publication of private fixtures. Reproduce with the developer guide. Release evidence still needs the final commit, environment and human reviewer.

## Initial refinements
1. One hashed guest credential is stored on Owner instead of a separate credentials table; multiple credentials/rotation are pending.
2. Session JSON is the canonical controller snapshot, alongside normalized immutable questions, answers and control events. Owner advisory locks plus lease/revision checks fence concurrent writes.
3. Complete 60-line windows are labelled as line-window indexing; AST semantic indexing is pending. Accepted files are never silently truncated.
4. Expiry is fixed at creation: seven days, samples 24 hours. Activity-based extension is pending and UI discloses current behaviour.
5. Only mock mode is permitted; other configurations fail closed. Paid usage reservations and cost telemetry are deferred until a real adapter exists.
6. An ownership-scoped project-session history endpoint is added to schema/OpenAPI/examples. Retest plans never replace normal project plans.

## Remaining live-release work
- Real model adapter, provider consent, token budgets, spend reservations, cost/latency telemetry, semantic grounding and useful calibrated assessment.
- Real-provider behavioural evaluation and technical peer review, including correction handling and prior coaching context.
- Semantic JS/TS indexing, activity-based expiry and replacement-version UI (the version API exists).
- Container/hosted staging verification, actual process-kill/restart rehearsal, encrypted backups, restore/deletion-receipt replay and provider-retention configuration.
- Full keyboard-only, screen-reader, 200% zoom, speech/Wispr and cross-browser manual verification.
- Five real classmate trials, honest pilot results, public deployment, demo video and submission assets.

No public deployment or paid calls were performed. Docker is unavailable on the current host. Prepared CI/container definitions do not establish hosted success. This preview is not an AI-quality result or a completed hackathon release.
