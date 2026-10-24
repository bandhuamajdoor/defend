import type { Evidence, ReportContent, State } from "../domain/types";
import { requireThat } from "../domain/errors";
import { sha } from "./ingestion";
export function verifyEvidence(evidence: Evidence[], versionId: string) {
  for (const e of evidence)
    requireThat(
      e.versionId === versionId &&
        e.startLine > 0 &&
        e.endLine >= e.startLine &&
        sha(e.excerpt) === e.sha256,
      "INVALID_INPUT",
      "Evidence could not be verified.",
    );
}
export function verifyReport(
  report: ReportContent,
  s: State,
  evidence: Evidence[],
) {
  requireThat(
    new Set(report.criteria.map((c) => c.criterionId)).size === 4,
    "INVALID_INPUT",
    "Report must cover four distinct criteria.",
  );
  const ids = new Set(evidence.map((e) => e.id));
  for (const item of [...report.criteria, ...report.findings]) {
    if ("status" in item && item.status !== "not_assessed")
      requireThat(
        item.answerQuotes.length > 0,
        "INVALID_INPUT",
        "An assessed criterion needs answer evidence.",
      );
    if ("status" in item && item.status === "not_assessed")
      requireThat(
        item.answerQuotes.length === 0,
        "INVALID_INPUT",
        "Unassessed criteria cannot invent quotes.",
      );
    for (const q of item.answerQuotes)
      requireThat(
        s.answers.some((a) => a.id === q.answerId && a.text.includes(q.quote)),
        "INVALID_INPUT",
        "Answer quotation could not be verified.",
      );
    if ("evidenceIds" in item)
      requireThat(
        item.evidenceIds.every((id) => ids.has(id)),
        "INVALID_INPUT",
        "A report references unavailable evidence.",
      );
  }
}
