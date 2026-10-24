"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Download, ShieldCheck, Trash2 } from "lucide-react";
import { ErrorNotice, Modal } from "@/components/ui";
import { useMutation } from "@/components/hooks";

export function Privacy() {
  const router = useRouter();
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function remove() {
    const result = await mutation.run("/me", "DELETE", {});
    if (result) {
      sessionStorage.removeItem("defend-current-session");
      setOpen(false);
      router.push("/");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">YOUR WORK STAYS YOURS</div>
        <h1>
          A private space to practise<span className="green-period">.</span>
        </h1>
        <p>Clear boundaries for your source, answers and reports.</p>
      </div>
      <div className="privacy-grid">
        <section className="panel privacy-content">
          <ShieldCheck size={30} />
          <h2>What this preview stores</h2>
          <p>
            Your selected text files, project brief, contribution, accepted
            interview answers, reports, and feedback notes are stored in the
            configured PostgreSQL database.
          </p>
          <h3>Your browser session is your access key.</h3>
          <p>
            An opaque, HttpOnly cookie identifies your private workspace.
            Clearing cookies loses access; there is no cross-device recovery.
            Export reports you want to keep.
          </p>
          <h3>No live AI provider is enabled.</h3>
          <p>
            This build runs a deterministic mock adapter. Project text and
            answers are not sent to an AI provider. The mock does not assess
            correctness or competency.
          </p>
          <h3>Typing and dictation share one input.</h3>
          <p>
            Defend does not collect microphone audio. External dictation tools
            process audio under their own policies. Optional spoken questions
            use your browser’s speech service, which may use online processing.
          </p>
          <h3>Retention and deletion</h3>
          <p>
            Projects expire after seven days; sample projects after 24 hours.
            Browser credentials expire after 30 days. The worker checks expiry
            and purges deleted content every minute while running. Project
            expiry is fixed in this initial implementation.
          </p>
          <p>
            Deletion revokes access immediately and cancels pending work.
            Content-free deletion receipts remain for 30 days. This local
            preview has no managed backups; a production backup policy and
            restore rehearsal remain release requirements.
          </p>
        </section>
        <aside className="panel privacy-actions">
          <span className="step-icon">
            <Download size={22} />
          </span>
          <h2>Take your progress with you.</h2>
          <p>
            Each finished report offers JSON and print-friendly HTML, with the
            original source excerpts embedded.
          </p>
          <Link className="btn secondary" href="/projects">
            Open my projects <ArrowUpRight size={16} />
          </Link>
          <hr />
          <h3>Clear this workspace</h3>
          <p>
            Revoke access to all projects, interview answers and reports in this
            browser session.
          </p>
          <button className="btn danger" onClick={() => setOpen(true)}>
            <Trash2 size={16} />
            Delete all my data
          </button>
        </aside>
      </div>
      {open && (
        <Modal
          title="Delete your entire workspace?"
          onClose={() => setOpen(false)}
        >
          <p>
            This revokes access immediately, cancels pending jobs, and schedules
            all stored content for purge. Export anything you want to keep
            first.
          </p>
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setOpen(false)}>
              Keep my data
            </button>
            <button
              className="btn danger"
              onClick={remove}
              disabled={mutation.busy}
            >
              Delete all my data
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
