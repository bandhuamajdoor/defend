import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { ingest, evidenceWindows } from "../src/services/ingestion";
import { sample } from "../src/fixtures/sample";
import {
  initialState,
  accept,
  control,
  publish,
  budgetReached,
} from "../src/domain/controller";
import { prepare, nextQuestion, evaluate } from "../src/providers/mock";
import { verifyReport } from "../src/services/evidence";
import { exportHTML } from "../src/services/export";
import { validate } from "../src/domain/contracts";
import type { ReportDTO } from "../src/domain/types";
const plan = prepare(sample.brief, sample.contribution, []);
function ready() {
  const s = initialState();
  publish(s, nextQuestion(s, plan, []), 1000);
  return s;
}
describe("upload boundaries", () => {
  it("normalizes LF while preserving source paths and immutable line windows", () => {
    const result = ingest({
      ...sample,
      files: [{ path: "src/main.ts", text: "a\r\nb\rc" }],
    });
    expect(result.files[0].text).toBe("a\nb\nc");
    expect(evidenceWindows(result.files[0])[0]).toMatchObject({
      startLine: 1,
      endLine: 3,
      excerpt: "a\nb\nc",
    });
  });
  it.each([
    "../secret.ts",
    "C:\\app.ts",
    "/root.ts",
    "src/../app.ts",
    "src//app.ts",
    ".env",
    "node_modules/app.ts",
    "dist/app.js",
    "package-lock.json",
    "credentialS.json",
    "main.zip",
  ])("rejects excluded path %s", (path) =>
    expect(() =>
      ingest({ ...sample, files: [{ path, text: "text" }] }),
    ).toThrow(),
  );
  it("rejects case-folded duplicate names", () =>
    expect(() =>
      ingest({
        ...sample,
        files: [
          { path: "A.ts", text: "" },
          { path: "a.ts", text: "" },
        ],
      }),
    ).toThrow(/Duplicate/));
  it("checks UTF-8 byte limits rather than string length", () =>
    expect(() =>
      ingest({
        ...sample,
        files: [{ path: "large.ts", text: "€".repeat(88000) }],
      }),
    ).toThrow(/256 KiB/));
  it("accepts the exact per-file byte boundary", () =>
    expect(
      ingest({ ...sample, files: [{ path: "ok.ts", text: "a".repeat(262144) }] })
        .files[0].byteSize,
    ).toBe(262144));
  it("rejects secrets without echoing their values", () => {
    const value = "ghp_" + "a".repeat(30);
    try {
      ingest({
        ...sample,
        files: [{ path: "main.ts", text: "// token\n" + value }],
      });
      throw Error("expected rejection");
    } catch (e) {
      expect((e as Error).message).toContain("line 2");
      expect((e as Error).message).not.toContain(value);
    }
  });
  it("rejects binary and replacement characters", () => {
    for (const text of ["a\0b", "a\ufffdb"])
      expect(() =>
        ingest({ ...sample, files: [{ path: "main.ts", text }] }),
      ).toThrow(/encoding/);
  });
});
describe("interview controller", () => {
  it("keeps accepted text identical for typing, paste or dictation", () => {
    const s = ready(),
      questionId = s.currentQuestion!.id;
    const text =
      "The total is quantity multiplied by unit price.\nI would check the UI update.";
    const status = accept(
      s,
      "awaiting_answer",
      plan,
      "normal",
      {
        id: randomUUID(),
        questionId,
        turnId: randomUUID(),
        text,
        topicId: "purpose",
        assisted: false,
      },
      2000,
    );
    expect(status).toBe("generating");
    expect(s.answers[0].text).toBe(text);
    expect(s.topicIndex).toBe(1);
    expect(s.activeMs).toBe(1000);
  });
  it("pause excludes inactive time and resume keeps the same question", () => {
    const s = ready(),
      q = s.currentQuestion;
    expect(control(s, "awaiting_answer", "pause", plan, "normal", 3000)).toBe(
      "paused",
    );
    expect(s.activeMs).toBe(2000);
    expect(control(s, "paused", "resume", plan, "normal", 100000)).toBe(
      "awaiting_answer",
    );
    expect(s.currentQuestion).toEqual(q);
    expect(s.activeSince).toBe(100000);
  });
  it("does not accept answers while paused", () => {
    const s = ready();
    expect(() =>
      accept(
        s,
        "paused",
        plan,
        "normal",
        {
          id: randomUUID(),
          questionId: s.currentQuestion!.id,
          turnId: randomUUID(),
          text: "An answer",
          topicId: "purpose",
          assisted: false,
        },
        2000,
      ),
    ).toThrow();
    expect(s.answers).toEqual([]);
  });
  it("clarify records assistance and bounds repeated requests", () => {
    const s = ready();
    control(s, "awaiting_answer", "clarify", plan, "normal", 2000);
    expect(s.hinted).toHaveLength(1);
    publish(s, nextQuestion(s, plan, []), 3000);
    control(s, "awaiting_answer", "clarify", plan, "normal", 4000);
    publish(s, nextQuestion(s, plan, []), 5000);
    expect(() =>
      control(s, "awaiting_answer", "clarify", plan, "normal", 6000),
    ).toThrow(/limit/);
  });
  it("lets an unfinished answer finish after the active-time budget", () => {
    const s = ready();
    expect(budgetReached(s, "normal", 800000)).toBe(true);
    expect(s.currentQuestion).not.toBeNull();
    const status = accept(
      s,
      "awaiting_answer",
      plan,
      "normal",
      {
        id: randomUUID(),
        questionId: s.currentQuestion!.id,
        turnId: randomUUID(),
        text: "My final answer.",
        topicId: "purpose",
        assisted: false,
      },
      800000,
    );
    expect(status).toBe("evaluating");
    expect(s.answers).toHaveLength(1);
  });
  it("counts skips and finishes at the answer-event cap", () => {
    const s = ready();
    s.count = 11;
    expect(control(s, "awaiting_answer", "skip", plan, "normal", 2000)).toBe(
      "evaluating",
    );
    expect(s.skipped).toHaveLength(1);
  });
  it("disallows resume after completion", () =>
    expect(() =>
      control(ready(), "completed", "resume", plan, "normal", 2000),
    ).toThrow());
});
describe("grounding and honest reports", () => {
  it("does not assess unanswered or skipped topics negatively", () => {
    const content = evaluate(initialState(), plan);
    expect(content.findings).toHaveLength(0);
    expect(
      content.criteria.every(
        (c) => c.status === "not_assessed" && c.answerQuotes.length === 0,
      ),
    ).toBe(true);
  });
  it("rejects fabricated answer quotations", () => {
    const s = ready();
    const content = evaluate(s, plan);
    content.criteria[0] = {
      ...content.criteria[0],
      status: "demonstrated",
      answerQuotes: [{ answerId: randomUUID(), quote: "Invented answer" }],
    };
    expect(() => verifyReport(content, s, [])).toThrow(/quotation/);
  });
  it("escapes HTML, including code and answer text in portable exports", () => {
    const s = ready();
    s.answers.push({
      id: randomUUID(),
      questionId: s.currentQuestion!.id,
      turnId: randomUUID(),
      topicId: "purpose",
      text: "<script>alert(1)</script>",
      assisted: false,
    });
    const content = evaluate(s, plan);
    const r: ReportDTO = {
      id: randomUUID(),
      sessionId: randomUUID(),
      revision: 1,
      rubricVersion: "v1-mock-preview",
      createdAt: new Date().toISOString(),
      content,
      evidence: [],
    };
    const html = exportHTML(r);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("runtime validation uses the committed domain schema", () => {
    expect(() =>
      validate("ProjectUpload", { ...sample, consent: false }),
    ).toThrow();
    expect(validate("PreparedPlan", plan)).toEqual(plan);
  });
});
