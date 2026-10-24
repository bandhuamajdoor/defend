# Product requirements
## Problem and audience
Students can build a functioning project but struggle to explain its actual implementation, justify decisions, and reason about failure cases. Primary users are technical college students preparing for project vivas or interviews. The first validation cohort is the builder and five classmates.

Job: “Help me practise defending this project, reveal gaps fairly, and give me a focused way to improve.”

## Release scope
The release is a complete desktop-first English practice product for small JavaScript/TypeScript web projects. Python/plain-text files may be accepted as context, but specialised analysis is only claimed for the tested JS/TS scope. Student stack remains an assumption to validate on day one. Normal interview: five planned topics, target 5–8 minutes, hard cap 12 submitted answers or 12 active minutes. Time is a product pacing target, never a competency signal. Retest: two topics, six answers or six active minutes. No forced submission of an unfinished answer.

## Requirements
| ID | Requirement | Acceptance |
| --- | --- | --- |
| R01 | Public sample | New visitor starts an isolated sample in two clicks without payment, signup or credentials. |
| R02 | Own project | Upload selected text files, contribution statement and brief; see accepted/rejected files and exact limits. |
| R03 | Confirm context | Inspect and correct generated summary; confirmation binds to one immutable version and plan. |
| R04 | Adaptive interview | Follow-up refers to an actual answer or evidence; one main question per turn; bounded topic progression. |
| R05 | Input independence | Same submitted text works from typing or external dictation; no Wispr SDK/account check, silence timer or automatic send. |
| R06 | Spoken questions | User can enable browser speech, mute, stop and replay; visible text works when speech is unavailable. |
| R07 | Session controls | Pause, resume, repeat, skip and end operate according to the controller contract. |
| R08 | Reliability | Accepted answers survive reload, retry and worker restart; a duplicate submission never advances twice. |
| R09 | Grounded feedback | Each assessed criterion cites answer evidence; project claims cite immutable file excerpts. Missing context stays uncertain. |
| R10 | Retest | New scenario tests a selected unresolved concept; report distinguishes previous coaching from unaided answers. |
| R11 | Report portability | Download JSON and print-friendly HTML; evidence links remain understandable via embedded cited excerpts. |
| R12 | Ownership/privacy | Users cannot access another guest's resources; consent precedes sending uploaded content to a provider; deletion works. |
| R13 | Accessibility | Keyboard navigation, readable code, visible speech text, reduced-motion support and no audio-only steps. |
| R14 | Useful pilot | Five real classmates complete trials; peer review verifies negative findings and collects correction requests. |
| R15 | Honest failures | Provider failure offers retry; unavailable evidence is explicit; no sample feedback substituted for live results. |

## Exclusions
No hiring decisions, proctoring, emotion/face analysis, accent scoring, plagiarism/authorship verdicts, avatars, live coding execution, automatic fixes, arbitrary GitHub URL fetching, ZIP/PDF ingestion, realtime barge-in, billing, institution administration or team accounts. Built-in microphone transcription is a later adapter; the initial product supports external dictation.

## Experience principles
The interviewer is curious, calm and technically precise. It asks for reasoning, accepts a correction, and never treats a missing file as proof of a defect. Feedback follows the session; hints are only given when explicitly requested through a clarify action and are recorded. Praise must be specific and justified.

## Success and release measures
Targets are not achieved claims:
- All deterministic reliability/isolation gates pass.
- All citations resolve; zero fabricated file/line references in release fixtures.
- At least 4/5 pilot users finish without operator help and identify one useful next action.
- A technical peer reviews every pilot contradiction finding; any unsupported accusation blocks release until addressed.
- At least 80% of reviewed follow-ups are judged relevant by a peer across at least 20 turns.
- Target p95 submitted-answer-to-question latency <=10 seconds in a five-session trial; report actual latency and retain a usable loading state if missed.
- No automatic “improvement” claim solely from higher model scores; retests use new scenarios and human-reviewed examples.

## Completion criteria
Requirements R01–R13 pass their acceptance checks; R14 has honest recorded evidence or an explicitly disclosed shortfall; R15 passes failure injection. Deployment, backups/deletion policy, spending limits and sample reset are verified before public submission.

