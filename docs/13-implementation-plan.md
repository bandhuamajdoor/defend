# Seven-day implementation plan
Preparation/docs: 24 October 2026. Build schedule: 25–31 October, IST. Deadline: 31 October 23:59 IST; target submission 20:00 IST for buffer. Scope is one solo builder using AI assistance; no team/delegation assumption.

## Backlog with dependencies
| Ticket | Deliverable | Depends on | Done when |
| --- | --- | --- | --- |
| B01 | Scaffold, config, local DB, CI, typed contracts | Documentation | Clean checkout starts web+worker in mock mode; documented scripts exist. |
| B02 | Original Campus Tickets fixture and evaluation manifest | B01 | Source fixture, known bug/correct control/missing-context cases checked by human. |
| B03 | Guest identity, ownership, quotas and consent | B01 | Foreign-ID tests and no-cost mock guest flow pass. |
| B04 | Versioned uploads, exclusions, excerpts, preparation queue | B02,B03 | Valid project prepares; all upload boundaries/secret checks pass. |
| B05 | Summary correction/confirmation and frozen plan | B04 | Stale confirmation rejected; immutable session references work. |
| B06 | Controller, idempotency, answer persistence and leases | B01,B03 | Transition, retry, double-submit, stale-worker and end-race tests pass. |
| B07 | Interview screen, text composer and optional browser speech | B05,B06 | Keyboard/voice-text path, pause/repeat/clarify/end usable. |
| B08 | One real model adapter and grounded prompts | B04,B06 | Real fixture evaluation passes with usage/cost telemetry. |
| B09 | Evidence-linked debrief, JSON/HTML export | B07,B08 | Four criterion statuses and valid citations; no-answer/partial reports handled. |
| B10 | Targeted retest and feedback dispute recording | B09 | Fresh scenario, same concept/version, hint context retained. |
| B11 | Delete/expiry, deployment, backup, operations | B03,B06 | Primary purge, restore receipt handling, quotas and worker restart proven. |
| B12 | Classmate pilot, fixes, demo and submission assets | B09–B11 | Real results, final gates and <=2-minute demo. |

## Daily outcomes
| Day | Date | Outcome |
| --- | --- | --- |
| 1 | 25 Oct | B01–B03; confirm JS/TS user fit with classmates; choose provider/host credentials and budget; mock sample walkthrough. |
| 2 | 26 Oct | B04–B06 core; first uploaded project creates a confirmed plan; durable first answer. |
| 3 | 27 Oct | B07–B08; real adaptive conversation with actual evidence; deployed staging. |
| 4 | 28 Oct | B09; complete end-to-end interview and debrief; first two user trials. |
| 5 | 29 Oct | B10–B11; remaining trials; retest, export, deletion and recovery. |
| 6 | 30 Oct | Reliability/grounding fixes, accessibility, real-provider regression and demo rehearsal. |
| 7 | 31 Oct | Freeze features, final release gates, video/usage card/description, submission by 20:00 IST. |

## Cut order if behind
Cut optional server TTS, extra language-specific parsers, decorative animation and dashboard extras first. Do not cut owner isolation, evidence checks, saved-answer reliability, text fallback, usable report, sample or truthful errors.
If core model grounding fails by day three, constrain supported project size/topic scope and explicitly disclose it; do not compensate with fabricated output.
If full retest is at risk, use a two-question retest from one selected concept (still fresh questions and persisted report), not a link to an unimplemented page.

## Risks / checkpoints
Daily checkpoint: working deployed path, real-model evidence quality, queue reliability, remaining critical tickets and cost. Day-four go/no-go: a fresh user must complete an own-project interview and inspect report evidence. If not, freeze new features and fix that path.
A feature is done only when acceptance evidence exists; merged code alone does not complete a ticket.

## Release definition
No P0 privacy/data-loss defects; no P1 core-flow failures; all required gates recorded. Known limitations documented in UI/README. Deployment URL and submission are separate external actions; prepare reviewable artifacts before any action needing user approval.

