# Testing, evaluation and release gates
## Strategy
Test meaningful failure boundaries. Pure domain tests cover transitions and invariants; integration tests use real PostgreSQL transactions; browser tests exercise user journeys; AI evaluations check evidence and conversation usefulness. Mock-only success cannot establish product quality.

Implemented tools: pinned Vitest for domain/API tests and Playwright for browser checks. Commands now work as described in the developer guide. The evaluation runner performs mechanical mock checks only; real-provider semantic evaluation remains a release gate. See [actual local evidence](16-implementation-status.md).

Coaching tests cover intentionally bad, confidently wrong and concise correct sample answers, assisted revisions, bounded follow-ups, missing context and ending during unavailable coaching. Retrieval tests cover 500 files, relative imports and no code execution. Real PostgreSQL tests stub Groq/Ollama transport to verify schema, quotas and no fallback; they establish adapter mechanics, not external model quality. Browser speech recognition is simulated to check text handoff and review-before-send; actual microphone/audio QA remains manual.

Upload regression tests include C/C++ sources/headers/templates/Makefiles/configuration, 622 bundled headers, root/nested ignore precedence, anchoring, escaped patterns, negation, ignored parents, unreadable rules and safeguards that Git negation cannot bypass. Browser checks cover ignore exceptions, C++ preparation, re-selection after changing .gitignore and explicit acknowledgement of documentation-only context.

## Requirement traceability
| Test ID | Requirements | Scenario and pass condition |
| --- | --- | --- |
| T01 | R01 | Fresh guest starts isolated sample without signup; another guest cannot see it. |
| T02 | R02,R12 | Allowed upload succeeds; binary, traversal, secret, duplicate path and each size boundary fail before provider use. |
| T03 | R03 | Summary edit increments plan revision; old confirmation cannot start a session. |
| T04 | R04 | Follow-up responds to answer/evidence; topic/phase budgets enforce progression. |
| T05 | R05 | Identical answer pasted, typed and inserted via external dictation reaches same domain contract. |
| T06 | R06,R13 | Speech unavailable/muted still permits all steps; repeat text identical; stop cancels actual playback. |
| T07 | R07 | Pause/resume/end/skip/clarify transitions match table; unasked/skipped topics are not scored negatively. |
| T08 | R08 | Duplicate answer returns same acceptance; conflicting same key fails; two-tab race has one winner. |
| T09 | R08,R15 | Kill worker after provider response/before commit; restart creates no duplicate question; accepted answer remains. |
| T10 | R09 | Missing middleware is unresolved; explicit incompatible code yields supported critique; all citations/quotes resolve. |
| T11 | R10 | Retest scenario differs; concept and project version match; hints recorded. |
| T12 | R11 | JSON/HTML exports contain canonical report and excerpts; HTML payloads cannot execute. |
| T13 | R12 | Foreign project/session/job/report/export/delete IDs return 404; deletion invalidates in-flight output. |
| T14 | R13 | Keyboard-only full journey, screen reader status, 200% zoom, reduced motion. |
| T15 | R14 | Five pilot sessions, human-reviewed negative findings and feedback record. |
| T16 | R15 | 429/5xx/timeouts/malformed JSON exhaust bounded retries honestly; no substituted sample report. |

## AI evaluation cases
[Machine-readable cases](fixtures/evaluation-cases.json) define properties, not exact wording. Implement fixture files and ground-truth annotations under ticket B02. Until then the cases are test specifications.
Include concise correct answers, confident wrong answers, legitimate corrections, missing source, source injection, contradictory README/code, unknown concepts, overlong answers, skipped topics and clarification requests. Review both negative and positive findings; “no issues found” can be wrong too.
Use a fixed rubric/provider/prompt version; compare baseline output to changed prompt on the same corpus. At least ten cases and twenty follow-ups in the release run. A human verifies semantic entailment; schema checks alone are insufficient.

## Acceptance gates
- G1 contracts: examples/schema/OpenAPI refs and documentation links consistent.
- G2 domain: every transition/race test passes.
- G3 isolation: all foreign-ID and injection tests pass.
- G4 grounding: every reported citation resolves; no unsupported contradiction remains in release fixtures/pilot.
- G5 UX: public sample + own-project + report + retest + deletion complete in deployed environment.
- G6 operations: worker restart, migration, quota stop, backup/restore rehearsal and deletion recovery verified.
- G7 pilot: actual results recorded with limitations; never invent time savings.
- G8 submission: public link, <=2-minute video, usage screenshot and required description complete.

## Performance and cost
Measure at five concurrent sessions: API acceptance p95 target <500ms excluding network; next-question p95 target <=10s; initial preparation target <=60s for sample; report target <=45s. These are engineering targets, not release claims. If exceeded, optimise context/queue/provider and make waits clear.
Record token counts and priced usage per job/session, retry overhead and budget reservations. No unbounded evaluation loops.

## CI / manual division
CI: lint/typecheck, schema/contract validation, domain tests, DB integration tests and browser sample smoke. Secrets are absent from pull-request jobs; mock models only.
Staging manual: real provider evaluations, speech across Chrome/Edge, Wispr input, mobile fallback, accessibility, restore, purge, cost stop and five user trials.
Release evidence: timestamp, commit, environment, test, actual result and reviewer. No empty checkbox is a pass.

