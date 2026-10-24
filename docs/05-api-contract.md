# API contract
Base path /api/v1. JSON over HTTPS (localhost HTTP in development). [OpenAPI](contracts/openapi.json) defines routes; [domain schema](contracts/domain.schema.json) is the field/enum source. IDs are UUIDs, times ISO-8601 UTC. See [status](16-implementation-status.md) for release limits.

## Authentication
POST /guest creates an opaque 256-bit random credential in HttpOnly, Secure, SameSite=Lax cookie defend_guest, Path=/, max-age 30 days. Local HTTP development may omit Secure only on localhost. Store token hash in credentials. No credential in URL, logs or localStorage. Existing valid guest may reuse its identity.

All resources except health, capabilities and guest creation require ownership. Return 404 for absent or foreign resources. Guests can only use their own copied sample/project. This release has no cross-device recovery; explain this on entry and provide export.

## Mutation rules
Every POST except /guest requires Idempotency-Key (UUID); DELETE also requires it. Identical replay returns the original acceptance response, followed by GET for latest state. Same key and different canonical request hash -> 409 IDEMPOTENCY_CONFLICT. Retain records seven days or until owner deletion.
Stateful mutations also require expectedRevision in body; deletes operate on full resources and do not require it. Origin must match APP_ORIGIN. No permissive CORS. JSON content type is required. Request cap 24 MiB before parsing; decoded source has tighter aggregate limits.

## Route summary
| Method and route suffix | Purpose | Response |
| --- | --- | --- |
| POST /guest | Create/reuse guest cookie | 201 Guest |
| GET /capabilities | Public provider readiness, data disclosure, consent version and upload limits; no secrets | 200 Capabilities |
| GET /projects | Owner's project summaries | 200 ProjectList |
| POST /projects | Upload project and queue preparation | 202 Operation |
| POST /projects/sample | Accept ConsentRequest, copy seeded fixture and queue preparation | 202 Operation |
| GET /projects/{projectId} | Files metadata, versions, latest plan/status | 200 Project |
| GET /projects/{projectId}/sessions | Owner-scoped interview history | 200 ProjectSessionList |
| POST /projects/{projectId}/versions | Upload complete replacement version | 202 Operation |
| POST /projects/{projectId}/confirm | Confirm or edit latest prepared summary/contribution | 200 Confirmation |
| DELETE /projects/{projectId} | Tombstone project and schedule purge | 202 Deletion |
| POST /sessions | Start normal interview from confirmed normal plan | 202 Operation |
| GET /sessions/{sessionId} | Canonical state, visible transcript, current question | 200 Session |
| GET /sessions/{sessionId}/evidence?ids=UUID,... | Up to 12 same-version excerpts referenced by the owned session | 200 EvidenceList |
| POST /sessions/{sessionId}/answers | Persist answer and queue next turn | 202 Operation |
| POST /sessions/{sessionId}/controls | pause/resume/skip/clarify/end | 202 Operation |
| GET /jobs/{jobId} | Ownership-scoped job state | 200 Job |
| POST /jobs/{jobId}/retry | Retry failed job if entity still compatible | 202 Operation |
| GET /sessions/{sessionId}/report | Completed report, or 202 status | 200 Report / 202 Operation |
| POST /sessions/{sessionId}/retest | Create linked session from report concepts | 202 Operation |
| POST /reports/{reportId}/feedback | Save disputed-finding note | 201 FeedbackReceipt |
| GET /sessions/{sessionId}/export?format=json\|html | Download canonical report with evidence | 200 attachment |
| DELETE /me | Tombstone all owner's resources and revoke cookie | 202 Deletion |
| GET /health | Content-free web liveness/readiness | 200 or 503 Health |

Repeat/mute/playback require no mutation endpoint. POST controls may return an Operation without a job for a purely local domain transition (pause); jobId is null and session revision identifies committed state.

## Canonical acceptance / polling
Operation contains resourceId, revision (nullable for preparation), jobId (nullable for immediate transitions), and status accepted.
Job status: queued, running, succeeded, failed, cancelled. resultId points to a session, plan or report as appropriate. Poll entity after success. On request timeout, retry same key; do not invent a new turn ID.
Public session JSON omits hidden interviewer notes, model reasoning, provider prompts, expected answer hints and credentials.

Sample creation requires the same explicit provider/data consent as an own-project upload. Creating a new project version also updates the project's display title from ProjectUpload.title. Confirmation can correct the summary/contribution and creates a new confirmed plan revision with the existing evidence-grounded topic cards; changing actual source files requires a new project version.

Real-provider uploads must include the current consentVersion from capabilities. Session responses include saved coaching and its engine; answer acceptance remains separate from asynchronous feedback publication. Repeat polling does not return full source files. Confirm/retest preserve the frozen provider/model and prompt version. An explicit End may produce a partial report without evaluating a pending answer.

A retest request accepts one or two eligible concept IDs from that report. With one selected concept, create two distinct scenario topics for it; with two, create one per concept. RetestPlan contains exactly two topics and inherits the parent project's confirmed context. It is internal and cannot be passed to the normal session-creation route.

## Errors
Envelope: error.code, error.message, error.requestId, error.retryable, optional error.currentRevision.
400 invalid JSON; 401 missing/expired cookie; 404 foreign/missing resource; 409 stale revision/incompatible state/idempotency conflict; 413 limits; 422 unsupported file, potential secret, failed content checks; 429 quota/rate limit with Retry-After; 503 temporary dependency failure. Messages never contain file contents, keys, database errors or raw model output.
Codes include INVALID_INPUT, UNAUTHENTICATED, NOT_FOUND, STALE_REVISION, INVALID_STATE, IDEMPOTENCY_CONFLICT, LIMIT_EXCEEDED, UNSUPPORTED_FILE, POTENTIAL_SECRET, RATE_LIMITED, DEPENDENCY_UNAVAILABLE.

## Export and deletion
Export escapes HTML, applies attachment Content-Disposition and includes generated-at, rubric version and embedded evidence excerpts. No arbitrary script/style URLs. Only finished reports can export (409 otherwise).
Deletion receipt is opaque and content-free; deleted IDs return 404 immediately. Polling a job is not required to revoke access. No shared unauthenticated report URL in v0.1.

