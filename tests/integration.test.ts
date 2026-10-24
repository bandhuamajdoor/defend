import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/db/client";
import { handle } from "../src/services/api";
import { claim, runJob, runOne, maintain } from "../src/jobs/runner";
import { validate } from "../src/domain/contracts";
import type {
  Operation,
  ProjectDTO,
  PublicSession,
  ReportDTO,
} from "../src/domain/types";
const owners: string[] = [];
const appOrigin = process.env.APP_ORIGIN!;
class Guest {
  cookie = "";
  ip = randomUUID();
  async call(path: string, method = "GET", body?: unknown, key = randomUUID()) {
    const r = await handle(
      new Request(`${appOrigin}/api/v1${path}`, {
        method,
        headers: {
          origin: appOrigin,
          "x-forwarded-for": this.ip,
          "content-type": "application/json",
          "idempotency-key": key,
          ...(this.cookie ? { cookie: this.cookie } : {}),
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      }),
    );
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async init() {
    const r = await this.call("/guest", "POST");
    expect(r.status).toBe(201);
    this.cookie = r.headers.get("set-cookie")!.split(";")[0];
    owners.push(r.data.ownerId);
    return this;
  }
}
let alice: Guest,
  bob: Guest,
  project: ProjectDTO,
  session: PublicSession,
  firstJob: string;
async function drain() {
  for (let i = 0; i < 25; i++) {
    if (!(await runOne({ delayMs: 0 }))) return;
  }
  throw new Error("Queue did not drain");
}
async function snapshot() {
  const r = await alice.call(`/sessions/${session.id}`);
  expect(r.status).toBe(200);
  session = validate<PublicSession>("Session", r.data);
  return session;
}
beforeAll(async () => {
  process.env.TRUST_PROXY = "1";
  alice = await new Guest().init();
  bob = await new Guest().init();
});
afterAll(async () => {
  await db.owner.deleteMany({ where: { id: { in: owners } } });
  await db.$disconnect();
});
describe.sequential("real PostgreSQL API + worker flow", () => {
  it("creates isolated sample and validates every public DTO against contracts", async () => {
    const op = await alice.call("/projects/sample", "POST", { consent: true });
    expect(op.status).toBe(202);
    validate("Operation", op.data);
    firstJob = op.data.jobId;
    await drain();
    const r = await alice.call(`/projects/${op.data.resourceId}`);
    project = validate("Project", r.data);
    expect(project.versions[0].status).toBe("ready");
    expect((await bob.call(`/projects/${project.id}`)).status).toBe(404);
    expect((await bob.call(`/jobs/${firstJob}`)).status).toBe(404);
  });
  it("freezes confirmation, rejects stale plan, and starts a durable interview", async () => {
    const v = project.versions[0],
      p = v.plan!;
    const c = await alice.call(`/projects/${project.id}/confirm`, "POST", {
      versionId: v.id,
      expectedRevision: p.revision,
      summary: p.content.summary,
      contribution: p.content.contribution,
    });
    expect(c.status).toBe(200);
    validate("Confirmation", c.data);
    expect(
      (
        await alice.call("/sessions", "POST", {
          projectId: project.id,
          versionId: v.id,
          planId: p.id,
          expectedRevision: p.revision,
        })
      ).status,
    ).toBe(409);
    const created = await alice.call("/sessions", "POST", {
      projectId: project.id,
      versionId: v.id,
      planId: c.data.planId,
      expectedRevision: c.data.revision,
    });
    expect(created.status).toBe(202);
    session = { id: created.data.resourceId } as PublicSession;
    await drain();
    await snapshot();
    expect(session.status).toBe("awaiting_answer");
  });
  it("accepts a double click exactly once and rejects conflicting reuse", async () => {
    const key = randomUUID();
    const input = {
      questionId: session.currentQuestion!.id,
      turnId: randomUUID(),
      expectedRevision: session.revision,
      text: "I implemented the quantity selector and pricing calculation.",
    };
    const [a, b] = await Promise.all([
      alice.call(`/sessions/${session.id}/answers`, "POST", input, key),
      alice.call(`/sessions/${session.id}/answers`, "POST", input, key),
    ]);
    expect(a.status).toBe(202);
    expect(b.data).toEqual(a.data);
    expect(await db.answer.count({ where: { sessionId: session.id } })).toBe(1);
    expect(
      (
        await alice.call(
          `/sessions/${session.id}/answers`,
          "POST",
          { ...input, text: "A different answer" },
          key,
        )
      ).status,
    ).toBe(409);
    await drain();
    await snapshot();
  });
  it("has one winner when two tabs submit different answers for the same revision", async () => {
    const input = {
      questionId: session.currentQuestion!.id,
      turnId: randomUUID(),
      expectedRevision: session.revision,
      text: "A user input updates quantity state. The total needs to derive from it.",
    };
    const results = await Promise.all([
      alice.call(`/sessions/${session.id}/answers`, "POST", input),
      alice.call(`/sessions/${session.id}/answers`, "POST", {
        ...input,
        turnId: randomUUID(),
        text: "A second tab answer.",
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
    await drain();
    await snapshot();
  });
  it("pause cancels late worker publication; resume preserves accepted answers", async () => {
    const answered = await alice.call(
      `/sessions/${session.id}/answers`,
      "POST",
      {
        questionId: session.currentQuestion!.id,
        turnId: randomUUID(),
        expectedRevision: session.revision,
        text: "I would verify this by changing the quantity in a component test.",
      },
    );
    expect(answered.status).toBe(202);
    const job = await claim();
    expect(job).not.toBeNull();
    const completion = runJob(job!, { delayMs: 150 });
    await snapshot();
    const paused = await alice.call(
      `/sessions/${session.id}/controls`,
      "POST",
      { action: "pause", expectedRevision: session.revision },
    );
    expect(paused.status).toBe(202);
    await completion;
    await snapshot();
    expect(session.status).toBe("paused");
    expect(session.currentQuestion).toBeNull();
    const count = await db.answer.count({ where: { sessionId: session.id } });
    await alice.call(`/sessions/${session.id}/controls`, "POST", {
      action: "resume",
      expectedRevision: session.revision,
    });
    await drain();
    await snapshot();
    expect(session.status).toBe("awaiting_answer");
    expect(await db.answer.count({ where: { sessionId: session.id } })).toBe(
      count,
    );
  });
  it("reclaims an expired worker lease and fences the old worker", async () => {
    await alice.call(`/sessions/${session.id}/controls`, "POST", {
      action: "skip",
      expectedRevision: session.revision,
    });
    const old = await claim();
    expect(old).not.toBeNull();
    await db.job.update({
      where: { id: old!.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    const replacement = await claim();
    expect(replacement!.leaseToken).not.toBe(old!.leaseToken);
    await runJob(old!, { delayMs: 0 });
    expect((await db.job.findUnique({ where: { id: old!.id } }))?.status).toBe(
      "running",
    );
    await runJob(replacement!, { delayMs: 0 });
    await snapshot();
    expect(session.status).toBe("awaiting_answer");
  });
  it("bounds dependency retries and user retry never inserts another answer", async () => {
    const r = await alice.call(`/sessions/${session.id}/answers`, "POST", {
      questionId: session.currentQuestion!.id,
      turnId: randomUUID(),
      expectedRevision: session.revision,
      text: "I would simulate a failed request and check how the UI recovers.",
    });
    const op = r.data as Operation;
    const count = await db.answer.count({ where: { sessionId: session.id } });
    for (let i = 0; i < 3; i++) {
      await db.job.update({
        where: { id: op.jobId! },
        data: { runAfter: new Date(0) },
      });
      await runOne({ fail: true, delayMs: 0 });
    }
    await snapshot();
    expect(session.status).toBe("generation_failed");
    const j = await alice.call(`/jobs/${op.jobId}`);
    expect(j.data.attempts).toBe(3);
    expect(j.data.status).toBe("failed");
    const retry = await alice.call(`/jobs/${op.jobId}/retry`, "POST");
    expect(retry.status).toBe(202);
    await drain();
    await snapshot();
    expect(session.status).toBe("awaiting_answer");
    expect(await db.answer.count({ where: { sessionId: session.id } })).toBe(
      count,
    );
  });
  it("end fences in-flight generation and creates an evidence-linked partial report", async () => {
    const skip = await alice.call(`/sessions/${session.id}/controls`, "POST", {
      action: "skip",
      expectedRevision: session.revision,
    });
    expect(skip.status).toBe(202);
    const job = await claim();
    const late = job ? runJob(job, { delayMs: 150 }) : Promise.resolve();
    await snapshot();
    if (session.status !== "evaluating")
      expect(
        (
          await alice.call(`/sessions/${session.id}/controls`, "POST", {
            action: "end",
            expectedRevision: session.revision,
          })
        ).status,
      ).toBe(202);
    await late;
    await drain();
    await snapshot();
    expect(session.status).toBe("completed");
    const report = await alice.call(`/sessions/${session.id}/report`);
    const r = validate<ReportDTO>("Report", report.data);
    expect(r.content.criteria.every((c) => c.status === "not_assessed")).toBe(
      true,
    );
    expect(r.evidence.length).toBeGreaterThan(0);
    expect((await bob.call(`/sessions/${session.id}`)).status).toBe(404);
    expect((await bob.call(`/sessions/${session.id}/report`)).status).toBe(404);
    expect(
      (await bob.call(`/sessions/${session.id}/export?format=json`)).status,
    ).toBe(404);
  });
  it("exports canonical content, records a dispute, and creates a fresh retest", async () => {
    const r = (await alice.call(`/sessions/${session.id}/report`))
      .data as ReportDTO;
    const exported = await alice.call(
      `/sessions/${session.id}/export?format=json`,
    );
    expect(exported.data).toEqual(r);
    const feedback = await alice.call(`/reports/${r.id}/feedback`, "POST", {
      findingId: r.content.findings[0].id,
      note: "The authentication middleware was not uploaded.",
    });
    expect(feedback.status).toBe(201);
    const retest = await alice.call(`/sessions/${session.id}/retest`, "POST", {
      reportId: r.id,
      conceptIds: [r.content.findings[0].conceptId],
    });
    expect(retest.status).toBe(202);
    await drain();
    const next = (await alice.call(`/sessions/${retest.data.resourceId}`))
      .data as PublicSession;
    expect(next.mode).toBe("retest");
    expect(next.versionId).toBe(session.versionId);
    expect(next.currentQuestion!.text).toContain("ten times");
    const refreshed = validate<ProjectDTO>(
      "Project",
      (await alice.call(`/projects/${project.id}`)).data,
    );
    expect(refreshed.versions[0].plan!.content.topics).toHaveLength(5);
  });
  it("rejects cross-origin mutations before performing them", async () => {
    const r = await handle(
      new Request(`${appOrigin}/api/v1/projects/sample`, {
        method: "POST",
        headers: {
          origin: "https://foreign.invalid",
          "content-type": "application/json",
          cookie: alice.cookie,
          "idempotency-key": randomUUID(),
        },
        body: '{"consent":true}',
      }),
    );
    expect(r.status).toBe(403);
  });
  it("deletion revokes every resource immediately, then purges source data", async () => {
    expect((await bob.call(`/projects/${project.id}`, "DELETE")).status).toBe(
      404,
    );
    expect((await alice.call(`/projects/${project.id}`, "DELETE")).status).toBe(
      202,
    );
    for (const path of [
      `/projects/${project.id}`,
      `/sessions/${session.id}`,
      `/sessions/${session.id}/report`,
      `/jobs/${firstJob}`,
    ])
      expect((await alice.call(path)).status).toBe(404);
    await maintain();
    expect(
      await db.sourceFile.count({ where: { versionId: session.versionId } }),
    ).toBe(0);
    expect(
      await db.deletionReceipt.count({ where: { resourceId: project.id } }),
    ).toBe(1);
  });
});
