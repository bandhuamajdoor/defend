# Implementation status and verification

25 October 2026 · conversational V1 preview. User-requested refinements are recorded as D15–D18 in the decision log.

## Implemented
- Light/dark/system theme with persistent preference, page/chat arrival, hover and landing animations, reduced-motion support.
- Conversation history, feedback after each answer, specific strengths/improvements, illustrative answers, manageable retries, source inspection and good-answer refinements.
- Exact sample checklist with source-grounded corrections; own-source communication coaching is explicitly unassessed technically until a model is connected.
- Strict Groq Free and loopback Ollama adapters, provider consent/provenance, atomic request caps, usage/status records, timeout/response bounds and no paid/sample fallback.
- Optional browser dictation and speech, review-before-send, text fallback. Defend does not store audio.
- Folder/file upload up to 500 files / 8 MiB / 2,000,000 characters, visible exclusions, complete line windows, cached JS/TS syntax/import map and bounded lexical retrieval. Coverage distinguishes indexing from model review.
- C/C++ source, headers, templates, build/config text and scoped root/nested .gitignore folder filtering. Bundled-library defaults preserve original include/ headers; re-selection refreshes ignored files, and documentation-only context requires acknowledgement.
- Immutable source and answer history, persisted coaching, assisted revisions, reports with exact quotations, practice tasks, export/dispute and focused retest.
- Guest ownership, Origin validation, idempotency, durable PostgreSQL jobs, lease/revision fences, bounded retries, deletion/expiry and purge. Explicit End can summarize saved coaching even during a provider outage.

## Verification
| Check | Actual local result |
| --- | --- |
| Domain/coaching/upload tests | 66 passing: boundaries, controller, sample feedback, assisted revisions, retrieval, Unicode/model contracts, C++ and scoped ignore-rule regressions |
| PostgreSQL integration | 16 passing: API contracts/isolation, races/recovery, saved coaching/report/export/retest/deletion, synthetic model transports/quotas, 500-file scope, End without another model call |
| Chromium browser | Eleven scenarios passed: theme/accessibility, conversation/recovery, debrief/retest, nested ignore exceptions, C++ preparation with 622 bundled headers, re-selection after changed rules, documentation-only acknowledgement and mobile/setup/delete-all |
| Accessibility | Automated WCAG A/AA light, dark and conversation scans passed; full manual audit remains open |
| Build | Optimized Next.js web and independent worker compiled locally |
| Evaluation | Twelve legacy mechanical schema/quotation checks; no external semantic model evaluation |

Generated screenshots, scans and results live under gitignored output/playwright/ and output/evals/. Reproduce with the developer guide. Browser recognition uses a test double; no actual microphone was tested. Transport stubs do not establish Groq/Ollama coaching quality.

## Remaining release work
- A free Groq key or installed local Ollama model is still needed for real own-project AI coaching. No external inference or model download was performed here.
- Human-reviewed relevance, factual grounding, quality, latency and hardware measurements on actual large projects. A synthetic 500-file test proves bounded indexing/retrieval plumbing only.
- Full keyboard/screen-reader/200% zoom, cross-browser and real speech/Wispr trials.
- Hosted staging/container verification, actual process-kill/restart rehearsal, encrypted backups/restore and provider-retention configuration. Docker is unavailable locally; public hosting is not configured.
- Five real classmate trials, honest pilot outcomes, demo video and submission assets.

Expiry remains fixed at creation (seven days, samples 24 hours); sliding activity expiry and replacement-version UI are pending. The version API exists. No overall numeric grade, learning-effect claim or full-repository-understanding claim is made. This preview is ready for local critique, with real AI quality and hosted operations still open.
