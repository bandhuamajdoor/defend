"use client";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { X, ArrowUpRight, FileCode2, Check, LoaderCircle } from "lucide-react";
import type { Evidence } from "@/domain/types";
export function Icon({
  icon: Component,
  size = 18,
  ...props
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Busy({
  text = "Preparing your workspace…",
}: {
  text?: string;
}) {
  return (
    <div className="busy" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Try again <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const d = ref.current;
    const prior = document.activeElement as HTMLElement | null;
    d?.showModal();
    const handler = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    d?.addEventListener("cancel", handler);
    return () => {
      d?.removeEventListener("cancel", handler);
      d?.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="dialog-title">
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EvidenceCard({ evidence: e }: { evidence: Evidence }) {
  return (
    <details className="evidence-card">
      <summary>
        <FileCode2 size={16} />
        <span>{e.path}</span>
        <small>
          L{e.startLine}–{e.endLine}
        </small>
      </summary>
      <pre>
        <code>
          {e.excerpt.split("\n").map((line, i) => (
            <span className="code-line" key={i}>
              <span className="line-number">{e.startLine + i}</span>
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
      <div className="evidence-footer">
        <Check size={12} /> Immutable source excerpt
      </div>
    </details>
  );
}
export const labels: Record<string, string> = {
  introduction: "The big picture",
  walkthrough: "Implementation",
  technical_depth: "Design decisions",
  failure_scenario: "What could go wrong",
  reflection: "Looking ahead",
  complete: "Complete",
  implementation: "Implementation understanding",
  design: "Design reasoning",
  failure: "Failure reasoning",
  limits: "Awareness of limitations",
  not_assessed: "Not assessed",
  not_demonstrated: "Not demonstrated",
  partial: "Partial",
  demonstrated: "Demonstrated",
};
