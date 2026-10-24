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
import { uploadLimits, implementationSource } from "@/domain/upload-limits";
import {
  selectUploadCandidates,
  type ExcludedFile,
} from "@/domain/folder-selection";

export function NewProject() {
  const router = useRouter();
  const runtime = useRuntime();
  const [files, setFiles] = useState<SourceInput[]>([]),
    [consent, setConsent] = useState(false),
    [fileError, setFileError] = useState(""),
    [ready, setReady] = useState(false),
    [reading, setReading] = useState(false),
    [dragging, setDragging] = useState(false),
    [excluded, setExcluded] = useState<ExcludedFile[]>([]),
    [ignoreInfo, setIgnoreInfo] = useState(""),
    [documentationAccepted, setDocumentationAccepted] = useState(false);
  useEffect(() => setReady(true), []);
  const mutation = useMutation();
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const documentationOnly =
    files.length > 0 && !files.some((f) => implementationSource.test(f.path));
  async function select(list: FileList | null, isFolder = false) {
    if (!list) return;
    setFileError("");
    setReading(true);
    setDocumentationAccepted(false);
    try {
      const existing = isFolder ? [] : files;
      const candidates = Array.from(list).map((file) => {
        let content: Promise<string> | undefined;
        return {
          path: (file.webkitRelativePath
            ? file.webkitRelativePath.split("/").slice(1).join("/")
            : file.name
          )
            .replaceAll("\\", "/")
            .normalize("NFC"),
          size: file.size,
          readText: () =>
            (content ??= file
              .arrayBuffer()
              .then((buffer) => {
                const text = new TextDecoder("utf-8", { fatal: true }).decode(
                  buffer,
                );
                if (text.includes("\0"))
                  throw new Error(
                    `${file.name} contains binary data. Choose UTF-8 source text.`,
                  );
                return text;
              })
              .catch(() => {
                throw new Error(
                  `${file.name} is not readable UTF-8 text. Remove it or choose a smaller source folder.`,
                );
              })),
        };
      });
      const selection = await selectUploadCandidates(candidates, isFolder);
      const { excluded: skipped, eligible } = selection;
      setExcluded(skipped);
      setIgnoreInfo(
        isFolder
          ? selection.gitignoreFiles
            ? `Applied ${selection.gitignoreFiles} .gitignore file(s), including nested rules and ! exceptions.`
            : "No .gitignore found in the selected folder. Default exclusions still apply."
          : "Select a folder to apply its .gitignore rules. Individual file selection cannot discover nearby ignore files.",
      );
      if (existing.length + eligible.length > uploadLimits.files)
        throw new Error(
          "Choose up to 500 source files. Narrow this folder to the feature you want to practise.",
        );
      if (
        eligible.reduce((n, c) => n + c.size, 0) +
          existing.reduce(
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
        eligible.map(async ({ path, readText }) => {
          const text = await readText();
          return { path, text };
        }),
      );
      const combined = [...existing, ...selected];
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
    if (documentationOnly && !documentationAccepted) return;
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
            onChange={(e) => void select(e.target.files, true)}
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
            A folder keeps relative paths and respects its .gitignore.
            Dependencies, generated output and secret files are excluded before
            upload. Selecting a folder replaces the current selection.
          </p>
          {ignoreInfo && (
            <p className="upload-status" role="status">
              {ignoreInfo}
            </p>
          )}
          {excluded.length > 0 && (
            <details className="upload-exclusions">
              <summary>
                {excluded.length} files excluded — review before continuing
              </summary>
              <p className="small-copy">
                {Array.from(new Set(excluded.map((f) => f.reason)))
                  .map(
                    (reason) =>
                      `${excluded.filter((f) => f.reason === reason).length} · ${reason}`,
                  )
                  .join("; ")}
              </p>
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
                    onClick={() => {
                      setFiles(files.filter((_, j) => i !== j));
                      setDocumentationAccepted(false);
                    }}
                    aria-label={`Remove ${f.path}`}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <ErrorNotice message={fileError} />}
          {documentationOnly && (
            <div className="notice" role="status">
              <strong>No implementation source is selected.</strong>
              <p>
                Only documentation or configuration is ready. Add your source
                files for code-specific interview questions, or explicitly
                continue with this limited context.
              </p>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={documentationAccepted}
                  onChange={(e) => setDocumentationAccepted(e.target.checked)}
                />
                Continue with documentation and configuration only
              </label>
            </div>
          )}
          <Consent checked={consent} onChange={setConsent} />
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="form-footer">
            <span>
              <LockKeyhole size={13} /> Private to your browser session
            </span>
            <button
              className="btn primary"
              type="submit"
              disabled={
                !consent ||
                !files.length ||
                mutation.busy ||
                reading ||
                (documentationOnly && !documentationAccepted)
              }
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
              C/C++, JavaScript, TypeScript & Python source
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
            C/C++ headers, templates, Makefiles and configuration text are
            supported. Only JS/TS has syntax indexing; other source uses text
            retrieval. Bundled Asio/Crow and third_party libraries are skipped
            in folders; choose individual files if you want to discuss a
            dependency.
          </p>
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
