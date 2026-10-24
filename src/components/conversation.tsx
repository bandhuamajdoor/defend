"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  ArrowDown,
  CheckCircle2,
  Lightbulb,
  MessageCircle,
  Search,
  Target,
  ChevronDown,
  Code2,
} from "lucide-react";
import type { Coaching, PublicSession } from "@/domain/types";
export const verdictLabels = {
  needs_work: "Let’s strengthen this",
  promising: "Good start",
  strong: "That explanation works",
  uncertain: "Let’s verify the details",
};
export function CoachFeedback({
  feedback: f,
  onSources,
}: {
  feedback: Coaching;
  onSources: (ids: string[]) => void;
}) {
  const Verdict =
    f.verdict === "strong"
      ? CheckCircle2
      : f.verdict === "uncertain"
        ? Search
        : Target;
  return (
    <article
      className={`coach-feedback ${f.verdict}`}
      aria-label="Answer coaching"
    >
      <div className="feedback-heading">
        <span>
          <Verdict size={17} />
          {verdictLabels[f.verdict]}
        </span>
        <small>
          {f.source === "guided_sample"
            ? "Guided sample checklist"
            : f.source === "structure_only"
              ? "Explanation structure"
              : f.source === "groq"
                ? "Groq coach"
                : "Local AI coach"}
        </small>
      </div>
      <p className="feedback-summary">{f.summary}</p>
      {f.strengths.length > 0 && (
        <div className="feedback-block">
          <h4>
            <CheckCircle2 size={14} />
            Keep doing this
          </h4>
          <ul>
            {f.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {f.improvements.length > 0 && (
        <div className="feedback-block improvements">
          <h4>
            <Lightbulb size={14} />
            {f.verdict === "strong"
              ? "One more bit of precision"
              : "Make it stronger"}
          </h4>
          <ul>
            {f.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {f.exampleAnswer && (
        <details className="answer-example">
          <summary>
            <MessageCircle size={14} />
            See one way to structure the answer
            <ChevronDown size={13} />
          </summary>
          <p>{f.exampleAnswer}</p>
          <small>
            Adapt this to your actual work. Your next attempt is recorded as
            coached practice.
          </small>
        </details>
      )}
      {f.evidenceIds.length > 0 && (
        <button
          type="button"
          className="text-button"
          onClick={() => onSources(f.evidenceIds)}
        >
          <Code2 size={14} />
          Inspect the source behind this feedback
        </button>
      )}
    </article>
  );
}
export function Conversation({
  session: s,
  onSources,
}: {
  session: PublicSession;
  onSources: (ids: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    last = useRef(""),
    stayAtEnd = useRef(true);
  const [away, setAway] = useState(false);
  const marker = `${s.turns.at(-1)?.id}:${s.coaching?.length ?? 0}:${s.status}`;
  useEffect(() => {
    if (marker === last.current) return;
    last.current = marker;
    const el = ref.current;
    if (!el) return;
    if (stayAtEnd.current || s.turns.length <= 2) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      setAway(false);
    } else setAway(true);
  }, [marker, s.status, s.turns.length]);
  return (
    <div className="conversation-stage">
      <div
        className="chat-messages"
        ref={ref}
        tabIndex={0}
        aria-label="Practice conversation"
        onScroll={() => {
          const el = ref.current;
          if (el) {
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            stayAtEnd.current = distance < 160;
            setAway(distance > 280);
          }
        }}
      >
        <div className="conversation-welcome">
          <AudioLines size={20} />
          <p>
            This is practice. Think aloud, change your mind, and ask for help.
            <br />
            <strong>We’ll work on the explanation together.</strong>
          </p>
        </div>
        {s.turns.map((t) => (
          <div
            key={t.id}
            className={`chat-entry ${t.role} ${t.id === s.currentQuestion?.id ? "current-question" : ""}`}
          >
            {t.role === "system" ? (
              <p className="chat-event">{t.text}</p>
            ) : (
              <>
                <div className="chat-author">
                  <span className="chat-avatar">
                    {t.role === "student" ? "Y" : <AudioLines size={16} />}
                  </span>
                  <span>{t.role === "student" ? "You" : "Defend"}</span>
                  {t.role === "student" && <small>Saved</small>}
                </div>
                <div className="chat-bubble">
                  {t.id === s.currentQuestion?.id ? (
                    <h2>{t.text}</h2>
                  ) : (
                    <p>{t.text}</p>
                  )}
                </div>
                {t.role === "student" &&
                  (s.coaching ?? [])
                    .filter((f) => f.answerId === t.id)
                    .map((f) => (
                      <CoachFeedback
                        key={f.id}
                        feedback={f}
                        onSources={onSources}
                      />
                    ))}
              </>
            )}
          </div>
        ))}
        {["preparing", "generating", "evaluating"].includes(s.status) && (
          <div className="coach-thinking" role="status">
            <span className="thinking-dots">
              <i />
              <i />
              <i />
            </span>
            <span>
              {s.status === "preparing"
                ? "Finding a starting point…"
                : s.status === "evaluating"
                  ? "Turning your practice into clear next steps…"
                  : "Reading your answer and checking the source…"}
            </span>
          </div>
        )}
      </div>
      {away && (
        <button
          className="jump-latest"
          onClick={() => {
            ref.current?.scrollTo({
              top: ref.current.scrollHeight,
              behavior: "smooth",
            });
            setAway(false);
          }}
        >
          <ArrowDown size={14} />
          Latest response
        </button>
      )}
    </div>
  );
}
