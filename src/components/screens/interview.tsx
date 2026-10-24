"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  Code2,
  FileCode2,
  Leaf,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Send,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { PublicSession, Operation } from "@/domain/types";
import {
  Badge,
  Busy,
  ErrorNotice,
  EvidenceCard,
  Modal,
  labels,
} from "@/components/ui";
import { useResource } from "@/components/hooks";
import { useMutation } from "@/components/hooks";

export function Interview({ id }: { id: string }) {
  const router = useRouter();
  const resource = useResource<PublicSession>(
    `/sessions/${id}`,
    (s) => !s || ["preparing", "generating", "evaluating"].includes(s.status),
  );
  const mutation = useMutation();
  const [draft, setDraft] = useState(""),
    [endOpen, setEndOpen] = useState(false),
    [speech, setSpeech] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [audioAvailable, setAudioAvailable] = useState(false),
    [online, setOnline] = useState(true),
    [evidenceOpen, setEvidenceOpen] = useState(true),
    [job, setJob] = useState<string | null>(null),
    [extraSeconds, setExtraSeconds] = useState(0);
  const composer = useRef<HTMLTextAreaElement>(null);
  const s = resource.data;
  const q = s?.currentQuestion;
  function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  const play = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);
  useEffect(() => {
    setAudioAvailable("speechSynthesis" in window);
    setJob(new URLSearchParams(window.location.search).get("job"));
    sessionStorage.setItem("defend-current-session", id);
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [id]);
  useEffect(() => {
    if (s?.status === "completed") router.replace(`/sessions/${id}/report`);
  }, [s?.status, id, router]);
  useEffect(() => {
    setExtraSeconds(0);
    if (s?.status !== "awaiting_answer") return;
    const timer = setInterval(() => setExtraSeconds((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [s?.activeSeconds, s?.status]);
  const questionText = q?.text;
  const questionId = q?.id;
  useEffect(() => {
    if (questionText && speech && s?.status === "awaiting_answer") play(questionText);
    else if (s?.status === "paused" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
  }, [questionId, questionText, speech, s?.status, play]);
  useEffect(() => {
    if (!draft) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a");
      if (
        link &&
        link.href !== window.location.href &&
        !window.confirm(
          "You have an unsent answer. Leave this page and discard the draft?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [draft]);
  function remember(op: Operation) {
    setJob(op.jobId);
    const url = new URL(window.location.href);
    if (op.jobId) url.searchParams.set("job", op.jobId);
    else url.searchParams.delete("job");
    window.history.replaceState(null, "", url);
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!s || !q || !draft.trim()) return;
    stopSpeech();
    const op = await mutation.run<Operation>(
      `/sessions/${id}/answers`,
      "POST",
      {
        questionId: q.id,
        turnId: pendingTurn.current,
        expectedRevision: s.revision,
        text: draft,
      },
    );
    if (op) {
      pendingTurn.current = crypto.randomUUID();
      setDraft("");
      remember(op);
      await resource.refresh();
    } else await resource.refresh();
  }
  const pendingTurn = useRef("");
  useEffect(() => {
    pendingTurn.current = crypto.randomUUID();
  }, []);
  async function act(action: string) {
    if (!s) return;
    stopSpeech();
    const op = await mutation.run<Operation>(
      `/sessions/${id}/controls`,
      "POST",
      { action, expectedRevision: s.revision },
    );
    if (op) {
      remember(op);
      if (action === "end") {
        setDraft("");
        setEndOpen(false);
      }
      await resource.refresh();
    } else await resource.refresh();
  }
  async function retry() {
    if (!job) return;
    const op = await mutation.run<Operation>(`/jobs/${job}/retry`, "POST", {});
    if (op) {
      remember(op);
      await resource.refresh();
    }
  }
  if (!s)
    return resource.error ? (
      <ErrorNotice
        message={resource.error}
        onRetry={() => void resource.refresh()}
      />
    ) : (
      <Busy />
    );
  const waiting = s.status === "awaiting_answer",
    failed = ["generation_failed", "evaluation_failed"].includes(s.status),
    seconds = s.activeSeconds + extraSeconds;
  const prior = s.turns.filter((t) => t.id !== q?.id);
  const phaseIndex = [
    "introduction",
    "walkthrough",
    "technical_depth",
    "failure_scenario",
    "reflection",
  ].indexOf(s.phase);
  return (
    <>
      <div className="interview-heading">
        <div>
          <Link className="back-link" href={`/projects/${s.projectId}`}>
            ← Project workspace
          </Link>
          <h1>
            {s.mode === "retest"
              ? "A fresh perspective."
              : "Let’s talk about your work."}
          </h1>
          <p>Take your time. Send when your answer is complete.</p>
        </div>
        <div className="session-status">
          <Badge tone={s.status === "paused" ? "neutral" : "green"}>
            {s.status === "paused"
              ? "Paused"
              : waiting
                ? "Ready when you are"
                : s.status === "evaluating"
                  ? "Preparing report"
                  : failed
                    ? "Needs attention"
                    : "Preparing a question"}
          </Badge>
          <span className="session-time">
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")} active
          </span>
        </div>
      </div>
      <div
        className="practice-progress"
        aria-label={`Current phase: ${labels[s.phase]}`}
      >
        {(s.mode === "retest"
          ? ["technical_depth", "failure_scenario"]
          : [
              "introduction",
              "walkthrough",
              "technical_depth",
              "failure_scenario",
              "reflection",
            ]
        ).map((p, i) => (
          <div
            key={p}
            className={`progress-step ${s.phase === p ? "current" : i < phaseIndex ? "done" : ""}`}
          >
            <span>{i < phaseIndex ? <Check size={12} /> : i + 1}</span>
            <strong>{labels[p]}</strong>
          </div>
        ))}
      </div>
      {!online && (
        <div className="notice error" role="alert">
          You’re offline. Your draft stays here. Reconnect before sending.
        </div>
      )}
      {resource.error && (
        <ErrorNotice
          message={resource.error}
          onRetry={() => void resource.refresh()}
        />
      )}
      <div
        className={`interview-layout ${!evidenceOpen ? "evidence-hidden" : ""}`}
      >
        <section className="conversation panel">
          <div className="conversation-toolbar">
            <span>
              <span className="status-dot" />
              THE PRACTICE ROOM
            </span>
            <div>
              {audioAvailable && (
                <button
                  className="text-button"
                  aria-pressed={speech}
                  onClick={() => {
                    if (speech) stopSpeech();
                    setSpeech(!speech);
                  }}
                >
                  {speech ? <Volume2 size={15} /> : <VolumeX size={15} />}Speech{" "}
                  {speech ? "on" : "off"}
                </button>
              )}
              <button
                className="icon-button"
                aria-label={
                  evidenceOpen ? "Hide source evidence" : "Show source evidence"
                }
                aria-pressed={evidenceOpen}
                onClick={() => setEvidenceOpen(!evidenceOpen)}
              >
                <Code2 size={18} />
              </button>
            </div>
          </div>
          {prior.length > 0 && (
            <details className="transcript">
              <summary>
                <MessageSquare size={14} /> Conversation so far{" "}
                <span>
                  {s.turns.filter((t) => t.role === "student").length} saved
                  answers
                </span>
              </summary>
              <div className="transcript-items">
                {prior.map((t) => (
                  <div className={`turn ${t.role}`} key={t.id}>
                    <span>
                      {t.role === "student"
                        ? "YOU"
                        : t.role === "interviewer"
                          ? "DEFEND"
                          : "SESSION"}
                    </span>
                    <p>{t.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="question-area">
            {q && (
              <>
                <div className="question-eyebrow">
                  <span
                    className={`question-symbol ${speaking ? "is-speaking" : ""}`}
                  >
                    <AudioLines size={23} />
                  </span>
                  <span>
                    {labels[s.phase]}
                    <small>
                      Question{" "}
                      {s.turns.filter((t) => t.role === "interviewer").length} ·{" "}
                      {q.kind === "clarification"
                        ? "Clarification · assistance recorded"
                        : q.kind === "follow_up"
                          ? "A closer look"
                          : "Your perspective"}
                    </small>
                  </span>
                </div>
                <h2>{q.text}</h2>
                <div className="question-tools">
                  <button
                    className="text-button"
                    onClick={() => {
                      if (speech) play(q.text);
                      else composer.current?.focus();
                    }}
                  >
                    <RefreshCw size={14} />
                    Repeat question
                  </button>
                  {speaking && (
                    <button className="text-button" onClick={stopSpeech}>
                      <Square size={12} />
                      Stop speaking
                    </button>
                  )}
                  <span>
                    <Check size={12} />
                    Question saved
                  </span>
                </div>
              </>
            )}
            {["preparing", "generating"].includes(s.status) && (
              <Busy
                text={
                  s.status === "preparing"
                    ? "Preparing your first question…"
                    : "Your answer is saved. Preparing the next question…"
                }
              />
            )}
            {s.status === "evaluating" && (
              <Busy text="Your answers are saved. Building your report preview…" />
            )}
            {s.status === "paused" && (
              <div className="pause-message">
                <Pause size={22} />
                <h3>A moment to think.</h3>
                <p>Your answers are saved and the active timer is paused.</p>
                <button
                  className="btn primary"
                  onClick={() => act("resume")}
                  disabled={mutation.busy}
                >
                  <Play size={15} />
                  Resume practice
                </button>
              </div>
            )}
            {failed && (
              <ErrorNotice
                message={
                  s.status === "generation_failed"
                    ? "Your answer was saved. The next question couldn’t load."
                    : "Your answers are safe. The report couldn’t be prepared."
                }
                onRetry={job ? retry : undefined}
              />
            )}
          </div>
          <form className="composer" onSubmit={send}>
            <label htmlFor="answer">
              YOUR ANSWER{" "}
              <span>Type, or dictate with Wispr or your preferred tool.</span>
            </label>
            <textarea
              ref={composer}
              id="answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={stopSpeech}
              disabled={!waiting || mutation.busy}
              maxLength={8000}
              placeholder={
                s.status === "paused"
                  ? "Your draft will be here when you resume."
                  : "Start with what you know. Think it through in your own words…"
              }
              rows={5}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                {draft.length.toLocaleString()} / 8,000{" "}
                <span className="shortcut">Ctrl ↵ to send</span>
              </span>
              <button
                className="btn primary"
                disabled={!waiting || !draft.trim() || mutation.busy || !online}
                type="submit"
              >
                {mutation.busy ? "Saving…" : "Send answer"}
                <Send size={15} />
              </button>
            </div>
          </form>
          {mutation.error && <ErrorNotice message={mutation.error} />}
          {s.budgetReached && (
            <div className="notice">
              Finish this answer, then we’ll wrap up. Your draft will never be
              submitted automatically.
            </div>
          )}
          <div className="session-controls">
            <div>
              <button
                className="text-button"
                disabled={
                  mutation.busy ||
                  ![
                    "preparing",
                    "generating",
                    "awaiting_answer",
                    "generation_failed",
                    "paused",
                  ].includes(s.status)
                }
                onClick={() => act(s.status === "paused" ? "resume" : "pause")}
              >
                {s.status === "paused" ? (
                  <Play size={14} />
                ) : (
                  <Pause size={14} />
                )}{" "}
                {s.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                className="text-button"
                disabled={!waiting || mutation.busy}
                onClick={() => act("clarify")}
              >
                <MessageSquare size={14} />
                Clarify
              </button>
              <button
                className="text-button"
                disabled={!waiting || mutation.busy}
                onClick={() => act("skip")}
              >
                <SkipForward size={14} />
                Skip
              </button>
            </div>
            <button
              className="text-button end-button"
              disabled={
                mutation.busy ||
                ["evaluating", "evaluation_failed", "completed"].includes(
                  s.status,
                )
              }
              onClick={() => setEndOpen(true)}
            >
              End practice <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        {evidenceOpen && (
          <aside className="evidence-panel">
            <div className="section-heading">
              <h3>
                <Code2 size={17} /> Source context
              </h3>
              <Badge>Read only</Badge>
            </div>
            <p>
              The same source you uploaded. Use it to ground your explanation.
            </p>
            {q?.evidence.length ? (
              q.evidence.map((e) => <EvidenceCard key={e.id} evidence={e} />)
            ) : (
              <div className="evidence-empty">
                <FileCode2 size={28} />
                <h4>Your perspective comes first.</h4>
                <p>
                  This question doesn’t need a source excerpt. Evidence appears
                  here when a question refers to your files.
                </p>
              </div>
            )}
            <div className="practice-tip">
              <Leaf size={18} />
              <h4>A little room to reason.</h4>
              <p>
                It’s okay to say “I’m not sure.” Explain what you know and how
                you would check the rest.
              </p>
            </div>
            <p className="preview-disclosure">
              Deterministic mock interview. Follow-ups reference your words, but
              no live AI reasoning or assessment is enabled.
            </p>
          </aside>
        )}
      </div>
      {endOpen && (
        <Modal title="Ready to wrap up?" onClose={() => setEndOpen(false)}>
          <p>
            Your {s.turns.filter((t) => t.role === "student").length} accepted
            answers will be included in a partial report. Unvisited topics are
            not assessed.{draft && " Your unsent draft will be discarded."}
          </p>
          {mutation.error && <ErrorNotice message={mutation.error} />}
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setEndOpen(false)}>
              Keep practising
            </button>
            <button
              className="btn primary"
              onClick={() => act("end")}
              disabled={mutation.busy}
            >
              End & view report <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
