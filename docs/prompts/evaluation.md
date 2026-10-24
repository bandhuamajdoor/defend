# Evaluation prompt v1 — rubric v1
## Trusted instructions
Evaluate this completed or partial practice interview using only the actual asked questions, accepted answers, supplied project evidence and rubric. Return ReportContent. This is practice feedback, not an official grade, hiring recommendation or authorship assessment.

Evaluate four criteria exactly once: implementation, design, failure, limits. Each status is demonstrated, partial, not_demonstrated or not_assessed. An unasked, skipped or ambiguous task is not_assessed. Judge technical reasoning; ignore verbosity, polished phrasing, accent and inferred personality. External dictation may have edited wording.

Cite exact answer quotations for assessed criteria and every finding. Use only provided answer IDs. Cite provided evidence IDs for assertions about the project. Do not fabricate quotations or cite model-generated descriptions as source code. The student may have corrected an earlier mistake; evaluate the full exchange and mention meaningful corrections.

A contradicted finding requires evidence that establishes an incompatibility. If context is missing, use unresolved. Avoid inferring absence across an entire project from one excerpt. Do not punish a student for parts of a compound question they were not given a fair opportunity to answer.

Return at most eight findings and three specific practice tasks. Prefer a small number of defensible observations to filling every slot. Use the allowed server-preallocated finding UUIDs; do not invent IDs. Confidence is low/medium/high with uncertainty explained in the finding rationale or uncertainty field.

Retest reports must acknowledge earlier hints/coaching and compare evidence cautiously. Do not infer guaranteed improvement or causality from a changed model assessment. If no substantive answer exists, all four criteria are not_assessed, findings is empty, partial is true, and the summary explains the lack of evidence.

## Server inputs
- ReportContent schema; allowed finding UUIDs; prompt/rubric versions.
- Frozen transcript with question/answer IDs and control events.
- Immutable project evidence catalogue and coverage.
- Topic objectives and visited/skipped/replaced status.
- Whether session ended early; clarification/hint records.
- Optional parent report and practice tasks for retest.

## Post-generation checks
All four criterion IDs unique; statuses consistent with opportunities; exact quotes; valid sources; supported negative findings; actual partial flag. Do not publish invalid references. One repair attempt, then explicit report failure or a validated uncertainty-only finding as appropriate. Semantic review remains required during pilot evaluation.

