import { randomUUID } from "node:crypto";
import type {
  PlanContent,
  Evidence,
  State,
  ReportContent,
  Criterion,
  Question,
} from "../domain/types";
import { validate } from "../domain/contracts";
export const providerId = "deterministic-mock-v1";
export function prepare(
  brief: string,
  contribution: string,
  evidence: Evidence[],
): PlanContent {
  const code = evidence.filter((e) => /\.[jt]sx?$/.test(e.path));
  const ids = (code.length ? code : evidence).slice(0, 3).map((e) => e.id);
  const path = code[0]?.path ?? evidence[0]?.path ?? "your project";
  return validate("PreparedPlan", {
    summary: brief,
    contribution,
    uncertainties: [
      "Development preview: the brief is copied from your description; no AI analysis has been performed.",
      "Only the supplied files are available. Deployment, middleware and runtime behaviour may be missing.",
    ],
    topics: [
      {
        id: "purpose",
        phase: "introduction",
        conceptId: "project-purpose",
        objective: "Describe the project and your contribution.",
        openingQuestion:
          "What did you build, who is it for, and which part did you work on?",
        evidenceIds: [],
      },
      {
        id: "flow",
        phase: "walkthrough",
        conceptId: "data-flow",
        objective: "Trace a concrete input through the implementation.",
        openingQuestion: `Walk me through what happens to a user input in ${path}.`,
        evidenceIds: ids,
      },
      {
        id: "design",
        phase: "technical_depth",
        conceptId: "design-tradeoffs",
        objective: "Explain an implementation choice and its trade-off.",
        openingQuestion:
          "Choose one implementation decision in the supplied files. What trade-off led you to it?",
        evidenceIds: ids,
      },
      {
        id: "failure",
        phase: "failure_scenario",
        conceptId: "failure-recovery",
        objective: "Reason about a changing input or failed operation.",
        openingQuestion:
          "If an input changes after the initial render, what needs to update to keep the displayed result correct?",
        evidenceIds: ids,
      },
      {
        id: "limits",
        phase: "reflection",
        conceptId: "context-limits",
        objective: "Distinguish verified behaviour from missing context.",
        openingQuestion:
          "Which claim about this project would you need more evidence to verify?",
        evidenceIds: [],
      },
    ],
  });
}
export function nextQuestion(
  s: State,
  plan: PlanContent,
  evidence: Evidence[],
): Question {
  const topic = plan.topics[s.topicIndex];
  let text = topic.openingQuestion;
  if (s.next === "follow_up") {
    const last = s.answers.at(-1)?.text.slice(0, 140) ?? "";
    text = `You said “${last}”. What concrete example or source detail would help you verify that explanation?`;
  }
  if (s.next === "clarification")
    text = `Let’s focus on one step: ${topic.objective} What is one concrete example from your project?`;
  return {
    id: randomUUID(),
    topicId: topic.id,
    text,
    kind:
      s.next === "opening"
        ? "opening"
        : s.next === "follow_up"
          ? "follow_up"
          : "clarification",
    evidence: evidence.filter((e) => topic.evidenceIds.includes(e.id)),
    createdAt: new Date().toISOString(),
  };
}
const criteria: Criterion[] = ["implementation", "design", "failure", "limits"];
export function evaluate(s: State, plan: PlanContent): ReportContent {
  const findings = s.answers
    .filter((a, i, all) => all.findIndex((x) => x.topicId === a.topicId) === i)
    .slice(0, 4)
    .map((a) => {
      const topic = plan.topics.find((t) => t.id === a.topicId)!;
      const criterionId: Criterion =
        topic.phase === "technical_depth"
          ? "design"
          : topic.phase === "failure_scenario"
            ? "failure"
            : topic.phase === "reflection"
              ? "limits"
              : "implementation";
      return {
        id: randomUUID(),
        criterionId,
        conceptId: topic.conceptId,
        outcome: "unresolved" as const,
        title: `Revisit: ${topic.objective}`,
        rationale:
          "This development adapter records an answer for reflection. It cannot judge correctness or whether the source supports your explanation.",
        answerQuotes: [{ answerId: a.id, quote: a.text.slice(0, 2000) }],
        evidenceIds: topic.evidenceIds,
        uncertainty: a.assisted
          ? "A clarification was requested for this topic. No unaided improvement is inferred."
          : "No live model or human has evaluated this answer.",
        practiceTask: `Use a fresh example to ${topic.objective.charAt(0).toLowerCase() + topic.objective.slice(1)}`,
      };
    });
  return validate("ReportContent", {
    partial: plan.topics.some(
      (t) => !s.answers.some((a) => a.topicId === t.id),
    ),
    summary: s.answers.length
      ? `Development report preview · ${s.answers.length} saved answer${s.answers.length === 1 ? "" : "s"}. Review your exact words and the source excerpts, then try a fresh scenario. Correctness has not been assessed.`
      : "No answers were submitted. All criteria remain not assessed; you can begin a new practice when ready.",
    criteria: criteria.map((criterionId) => ({
      criterionId,
      status: "not_assessed",
      rationale:
        "The deterministic development adapter does not assess competency. A validated live provider and human evaluation are required.",
      answerQuotes: [],
      confidence: "low",
    })),
    findings,
    practiceTasks: findings.slice(0, 3).map((f) => f.practiceTask),
    unassessedTopics: plan.topics
      .filter((t) => !s.answers.some((a) => a.topicId === t.id))
      .map((t) => t.id),
  });
}
