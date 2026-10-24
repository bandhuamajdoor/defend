import type { ReportDTO } from "../domain/types";
export const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function exportHTML(r: ReportDTO) {
  const e = escapeHTML;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Defend practice report</title><style>body{font:16px/1.6 system-ui;max-width:800px;margin:40px auto;padding:24px;color:#172e2a}section{border-top:1px solid #ddd;padding:20px 0}pre{white-space:pre-wrap;font:13px/1.6 monospace;background:#f4f5f2;padding:16px}blockquote{border-left:3px solid #638b63;padding-left:16px}@media print{body{margin:0}section{break-inside:avoid}}</style><h1>Defend · Practice report</h1><p>${e(r.rubricVersion)} · ${e(r.createdAt)}</p><p>${e(r.content.summary)}</p>${r.content.criteria.map((c) => `<section><h2>${e(c.criterionId)} · ${e(c.status.replaceAll("_", " "))}</h2><p>${e(c.rationale)}</p></section>`).join("")}${r.content.findings
    .map(
      (f) =>
        `<section><h2>${e(f.title)}</h2><p>${e(f.rationale)}</p>${f.answerQuotes.map((q) => `<blockquote>${e(q.quote)}</blockquote>`).join("")}<p>${e(f.uncertainty)}</p><p>Practice: ${e(f.practiceTask)}</p>${r.evidence
          .filter((x) => f.evidenceIds.includes(x.id))
          .map(
            (x) =>
              `<p>${e(x.path)} · lines ${x.startLine}–${x.endLine}</p><pre>${e(x.excerpt)}</pre>`,
          )
          .join("")}</section>`,
    )
    .join("")}</html>`;
}
