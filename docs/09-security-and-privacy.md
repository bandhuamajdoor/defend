# Security and privacy specification
This is an implementation checklist for the scoped product, not a compliance certification.

## Data and permissions
Guest owners hold private project text, contribution descriptions, answers, reports and feedback notes. No microphone audio is collected by Defend v0.1. External dictation has its own processing policies; disclose that distinction without claiming control over its retention.
Before first provider use, disclose the selected AI provider, data sent, storage/expiry, and how to delete. Browser speech may use device/browser-provided services; do not promise all speech runs offline.

## Threats and controls
| Threat | Required control |
| --- | --- |
| Cross-user object access | Owner-scoped lookup on every route/job/export; foreign IDs return 404; test all resource types. |
| Guest-cookie theft | Random opaque token, hashed DB storage, HttpOnly/Secure/SameSite cookie; no URL credentials. |
| CSRF | Exact Origin validation on mutations, JSON-only inputs, no wildcard credentialed CORS. |
| Prompt injection in source | Separate trusted instructions from evidence; no code execution/network tools; schema/action/reference validation. |
| XSS in source/report | Escape code and text, sanitise Markdown or use plain text, prohibit raw HTML, CSP. |
| Secret upload | Filename exclusions and server scan; reject safely; never log raw contents. |
| Resource exhaustion | File/input/token limits, owner/IP quotas, worker concurrency and global spend reservation. |
| Race/replay | Idempotency records, revision CAS, lease fencing and transactional state changes. |
| Stale deleted data | Tombstones checked before provider dispatch and before commit; purge job; restore deletion receipts. |

## Abuse/cost defaults
Per owner: five projects/day, ten normal or retest sessions/day, one generating session at once, sixty mutation requests/minute. Per IP: 120 requests/minute and ten guest creations/hour; accommodate shared college networks through configurable limits, not permanent fingerprinting. Rate-limit storage is server-side, atomic and shared between instances. Hash short-lived IP identifiers with a rotating salt; no raw IPs in analytics.
Paid adapters are disabled. Free/local request allowances reserve atomically before every attempt; configured Groq use requires explicit Free-only acknowledgement, though the app cannot inspect an account's billing plan. Provider credentials are server-only. Groq uses its fixed official endpoint; Ollama only accepts operator-configured loopback HTTP without redirects. Real-provider uploads require the matching capabilities consentVersion. No silent provider switch or model fallback is permitted.

## Retention and deletion
Use [data lifecycle](04-data-model.md). A deletion immediately revokes access; active provider requests may not be retractable, but responses must be discarded and configured provider retention disclosed. Target primary purge <=24 hours. Publish actual backup retention, target <=30 days. These are launch gates, not promises before hosting is configured.
No training reuse, public galleries or report sharing by default. No raw transcripts/source in logs, error telemetry or analytics. Exports are user-triggered and access-controlled.

## Consent text draft
“Defend sends your selected project files and interview answers to [configured provider] to prepare questions and feedback. Your project is private to this browser session and expires after seven days without activity. You can export or delete it. Upload only files you are allowed to share, without secrets.”
Populate provider/retention accurately before release. Consent must be unchecked by default and recorded with text version.

Actual preview copy uses fixed creation-based expiry, a guided/local/Groq-specific disclosure and the current consent version. Optional browser dictation requests microphone access only on a user action. Defend stores no audio; browser speech services may process it. HTTP Permissions-Policy allows microphone only for self and disables camera/geolocation. Theme preference is a separate nonsecret cookie.

## Incident procedure
Disable new paid jobs, preserve content-free diagnostic evidence, rotate affected secrets, identify affected owners/resources, fix isolation/deletion failure, rerun release gates, and communicate through an available authorised channel. No automatic outbound notifications are assumed by the implementation plan.

