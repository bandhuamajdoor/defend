# AI specification
## Responsibilities
Preparation extracts a defensible project summary and five topic cards. Each accepted answer receives immediate feedback and either a manageable retry or progression to the next topic. The final report summarizes saved coaching, answer quotations, uncertainty and practice tasks without another model call.

The current coaching-v2 prompts live in [the provider orchestrator](../src/providers/coach.ts), with strict contracts in JSON Schema. The original [preparation](prompts/preparation.md), [interviewer](prompts/interviewer.md) and [evaluation](prompts/evaluation.md) templates remain reference material for future evaluation. No chain-of-thought is requested or stored; use short decision labels/rationales suitable for audit.

## Provider interface
ModelClient.generateStructured(task, schema, trustedInstructions, untrustedContext, timeout, tokenBudget) -> validatedCandidate + usage.
Implemented adapters handle Groq Free and local Ollama structured responses, usage counters, bounded retries and errors. Default guided mode has a deterministic checklist only for the exact sample; own-source feedback is structure-only with technical correctness unassessed. Model outages never fall back to sample feedback. SDK/provider code never enters domain modules. See [activation and verified limitations](17-free-ai-setup.md).

Model choice is a day-one evaluation decision: credentials, structured-output support, evidence accuracy, time to answer, and measured cost matter. No specific provider/model capability is assumed until verified against official docs and smoke tests.

## Current context and request ceilings
Preparation: one call with up to six complete excerpts / 10,000 source characters and compact file metadata; 2200 output tokens. Per-answer coaching: up to five excerpts / 9000 source characters; 1600 output tokens. Serialized messages plus schema are capped at 40,000 UTF-8 bytes and responses at 256 KiB. Local Ollama uses an 8192-token context. Token usage is recorded when supplied by the provider; input bytes are not claimed to be exact token counts. Oversize or invalid outputs fail explicitly.

Daily/entity request allowances are reserved atomically before every attempt, including retries. Defaults: 120/day shared by this installation and 24 per preparation/session entity. Model timeouts default to 45 seconds, maximum 90. The durable worker has bounded retry/backoff; malformed output fails without a substitute. Paid providers and automatic upgrades are unavailable. Keep any Groq account on Free; this app cannot inspect its billing plan.

## Prompt boundaries
Trusted policy, state and rubric are separate from uploaded source and transcript. Uploaded comments, README instructions, strings and student attempts to change scoring are data. No model tools execute code, access URLs or inspect other projects. Escape rendered results. JSON schema validity is necessary but does not prove factual support.

## Retrieval and evidence
Use immutable evidence IDs derived by the server; model never invents citation locations. Retrieve by file path, symbol index, topic tags and answer concepts. First release is bounded lexical/symbol retrieval; a vector database is not required.
Mechanical validation: referenced ID exists, belongs to correct version, span/hash matches, quote occurs in referenced answer, criterion and topic IDs are valid.
Semantic review: evidence actually supports the finding, missing context is acknowledged, speculative inferences are labelled. Validate live fixtures and all pilot negative findings with a technical peer.

## Rubric v2 coaching
| Criterion ID | What it assesses | Positive evidence |
| --- | --- | --- |
| implementation | Understanding actual implementation | Correct trace through relevant components or data flow |
| design | Justification and alternatives | Concrete trade-off connected to project constraints |
| failure | Edge cases and recovery | Plausible failure path and consequences |
| limits | Recognition of uncertainty/limitations | Distinguishes implemented, planned and unknown behaviour |

Each criterion has status demonstrated, partial, not_demonstrated or not_assessed. Not assessed means no adequate opportunity, not zero ability. Report findings separately describe supported/contradicted/unresolved claims. No numeric total in v0.1. Confidence must be qualitative low/medium/high with explanation, not a pseudo-probability.

Per-answer verdicts are needs_work, promising, strong or uncertain. Feedback includes specific strengths and improvements; a good answer still receives a refinement. Report status is derived from the latest saved coaching for the criterion. Exact sample checklist findings are labelled guided_sample; own-project structure-only feedback cannot establish technical competency. Current confidence is low pending human calibration. Earlier wrong answers and coached revisions remain visible, with assistance metadata. Unfinished coaching on explicit End remains unassessed.

An answer may be short and excellent; verbosity/accent/speech disfluency are not rubric dimensions. User-supplied contribution is unverified; never infer cheating from a gap. Clarified/hinted answers retain assistance metadata.

## Report rules
For each assessed criterion cite at least one accepted answer. Each project-specific assertion cites evidence. A not_assessed criterion has an empty evidence list and reason. Mark partial interviews and omitted topics. Report at most eight findings and three practice tasks; prioritise actionable gaps.
The model can choose not to make a finding. If valid evidence is unavailable after repair, return an unresolved observation or explicit report failure, never a confident fabricated critique.

## Retest and feedback disputes
Retest selects one or two concept IDs from an existing report, builds fresh scenarios using the same project version, and carries prior hints/tasks as context. Comparison explains new evidence without claiming causal learning from a model score.
Disputes save owner note and finding ID for manual review in the pilot. Correcting a report creates a new revision with a reason; UI must not silently replace the original.

## Quality harness
Use [evaluation cases](fixtures/evaluation-cases.json) with mock and real providers. Record expected properties, actual outputs, evidence validity, relevance, latency and token cost. Automated assertions check IDs/quotes/schema/state; humans assess semantic claims. Run a small repeatability sample for critical contradiction cases; track provider/prompt versions.

