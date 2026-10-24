"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCode2,
  MessageSquare,
  Trash2,
} from "lucide-react";
import type { ProjectDTO, Operation } from "@/domain/types";
import { request } from "@/components/client";
import { Badge, Busy, ErrorNotice, Modal, labels } from "@/components/ui";
import { useResource } from "@/components/hooks";
import { useMutation } from "@/components/hooks";

export function Project({ id }: { id: string }) {
  const router = useRouter();
  const resource = useResource<ProjectDTO>(
    `/projects/${id}`,
    (p) => !p || p.versions[0]?.status === "preparing",
  );
  const mutation = useMutation();
  const [summary, setSummary] = useState(""),
    [contribution, setContribution] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { id: string; status: string; mode: string; createdAt: string }[]
  >([]);
  const p = resource.data,
    v = p?.versions[0],
    plan = v?.plan;
  useEffect(() => {
    if (plan) {
      setSummary(plan.content.summary);
      setContribution(plan.content.contribution);
    }
    // Editing is initialized once for each immutable plan, never on a polling refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);
  useEffect(() => {
    setJob(new URLSearchParams(window.location.search).get("job"));
    request<{ sessions: typeof history }>(`/projects/${id}/sessions`)
      .then((r) => setHistory(r.sessions))
      .catch(() => {});
  }, [id]);
  async function start() {
    if (!p || !v || !plan) return;
    let confirmed = { planId: plan.id, revision: plan.revision };
    if (
      !plan.confirmed ||
      summary !== plan.content.summary ||
      contribution !== plan.content.contribution
    ) {
      const c = await mutation.run<typeof confirmed>(
        `/projects/${id}/confirm`,
        "POST",
        {
          versionId: v.id,
          expectedRevision: plan.revision,
          summary,
          contribution,
        },
      );
      if (!c) return;
      confirmed = c;
      await resource.refresh();
    }
    const op = await mutation.run<Operation>("/sessions", "POST", {
      projectId: id,
      versionId: v.id,
      planId: confirmed.planId,
      expectedRevision: confirmed.revision,
    });
    if (op) {
      sessionStorage.setItem("defend-current-session", op.resourceId);
      router.push(`/sessions/${op.resourceId}?job=${op.jobId}`);
    }
  }
  async function remove() {
    const result = await mutation.run(`/projects/${id}`, "DELETE", {});
    if (result) router.push("/projects");
  }
  if (!p)
    return resource.error ? (
      <ErrorNotice
        message={resource.error}
        onRetry={() => void resource.refresh()}
      />
    ) : (
      <Busy />
    );
  return (
    <>
      <Link href="/projects" className="back-link">
        ← My projects
      </Link>
      <div className="section-heading page-heading">
        <div>
          <div className="eyebrow">YOUR PROJECT WORKSPACE</div>
          <h1>{p.title}</h1>
          <p>
            Version {v?.ordinal} · {v?.files.length} source files · Expires{" "}
            {new Date(p.expiresAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <button
          className="icon-button"
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete project"
        >
          <Trash2 size={19} />
        </button>
      </div>
      {resource.error && <ErrorNotice message={resource.error} />}
      <div className="form-layout">
        <section className="panel project-form">
          <div className="section-heading">
            <h2>First, a shared understanding.</h2>
            <Badge tone={v?.status === "ready" ? "green" : "neutral"}>
              {v?.status === "ready"
                ? "Ready to review"
                : v?.status === "failed"
                  ? "Preparation failed"
                  : "Preparing"}
            </Badge>
          </div>
          <p className="section-copy">
            Make this brief sound like your project. Confirmation saves an
            immutable plan for this interview.
          </p>
          {v?.status === "preparing" && (
            <Busy text="Indexing source excerpts and preparing your practice plan…" />
          )}
          {v?.status === "failed" && (
            <ErrorNotice
              message="Preparation could not finish. Your uploaded files are saved."
              onRetry={
                job
                  ? () =>
                      void mutation
                        .run(`/jobs/${job}/retry`, "POST", {})
                        .then(() => resource.refresh())
                  : undefined
              }
            />
          )}{" "}
          {plan && (
            <>
              {plan.content.coverage && (
                <div className="coverage-card">
                  <h3>What the coach can see</h3>
                  <div className="coverage-stats">
                    <span>
                      {plan.content.coverage.indexedFiles} files indexed
                    </span>
                    <span>
                      {plan.content.coverage.indexedExcerpts} source windows
                    </span>
                    <span>
                      {plan.content.coverage.reviewedExcerpts} excerpts reviewed
                      by a model
                    </span>
                  </div>
                  <p>
                    The file map covers accepted source. Each answer retrieves a
                    small, relevant evidence pack. Unreviewed code remains
                    uncertain.
                  </p>
                </div>
              )}
              <label>
                Project summary
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={4000}
                  rows={4}
                />
              </label>
              <label>
                Your contribution
                <textarea
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <div className="uncertainties">
                <h3>What I may be missing</h3>
                {plan.content.uncertainties.map((u) => (
                  <p key={u}>{u}</p>
                ))}
              </div>
              <div className="form-footer">
                <span>
                  <Check size={14} /> Your edits stay with this plan
                </span>
                <button
                  className="btn primary"
                  disabled={
                    mutation.busy || !summary.trim() || !contribution.trim()
                  }
                  onClick={start}
                >
                  {mutation.busy
                    ? "Saving…"
                    : plan.confirmed
                      ? "Start a new practice"
                      : "Confirm & start practice"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {mutation.error && (
            <ErrorNotice
              message={mutation.error}
              onRetry={() => void resource.refresh()}
            />
          )}
        </section>
        <aside className="form-aside panel">
          <div className="section-heading">
            <h3>Inside this practice</h3>
            <span className="quiet-copy">5 topics</span>
          </div>
          <ol className="topic-list">
            {plan?.content.topics.map((t, i) => (
              <li key={t.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{labels[t.phase]}</strong>
                  <small>{t.objective}</small>
                </div>
              </li>
            ))}
          </ol>
          <hr />
          <h4>Source files</h4>
          <ul className="source-list">
            {v?.files.map((f) => (
              <li key={f.id}>
                <FileCode2 size={15} />
                <span>{f.path}</span>
                <small>{f.lineCount} lines</small>
              </li>
            ))}
          </ul>
          <p className="small-copy">
            Line-window indexing · no code execution. This preview does not
            perform semantic source analysis.
          </p>
        </aside>
      </div>
      {history.length > 0 && (
        <section className="panel history-panel">
          <h2>Your practices</h2>
          {history.map((s) => (
            <Link
              key={s.id}
              className="history-row"
              href={`/sessions/${s.id}${s.status === "completed" ? "/report" : ""}`}
            >
              <MessageSquare size={17} />
              <span>
                {s.mode === "retest" ? "Focused retest" : "Project interview"}
                <small>{new Date(s.createdAt).toLocaleString("en-IN")}</small>
              </span>
              <Badge>{s.status.replaceAll("_", " ")}</Badge>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </section>
      )}
      {deleteOpen && (
        <Modal
          title="Delete this project?"
          onClose={() => setDeleteOpen(false)}
        >
          <p>
            Access to all versions, answers and reports will be revoked
            immediately. Export reports you want to keep first.
          </p>
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="dialog-actions">
            <button
              className="btn secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Keep project
            </button>
            <button
              className="btn danger"
              onClick={remove}
              disabled={mutation.busy}
            >
              Delete project
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
