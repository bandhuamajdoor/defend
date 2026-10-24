"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  Code2,
  FileCode2,
  Leaf,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Play,
  RefreshCw,
  Send,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Evidence, Operation, PublicSession } from "@/domain/types";
import { request } from "@/components/client";
import { useResource, useMutation } from "@/components/hooks";
import {
  Badge,
  Busy,
  ErrorNotice,
  EvidenceCard,
  Modal,
  labels,
} from "@/components/ui";
import { Conversation } from "@/components/conversation";
import { useDictation } from "@/components/use-dictation";
export function Interview({ id }: { id: string }) {
  const router = useRouter(),
    resource = useResource<PublicSession>(
      `/sessions/${id}`,
      (s) => !s || ["preparing", "generating", "evaluating"].includes(s.status),
    ),
    mutation = useMutation();
  const [draft, setDraft] = useState(""),
    [endOpen, setEndOpen] = useState(false),
    [speech, setSpeech] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [audioAvailable, setAudioAvailable] = useState(false),
    [online, setOnline] = useState(true),
    [evidenceOpen, setEvidenceOpen] = useState(false),
    [job, setJob] = useState<string | null>(null),
    [extraSeconds, setExtraSeconds] = useState(0);
  const [sources, setSources] = useState<Evidence[] | null>(null),
    [sourceError, setSourceError] = useState(""),
    [loadingSource, setLoadingSource] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null),
    pendingTurn = useRef(""),
    spokenFeedback = useRef("");
  const s = resource.data,
    q = s?.currentQuestion,
    latest = s?.coaching?.at(-1);
  const dictation = useDictation((text) =>
    setDraft(
      (value) => value + (value && !value.endsWith(" ") ? " " : "") + text,
    ),
  );
  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);
  const play = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);
  useEffect(() => {
    setAudioAvailable("speechSynthesis" in window);
    pendingTurn.current = crypto.randomUUID();
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
  const questionId = q?.id,
    questionText = q?.text,
    feedbackId = latest?.id,
    feedbackText = latest
      ? `${latest.summary} ${latest.improvements[0] ?? ""}`
      : "";
  useEffect(() => {
    if (!speech || s?.status !== "awaiting_answer" || !questionText) {
      stopSpeech();
      return;
    }
    const prefix =
      feedbackId && spokenFeedback.current !== feedbackId
        ? feedbackText + " "
        : "";
    if (feedbackId) spokenFeedback.current = feedbackId;
    play(prefix + questionText);
  }, [
    questionId,
    questionText,
    feedbackId,
    feedbackText,
    speech,
    s?.status,
    play,
    stopSpeech,
  ]);
  useEffect(() => {
    if (!draft) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a");
      if (
        link &&
        link.href !== window.location.href &&
        !window.confirm(
          "Your answer has not been sent. Leave and discard this draft?",
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
    setSources(null);
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!s || !q || !draft.trim() || dictation.listening) return;
    dictation.stop();
    stopSpeech();
    const text = draft,
      question = q.id;
    const op = await mutation.run<Operation>(
      `/sessions/${id}/answers`,
      "POST",
      {
        questionId: question,
        turnId: pendingTurn.current,
        expectedRevision: s.revision,
        text,
      },
    );
    if (op) {
      pendingTurn.current = crypto.randomUUID();
      setDraft("");
      remember(op);
      await resource.refresh();
    } else {
      const canonical = await resource.refresh();
      if (
        canonical?.turns.some(
          (t) =>
            t.role === "student" &&
            t.questionId === question &&
            t.text === text,
        )
      ) {
        pendingTurn.current = crypto.randomUUID();
        setDraft("");
        mutation.setError("");
      }
    }
  }
  async function act(action: string) {
    if (!s) return;
    dictation.stop();
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
      if (action === "skip") setDraft("");
    }
    await resource.refresh();
  }
  async function retry() {
    const current = s?.jobId ?? job;
    if (!current) return;
    const op = await mutation.run<Operation>(
      `/jobs/${current}/retry`,
      "POST",
      {},
    );
    if (op) {
      remember(op);
      await resource.refresh();
    }
  }
  async function inspect(ids: string[]) {
    setEvidenceOpen(true);
    setSourceError("");
    setLoadingSource(true);
    try {
      const result = await request<{ evidence: Evidence[] }>(
        `/sessions/${id}/evidence?ids=${ids.join(",")}`,
      );
      setSources(result.evidence);
    } catch (e) {
      setSourceError((e as Error).message);
    } finally {
      setLoadingSource(false);
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
  const phases =
    s.mode === "retest"
      ? ["technical_depth", "failure_scenario"]
      : [
          "introduction",
          "walkthrough",
          "technical_depth",
          "failure_scenario",
          "reflection",
        ];
  const current =
    s.topicProgress?.current ?? Math.max(1, phases.indexOf(s.phase) + 1);
  return (
    <>
      <div className="interview-heading">
        <div>
          <Link className="back-link" href={`/projects/${s.projectId}`}>
            ← Project workspace
          </Link>
          <div className="room-kicker">
            <span className="live-room-dot" />
            YOUR PROJECT. A REAL CONVERSATION.
          </div>
          <h1>
            {s.mode === "retest" ? "A fresh perspective." : "Talk it through."}
          </h1>
          <p>Explain. Get specific feedback. Try a stronger answer.</p>
        </div>
        <div className="session-status">
          <Badge tone={s.status === "paused" ? "neutral" : "green"}>
            {s.status === "paused"
              ? "Paused"
              : waiting
                ? "Your turn"
                : failed
                  ? "Needs attention"
                  : s.status === "evaluating"
                    ? "Preparing debrief"
                    : "Coach is thinking"}
          </Badge>
          <span className="session-time">
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")} active ·{" "}
            {s.turns.filter((t) => t.role === "student").length} saved answers
          </span>
        </div>
      </div>
      <div
        className="practice-progress"
        aria-label={`Topic ${current} of ${phases.length}`}
      >
        {phases.map((p, i) => (
          <div
            key={p}
            className={`progress-step ${i + 1 === current ? "current" : i + 1 < current ? "done" : ""}`}
          >
            <span>{i + 1 < current ? <Check size={12} /> : i + 1}</span>
            <strong>{labels[p]}</strong>
          </div>
        ))}
      </div>
      {!online && (
        <div className="notice error" role="alert">
          You’re offline. Your unsent answer stays here until you reconnect.
        </div>
      )}
      {resource.error && (
        <ErrorNotice
          message={resource.error}
          onRetry={() => void resource.refresh()}
        />
      )}
      <div
        className={`interview-layout chat-layout ${!evidenceOpen ? "evidence-hidden" : ""}`}
      >
        <section className="conversation panel">
          <div className="conversation-toolbar">
            <span>
              <AudioLines size={15} />
              THE PRACTICE ROOM
            </span>
            <div>
              {audioAvailable && (
                <button
                  className="text-button"
                  aria-pressed={speech}
                  onClick={() => {
                    dictation.stop();
                    if (speech) stopSpeech();
                    setSpeech(!speech);
                  }}
                >
                  {speech ? <Volume2 size={15} /> : <VolumeX size={15} />}Read
                  coach aloud
                </button>
              )}
              <button
                className="source-toggle"
                aria-pressed={evidenceOpen}
                onClick={() => setEvidenceOpen(!evidenceOpen)}
              >
                <Code2 size={16} />
                Source {evidenceOpen ? "open" : "context"}
              </button>
            </div>
          </div>
          {s.engine === "legacy_mock" && (
            <div className="notice">
              This is a saved V1 mock interview. Start a fresh practice from
              your project to get immediate coaching.
            </div>
          )}
          <Conversation session={s} onSources={(ids) => void inspect(ids)} />
          {s.status === "paused" && (
            <div className="pause-message">
              <Pause size={22} />
              <h3>A moment to think.</h3>
              <p>Your timer is paused. Your draft stays right here.</p>
              <button
                className="btn primary"
                disabled={mutation.busy}
                onClick={() => act("resume")}
              >
                <Play size={15} />
                Resume practice
              </button>
            </div>
          )}
          {failed && (
            <ErrorNotice
              message="Your answer is saved. The coach couldn’t finish this response. You can retry without submitting again."
              onRetry={retry}
            />
          )}
          {speaking && (
            <button className="stop-speaking text-button" onClick={stopSpeech}>
              <Square size={12} />
              Stop speaking
            </button>
          )}
          {q && waiting && (
            <div className="question-actions">
              <button
                className="text-button"
                onClick={() =>
                  speech ? play(q.text) : composer.current?.focus()
                }
              >
                <RefreshCw size={13} />
                Repeat question
              </button>
              <button
                className="text-button"
                disabled={mutation.busy}
                onClick={() => act("clarify")}
              >
                <MessageSquare size={13} />
                Break this down
              </button>
            </div>
          )}
          <form className="composer chat-composer" onSubmit={send}>
            <label htmlFor="answer">
              YOUR ANSWER{" "}
              <span>
                {dictation.listening
                  ? "Stop dictation to review, then send."
                  : "Type naturally, or speak your answer."}
              </span>
            </label>
            <textarea
              ref={composer}
              id="answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={stopSpeech}
              disabled={!waiting || mutation.busy}
              maxLength={8000}
              rows={4}
              placeholder={
                s.status === "paused"
                  ? "Your draft will be here when you resume."
                  : "Think it through in your own words. It’s okay to start with “I’m not sure”…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {dictation.interim && (
              <p className="interim-transcript" aria-live="off">
                {dictation.interim}
              </p>
            )}
            <div className="composer-bottom">
              <div className="composer-tools">
                {dictation.available && (
                  <button
                    type="button"
                    className={`dictation-button ${dictation.listening ? "listening" : ""}`}
                    disabled={!waiting || mutation.busy}
                    onClick={() => {
                      stopSpeech();
                      dictation.toggle();
                    }}
                    aria-pressed={dictation.listening}
                  >
                    {dictation.listening ? (
                      <MicOff size={17} />
                    ) : (
                      <Mic size={17} />
                    )}
                    <span>
                      {dictation.listening ? "Stop listening" : "Dictate"}
                    </span>
                  </button>
                )}
                <span className="answer-counter">
                  {draft.length.toLocaleString()} / 8,000
                  <span className="shortcut">Ctrl ↵ to send</span>
                </span>
              </div>
              <button
                className="btn primary"
                type="submit"
                disabled={
                  !waiting ||
                  !draft.trim() ||
                  mutation.busy ||
                  !online ||
                  dictation.listening
                }
              >
                {mutation.busy ? "Saving…" : "Send answer"}
                <Send size={15} />
              </button>
            </div>
          </form>
          {dictation.available && (
            <p className="dictation-privacy">
              Dictation uses your browser’s speech service, which may process
              audio online. Only text is sent to Defend. Nothing is sent
              automatically.
            </p>
          )}
          {dictation.error && <ErrorNotice message={dictation.error} />}{" "}
          {mutation.error && <ErrorNotice message={mutation.error} />}
          {waiting && !draft && (
            <div className="answer-starters">
              <span>Need a starting point?</span>
              <button
                type="button"
                onClick={() => {
                  setDraft("I'm not sure yet.");
                  composer.current?.focus();
                }}
              >
                I’m not sure yet
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(
                    "The input is …\nIt goes through …\nThe output is …\nI would verify this by …",
                  );
                  composer.current?.focus();
                }}
              >
                Use an answer structure
              </button>
            </div>
          )}
          {s.budgetReached && (
            <div className="notice">
              Finish this answer, then we’ll wrap up. Your answer will never be
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
                Skip topic
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
              End practice <ArrowRight size={14} />
            </button>
          </div>
        </section>
        {evidenceOpen && (
          <aside className="evidence-panel source-drawer">
            <div className="section-heading">
              <h3>
                <Code2 size={17} />
                Source context
              </h3>
              <button
                className="icon-button"
                aria-label="Close source context"
                onClick={() => setEvidenceOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <p>
              {sources
                ? "Source excerpts referenced by the selected feedback."
                : "Source excerpts for the current question. Other files remain unverified."}
            </p>
            {loadingSource ? (
              <Busy text="Loading verified source…" />
            ) : (sources ?? q?.evidence ?? []).length ? (
              (sources ?? q?.evidence ?? []).map((e) => (
                <EvidenceCard key={e.id} evidence={e} />
              ))
            ) : (
              <div className="evidence-empty">
                <FileCode2 size={28} />
                <h4>Your explanation comes first.</h4>
                <p>
                  This question doesn’t need a code excerpt. Source references
                  appear when they are relevant.
                </p>
              </div>
            )}
            {sourceError && <ErrorNotice message={sourceError} />}
            <div className="practice-tip">
              <Leaf size={18} />
              <h4>Reason from what’s visible.</h4>
              <p>
                Separate what the code shows from what you believe. Saying how
                you’d verify an uncertain claim is part of a strong interview
                answer.
              </p>
            </div>
            <p className="preview-disclosure">
              {s.engine === "guided_sample"
                ? "This sample uses a source-specific guided checklist. It is not live AI."
                : s.engine === "structure_only"
                  ? "No model is connected. Coaching covers answer structure; technical correctness remains unassessed."
                  : s.engine === "groq"
                    ? "Live coaching uses Groq and a bounded set of source excerpts. Model feedback can be wrong."
                    : "Local model coaching uses retrieved excerpts. Model feedback can be wrong."}
            </p>
          </aside>
        )}
      </div>
      {endOpen && (
        <Modal title="Ready to wrap up?" onClose={() => setEndOpen(false)}>
          <p>
            Your accepted answers and coaching will be saved in the debrief.
            Unvisited topics remain unassessed.
            {draft && " Your unsent draft will be discarded."}
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
