"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Code2,
  Download,
  Layers,
  Leaf,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { Operation, ReportDTO } from "@/domain/types";

import {
  Badge,
  Busy,
  ErrorNotice,
  EvidenceCard,
  Icon,
  Modal,
  labels,
} from "@/components/ui";
import { useResource } from "@/components/hooks";
import { useMutation } from "@/components/hooks";

export function Report({ id }: { id: string }) {
  const router = useRouter();
  const resource = useResource<ReportDTO | Operation>(
    `/sessions/${id}/report`,
    (r) => !r || !("content" in r),
  );
  const mutation = useMutation();
  const [selected, setSelected] = useState<string[]>([]),
    [dispute, setDispute] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [receipt, setReceipt] = useState("");
  const r = resource.data && "content" in resource.data ? resource.data : null;
  async function retest() {
    if (!r) return;
    const op = await mutation.run<Operation>(`/sessions/${id}/retest`, "POST", {
      reportId: r.id,
      conceptIds: selected,
    });
    if (op) {
      sessionStorage.setItem("defend-current-session", op.resourceId);
      router.push(`/sessions/${op.resourceId}?job=${op.jobId}`);
    }
  }
  async function feedback() {
    if (!r || !dispute) return;
    const result = await mutation.run<{ id: string }>(
      `/reports/${r.id}/feedback`,
      "POST",
      { findingId: dispute, note },
    );
    if (result) {
      setReceipt(
        `Review request recorded. Receipt ${result.id.slice(0, 8)}. The report has not been automatically changed.`,
      );
      setDispute(null);
      setNote("");
    }
  }
  if (!r)
    return resource.error ? (
      <ErrorNotice
        message={resource.error}
        onRetry={() => void resource.refresh()}
      />
    ) : (
      <Busy text="Preparing your report. Accepted answers remain saved…" />
    );
  const concepts = Array.from(
    new Map(r.content.findings.map((f) => [f.conceptId, f])).values(),
  );
  return (
    <>
      <Link href="/projects" className="back-link">
        ← My projects
      </Link>
      <div className="section-heading page-heading">
        <div>
          <div className="eyebrow">
            A LITTLE REFLECTION. A CLEARER NEXT STEP.
          </div>
          <h1>
            Here’s what to take forward<span className="green-period">.</span>
          </h1>
          <p>
            {r.content.partial ? "Partial practice" : "Practice complete"} ·{" "}
            {new Date(r.createdAt).toLocaleDateString("en-IN")} · Rubric{" "}
            {r.rubricVersion}
          </p>
        </div>
        <div className="export-buttons">
          <a
            className="btn secondary"
            href={`/api/v1/sessions/${id}/export?format=json`}
            download
          >
            <Download size={15} />
            JSON
          </a>
          <a
            className="btn secondary"
            href={`/api/v1/sessions/${id}/export?format=html`}
            download
          >
            <Download size={15} />
            Print-friendly report
          </a>
        </div>
      </div>
      <section className="report-summary panel">
        <span className="step-icon">
          <BookOpen size={24} />
        </span>
        <div>
          <Badge tone="green">Development report preview</Badge>
          <h2>Keep the reasoning. Find your next question.</h2>
          <p>{r.content.summary}</p>
        </div>
      </section>
      <div className="criteria-grid">
        {r.content.criteria.map((c) => (
          <article className="criterion-card" key={c.criterionId}>
            <Icon
              icon={
                c.criterionId === "implementation"
                  ? Code2
                  : c.criterionId === "design"
                    ? Layers
                    : c.criterionId === "failure"
                      ? ShieldCheck
                      : Leaf
              }
              size={20}
            />
            <h3>{labels[c.criterionId]}</h3>
            <Badge>{labels[c.status]}</Badge>
            <p>{c.rationale}</p>
          </article>
        ))}
      </div>
      <div className="report-layout">
        <section>
          <div className="section-heading">
            <h2>Your answers, in context.</h2>
            <span className="quiet-copy">Exact quotes. Original source.</span>
          </div>
          {!r.content.findings.length && (
            <div className="panel empty-state">
              <MessageSquare size={27} />
              <h3>A fresh start is a good next step.</h3>
              <p>
                No substantive answers were submitted, so there are no findings
                or scores.
              </p>
              <Link className="btn primary" href="/projects">
                Choose a project <ArrowRight size={15} />
              </Link>
            </div>
          )}
          {r.content.findings.map((f, i) => (
            <article className="finding panel" key={f.id}>
              <div className="section-heading">
                <span className="eyebrow">
                  REFLECTION {String(i + 1).padStart(2, "0")}
                </span>
                <Badge>Unresolved · mock preview</Badge>
              </div>
              <h3>{f.title}</h3>
              {f.answerQuotes.map((q) => (
                <blockquote key={q.answerId}>
                  <span>YOU SAID</span>
                  <p>“{q.quote}”</p>
                </blockquote>
              ))}
              <p>{f.rationale}</p>
              <div className="uncertainty-note">
                <span>What remains uncertain</span>
                <p>{f.uncertainty}</p>
              </div>
              {r.evidence
                .filter((e) => f.evidenceIds.includes(e.id))
                .map((e) => (
                  <EvidenceCard key={e.id} evidence={e} />
                ))}
              <div className="practice-task">
                <ArrowUpRight size={18} />
                <div>
                  <strong>Try this next</strong>
                  <p>{f.practiceTask}</p>
                </div>
              </div>
              <button
                className="text-button quiet-copy"
                onClick={() => {
                  mutation.setError("");
                  setDispute(f.id);
                }}
              >
                This seems wrong <MessageSquare size={13} />
              </button>
            </article>
          ))}
        </section>
        <aside className="retest-panel panel">
          <span className="step-icon">
            <RefreshCw size={22} />
          </span>
          <span className="eyebrow">THE NEXT SMALL STEP</span>
          <h2>
            Same concept.
            <br />
            Fresh perspective.
          </h2>
          <p>
            Try a new scenario around one or two concepts. Previous hints remain
            part of the practice history.
          </p>
          {concepts.map((f) => (
            <label className="concept-option" key={f.conceptId}>
              <input
                type="checkbox"
                checked={selected.includes(f.conceptId)}
                disabled={
                  !selected.includes(f.conceptId) && selected.length === 2
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, f.conceptId]
                      : selected.filter((c) => c !== f.conceptId),
                  )
                }
              />
              <span>{f.conceptId.replaceAll("-", " ")}</span>
            </label>
          ))}
          <button
            className="btn primary full-width"
            disabled={!selected.length || mutation.busy}
            onClick={retest}
          >
            Start focused retest <ArrowRight size={16} />
          </button>
          {mutation.error && !dispute && (
            <ErrorNotice message={mutation.error} />
          )}
          <p className="small-copy">
            2 topics · up to 6 active minutes. This preview does not make
            improvement claims.
          </p>
          {r.content.unassessedTopics.length > 0 && (
            <div className="unassessed">
              <h4>Still unexplored</h4>
              <p>
                {r.content.unassessedTopics
                  .map((t) => t.replaceAll("-", " "))
                  .join(", ")}
                . These topics weren’t assessed.
              </p>
            </div>
          )}
        </aside>
      </div>
      {receipt && (
        <div className="notice" role="status">
          {receipt}
        </div>
      )}
      {dispute && (
        <Modal
          title="Flag feedback for review"
          onClose={() => setDispute(null)}
        >
          <p>
            Your note is saved for manual review. It won’t automatically rewrite
            this report.
          </p>
          <label>
            What needs another look?
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={4}
            />
          </label>
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setDispute(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!note.trim() || mutation.busy}
              onClick={feedback}
            >
              Save review request
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
