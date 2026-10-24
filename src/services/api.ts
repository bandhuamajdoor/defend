import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { db, json, type Tx } from "../db/client";
import { AppError, requireThat } from "../domain/errors";
import { validate } from "../domain/contracts";
import type {
  Upload,
  PlanContent,
  State,
  Status,
  ReportContent,
} from "../domain/types";
import {
  accept,
  control,
  initialState,
  checkRevision,
} from "../domain/controller";
import { ingest, sha, evidenceWindows } from "./ingestion";
import { sample } from "../fixtures/sample";
import { checkConfig, origin } from "./config";
import { projectDTO, sessionDTO, reportDTO, evidenceDTO } from "./views";
import { exportHTML } from "./export";
import { uploadLimits } from "../domain/upload-limits";
import { runtimeInfo, validateBackend } from "../providers/runtime";
const day = 86400000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const activeProject = { deletedAt: null, expiresAt: { gt: new Date() } };
export function projectWhere(ownerId: string) {
  return { ownerId, deletedAt: null, expiresAt: { gt: new Date() } };
}
export function sessionWhere(ownerId: string) {
  return { ownerId, version: { project: projectWhere(ownerId) } };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
async function rate(tx: Tx, key: string, limit: number, windowMs: number) {
  const bucket = `${key}:${Math.floor(Date.now() / windowMs)}`;
  const r = await tx.rateBucket.upsert({
    where: { key: bucket },
    create: {
      key: bucket,
      count: 1,
      expiresAt: new Date(Date.now() + windowMs),
    },
    update: { count: { increment: 1 } },
  });
  requireThat(
    r.count <= limit,
    "RATE_LIMITED",
    "Too many requests. Please try again shortly.",
    429,
  );
}
function ipKey(req: Request) {
  const address =
    process.env.TRUST_PROXY === "1"
      ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")
      : "direct";
  return createHmac("sha256", process.env.APP_SECRET!)
    .update(`${new Date().toISOString().slice(0, 10)}:${address}`)
    .digest("hex");
}
async function owner(req: Request) {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("defend_guest="))
    ?.slice(13);
  if (!cookie) return null;
  return db.owner.findFirst({
    where: {
      tokenHash: sha(cookie),
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}
async function body(req: Request) {
  requireThat(
    req.headers.get("content-type")?.split(";")[0] === "application/json",
    "INVALID_INPUT",
    "Send an application/json request.",
    400,
  );
  requireThat(
    Number(req.headers.get("content-length") ?? 0) <= uploadLimits.requestBytes,
    "LIMIT_EXCEEDED",
    "Request exceeds 24 MiB.",
    413,
  );
  const reader = req.body?.getReader();
  let size = 0;
  const parts: Uint8Array[] = [];
  if (reader)
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > uploadLimits.requestBytes) {
        await reader.cancel();
        throw new AppError("LIMIT_EXCEEDED", "Request exceeds 24 MiB.", 413);
      }
      parts.push(part.value);
    }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
  } catch {
    throw new AppError("INVALID_INPUT", "Request contains invalid JSON.", 400);
  }
}
export async function enqueue(
  tx: Tx,
  ownerId: string,
  kind: string,
  entityId: string,
  expectedRevision: number,
) {
  return tx.job.create({ data: { ownerId, kind, entityId, expectedRevision } });
}
const operation = (
  resourceId: string,
  revision: number | null,
  jobId: string | null,
) => ({ resourceId, revision, jobId, status: "accepted" });
async function cancelJobs(tx: Tx, entityId: string) {
  await tx.job.updateMany({
    where: { entityId, status: { in: ["queued", "running"] } },
    data: { status: "cancelled", leaseToken: null, leaseUntil: null },
  });
}
async function getSession(tx: Tx, ownerId: string, id: string) {
  const s = await tx.session.findFirst({
    where: { id, ...sessionWhere(ownerId) },
    include: { plan: true, version: true },
  });
  requireThat(s, "NOT_FOUND", "Interview not found.", 404);
  return s;
}
async function getProject(tx: Tx, ownerId: string, id: string) {
  const p = await tx.project.findFirst({
    where: { id, ...projectWhere(ownerId) },
    include: {
      versions: {
        orderBy: { ordinal: "desc" },
        include: {
          files: {
            select: { id: true, path: true, byteSize: true, lineCount: true },
          },
          plans: {
            where: { mode: "normal" },
            orderBy: { revision: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  requireThat(p, "NOT_FOUND", "Project not found.", 404);
  return p;
}
async function addVersion(
  tx: Tx,
  ownerId: string,
  input: Upload,
  projectId?: string,
  isSample = false,
) {
  const parsed = ingest(input);
  const [database] = await tx.$queryRaw<
    { encoding: string }[]
  >`SELECT current_setting('server_encoding') AS encoding`;
  requireThat(
    database?.encoding === "UTF8",
    "DEPENDENCY_UNAVAILABLE",
    "The project database must use UTF-8 to store source files. Run the local database UTF-8 repair before retrying. Your selected files remain on this page.",
    503,
  );
  const runtime = runtimeInfo();
  validateBackend();
  requireThat(
    runtime.provider === "mock" ||
      input.consentVersion === runtime.consentVersion,
    "INVALID_INPUT",
    "Please review and accept the current model-provider disclosure.",
  );
  if (projectId) await getProject(tx, ownerId, projectId);
  else {
    requireThat(
      (await tx.project.count({
        where: { ownerId, createdAt: { gt: new Date(Date.now() - day) } },
      })) < 5,
      "RATE_LIMITED",
      "You can create up to five projects per day.",
      429,
    );
    const p = await tx.project.create({
      data: {
        ownerId,
        title: input.title,
        sample: isSample,
        expiresAt: new Date(Date.now() + (isSample ? day : 7 * day)),
      },
    });
    projectId = p.id;
  }
  const ordinal = (await tx.version.count({ where: { projectId } })) + 1;
  requireThat(
    ordinal <= 100,
    "LIMIT_EXCEEDED",
    "This project has reached its version limit.",
    413,
  );
  const version = await tx.version.create({
    data: {
      projectId,
      ordinal,
      brief: input.brief,
      contribution: input.contribution,
      contentHash: parsed.contentHash,
      consentVersion: runtime.consentVersion,
      files: { create: parsed.files },
    },
  });
  for (const f of parsed.files)
    await tx.evidence.createMany({
      data: evidenceWindows(f).map((e) => ({ ...e, versionId: version.id })),
    });
  await tx.project.update({
    where: { id: projectId },
    data: { title: input.title, lastActivityAt: new Date() },
  });
  const job = await enqueue(tx, ownerId, "prepare_project", version.id, 1);
  return operation(projectId, null, job.id);
}
async function newSession(
  tx: Tx,
  ownerId: string,
  versionId: string,
  planId: string,
  mode = "normal",
  parentReportId?: string,
) {
  requireThat(
    (await tx.session.count({
      where: { ownerId, createdAt: { gt: new Date(Date.now() - day) } },
    })) < 10,
    "RATE_LIMITED",
    "You can start up to ten interviews per day.",
    429,
  );
  requireThat(
    !(await tx.session.findFirst({
      where: {
        ownerId,
        status: { in: ["preparing", "generating", "evaluating"] },
      },
    })),
    "INVALID_STATE",
    "Wait for your other interview to finish generating.",
    409,
  );
  const s = await tx.session.create({
    data: {
      ownerId,
      versionId,
      planId,
      mode,
      parentReportId,
      state: json({ ...initialState(), coachMode: true, coaching: [] }),
    },
  });
  const j = await enqueue(tx, ownerId, "generate_turn", s.id, 0);
  return operation(s.id, 0, j.id);
}
async function mutation(
  tx: Tx,
  ownerId: string,
  method: string,
  path: string[],
  input: unknown,
): Promise<{ code: number; data: unknown }> {
  const [area, id, action] = path;
  if (area === "projects" && method === "POST" && !id)
    return {
      code: 202,
      data: await addVersion(
        tx,
        ownerId,
        validate<Upload>("ProjectUpload", input),
      ),
    };
  if (area === "projects" && id === "sample" && method === "POST") {
    const consent = validate<{ consent: true; consentVersion?: string }>(
      "ConsentRequest",
      input,
    );
    return {
      code: 202,
      data: await addVersion(
        tx,
        ownerId,
        { ...sample, consentVersion: consent.consentVersion },
        undefined,
        true,
      ),
    };
  }
  if (area === "projects" && id) {
    const p = await getProject(tx, ownerId, id);
    if (method === "DELETE" && !action) {
      await tx.project.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      const versions = p.versions.map((v) => v.id);
      const sessions = await tx.session.findMany({
        where: { versionId: { in: versions } },
        select: { id: true },
      });
      await tx.job.updateMany({
        where: {
          entityId: { in: [...versions, ...sessions.map((s) => s.id)] },
        },
        data: { status: "cancelled", leaseToken: null },
      });
      const receipt = await tx.deletionReceipt.create({
        data: { resourceId: id },
      });
      return { code: 202, data: { receiptId: receipt.id, status: "accepted" } };
    }
    if (method === "POST" && action === "versions")
      return {
        code: 202,
        data: await addVersion(
          tx,
          ownerId,
          validate<Upload>("ProjectUpload", input),
          id,
        ),
      };
    if (method === "POST" && action === "confirm") {
      const b = validate<{
        versionId: string;
        expectedRevision: number;
        summary: string;
        contribution: string;
      }>("ConfirmRequest", input);
      const v = p.versions[0],
        plan = v?.plans[0];
      requireThat(
        v?.id === b.versionId && plan,
        "INVALID_STATE",
        "Wait for the latest project version to prepare.",
        409,
      );
      checkRevision(plan.revision, b.expectedRevision);
      const confirmed = await tx.plan.create({
        data: {
          versionId: v.id,
          mode: "normal",
          revision: plan.revision + 1,
          content: json({
            ...(plan.content as object),
            summary: b.summary,
            contribution: b.contribution,
          }),
          modelId: plan.modelId,
          promptVersion: plan.promptVersion,
          confirmedAt: new Date(),
        },
      });
      return {
        code: 200,
        data: {
          projectId: id,
          versionId: v.id,
          planId: confirmed.id,
          revision: confirmed.revision,
          confirmed: true,
        },
      };
    }
  }
  if (area === "sessions" && method === "POST" && !id) {
    const b = validate<{
      projectId: string;
      versionId: string;
      planId: string;
      expectedRevision: number;
    }>("SessionCreate", input);
    const p = await getProject(tx, ownerId, b.projectId);
    const v = p.versions[0];
    const plan = v?.plans[0];
    requireThat(
      v?.id === b.versionId && plan?.id === b.planId && plan.confirmedAt,
      "INVALID_STATE",
      "Confirm the latest project brief before starting.",
      409,
    );
    checkRevision(plan.revision, b.expectedRevision);
    return { code: 202, data: await newSession(tx, ownerId, v.id, plan.id) };
  }
  if (area === "sessions" && id && method === "POST") {
    const s = await getSession(tx, ownerId, id);
    const state = s.state as unknown as State;
    const plan = s.plan.content as unknown as PlanContent;
    if (action === "retest") {
      const b = validate<{ reportId: string; conceptIds: string[] }>(
        "RetestRequest",
        input,
      );
      const r = await tx.report.findFirst({
        where: { id: b.reportId, sessionId: s.id },
      });
      requireThat(
        r && s.status === "completed",
        "NOT_FOUND",
        "Finished report not found.",
        404,
      );
      const content = r.content as unknown as ReportContent;
      requireThat(
        new Set(b.conceptIds).size === b.conceptIds.length &&
          b.conceptIds.every((c) =>
            content.findings.some((f) => f.conceptId === c),
          ),
        "INVALID_INPUT",
        "Choose one or two concepts from this report.",
      );
      const selected = b.conceptIds.map(
        (c) => plan.topics.find((t) => t.conceptId === c)!,
      );
      const topics = [selected[0], selected[1] ?? selected[0]].map((t, i) => ({
        ...t,
        id: `retest-${i + 1}`,
        phase: i === 0 ? "technical_depth" : "failure_scenario",
        openingQuestion:
          i === 0
            ? `Imagine this project must support ten times as many users. How would you revisit this objective: ${t.objective}`
            : `Imagine a dependency returns outdated data. How would you test this objective: ${t.objective}`,
      }));
      const retest = validate<PlanContent>("RetestPlan", { ...plan, topics });
      const next = await tx.plan.create({
        data: {
          versionId: s.versionId,
          mode: "retest",
          revision: 1,
          content: json(retest),
          modelId: s.plan.modelId,
          promptVersion: s.plan.promptVersion,
          confirmedAt: new Date(),
        },
      });
      return {
        code: 202,
        data: await newSession(
          tx,
          ownerId,
          s.versionId,
          next.id,
          "retest",
          r.id,
        ),
      };
    }
    let status: Status;
    let event: string;
    if (action === "answers") {
      const b = validate<{
        questionId: string;
        turnId: string;
        expectedRevision: number;
        text: string;
      }>("AnswerRequest", input);
      checkRevision(s.revision, b.expectedRevision);
      const answer = {
        id: randomUUID(),
        questionId: b.questionId,
        turnId: b.turnId,
        text: b.text,
        topicId: state.currentQuestion?.topicId ?? "",
        assisted:
          state.clarifications > 0 ||
          !!state.coaching?.some(
            (f) => f.topicId === state.currentQuestion?.topicId,
          ),
      };
      status = accept(
        state,
        s.status as Status,
        plan,
        s.mode,
        answer,
        Date.now(),
      );
      await tx.answer.create({
        data: {
          id: answer.id,
          sessionId: id,
          questionId: b.questionId,
          turnId: b.turnId,
          text: b.text,
        },
      });
      event = "answer";
    } else if (action === "controls") {
      const b = validate<{ action: string; expectedRevision: number }>(
        "ControlRequest",
        input,
      );
      checkRevision(s.revision, b.expectedRevision);
      status = control(
        state,
        s.status as Status,
        b.action,
        plan,
        s.mode,
        Date.now(),
      );
      event = b.action;
      await cancelJobs(tx, id);
      state.turns.push({
        id: randomUUID(),
        role: "system",
        questionId: null,
        text:
          b.action === "clarify"
            ? "Clarification requested · assistance recorded."
            : b.action === "skip"
              ? "Question skipped · not assessed."
              : `Interview ${b.action === "end" ? "ended" : b.action === "pause" ? "paused" : "resumed"}.`,
        createdAt: new Date().toISOString(),
      });
    } else throw new AppError("NOT_FOUND", "Route not found.", 404);
    const revision = s.revision + 1;
    await tx.session.update({
      where: { id },
      data: { revision, status, state: json(state) },
    });
    await tx.sessionEvent.create({
      data: { sessionId: id, type: event, payload: json({ revision }) },
    });
    let jobId: string | null = null;
    if (status === "generating" || status === "evaluating")
      jobId = (
        await enqueue(
          tx,
          ownerId,
          status === "evaluating"
            ? "evaluate_session"
            : state.next === "clarification"
              ? "clarify_turn"
              : "generate_turn",
          id,
          revision,
        )
      ).id;
    return { code: 202, data: operation(id, revision, jobId) };
  }
  if (area === "jobs" && id && action === "retry" && method === "POST") {
    const job = await tx.job.findFirst({
      where: { id, ownerId, status: "failed" },
    });
    requireThat(job, "NOT_FOUND", "Failed job not found.", 404);
    let revision = job.expectedRevision;
    if (job.kind === "prepare_project") {
      const v = await tx.version.findFirst({
        where: { id: job.entityId, project: projectWhere(ownerId) },
      });
      requireThat(v, "NOT_FOUND", "Project not found.", 404);
      await tx.version.update({
        where: { id: v.id },
        data: { status: "preparing" },
      });
    } else {
      const s = await getSession(tx, ownerId, job.entityId);
      requireThat(
        ["generation_failed", "evaluation_failed"].includes(s.status),
        "INVALID_STATE",
        "This job is no longer current.",
        409,
      );
      revision = s.revision + 1;
      await tx.session.update({
        where: { id: s.id },
        data: {
          revision,
          status: job.kind === "evaluate_session" ? "evaluating" : "generating",
        },
      });
    }
    await tx.job.update({
      where: { id },
      data: {
        status: "queued",
        expectedRevision: revision,
        attempts: 0,
        errorCode: null,
        leaseToken: null,
        leaseUntil: null,
        runAfter: new Date(),
      },
    });
    return { code: 202, data: operation(job.entityId, revision, id) };
  }
  if (area === "reports" && id && action === "feedback" && method === "POST") {
    const b = validate<{ findingId: string; note: string }>(
      "FeedbackRequest",
      input,
    );
    const r = await tx.report.findFirst({
      where: { id, session: sessionWhere(ownerId) },
    });
    requireThat(r, "NOT_FOUND", "Report not found.", 404);
    requireThat(
      (r.content as unknown as ReportContent).findings.some(
        (f) => f.id === b.findingId,
      ),
      "NOT_FOUND",
      "Finding not found.",
      404,
    );
    const receipt = await tx.feedback.create({
      data: { reportId: id, findingId: b.findingId, note: b.note },
    });
    return { code: 201, data: { id: receipt.id, status: "recorded" } };
  }
  if (area === "me" && method === "DELETE") {
    await tx.owner.update({
      where: { id: ownerId },
      data: { deletedAt: new Date() },
    });
    await tx.project.updateMany({
      where: { ownerId },
      data: { deletedAt: new Date() },
    });
    await tx.job.updateMany({
      where: { ownerId },
      data: { status: "cancelled", leaseToken: null },
    });
    const receipt = await tx.deletionReceipt.create({
      data: { resourceId: ownerId },
    });
    return { code: 202, data: { receiptId: receipt.id, status: "accepted" } };
  }
  throw new AppError("NOT_FOUND", "Route not found.", 404);
}
async function read(ownerId: string, path: string[], req: Request) {
  const [area, id, action] = path;
  if (area === "projects" && !id) {
    const ps = await db.project.findMany({
      where: projectWhere(ownerId),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      projects: ps.map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
    });
  }
  if (area === "projects" && id) {
    const project = await getProject(db, ownerId, id);
    if (action === "sessions") {
      const sessions = await db.session.findMany({
        where: {
          ...sessionWhere(ownerId),
          version: { projectId: id, project: projectWhere(ownerId) },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return NextResponse.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          status: s.status,
          mode: s.mode,
          createdAt: s.createdAt.toISOString(),
        })),
      });
    }
    requireThat(!action, "NOT_FOUND", "Route not found.", 404);
    return NextResponse.json(projectDTO(project));
  }
  if (area === "sessions" && id) {
    const s = await getSession(db, ownerId, id);
    if (action === "evidence") {
      const ids = [
        ...new Set(new URL(req.url).searchParams.get("ids")?.split(",") ?? []),
      ];
      requireThat(
        ids.length > 0 && ids.length <= 12 && ids.every((i) => uuid.test(i)),
        "INVALID_INPUT",
        "Choose up to 12 source references.",
      );
      const evidence = await db.evidence.findMany({
        where: { id: { in: ids }, versionId: s.versionId },
        include: { file: { select: { path: true } } },
      });
      requireThat(
        evidence.length === ids.length,
        "NOT_FOUND",
        "Source context not found.",
        404,
      );
      return NextResponse.json({ evidence: evidence.map(evidenceDTO) });
    }
    if (!action) {
      const job = await db.job.findFirst({
        where: { entityId: s.id, ownerId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ ...sessionDTO(s), jobId: job?.id ?? null });
    }
    const r = await db.report.findFirst({
      where: { sessionId: id },
      orderBy: { revision: "desc" },
    });
    if (action === "report" && !r) {
      requireThat(
        s.status !== "evaluation_failed",
        "DEPENDENCY_UNAVAILABLE",
        "Your report could not be prepared. Return to the practice room to retry the saved job.",
        503,
      );
      return NextResponse.json(operation(id, s.revision, null), {
        status: 202,
      });
    }
    requireThat(r, "INVALID_STATE", "The report is not ready to export.", 409);
    const evidence = await db.evidence.findMany({
      where: { versionId: s.versionId },
      include: { file: { select: { path: true } } },
    });
    const dto = reportDTO(r, evidence.map(evidenceDTO));
    if (action === "report") return NextResponse.json(dto);
    if (action === "export") {
      const format = new URL(req.url).searchParams.get("format") ?? "json";
      requireThat(
        ["json", "html"].includes(format),
        "INVALID_INPUT",
        "Choose json or html.",
      );
      return new NextResponse(
        format === "json" ? JSON.stringify(dto, null, 2) : exportHTML(dto),
        {
          headers: {
            "Content-Type":
              format === "json"
                ? "application/json"
                : "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="defend-report.${format}"`,
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          },
        },
      );
    }
  }
  if (area === "jobs" && id) {
    const j = await db.job.findFirst({ where: { id, ownerId } });
    requireThat(j, "NOT_FOUND", "Job not found.", 404);
    if (j.kind === "prepare_project") {
      requireThat(
        await db.version.findFirst({
          where: { id: j.entityId, project: projectWhere(ownerId) },
        }),
        "NOT_FOUND",
        "Job not found.",
        404,
      );
    } else await getSession(db, ownerId, j.entityId);
    return NextResponse.json({
      id: j.id,
      kind: j.kind,
      status: j.status,
      attempts: j.attempts,
      resultId: j.resultId,
      errorCode: j.errorCode,
      retryable: j.status === "failed",
    });
  }
  throw new AppError("NOT_FOUND", "Route not found.", 404);
}
export async function handle(req: Request) {
  try {
    const path = new URL(req.url).pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    if (path[0] === "capabilities" && req.method === "GET") {
      let ready = true;
      try {
        validateBackend();
      } catch {
        ready = false;
      }
      return NextResponse.json({ ...runtimeInfo(), ready, uploadLimits });
    }
    checkConfig();
    if (path[0] === "health") {
      const [database] = await db.$queryRaw<
        { encoding: string }[]
      >`SELECT current_setting('server_encoding') AS encoding`;
      const heartbeat = await db.workerHeartbeat.findUnique({
        where: { id: "worker" },
      });
      return NextResponse.json(
        {
          status:
            database?.encoding === "UTF8" &&
            heartbeat &&
            Date.now() - heartbeat.updatedAt.getTime() < 60000
              ? "ok"
              : "unavailable",
        },
        {
          status:
            database?.encoding === "UTF8" &&
            heartbeat &&
            Date.now() - heartbeat.updatedAt.getTime() < 60000
              ? 200
              : 503,
        },
      );
    }
    if (path[1] && path[1] !== "sample")
      requireThat(uuid.test(path[1]), "NOT_FOUND", "Resource not found.", 404);
    const ip = ipKey(req);
    await db.$transaction((tx) => rate(tx, `ip:${ip}`, 120, 60000));
    const who = await owner(req);
    if (req.method !== "GET") {
      requireThat(
        req.headers.get("origin") === origin(),
        "INVALID_INPUT",
        "Request origin is not allowed.",
        403,
      );
      const input = await body(req);
      if (path[0] === "guest" && req.method === "POST") {
        if (who)
          return NextResponse.json(
            { ownerId: who.id, expiresAt: who.expiresAt.toISOString() },
            { status: 201 },
          );
        const token = randomBytes(32).toString("hex");
        const guest = await db.$transaction(async (tx) => {
          await rate(tx, `guest:${ip}`, 10, 3600000);
          return tx.owner.create({
            data: {
              tokenHash: sha(token),
              expiresAt: new Date(Date.now() + 30 * day),
            },
          });
        });
        const response = NextResponse.json(
          { ownerId: guest.id, expiresAt: guest.expiresAt.toISOString() },
          { status: 201 },
        );
        response.cookies.set("defend_guest", token, {
          httpOnly: true,
          secure: origin().startsWith("https://"),
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 86400,
        });
        return response;
      }
      requireThat(
        who,
        "UNAUTHENTICATED",
        "Start a browser session to continue.",
        401,
      );
      const key = req.headers.get("idempotency-key");
      requireThat(
        key && uuid.test(key),
        "INVALID_INPUT",
        "Provide a UUID Idempotency-Key.",
        400,
      );
      const scope = `${req.method}:${path.join("/")}`;
      const hash = sha(canonical(input));
      const result = await db.$transaction(
        async (tx) => {
          // An owner lock serializes mutation/idempotency checks across web instances.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${who.id}, 0))`;
          const active = await tx.owner.findFirst({
            where: {
              id: who.id,
              deletedAt: null,
              expiresAt: { gt: new Date() },
            },
          });
          requireThat(
            active,
            "UNAUTHENTICATED",
            "Browser session expired.",
            401,
          );
          const old = await tx.idempotency.findUnique({
            where: { ownerId_scope_key: { ownerId: who.id, scope, key } },
          });
          if (old) {
            requireThat(
              old.hash === hash,
              "IDEMPOTENCY_CONFLICT",
              "This retry key was already used for different content.",
              409,
            );
            return { code: old.code, data: old.response };
          }
          await rate(tx, `owner:${who.id}`, 60, 60000);
          const result = await mutation(tx, who.id, req.method, path, input);
          await tx.idempotency.create({
            data: {
              ownerId: who.id,
              scope,
              key,
              hash,
              code: result.code,
              response: json(result.data),
              expiresAt: new Date(Date.now() + 7 * day),
            },
          });
          return result;
        },
        { timeout: 15000 },
      );
      const response = NextResponse.json(result.data, { status: result.code });
      if (path[0] === "me") response.cookies.delete("defend_guest");
      return response;
    }
    requireThat(
      who,
      "UNAUTHENTICATED",
      "Start a browser session to continue.",
      401,
    );
    return await read(who.id, path, req);
  } catch (e) {
    if (new URL(req.url).pathname === "/api/v1/health")
      return NextResponse.json({ status: "unavailable" }, { status: 503 });
    const requestId = randomUUID();
    if (!(e instanceof AppError)) {
      const code = (e as { code?: unknown } | null)?.code;
      // Correlate unexpected failures without logging source, prompts, raw DB
      // errors or connection strings, which can contain uploaded text/secrets.
      console.error(
        JSON.stringify({
          event: "api_failure",
          requestId,
          method: req.method,
          errorType: e instanceof Error ? e.constructor.name : typeof e,
          ...(typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)
            ? { code }
            : {}),
        }),
      );
    }
    const error =
      e instanceof AppError
        ? e
        : new AppError(
            "DEPENDENCY_UNAVAILABLE",
            req.method === "POST" &&
              /^\/api\/v1\/projects(?:\/|$)/.test(new URL(req.url).pathname)
              ? "Project preparation could not be started. Your selected files remain on this page. Please retry."
              : "The service could not complete this request. Please retry; previously accepted answers remain saved.",
            503,
          );
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          retryable: error.status === 503,
          ...(error.currentRevision === undefined
            ? {}
            : { currentRevision: error.currentRevision }),
        },
      },
      {
        status: error.status,
        headers: error.status === 429 ? { "Retry-After": "60" } : undefined,
      },
    );
  }
}
