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
| D13 | One hashed credential on Owner, JSON controller snapshot plus normalized transcript | Small guest-only preview; advisory locks and lease/revision fencing preserve writes | Rotation or multiple credentials |
| D14 | Full line-window indexing, fixed initial expiry, mock-only provider gate | Runnable first vertical slice with honest coverage and no paid calls | AST indexing, sliding retention and live adapter validation |
| D15 | Immediate coaching after each answer, bounded retries and report from saved coaching | User's V1 critique prioritizes conversational preparation, explanations and refinements | Human trials and calibrated model evaluations |
| D16 | Groq Free and loopback Ollama; no paid fallback | User has no funds for paid APIs; guided sample remains usable without credentials | User explicitly changes budget/provider constraints |
| D17 | Up to 500 files, cached JS/TS symbol/import map, bounded lexical retrieval with disclosed scope | Larger student projects require navigation beyond a first-files sample | Retrieval misses, context limits or measured latency justify deeper analysis |
| D18 | Light/dark/system theme, accessible motion and optional browser dictation | User wants an interactive conversation with the computer | Manual accessibility and actual microphone trials |
| D19 | C/C++ text source/build/config support, scoped .gitignore filtering and visible documentation-only acknowledgement | User's storage-engine folder was reduced to a README by a narrow extension filter; Git ignore rules must govern folder selection | Additional language parsers or Git-aware repository ingestion |

D15–D18 supersede the earlier mock-only, small-input and post-session-only feedback defaults in D01/D07/D12/D14. The paid-billing architecture remains a future target; no purchase is authorized. Browser speech recognition can use a vendor service, and the app discloses this before optional use.

Current implementation refinements and actual verification are recorded in [implementation status](16-implementation-status.md). These do not remove original release gates.

## Open choices and deadlines
| Choice | Working default | Needed by | Blocking? |
| --- | --- | --- | --- |
| Student project stack | JS/TS web apps | Day 1 pilot discovery | Only specialised parser/example content |
| AI provider/model | Guided default; Groq Free or local Ollama implemented but not externally evaluated | Before own-project AI trial | Requires free key or installed local model |
| Hosting account | Container web+worker + managed PostgreSQL | Day 3 | Public deployment |
| Spend ceiling | No paid adapters; atomic daily/entity request limits for free/local mode | Before real calls | Keep hosted account on Free |
| Branding | Defend working name | Before public launch | No |
| Auth | Private guest cookie with export | Fixed v0.1 | No |
| Built-in microphone | Optional browser recognition implemented; real-device QA open | Before voice-quality claims | No; text fallback works |

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

