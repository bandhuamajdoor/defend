# Data model and invariants
PostgreSQL, UUID primary keys, UTC timestamps, explicit foreign keys. Owner scope is required for all queries; UUID unpredictability is not authorisation. API/domain enum spelling comes from [domain schema](contracts/domain.schema.json).

## Entities
| Table | Key fields | Relations / constraints |
| --- | --- | --- |
| owners | id, created_at, expires_at, deleted_at | Guest principal; no email needed. |
| credentials | id, owner_id, token_hash, expires_at | Unique hash; opaque cookie token never stored in plaintext. |
| projects | id, owner_id, title, created_at, last_activity_at, deleted_at | Soft deletion blocks access immediately. |
| project_versions | id, project_id, ordinal, brief, contribution, content_hash, status, summary, uncertainties, consent_at | Unique project+ordinal; file content immutable after creation. |
| source_files | id, version_id, path, utf8_text, sha256, byte_size, line_count | Unique version+normalised path; stored text is normalised LF. |
| evidence | id, version_id, file_id, start_line, end_line, excerpt_hash | Positive in-range line spans; excerpt derived from stored text. |
| plans | id, version_id, mode, revision, summary, contribution, topics_json, prompt_version, model_id, confirmed_at | Normal plans have five topics; retest plans have two. Confirmation applies to exact normal-plan revision; previous revisions retained. |
| sessions | id, owner_id, version_id, plan_id, mode, parent_report_id, status, paused_from, phase, revision, current_question_id, active_ms, active_since, question_count, followup_count | Snapshot bound to immutable version and confirmed plan; paused_from retains the state needed for resume. |
| questions | id, session_id, sequence, topic_id, text, evidence_ids, kind, objective, published_at | Unique session+sequence; immutable when published. |
| answers | id, session_id, question_id, turn_id, text, accepted_at | Unique session+turn_id; one accepted substantive answer per question. |
| session_events | id, session_id, ordinal, event_type, payload_json, created_at | Unique session+ordinal; append-only control/answer history. |
| jobs | id, owner_id, kind, entity_id, expected_revision, status, attempt_count, lease_token, lease_until, run_after, error_code, result_ref | Index status+run_after; no raw content in errors. |
| reports | id, session_id, revision, status, rubric_version, model_id, payload_json, created_at | Unique session+revision; published report immutable. |
| feedback_requests | id, owner_id, report_id, finding_id, note, created_at | User disputes; no implied automatic regrade. |
| idempotency_records | owner_id, route_scope, key, request_hash, status_code, response_json, expires_at | Unique owner+route_scope+key. |
| usage_reservations | id, owner_id, job_id, max_tokens, estimated_cost, actual_cost, status | Atomic budget reservations; price schedule version required. |

## Key invariants
- A question/evidence/answer reference must belong to the same session/project version as its parent.
- A report never cites an answer that was not accepted or a question that was not asked.
- Plan revision increments on summary correction; session creation uses only the latest confirmed plan.
- Re-preparation creates a new plan revision; existing sessions retain the previous plan. Project GET/confirmation exposes only normal plans. Retest plans are internal, use RetestPlan, inherit the parent's confirmed project context, and never replace the latest normal plan.
- Deleting a project prevents every worker output from being committed to it.
- File references use evidence IDs; model-supplied paths/line numbers are not trusted as canonical references.
- Session revision increments for accepted mutations and published next questions. Repeat/playback are local read actions.
- Answer insert, session mutation, event and job insert are atomic.
- Provider/model and prompt/rubric versions are retained for reproducibility, never API keys.

## Transactions and concurrency
Lock session row for answer/control operations. Resolve idempotency before checking revision so an exact replay can succeed even after state advances. On new request, require expectedRevision and a compatible state; otherwise 409 with current revision. Never hold a DB lock across provider calls.
Pause during generation updates revision and cancels publication; resume queues regeneration using the already saved answer. End cancels generation and queues a report. Worker compare-and-swap prevents stale publication.

## Retention and deletion
Working default: projects expire after seven days without activity; sample sessions after 24 hours; guest credentials after 30 days. UI displays expiry. Resource mutations and explicit authenticated viewing update last activity at most hourly. No expiry extension from worker polling alone.

Delete responds 202 after tombstoning and cancelling jobs. Worker purges files, excerpts, plans, sessions, answers, reports and feedback; credentials are revoked for delete-all. Keep only a content-free deletion receipt for 30 days. Backups can retain deleted records for their configured retention; state the actual period, target <=30 days, before launch. On restore, reapply deletion receipts before reopening access.

## Indexes / migrations
Index owner_id on projects/sessions, project_id on versions, version_id on files/evidence/plans, session_id+sequence on questions, session_id on answers/events/reports, and job ready/lease columns.
Create migrations in development; apply reviewed migrations in staging and production with the pinned Prisma version. No production schema reset. Use expand/contract changes and rollback application code only when schema remains compatible.

