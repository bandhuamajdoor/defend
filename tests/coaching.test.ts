import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  initialState,
  accept,
  applyCoaching,
  control,
  publish,
} from "../src/domain/controller";
import { guidedCoach, coachingReport } from "../src/providers/guided";
import { knownSample, verifyCoach } from "../src/providers/coach";
import { prepare, nextQuestion } from "../src/providers/mock";
import { ingest, evidenceWindows } from "../src/services/ingestion";
import { buildProjectMap, retrieve } from "../src/services/retrieval";
import { sample } from "../src/fixtures/sample";
import { verifyReport } from "../src/services/evidence";
import { validate } from "../src/domain/contracts";
import { modelSchema, retryDelay } from "../src/providers/structured";
import type { State, PlanContent, Evidence } from "../src/domain/types";
function sources(files = sample.files): Evidence[] {
  const versionId = randomUUID();
  return ingest({ ...sample, files }).files.flatMap((f) =>
    evidenceWindows(f).map((e) => ({ ...e, versionId, path: f.path })),
  );
}
const evidence = sources(),
  plan = prepare(sample.brief, sample.contribution, evidence);
function answer(index: number, text: string) {
  const state = initialState();
  state.coachMode = true;
  state.topicIndex = index;
  submit(state, plan, text);
  return state;
}
function submit(state: State, plan: PlanContent, text: string) {
  const q = nextQuestion(state, plan, evidence);
  publish(state, q, 1000);
  return accept(
    state,
    "awaiting_answer",
    plan,
    "normal",
    {
      id: randomUUID(),
      questionId: q.id,
      turnId: randomUUID(),
      topicId: q.topicId,
      text,
      assisted: !!state.coaching?.length,
    },
    2000,
  );
}
describe("immediate, bounded coaching", () => {
  it("turns an intentionally bad answer into an actionable retry", () => {
    const state = answer(1, "I don't know");
    const feedback = guidedCoach(state, plan, evidence, true);
    expect(feedback.verdict).toBe("needs_work");
    expect(feedback.recommendation).toBe("retry");
    expect(feedback.improvements.join(" ")).toContain("useState");
    expect(feedback.exampleAnswer).toContain("400");
    expect(feedback.evidenceIds.length).toBeGreaterThan(0);
    verifyCoach(feedback, state, evidence);
  });
  it("corrects the specific confident stale-price claim", () => {
    const state = answer(
      1,
      "The total automatically updates on every quantity change.",
    );
    const f = guidedCoach(state, plan, evidence, true);
    expect(f.verdict).toBe("needs_work");
    expect(f.summary).toContain("does not update");
    expect(
      evidence
        .filter((e) => f.evidenceIds.includes(e.id))
        .some(
          (e) =>
            e.path === "src/TicketSelector.tsx" &&
            e.excerpt.includes("[total]"),
        ),
    ).toBe(true);
    expect(f.improvements.join(" ")).toContain("runs on mount");
  });
  it("recognizes concise correct reasoning and still offers precision", () => {
    const state = answer(
      1,
      "Quantity changes, but total is initialized only once and becomes stale. Derive total from quantity and unitPrice.",
    );
    const f = guidedCoach(state, plan, evidence, true);
    expect(f.verdict).toBe("strong");
    expect(f.strengths.length).toBeGreaterThan(0);
    expect(f.improvements.join(" ")).toContain("unitPrice");
    expect(f.recommendation).toBe("advance");
  });
  it("does not treat unsupported own-project coaching as technical assessment", () => {
    const state = answer(
      1,
      "The function receives the input and returns the result because it is simpler.",
    );
    const f = guidedCoach(state, plan, [], false);
    expect(f.source).toBe("structure_only");
    expect(f.verdict).toBe("uncertain");
    applyCoaching(state, plan, f);
    expect(
      coachingReport(state, plan).criteria.every(
        (c) => c.status === "not_assessed",
      ),
    ).toBe(true);
  });
  it("bounds repeated weak answers to two follow-ups before advancing", () => {
    const state = answer(1, "idk");
    for (let i = 0; i < 3; i++) {
      const f = guidedCoach(state, plan, evidence, true);
      applyCoaching(state, plan, f);
      if (i < 2) {
        expect(state.topicIndex).toBe(1);
        submit(state, plan, "idk");
      }
    }
    expect(state.topicIndex).toBe(2);
    expect(state.coaching).toHaveLength(3);
  });
  it("preserves an earlier answer and its coached revision in the debrief", () => {
    const state = answer(1, "It always recalculates.");
    applyCoaching(state, plan, guidedCoach(state, plan, evidence, true));
    submit(
      state,
      plan,
      "Quantity changes, but total is initialized only once and stale. Derive total from quantity.",
    );
    applyCoaching(state, plan, guidedCoach(state, plan, evidence, true));
    const report = coachingReport(state, plan);
    expect(report.findings[0].answerQuotes).toHaveLength(2);
    expect(report.findings[0].uncertainty).toContain("prior coaching");
    expect(report.practiceTasks.length).toBeGreaterThan(0);
    verifyReport(report, state, evidence);
  });
  it("rejects invented answer and source references", () => {
    const state = answer(1, "idk"),
      f = guidedCoach(state, plan, evidence, true);
    expect(() =>
      verifyCoach({ ...f, evidenceIds: [randomUUID()] }, state, evidence),
    ).toThrow(/not reviewed/);
    expect(() =>
      verifyCoach({ ...f, answerId: randomUUID() }, state, evidence),
    ).toThrow(/submitted answer/);
  });
  it("uses a sample checklist only for exact known source", () => {
    expect(knownSample(evidence)).toBe(true);
    expect(
      knownSample(
        evidence.map((e, i) =>
          i ? e : { ...e, excerpt: "Different project source" },
        ),
      ),
    ).toBe(false);
  });
  it("ends without requiring unfinished coaching and preserves the unassessed answer", () => {
    const state = answer(
      1,
      "My saved answer while the provider is unavailable.",
    );
    expect(
      control(state, "generation_failed", "end", plan, "normal", 3000),
    ).toBe("evaluating");
    expect(state.skipPendingCoaching).toBe(true);
    const report = coachingReport(state, plan);
    expect(report.findings[0].title).toBe("Saved answer awaiting coaching");
    expect(report.findings[0].answerQuotes[0].quote).toBe(
      state.answers[0].text,
    );
    expect(report.criteria.every((c) => c.status === "not_assessed")).toBe(
      true,
    );
    verifyReport(report, state, evidence);
  });
});
describe("project-scale retrieval", () => {
  it("finds a relevant source beyond the former first-20-file limit", () => {
    const files = Array.from({ length: 500 }, (_, i) => ({
      path: `src/feature-${i}.ts`,
      text: `export function feature${i}(n: number) { return n + ${i}; }`,
    }));
    files[499] = {
      path: "src/recovery.ts",
      text: "export function retryLeaseOrder(job: { revision: number }) { return job.revision; }",
    };
    const indexed = sources(files),
      map = buildProjectMap(indexed),
      pack = retrieve(
        indexed,
        map,
        "Explain retryLeaseOrder recovery revision",
      );
    expect(map).toHaveLength(500);
    expect(pack.evidence.some((e) => e.path === "src/recovery.ts")).toBe(true);
    expect(pack.evidence.length).toBeLessThanOrEqual(6);
    expect(
      pack.evidence.reduce((n, e) => n + e.excerpt.length, 0),
    ).toBeLessThanOrEqual(11000);
    expect(pack.notes.join(" ")).toContain("unverified");
  });
  it("resolves relative imports without running code", () => {
    const indexed = sources([
      {
        path: "src/main.ts",
        text: 'import { calculate } from "./pricing";\nexport const total = calculate(2);',
      },
      {
        path: "src/pricing.ts",
        text: "globalThis.__defend_should_not_execute = true;\nexport const calculate = (n: number) => n * 2;",
      },
    ]);
    const map = buildProjectMap(indexed);
    expect(map.find((c) => c.path === "src/main.ts")?.resolvedImports).toEqual([
      "src/pricing.ts",
    ]);
    expect(
      (globalThis as Record<string, unknown>).__defend_should_not_execute,
    ).toBeUndefined();
    expect(
      retrieve(indexed, map, "main total").evidence.some(
        (e) => e.path === "src/pricing.ts",
      ),
    ).toBe(true);
  });
  it("retains all accepted lines while keeping ordinary windows bounded", () => {
    const text = Array.from(
      { length: 300 },
      (_, i) => `line ${i}: ${"x".repeat(170)}`,
    ).join("\n");
    const windows = evidenceWindows({ id: randomUUID(), text });
    expect(windows.map((e) => e.excerpt).join("\n")).toBe(text);
    expect(windows.every((e) => e.excerpt.length <= 10000)).toBe(true);
    expect(windows.at(-1)?.endLine).toBe(300);
  });
  it("requires explicit narrowing at upload limits instead of silently truncating", () => {
    const files = Array.from({ length: 501 }, (_, i) => ({
      path: `${i}.ts`,
      text: "",
    }));
    expect(() => ingest({ ...sample, files })).toThrow(/500/);
  });
  it("rejects malformed Unicode before source storage or model use", () => {
    expect(() =>
      ingest({ ...sample, files: [{ path: "bad.ts", text: "\ud800" }] }),
    ).toThrow();
  });
});
describe("model contract boundaries", () => {
  it("constructs a strict, closed schema with no unresolved source refs", () => {
    const s = modelSchema("CoachResponse");
    expect(s.additionalProperties).toBe(false);
    expect(JSON.stringify(s)).not.toContain("$ref");
    expect(s.required).toEqual(Object.keys(s.properties as object));
    expect(() => validate("CoachResponse", { verdict: "strong" })).toThrow();
  });
  it("handles malformed and date-shaped Retry-After without invalid queue times", () => {
    expect(retryDelay("not-a-number")).toBe(0);
    expect(retryDelay("120")).toBe(60000);
    expect(
      retryDelay(new Date(Date.now() + 10000).toUTCString()),
    ).toBeGreaterThan(5000);
  });
});
