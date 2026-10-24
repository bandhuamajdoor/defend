# UX and content specification
## Main flow
Landing -> choose sample or upload -> preparation -> confirm brief -> interview -> debrief -> focused retest.
Persistent navigation: projects, current interview, privacy/delete. No institutional dashboard in this release.

## Screens
| Route | Contents and primary action | Required non-happy states |
| --- | --- | --- |
| / | Promise, 45-second explanation, Try sample, Use my project | Provider unavailable banner; sample remains selectable but cannot fake a live interview. |
| /projects/new | Title, brief, contribution, selected files, consent, visible size limits | Unsupported/secret/binary/oversize errors identify file without echoing secret values. |
| /projects/:id | Versions, filenames, status, preparation progress, confirmed summary | Retry failed job; edit summary creates new plan revision; expired/deleted resource. |
| /sessions/:id | Interviewer question, topic progress, optional evidence drawer, answer composer, controls | Generating, paused, retry-needed, network lost, stale tab, resumed, ended. |
| /sessions/:id/report | Findings, strengths, unresolved context, evidence, next practice, export | Preparing, failed/retry, no substantive answers, partial interview. |
| /privacy | Actual provider disclosure, retention, delete project/all | Pending deletion, failure/retry, confirmation. |

## Interview layout
Desktop: central conversation; collapsible right evidence panel; sticky answer composer and controls. Mobile stacks these without horizontal page scrolling; code scrolls within its panel. Display previous turns compactly, current question prominently. Show “Question 3 · Design decisions”, not a live competency score.

Composer is a standard accessible textarea: multi-line, dictation-friendly and focused only after intentional navigation. Do not grab focus when streaming updates arrive. Send button and Ctrl/Cmd+Enter submit; plain Enter adds a newline. Stop speech on focus/Send to avoid overlapping output; a user toggle may preserve manual playback. Draft remains local in component memory during ordinary retries; never clear before server acceptance. No source/transcript persistence in browser localStorage in v0.1. Warn before abandoning an unsent draft; reload recovers accepted answers only.

## Controls
- Repeat: display/play exact stored question; no new question, budget use or model call.
- Clarify: explicit server control; model explains the same task without supplying the answer; marks a hint in history.
- Skip: server event marks question unassessed and advances; counts toward question-event cap.
- Pause: freeze active-time accounting; stop speech; composer disabled without losing its draft.
- Resume: restore current unanswered question; do not generate another.
- End interview: confirmation dialog, saves accepted work, cancels pending generation and starts partial debrief.
- Stop speaking: local playback control only; independent of interview end.

## Preparation and evidence
Show editable project summary and stated contribution. Put uncertainties in “What I may be missing”. Student confirmation does not certify factual accuracy or authorship. Show which files were used and which exceeded analysis limits. Never silently truncate accepted project content.
Evidence drawer shows path, exact line span, code and reason for opening it. Source text is escaped; no executing HTML or Markdown scripts.

## Debrief
Criteria: implementation understanding, design reasoning, failure reasoning, awareness of limitations.
Statuses: demonstrated, partial, not_demonstrated, not_assessed. Distinguish status from claim outcome (supported, contradicted, unresolved). No overall pass/fail or invented percentile.
Each finding contains answer quotation, rationale, uncertainty, source excerpt where applicable, and a concrete exercise. “Not assessed” has no fabricated answer quote.
Retest control selects one or two concept IDs and links to original report. Allow marking feedback “This seems wrong” with a note; v0.1 saves a review request and acknowledges it, not an automatic score rewrite.

## Visual direction
Calm interview workspace: neutral surfaces, one accent colour, strong type hierarchy, restrained motion. Use statuses with text and icons, never colour alone. No avatar required. A small speaking indicator reflects actual playback, never a fake microphone state.

## Accessibility and copy
Visible focus, labelled controls, dialogs with focus return, contrast to WCAG AA targets, scalable type, reduced motion. Announce completion/error once using a polite live region; do not read every transcript token aloud. All tasks work muted.
Useful copy: “Take your time. Send when your answer is complete.” / “I couldn't verify that from the supplied files.” / “Your answer was saved. The next question couldn't load.” / “This browser session is your access key. Export before clearing cookies.”
Test keyboard-only, 200% zoom and a screen reader before release.

