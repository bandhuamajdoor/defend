# Deployment and operations
## Hosting contract
Container-friendly HTTPS web process + private persistent worker + managed PostgreSQL, co-located where possible. Choose the user's existing hosting account before spending. Dockerfile, Compose and GitHub Actions configuration are prepared; Docker/hosted deployment is unverified on the current host. See [implementation status](16-implementation-status.md).
A web-only serverless deployment is insufficient for this queue design unless a supported durable worker service is also configured. Do not launch provider calls in unawaited request callbacks. Host duration/pricing must be checked against current plan documentation when deploying.

## Configuration gates
Pin Node/package/container versions; same application revision for web and worker. Configure HTTPS origin, DB TLS, secure secrets, provider/model, token pricing and positive global/session spend limits. Mock mode must be visibly labelled and is not the public live submission.
Browser speech works without server TTS credentials; validate actual availability on target browsers. Text fallback always enabled.

## Deploy sequence
1. Build from lockfile; run static, domain, integration and browser checks.
2. Back up DB; apply reviewed compatible migrations as a one-off release task.
3. Seed sample idempotently.
4. Start worker; verify heartbeat, queue claim and expired-lease recovery.
5. Start web; verify /api/v1/health reports readiness without private details.
6. Smoke-test sample and small private upload using a real provider; finish, export, retest and delete.
7. Verify budgets, ownership, deletion and logging; publish only after release gates pass.
8. Record commit/image, migration version, model/prompt/rubric versions, provider prices and actual infrastructure cost.

## Readiness and metrics
PostgreSQL server_encoding must be UTF8. Health reports unavailable for a legacy encoding even if a simple query works; project uploads return explicit repair guidance before inserting files. The native local launcher sets encoding explicitly rather than inheriting the Windows locale. `npm run db:utf8` repairs an existing local application database with row verification and retained rollback copies; it does not replace the hosted backup/restore policy below.

Web health checks DB connectivity and worker heartbeat freshness (<60 seconds); return 503 when sessions cannot progress. A lightweight process liveness probe remains separate inside hosting configuration to avoid restart loops during transient DB failure.
Worker writes heartbeat every 15 seconds; alert on stale heartbeat >60s, oldest queued job >120s, failures >10% over 20 jobs, repeated invalid evidence, or 80% daily spend.
Log request/job/session IDs, states, timings, token counts and error codes. Exclude source, answers, prompts, cookies and keys.
Track accepted-to-published latency separately from speech playback and upload time.

## Budget control
Current preview: paid adapters are disabled; free/local attempts use atomic request allowances and ModelCall usage/status records. See [free AI setup](17-free-ai-setup.md). The following monetary-reservation policy is a future requirement if paid providers are ever authorized.

Atomic reservation before queueing paid work; reconcile actual usage and retain safety margin for ambiguous timeout billing. If price configuration is missing, fail closed. On quota exhaustion allow read/export/delete and return a useful message for new generation. Operator override must be explicit and logged. No automatic provider purchase or credit top-up.

## Runbooks
| Incident | Action |
| --- | --- |
| Worker stopped | Check heartbeat, restart process, reclaim expired leases; inspect duplicate-effect tests before scaling. |
| Provider outage | Stop immediate retry storms; bounded backoff, mark retryable; preserve saved answers. |
| Invalid evidence/report | Quarantine output, keep prior canonical state; inspect fixture regression; never publish fake certainty. |
| DB unavailable | Reject writes with retryable error; retain browser draft; restore connectivity before draining jobs. |
| Spend ceiling reached | Pause paid jobs; allow export/delete; inspect per-session costs and retries. |
| Bad release | Stop new jobs, roll back compatible app image, retain accepted data; never reset production DB. |
| Deletion backlog | Block access via tombstones, repair purge worker, verify object counts and receipt; disclose delayed purge accurately. |

## Backup/restore and retention
Daily encrypted DB backups with provider-configured retention target <=30 days. Before launch verify restore into an isolated environment; reapply deletion receipts before exposing restored data. Target recovery point <=24h and recovery time <=4h for pilot; these are operational goals, not an SLA.
Hourly retention task tombstones expired projects/sample sessions and purges resources. Scan all entity tables and orphaned jobs. Physical deletion target <=24h. Confirm backup and AI-provider retention text in the UI matches reality.

## Launch checklist
All G1–G8 gates in [testing](10-testing-and-quality.md), no debug mode, actual provider consent text, sample isolation, quota enabled, browser speech fallback, restore evidence, and responsible operator available during judging.

