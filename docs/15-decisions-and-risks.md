# Decisions and risk register
Decisions below are implementation defaults chosen to make development executable. The user's settled requirement is an interview experience with interchangeable dictation; provider/hosting purchases are not authorised by these defaults.

## Architecture decisions
| ADR | Decision | Reason / rejected alternative | Revisit when |
| --- | --- | --- | --- |
| D01 | Text is canonical answer input | External dictation works without SDK/audio coupling | Built-in voice is prioritised |
| D02 | Prepare/live/evaluate phases | Reduce live latency and separate grading context | Measured quality indicates changes |
| D03 | Explicit controller | State, quotas and repeat behaviour need deterministic enforcement | Workflow complexity exceeds simple modules |
| D04 | Next.js + TS + PostgreSQL + worker | One language, durable work, inspectable state | Existing hosting imposes different constraints |
| D05 | PostgreSQL jobs, no Redis | Small scale; transactional enqueue | Queue throughput/latency justifies separate broker |
| D06 | Guest ownership | Judges/classmates can start immediately | Cross-device accounts are requested |
| D07 | Selected text files, JS/TS focus | Bounded analysis and easy real-user validation | Pilot projects require another language |
| D08 | Browser speech first | Spoken interviewer without provider dependency | Quality/accessibility testing needs server TTS |
| D09 | No overall numeric grade | Avoid misleading precision; actionable criterion evidence | Calibrated human-reviewed rubric exists |
| D10 | File/symbol retrieval first | Small inputs do not justify graph/vector infrastructure | Measured retrieval misses require it |
| D11 | Immutable versions and reports | Stable evidence and reproducibility | Never relax this invariant |
| D12 | Deterministic mock only in dev | Reliable tests without misleading live output | Never relabel mock as real |

## Open choices and deadlines
| Choice | Working default | Needed by | Blocking? |
| --- | --- | --- | --- |
| Student project stack | JS/TS web apps | Day 1 pilot discovery | Only specialised parser/example content |
| AI provider/model | Mock locally; one real structured-output provider after comparison | Day 1–2 | Real interviewing and quality/cost claims |
| Hosting account | Container web+worker + managed PostgreSQL | Day 3 | Public deployment |
| Spend ceiling | Paid mode disabled until positive caps configured | Before paid calls | Paid integration only |
| Branding | Defend working name | Before public launch | No |
| Auth | Private guest cookie with export | Fixed v0.1 | No |
| Built-in microphone | Deferred; external dictation supported | Future | No |

Credentials must be configured through secret storage, not pasted into docs or chat. No need to delay scaffold, mock vertical slice, contracts, UI or domain tests while provider/hosting choices are pending.

## Risks
| Risk | Impact | Mitigation / trigger |
| --- | --- | --- |
| False code accusation | Breaks trust | Missing-context fixtures, evidence checks, peer review; unresolved instead of unsupported negative finding |
| Slow interview | Breaks conversational feel | Precompute context, one main turn call, bound retrieval/output; measure p95 |
| Lost/duplicate answers | Invalidates session | Durable acceptance, idempotency, revisions, leases and crash tests |
| Generic questions | Weak differentiation | Topic cards with actual source evidence and answer-dependent probes |
| Scope growth | Missed deadline | Cut order and day-four vertical-slice gate |
| Cost abuse | Public demo outage | Owner/IP/global quotas, price-versioned reservations, disable at cap |
| Guest loses cookie | Lost access | Clear disclosure, exports; no insecure recovery shortcut |
| Browser speech inconsistency | Uneven audio | Actual browser checks, mute/text fallback, optional server adapter later |
| Unrepresentative pilot | Overstated value | Report sample and project scope; no broad efficacy claims |

## Documentation policy
Change schema/routes/enums/examples and affected prose together. Research recommendations are superseded by explicit decisions here. Implementation may refine internals while preserving acceptance criteria; record significant deviations and validation.

