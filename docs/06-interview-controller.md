# Interview state machine
The controller is deterministic domain logic. AI proposes language/actions; application code owns transitions, budgets and persistence.

## Session lifecycle
| Current state | Event | Next state / effect |
| --- | --- | --- |
| preparing | initial generation succeeds | awaiting_answer; publish first question |
| preparing | generation fails | generation_failed |
| awaiting_answer | valid answer | generating; persist answer and increment revision |
| awaiting_answer | skip | generating; record skipped question, no answer |
| awaiting_answer | clarify | generating; same topic; publish a clarification question; mark hint |
| preparing/generating | valid output | awaiting_answer; publish canonical question |
| preparing/generating | terminal generator error | generation_failed; accepted answer retained |
| preparing/awaiting_answer/generating/generation_failed | pause | paused; snapshot prior state; invalidate pending generation |
| paused | resume | awaiting_answer if an unanswered question exists; otherwise generating with new job |
| generation_failed | job retry | generating; same accepted answer |
| any nonterminal state | end | evaluating; cancel outstanding generation, freeze transcript |
| generating | controller chooses finish | evaluating; queue report |
| evaluating | report succeeds | completed |
| evaluating | report fails | evaluation_failed |
| evaluation_failed | report job retry | evaluating |
| any state | project deletion/expiry | access revoked; jobs cancelled; eventual purge |

Pause while evaluating is invalid. Answers only accepted in awaiting_answer for exactly currentQuestionId. A completed/ended session never resumes interviewing. Two tabs submitting different answers for one revision: first commits, other receives 409.

## Interview phases
introduction -> walkthrough -> technical_depth -> failure_scenario -> reflection -> complete.
Normal plan: five topics, at least one from each nonterminal phase. After introduction select walkthrough then technical depth then failure scenario then reflection. Phases never regress. Retest uses two selected concepts; introduction is a short greeting, not an assessed topic.
Plan topic IDs and sequence are frozen at confirmation. Follow-ups vary within a topic, using evidence and the actual answer.

## Budgets
Normal: target five to eight active minutes; hard budget twelve active minutes and twelve answer/skip events combined. Retest: six active minutes and six answer/skip events. At most two follow-ups per topic and two clarifications per question lineage. Clarify consumes a follow-up slot but not the submitted-answer count. Do not permit repeated clarify to evade the cap.
Time accrues from awaiting_answer entry to submission/control; model generation, pause and report time are excluded. No silent cutoff while the student is drafting: when the budget expires, display “Finish this answer, then we'll wrap up”; controller finishes after next submitted answer or explicit End. Actual duration may therefore exceed the nominal cap. No new question after the cap.
A skipped final question may finish immediately. Unvisited topics become not_assessed.

## Turn-generation contract
[InterviewerDecision](contracts/domain.schema.json) contains action ask/follow_up/advance_topic/finish, topicId, questionText, evidenceIds, claimUpdates, uncertainty and transitionReason.
Only the server assigns question IDs, ordinal, timestamps or state. Reject unknown topics, foreign evidence, backward transitions, exhausted follow-ups and invalid actions. finish requires adequate plan coverage, budget exhaustion or explicit user end; otherwise use next planned topic.
At most one short acknowledgment and one substantive question, normally <=70 words. Do not reveal the answer in the question. Compound-task validation requires semantic tests; punctuation alone is not enough.

## Claims and uncertainty
A claim ledger contains exact answer references, concept IDs and status supported/contradicted/unresolved. Only use contradicted when supplied evidence establishes an incompatibility. Example: no ownership check in an endpoint with unknown middleware is unresolved. Ask where the check lives.
If the student corrects an earlier statement, keep both statements and mark the correction for the report. No hidden overwrite.

## Clarification, repeats and interruption
Repeat returns the exact stored string locally. Clarify creates a new question linked to the prior one, same learning objective, with hint event. The previous question is marked replaced, not unanswerable or wrong. The explicit Repeat control guarantees verbatim replay. A typed request for clarification may be stored as an accepted answer, but is unassessed by the evaluator; the next generated clarification keeps the same objective and consumes the normal follow-up budget.
External dictation has no audio events. Stop-speech is local; automatic interruption detection is not claimed.
During pause/end racing a worker completion, revision/lease checks ensure only one valid state wins.

## Recovery
An accepted answer is immutable. A retry references the failed job, not a new answer. Cancellation discards late model output. Resume from server snapshots. Distinguish an unsent browser draft from persisted work in user copy.

