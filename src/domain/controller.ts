import type {
  State,
  Status,
  PlanContent,
  AcceptedAnswer,
  Question,
} from "./types";
import { AppError, requireThat } from "./errors";
export function initialState(): State {
  return {
    topicIndex: 0,
    followups: 0,
    clarifications: 0,
    count: 0,
    activeMs: 0,
    activeSince: null,
    currentQuestion: null,
    turns: [],
    answers: [],
    skipped: [],
    hinted: [],
    pausedFrom: null,
    next: "opening",
    reportId: null,
  };
}
export function elapsed(s: State, now: number): number {
  return (
    s.activeMs + (s.activeSince === null ? 0 : Math.max(0, now - s.activeSince))
  );
}
export function budgetReached(s: State, mode: string, now: number): boolean {
  return (
    s.count >= (mode === "retest" ? 6 : 12) ||
    elapsed(s, now) >= (mode === "retest" ? 6 : 12) * 60000
  );
}
function freeze(s: State, now: number) {
  s.activeMs = elapsed(s, now);
  s.activeSince = null;
}
export function checkRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new AppError(
      "STALE_REVISION",
      "This interview changed in another tab. Reload the saved state.",
      409,
      actual,
    );
}
export function afterEvent(
  s: State,
  plan: PlanContent,
  mode: string,
  now: number,
  skip = false,
): Status {
  freeze(s, now);
  s.count++;
  if (skip && s.currentQuestion) s.skipped.push(s.currentQuestion.id);
  s.currentQuestion = null;
  if (budgetReached(s, mode, now)) return "evaluating";
  // One answer-dependent follow-up per topic in the development adapter.
  if (
    !skip &&
    s.followups < 1 &&
    plan.topics[s.topicIndex].phase !== "introduction"
  ) {
    s.followups++;
    s.next = "follow_up";
    return "generating";
  }
  s.topicIndex++;
  s.followups = 0;
  s.clarifications = 0;
  s.next = "opening";
  return s.topicIndex >= plan.topics.length ? "evaluating" : "generating";
}
export function accept(
  s: State,
  status: Status,
  plan: PlanContent,
  mode: string,
  answer: AcceptedAnswer,
  now: number,
): Status {
  requireThat(
    status === "awaiting_answer" && s.currentQuestion?.id === answer.questionId,
    "INVALID_STATE",
    "This question is no longer accepting answers.",
    409,
  );
  requireThat(
    answer.text.trim(),
    "INVALID_INPUT",
    "Write an answer before sending.",
  );
  s.answers.push(answer);
  s.turns.push({
    id: answer.id,
    role: "student",
    questionId: answer.questionId,
    text: answer.text,
    createdAt: new Date(now).toISOString(),
  });
  if (s.coachMode) {
    freeze(s, now);
    s.count++;
    s.currentQuestion = null;
    s.pendingAnswerId = answer.id;
    return budgetReached(s, mode, now) ? "evaluating" : "generating";
  }
  return afterEvent(s, plan, mode, now);
}
export function applyCoaching(
  s: State,
  plan: PlanContent,
  feedback: import("./types").Coaching,
): boolean {
  s.coaching ??= [];
  if (!s.coaching.some((c) => c.answerId === feedback.answerId))
    s.coaching.push(feedback);
  s.pendingAnswerId = null;
  const attempts = s.answers.filter(
    (a) => a.topicId === feedback.topicId,
  ).length;
  if (feedback.recommendation === "retry" && attempts < 3 && s.followups < 2) {
    s.followups++;
    s.next = "follow_up";
    return true;
  }
  s.topicIndex++;
  s.followups = 0;
  s.clarifications = 0;
  s.next = "opening";
  return s.topicIndex < plan.topics.length;
}
export function control(
  s: State,
  status: Status,
  action: string,
  plan: PlanContent,
  mode: string,
  now: number,
): Status {
  if (action === "end") {
    requireThat(
      !["completed", "evaluating", "evaluation_failed"].includes(status),
      "INVALID_STATE",
      "This interview has already ended.",
      409,
    );
    freeze(s, now);
    s.skipPendingCoaching = true;
    return "evaluating";
  }
  if (action === "pause") {
    requireThat(
      [
        "preparing",
        "awaiting_answer",
        "generating",
        "generation_failed",
      ].includes(status),
      "INVALID_STATE",
      "Cannot pause in this state.",
      409,
    );
    freeze(s, now);
    s.pausedFrom = status;
    return "paused";
  }
  if (action === "resume") {
    requireThat(
      status === "paused",
      "INVALID_STATE",
      "The interview is not paused.",
      409,
    );
    s.pausedFrom = null;
    if (s.currentQuestion) {
      s.activeSince = now;
      return "awaiting_answer";
    }
    return "generating";
  }
  requireThat(
    status === "awaiting_answer",
    "INVALID_STATE",
    "Wait for the current question.",
    409,
  );
  if (action === "skip") return afterEvent(s, plan, mode, now, true);
  requireThat(
    action === "clarify" && s.clarifications < 2 && s.followups < 2,
    "INVALID_STATE",
    "Clarification limit reached. Answer or skip this question.",
    409,
  );
  freeze(s, now);
  s.clarifications++;
  s.followups++;
  s.next = "clarification";
  if (s.currentQuestion) s.hinted.push(s.currentQuestion.id);
  s.currentQuestion = null;
  return "generating";
}
export function publish(s: State, q: Question, now: number) {
  s.currentQuestion = q;
  s.activeSince = now;
  s.turns.push({
    id: q.id,
    role: "interviewer",
    questionId: q.id,
    text: q.text,
    createdAt: q.createdAt,
  });
}
