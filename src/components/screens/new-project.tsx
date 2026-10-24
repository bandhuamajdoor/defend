"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  FileCode2,
  FolderOpen,
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
import { useRuntime } from "@/components/runtime";
import { uploadLimits, exclusionReason } from "@/domain/upload-limits";

export function NewProject() {
  const router = useRouter();
  const runtime = useRuntime();
  const [files, setFiles] = useState<SourceInput[]>([]),
    [consent, setConsent] = useState(false),
    [fileError, setFileError] = useState(""),
    [ready, setReady] = useState(false),
    [reading, setReading] = useState(false),
    [dragging, setDragging] = useState(false),
    [excluded, setExcluded] = useState<{ path: string; reason: string }[]>([]);
  useEffect(() => setReady(true), []);
  const mutation = useMutation();
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  async function select(list: FileList | null) {
    if (!list) return;
    setFileError("");
    setReading(true);
    try {
      const candidates = Array.from(list).map((file) => ({
        file,
        path: file.webkitRelativePath
          ? file.webkitRelativePath.split("/").slice(1).join("/")
          : file.name,
      }));
      const skipped = candidates
        .map((c) => ({
          path: c.path,
          reason:
            exclusionReason(c.path) ??
            (c.file.size > uploadLimits.fileBytes ? "Exceeds 256 KiB" : null),
        }))
        .filter((c): c is { path: string; reason: string } => !!c.reason);
      setExcluded(skipped);
      const eligible = candidates.filter(
        (c) => !skipped.some((s) => s.path === c.path),
      );
      if (files.length + eligible.length > uploadLimits.files)
        throw new Error(
          "Choose up to 500 source files. Narrow this folder to the feature you want to practise.",
        );
      if (
        eligible.reduce((n, c) => n + c.file.size, 0) +
          files.reduce(
            (n, f) => n + new TextEncoder().encode(f.text).length,
            0,
          ) >
        uploadLimits.totalBytes
      )
        throw new Error(
          "The source exceeds 8 MiB. Choose the main feature or a smaller folder.",
        );
      if (!eligible.length)
        throw new Error(
          "No supported source files were found. Review the exclusions below.",
        );
      const selected = await Promise.all(
        eligible.map(async ({ file: f, path }) => {
          const buffer = await f.arrayBuffer();
          const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
          return { path, text };
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
        ) > uploadLimits.totalBytes ||
        combined.reduce((n, f) => n + f.text.length, 0) >
          uploadLimits.totalCharacters
      )
        throw new Error(
          "The selected source exceeds 8 MiB or 2,000,000 characters. Choose a smaller scope.",
        );
      setFiles(combined);
    } catch (e) {
      setFileError((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
      if (folder.current) folder.current.value = "";
      setReading(false);
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
        consentVersion: runtime?.consentVersion,
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
            disabled={!ready || reading}
            multiple
            accept=".md,.txt,.js,.jsx,.mjs,.cjs,.ts,.tsx,.json,.py,.sql,.css,.html,.yaml,.yml"
            onChange={(e) => void select(e.target.files)}
            aria-label="Select project files"
          />
          <button
            type="button"
            className={`dropzone ${dragging ? "is-dragging" : ""}`}
            disabled={!ready || reading}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void select(e.dataTransfer.files);
            }}
            onClick={() => input.current?.click()}
          >
            <span className="upload-circle">
              <UploadIcon size={23} />
            </span>
            <strong>
              {reading
                ? "Reading selected source…"
                : "Drop source files, or choose files"}
            </strong>
            <span>Up to 500 source files · 256 KiB each</span>
            <small>
              8 MiB and 2,000,000 characters total · no code execution
            </small>
          </button>
          <input
            ref={(el) => {
              folder.current = el;
              el?.setAttribute("webkitdirectory", "");
            }}
            disabled={!ready || reading}
            className="sr-only"
            type="file"
            multiple
            onChange={(e) => void select(e.target.files)}
            aria-label="Select project folder"
          />
          <div className="upload-actions">
            <button
              className="folder-button"
              type="button"
              disabled={!ready || reading}
              onClick={() => folder.current?.click()}
            >
              <FolderOpen size={17} />
              Choose a folder
            </button>
          </div>
          <p className="upload-status">
            {files.length
              ? `${files.length} source files selected · ${(files.reduce((n, f) => n + new TextEncoder().encode(f.text).length, 0) / 1024).toFixed(1)} KiB. `
              : ""}
            A folder keeps relative paths. Dependencies, generated output and
            secret files are excluded before upload.
          </p>
          {excluded.length > 0 && (
            <details className="upload-exclusions">
              <summary>
                {excluded.length} files excluded — review before continuing
              </summary>
              <ul>
                {excluded.map((f, i) => (
                  <li key={`${f.path}-${i}`}>
                    {f.path} · {f.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
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
              disabled={!consent || !files.length || mutation.busy || reading}
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
            <strong>{runtime?.label ?? "Coach configuration"}</strong>
            <p>
              {runtime?.dataDisclosure ?? "Loading coach configuration…"} A
              large project is indexed first; each answer uses focused source
              excerpts. The app never claims every file was understood.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
