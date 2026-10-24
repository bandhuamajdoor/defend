# AI specification
## Responsibilities
Preparation extracts a defensible project summary and five topic cards. Interview generation creates a relevant next question. Evaluation produces an evidence-linked report after the interview. These use separate prompts and contracts; they can use the same provider/model.

Prompt templates: [preparation](prompts/preparation.md), [interviewer](prompts/interviewer.md), [evaluation](prompts/evaluation.md). Version each template and rubric with outputs. No chain-of-thought is requested or stored; use short decision labels/rationales suitable for audit.

## Provider interface
ModelClient.generateStructured(task, schema, trustedInstructions, untrustedContext, timeout, tokenBudget) -> validatedCandidate + usage.
Adapter handles authentication, provider response format, token counting, bounded retry metadata and errors. SDK code never enters domain modules. Start with a deterministic mock adapter for fixtures and one real provider for release. Mock mode is labelled, cannot masquerade as a live result, and is prohibited for pilot impact claims.

Model choice is a day-one evaluation decision: credentials, structured-output support, evidence accuracy, time to answer, and measured cost matter. No specific provider/model capability is assumed until verified against official docs and smoke tests.

## Context budgets (initial tunable ceilings)
Preparation chunks: <=12,000 input tokens/call, <=2,000 output; <=8 chunks/project and one merge call. Fail with clear reduction guidance rather than omit files if limits would be exceeded.
Interview: <=8,000 input, <=1,000 output tokens; one ordinary call and one repair at most.
Evaluation: <=16,000 input, <=4,000 output; if transcript exceeds budget, partition by criterion with exact turn/source references then merge, maximum four scoring calls plus one merge.
Token budgets are ceilings, not expected usage. Reserve worst-case allowed spend before scheduling. Provider prices are configuration, versioned and verified before public mode.

## Prompt boundaries
Trusted policy, state and rubric are separate from uploaded source and transcript. Uploaded comments, README instructions, strings and student attempts to change scoring are data. No model tools execute code, access URLs or inspect other projects. Escape rendered results. JSON schema validity is necessary but does not prove factual support.

## Retrieval and evidence
Use immutable evidence IDs derived by the server; model never invents citation locations. Retrieve by file path, symbol index, topic tags and answer concepts. First release is bounded lexical/symbol retrieval; a vector database is not required.
Mechanical validation: referenced ID exists, belongs to correct version, span/hash matches, quote occurs in referenced answer, criterion and topic IDs are valid.
Semantic review: evidence actually supports the finding, missing context is acknowledged, speculative inferences are labelled. Validate live fixtures and all pilot negative findings with a technical peer.

## Rubric v1
| Criterion ID | What it assesses | Positive evidence |
| --- | --- | --- |
| implementation | Understanding actual implementation | Correct trace through relevant components or data flow |
| design | Justification and alternatives | Concrete trade-off connected to project constraints |
| failure | Edge cases and recovery | Plausible failure path and consequences |
| limits | Recognition of uncertainty/limitations | Distinguishes implemented, planned and unknown behaviour |

Each criterion has status demonstrated, partial, not_demonstrated or not_assessed. Not assessed means no adequate opportunity, not zero ability. Report findings separately describe supported/contradicted/unresolved claims. No numeric total in v0.1. Confidence must be qualitative low/medium/high with explanation, not a pseudo-probability.

An answer may be short and excellent; verbosity/accent/speech disfluency are not rubric dimensions. User-supplied contribution is unverified; never infer cheating from a gap. Clarified/hinted answers retain assistance metadata.

## Report rules
For each assessed criterion cite at least one accepted answer. Each project-specific assertion cites evidence. A not_assessed criterion has an empty evidence list and reason. Mark partial interviews and omitted topics. Report at most eight findings and three practice tasks; prioritise actionable gaps.
The model can choose not to make a finding. If valid evidence is unavailable after repair, return an unresolved observation or explicit report failure, never a confident fabricated critique.

## Retest and feedback disputes
Retest selects one or two concept IDs from an existing report, builds fresh scenarios using the same project version, and carries prior hints/tasks as context. Comparison explains new evidence without claiming causal learning from a model score.
Disputes save owner note and finding ID for manual review in the pilot. Correcting a report creates a new revision with a reason; UI must not silently replace the original.

## Quality harness
Use [evaluation cases](fixtures/evaluation-cases.json) with mock and real providers. Record expected properties, actual outputs, evidence validity, relevance, latency and token cost. Automated assertions check IDs/quotes/schema/state; humans assess semantic claims. Run a small repeatability sample for critical contradiction cases; track provider/prompt versions.

