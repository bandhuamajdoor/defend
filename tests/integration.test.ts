import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/db/client";
import { handle } from "../src/services/api";
import { claim, runJob, runOne, maintain } from "../src/jobs/runner";
import { validate } from "../src/domain/contracts";
import { structured, ModelFailure } from "../src/providers/structured";
import { validateBackend } from "../src/providers/runtime";
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
function publicationGate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release: () => release() };
}
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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    const gate = publicationGate();
    const completion = runJob(job!, { delayMs: 0, beforeCommit: gate.wait });
    await snapshot();
    const paused = await alice.call(
      `/sessions/${session.id}/controls`,
      "POST",
      { action: "pause", expectedRevision: session.revision },
    );
    gate.release();
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
    const gate = publicationGate();
    const late = job
      ? runJob(job, { delayMs: 0, beforeCommit: gate.wait })
      : Promise.resolve();
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
    gate.release();
    await late;
    await drain();
    await snapshot();
    expect(session.status).toBe("completed");
    const report = await alice.call(`/sessions/${session.id}/report`);
    const r = validate<ReportDTO>("Report", report.data);
    expect(r.rubricVersion).toBe("v2-guided_sample");
    for (const criterion of r.content.criteria) {
      if (criterion.status === "not_assessed")
        expect(criterion.answerQuotes).toEqual([]);
      else expect(criterion.answerQuotes.length).toBeGreaterThan(0);
    }
    expect(session.coaching?.length).toBeGreaterThan(0);
    expect(new Set(session.coaching?.map((c) => c.answerId)).size).toBe(
      session.coaching?.length,
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
describe.sequential(
  "free model boundaries — transport is stubbed; no external inference",
  () => {
    const response = {
      verdict: "promising",
      summary: "Name the data flow explicitly.",
      strengths: ["You named a component."],
      improvements: ["Trace one input through the handler."],
      exampleAnswer: null,
      recommendation: "retry",
      nextQuestion: "What input does that handler receive?",
      evidenceIds: [],
    };
    async function modelJob() {
      return db.job.create({
        data: {
          ownerId: alice.cookie ? owners[0] : owners[1],
          entityId: randomUUID(),
          kind: "prepare_project",
          expectedRevision: 1,
          status: "running",
          leaseToken: randomUUID(),
          leaseUntil: new Date(Date.now() + 120000),
        },
      });
    }
    function groq() {
      vi.stubEnv("MODEL_PROVIDER", "groq");
      vi.stubEnv("MODEL_NAME", "openai/gpt-oss-20b");
      vi.stubEnv("GROQ_API_KEY", "fixture-key");
      vi.stubEnv("MODEL_FREE_TIER_ONLY", "true");
    }
    it("validates strict Groq output and stops at the configured entity allowance", async () => {
      groq();
      vi.stubEnv("MODEL_SESSION_REQUEST_LIMIT", "1");
      const job = await modelJob();
      const transport = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify(response) } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", transport);
      expect(
        await structured(
          job,
          "CoachResponse",
          "Trusted coaching instructions",
          { answer: "Synthetic test answer" },
        ),
      ).toEqual(response);
      const sent = JSON.parse(
        (transport.mock.calls[0] as unknown as [string, RequestInit])[1]
          .body as string,
      );
      expect(sent.response_format.json_schema.strict).toBe(true);
      expect((transport.mock.calls[0] as unknown as [string])[0]).toBe(
        "https://api.groq.com/openai/v1/chat/completions",
      );
      await expect(
        structured(job, "CoachResponse", "Trusted instructions", {}),
      ).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: false });
      expect(transport).toHaveBeenCalledTimes(1);
      expect(
        await db.modelCall.findFirst({ where: { jobId: job.id } }),
      ).toMatchObject({
        status: "completed",
        inputTokens: 100,
        outputTokens: 50,
      });
    });
    it("does not substitute sample feedback for malformed provider output", async () => {
      groq();
      const job = await modelJob();
      const transport = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"invalid":true}' } }],
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", transport);
      await expect(
        structured(job, "CoachResponse", "Trusted instructions", {}),
      ).rejects.toBeInstanceOf(ModelFailure);
      expect(transport).toHaveBeenCalledTimes(1);
      expect(
        await db.modelCall.findFirst({ where: { jobId: job.id } }),
      ).toMatchObject({ status: "failed" });
    });
    it("uses only the local Ollama endpoint and rejects cloud configuration", async () => {
      vi.stubEnv("MODEL_PROVIDER", "ollama");
      vi.stubEnv("MODEL_NAME", "local-fixture");
      vi.stubEnv("MODEL_BASE_URL", "http://127.0.0.1:11434");
      const job = await modelJob();
      const transport = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              message: { content: JSON.stringify(response) },
              prompt_eval_count: 80,
              eval_count: 40,
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", transport);
      expect(
        await structured(job, "CoachResponse", "Trusted instructions", {}),
      ).toEqual(response);
      const [url, options] = transport.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("http://127.0.0.1:11434/api/chat");
      expect(options.headers).not.toHaveProperty("Authorization");
      expect(JSON.parse(options.body as string)).toMatchObject({
        stream: false,
        options: { num_ctx: 8192 },
      });
      vi.stubEnv("MODEL_BASE_URL", "https://untrusted.invalid");
      expect(() => validateBackend()).toThrow(/loopback/);
      vi.stubEnv("MODEL_BASE_URL", "http://127.0.0.1:11434");
      vi.stubEnv("MODEL_NAME", "model:cloud");
      expect(() => validateBackend()).toThrow(/local model/);
    });
    it("prepares a 500-file project and reports the actual review scope", async () => {
      const files = Array.from({ length: 500 }, (_, i) => ({
        path: `src/features/feature-${i}.ts`,
        text: `export function feature${i}(n: number) { return n + ${i}; }`,
      }));
      const op = await alice.call("/projects", "POST", {
        title: "Large synthetic project",
        brief: "Many feature modules for a retrieval-scale fixture.",
        contribution: "I wrote the feature functions.",
        consent: true,
        files,
      });
      expect(op.status).toBe(202);
      await drain();
      const project = validate<ProjectDTO>(
        "Project",
        (await alice.call(`/projects/${op.data.resourceId}`)).data,
      );
      expect(project.versions[0].files).toHaveLength(500);
      expect(project.versions[0].plan?.content.coverage).toMatchObject({
        indexedFiles: 500,
        indexedExcerpts: 500,
        reviewedExcerpts: 0,
      });
    });
  },
);
