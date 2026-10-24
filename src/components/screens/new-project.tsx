"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  FileCode2,
  LockKeyhole,
  Sparkles,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import type { Operation, SourceInput } from "@/domain/types";
import { ensureGuest } from "@/components/client";
import { ErrorNotice } from "@/components/ui";
import { useMutation } from "@/components/hooks";
import { Consent } from "@/components/consent";

export function NewProject() {
  const router = useRouter();
  const [files, setFiles] = useState<SourceInput[]>([]),
    [consent, setConsent] = useState(false),
    [fileError, setFileError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const mutation = useMutation();
  const input = useRef<HTMLInputElement>(null);
  async function select(list: FileList | null) {
    if (!list) return;
    setFileError("");
    try {
      if (files.length + list.length > 20)
        throw new Error("Choose at most 20 files.");
      const selected = await Promise.all(
        Array.from(list).map(async (f) => {
          if (f.size > 65536) throw new Error(`${f.name} exceeds 64 KiB.`);
          const buffer = await f.arrayBuffer();
          const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
          return { path: f.webkitRelativePath || f.name, text };
        }),
      );
      const combined = [...files, ...selected];
      if (
        new Set(combined.map((f) => f.path.toLowerCase())).size !==
        combined.length
      )
        throw new Error("A file with the same path is already selected.");
      if (
        combined.reduce(
          (n, f) => n + new TextEncoder().encode(f.text).length,
          0,
        ) > 524288
      )
        throw new Error("The selected files exceed 512 KiB.");
      setFiles(combined);
    } catch (e) {
      setFileError((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await ensureGuest();
      const op = await mutation.run<Operation>("/projects", "POST", {
        title: data.get("title"),
        brief: data.get("brief"),
        contribution: data.get("contribution"),
        files,
        consent,
      });
      if (op) router.push(`/projects/${op.resourceId}?job=${op.jobId}`);
    } catch (e) {
      mutation.setError((e as Error).message);
    }
  }
  return (
    <>
      <Link href="/projects" className="back-link">
        ← My projects
      </Link>
      <div className="page-heading">
        <div className="eyebrow">LET’S GET TO KNOW YOUR WORK</div>
        <h1>
          Bring your project<span className="green-period">.</span>
        </h1>
        <p>A little context makes for a much better conversation.</p>
      </div>
      <div className="form-layout">
        <form className="panel project-form" onSubmit={submit}>
          <div className="form-section-title">
            <span>01</span>
            <h2>The big picture</h2>
          </div>
          <label>
            Project name
            <input
              name="title"
              required
              maxLength={100}
              placeholder="e.g. Campus Tickets"
            />
          </label>
          <label>
            What does it do?
            <textarea
              name="brief"
              required
              maxLength={4000}
              rows={3}
              placeholder="Who is it for, and what problem does it solve?"
            />
          </label>
          <label>
            What did you work on?
            <textarea
              name="contribution"
              required
              maxLength={2000}
              rows={3}
              placeholder="Describe your own contribution, including any parts you’re still learning."
            />
          </label>
          <div className="form-section-title">
            <span>02</span>
            <h2>The source of the conversation</h2>
          </div>
          <input
            className="sr-only"
            ref={input}
            type="file"
            disabled={!ready}
            multiple
            accept=".md,.txt,.js,.jsx,.ts,.tsx,.json,.py,.sql,.css,.html,.yaml,.yml"
            onChange={(e) => void select(e.target.files)}
            aria-label="Select project files"
          />
          <button
            type="button"
            className="dropzone"
            disabled={!ready}
            onClick={() => input.current?.click()}
          >
            <span className="upload-circle">
              <UploadIcon size={23} />
            </span>
            <strong>Choose your project files</strong>
            <span>Selected text files · up to 20 files, 64 KiB each</span>
            <small>512 KiB and 120,000 characters total</small>
          </button>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={f.path}>
                  <FileCode2 size={16} />
                  <span>{f.path}</span>
                  <small>
                    {new TextEncoder().encode(f.text).length.toLocaleString()} B
                  </small>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setFiles(files.filter((_, j) => i !== j))}
                    aria-label={`Remove ${f.path}`}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <ErrorNotice message={fileError} />}
          <Consent checked={consent} onChange={setConsent} />
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="form-footer">
            <span>
              <LockKeyhole size={13} /> Private to your browser session
            </span>
            <button
              className="btn primary"
              type="submit"
              disabled={!consent || !files.length || mutation.busy}
            >
              {mutation.busy ? "Saving project…" : "Prepare my project"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
        <aside className="form-aside">
          <span className="step-icon">
            <Sparkles size={22} />
          </span>
          <h3>
            Give the conversation
            <br />
            something real.
          </h3>
          <p>
            Start with a README and the files behind your main feature. You’ll
            review the brief before your interview begins.
          </p>
          <hr />
          <h4>A few thoughtful boundaries</h4>
          <ul className="check-list">
            <li>
              <Check size={15} />
              JavaScript & TypeScript focus
            </li>
            <li>
              <Check size={15} />
              Text files, never executed
            </li>
            <li>
              <Check size={15} />
              No .env files or credentials
            </li>
            <li>
              <Check size={15} />
              No archives, PDFs or binaries
            </li>
          </ul>
          <p className="small-copy">
            Only upload files you’re allowed to share. Secret detection is
            best-effort; review your files first.
          </p>
          <div className="notice">
            <strong>About this preview</strong>
            <p>
              The mock adapter uses your description to make a practice plan.
              Live AI analysis is not enabled.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
