import { randomUUID } from "node:crypto";
import type {
  Coaching,
  State,
  PlanContent,
  Evidence,
  Criterion,
  ReportContent,
} from "../domain/types";
import { validate } from "../domain/contracts";
export function criterionFor(phase: string): Criterion {
  return phase === "technical_depth"
    ? "design"
    : phase === "failure_scenario"
      ? "failure"
      : phase === "reflection"
        ? "limits"
        : "implementation";
}
export function guidedCoach(
  state: State,
  plan: PlanContent,
  evidence: Evidence[],
  sample: boolean,
): Coaching {
  const answer =
    state.answers.find((a) => a.id === state.pendingAnswerId) ??
    state.answers.at(-1)!;
  const topic = plan.topics.find((t) => t.id === answer.topicId)!;
  const text = answer.text.toLowerCase();
  const strengths: string[] = [],
    improvements: string[] = [];
  const uncertain =
    /^(?:i (?:do(?:n'?t| not) know|have no idea)|idk|no idea|dunno|whatever|asdf|blah|not sure)[.!\s]*$/i.test(
      text.trim(),
    );
  const priority =
    topic.phase === "reflection" || topic.conceptId === "context-limits"
      ? ["src/booking.ts", "src/ownership.ts", "README.md"]
      : topic.phase === "introduction" || topic.conceptId === "project-purpose"
        ? ["README.md", "src/TicketSelector.tsx", "src/pricing.ts"]
        : ["src/TicketSelector.tsx", "src/pricing.ts", "src/ownership.ts"];
  const relevant = evidence
    .filter((e) =>
      sample ? priority.includes(e.path) : topic.evidenceIds.includes(e.id),
    )
    .sort((a, b) =>
      sample
        ? priority.indexOf(a.path) - priority.indexOf(b.path) ||
          a.startLine - b.startLine
        : 0,
    );
  let nextQuestion = topic.openingQuestion,
    exampleAnswer: string | null = null;
  let summary = "Let’s make that explanation more concrete.";
  let verdict: Coaching["verdict"] = "needs_work";
  if (!sample) {
    const specific =
      /\b(function|component|route|handler|database|query|state|cache|queue|service|module|request|response|input|output)\b/i.test(
        text,
      );
    if (specific)
      strengths.push("You named a concrete part of the implementation.");
    if (
      /\b(because|trade.?off|instead|alternative|cost|constraint)\b/.test(text)
    )
      strengths.push("You started explaining the reasoning behind the choice.");
    improvements.push(
      "Trace one real input through a named file or function, including the resulting output.",
    );
    if (!/\b(test|verify|check|error|fail|edge)\b/.test(text))
      improvements.push(
        "Add one edge case and explain how you would verify it.",
      );
    summary = uncertain
      ? "That’s a useful place to start. Open the relevant source and narrate one step you can verify."
      : "Your explanation gives us a starting point. I can coach its structure here, but cannot verify technical correctness without a connected model.";
    nextQuestion = `Choose one function in ${relevant[0]?.path ?? "the supplied files"}. What input does it receive and what does it return?`;
    verdict = "uncertain";
  } else if (
    topic.phase === "introduction" ||
    topic.conceptId === "project-purpose"
  ) {
    const purpose = /ticket|book|reserv|event/.test(text),
      audience = /student|college|campus|attendee/.test(text),
      ownership =
        /\bi\b.*(?:built|wrote|implemented|worked|made|developed|handled)|my (?:part|role|contribution)/.test(
          text,
        );
    if (purpose)
      strengths.push("You described the problem the ticket app addresses.");
    else
      improvements.push(
        "Start with the user’s problem: students need to reserve seats for college events.",
      );
    if (audience) strengths.push("You identified the audience.");
    else
      improvements.push(
        "Name who uses it and the action they need to complete.",
      );
    if (ownership)
      strengths.push("You separated your own work from the overall project.");
    else
      improvements.push(
        "State your own contribution without claiming parts you did not build.",
      );
    verdict =
      purpose && audience && ownership
        ? "strong"
        : purpose || ownership
          ? "promising"
          : "needs_work";
    summary =
      verdict === "strong"
        ? "That’s a clear introduction: purpose, audience, and your contribution are all there."
        : "The introduction needs a clearer story before we go into code.";
    nextQuestion =
      "Try a 30-second introduction: who is Campus Tickets for, and which part did you personally build?";
    exampleAnswer =
      "“Campus Tickets helps students reserve seats at college events. My contribution was [your actual part]. For example, [one concrete user action] runs through [one part you built].”";
  } else if (
    topic.phase === "walkthrough" ||
    topic.phase === "failure_scenario" ||
    ["data-flow", "failure-recovery"].includes(topic.conceptId)
  ) {
    const stateChange = /quantity|setquantity|ticket count|input/.test(text);
    const initialOnly =
      /initial|mount|stale|out.?of.?date|doesn.t.*(?:update|change|recalcul)|not.*(?:update|recalcul)|only once/.test(
        text,
      );
    const wrongUpdate =
      /(?:automatically|always|every change|each change|on change).{0,45}(?:recalcul|updat)|(?:total|price).{0,30}(?:updates|recalculates).{0,25}(?:change|quantity)/.test(
        text,
      ) && !initialOnly;
    const repair =
      /deriv|recomput|recalcul|calculatetotal\(quantity|remove.*state/.test(
        text,
      ) && initialOnly;
    if (stateChange)
      strengths.push("You referred to the quantity input and its state.");
    else
      improvements.push(
        "Follow the quantity input into setQuantity before discussing the displayed price.",
      );
    if (initialOnly)
      strengths.push(
        "You caught that total is initialized once, so the display can become stale.",
      );
    else
      improvements.push(
        "In TicketSelector.tsx, total has no setter: its useState initializer runs on mount, not whenever quantity changes.",
      );
    if (repair)
      strengths.push(
        "You connected the stale display to recomputing or deriving total from current quantity.",
      );
    else
      improvements.push(
        "Propose deriving total from current quantity and unitPrice, then verify a quantity change in a component test.",
      );
    verdict =
      initialOnly && stateChange && repair
        ? "strong"
        : initialOnly
          ? "promising"
          : "needs_work";
    summary = wrongUpdate
      ? "That claim doesn’t match this sample: changing quantity does not update the stored total."
      : verdict === "strong"
        ? "You connected the input, the stale state, and a plausible fix. That reasoning is defensible."
        : uncertain
          ? "Let’s inspect one concrete change together. You do not need to guess."
          : "You have part of the flow, but the relationship between quantity and total needs another look.";
    nextQuestion =
      "The unit price is 200. Quantity starts at 1, then changes to 2. What does the current code display, and why?";
    exampleAnswer =
      "“setQuantity changes quantity, but total is separate state initialized once to 200. It still displays 200 after quantity becomes 2. I would derive total from quantity and unitPrice, then test that changing the input displays 400.”";
    if (verdict === "strong")
      improvements.push(
        "Tighten the answer by distinguishing the pure pricing function from the component’s state lifecycle. Also test zero tickets and changing unitPrice.",
      );
  } else if (topic.phase === "technical_depth") {
    const reason =
      /because|trade.?off|instead|alternative|avoid|simpl|constraint/.test(
        text,
      );
    const concrete =
      /state|total|pricing|quantity|function|component|ownership|assertowner/.test(
        text,
      );
    if (concrete)
      strengths.push(
        "You anchored the design discussion in an implementation detail.",
      );
    else improvements.push("Name a decision visible in the supplied source.");
    if (reason) strengths.push("You included a reason or alternative.");
    else
      improvements.push(
        "Explain why that choice fits this project and name one alternative.",
      );
    verdict =
      reason && concrete ? "strong" : concrete ? "promising" : "needs_work";
    summary =
      verdict === "strong"
        ? "That is a defensible trade-off explanation. Make its limits explicit to strengthen it."
        : "A design answer needs both a concrete choice and the reason for it.";
    nextQuestion =
      "For the displayed price, what would you gain or lose by deriving total instead of storing it separately?";
    exampleAnswer =
      "“I would derive total from current quantity and unitPrice so the displayed price has one source of truth. Storing it separately is useful only if its lifecycle differs; otherwise it creates synchronization work and a stale-state risk.”";
    if (verdict === "strong")
      improvements.push(
        "Add the constraint under which the alternative would become the better choice.",
      );
  } else {
    const admits =
      /not supplied|missing|middleware|not shown|need.*(?:file|evidence|test)|can.t verify|uncertain|unknown/.test(
        text,
      );
    if (admits)
      strengths.push(
        "You separated a source-backed claim from missing context.",
      );
    else
      improvements.push(
        "Distinguish ownership checks we can see from request authentication middleware that is not supplied.",
      );
    verdict = admits ? "strong" : "needs_work";
    summary = admits
      ? "That is a useful boundary: you are explaining what you know and how you would check the rest."
      : "Missing files do not prove missing security. Name the evidence you would need.";
    nextQuestion =
      "We can see assertOwner, but not the host’s authentication middleware. What can you verify, and what would you ask to inspect?";
    exampleAnswer =
      "“The supplied cancelBooking calls assertOwner. I cannot verify request authentication because the middleware is outside this fixture. I would inspect the parent route and test unauthenticated and wrong-owner requests.”";
    if (admits)
      improvements.push(
        "Be precise about the next verification step: the parent route plus an unauthenticated and wrong-owner request test.",
      );
  }
  if (uncertain && sample) {
    verdict = "needs_work";
    summary =
      "It’s okay not to know yet. Let’s build the answer from one observable step in the source.";
  }
  if (verdict === "strong" && !improvements.length)
    improvements.push(
      "Make the opening even tighter with one concrete user action, while keeping your own contribution precise.",
    );
  const response = {
    verdict,
    summary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    exampleAnswer,
    recommendation:
      verdict === "needs_work" ||
      (!sample &&
        state.answers.filter((a) => a.topicId === topic.id).length < 2)
        ? "retry"
        : "advance",
    nextQuestion,
    evidenceIds: relevant.slice(0, 3).map((e) => e.id),
  };
  return {
    ...validate<import("../domain/types").CoachResponse>(
      "CoachResponse",
      response,
    ),
    id: randomUUID(),
    answerId: answer.id,
    questionId: answer.questionId,
    topicId: topic.id,
    criterionId: criterionFor(topic.phase),
    source: sample ? "guided_sample" : "structure_only",
  };
}
export function coachingReport(state: State, plan: PlanContent): ReportContent {
  const feedback = state.coaching ?? [];
  const criteria = (
    ["implementation", "design", "failure", "limits"] as const
  ).map((criterionId) => {
    const items = feedback.filter((f) => f.criterionId === criterionId),
      last = items.at(-1),
      assessed =
        last &&
        last.source !== "structure_only" &&
        last.verdict !== "uncertain";
    const answer = last && state.answers.find((a) => a.id === last.answerId);
    return {
      criterionId,
      status: !assessed
        ? "not_assessed"
        : last.verdict === "strong"
          ? "demonstrated"
          : last.verdict === "promising"
            ? "partial"
            : "not_demonstrated",
      rationale: !last
        ? "This topic was not reached."
        : !assessed
          ? "Only communication structure was coached. Technical correctness was not assessed."
          : `${last.summary}${answer?.assisted ? " This answer followed coaching; it is not evidence of unaided improvement." : ""}`,
      answerQuotes:
        assessed && answer
          ? [{ answerId: answer.id, quote: answer.text.slice(0, 2000) }]
          : [],
      confidence: "low" as const,
    };
  });
  const latest = Array.from(
    new Map(feedback.map((f) => [f.topicId, f])).values(),
  ).slice(0, 8);
  const findings: ReportContent["findings"] = latest.map((f) => {
    const answer = state.answers.find((a) => a.id === f.answerId)!;
    const first = state.answers.find((a) => a.topicId === answer.topicId)!;
    return {
      id: randomUUID(),
      criterionId: f.criterionId,
      conceptId: plan.topics.find((t) => t.id === f.topicId)!.conceptId,
      outcome:
        f.verdict === "strong" && f.source !== "structure_only"
          ? "supported"
          : f.verdict === "needs_work" && f.source === "guided_sample"
            ? "unresolved"
            : "unresolved",
      title: f.summary.slice(0, 150),
      rationale: [...f.strengths, ...f.improvements].join(" "),
      answerQuotes: [
        ...(first.id !== answer.id
          ? [{ answerId: first.id, quote: first.text.slice(0, 2000) }]
          : []),
        { answerId: answer.id, quote: answer.text.slice(0, 2000) },
      ],
      evidenceIds: f.evidenceIds,
      uncertainty: `${f.source === "guided_sample" ? "Guided sample checklist, not a general AI assessment." : f.source === "structure_only" ? "Only explanation structure was coached. Technical correctness remains unassessed." : "Model feedback can be wrong; verify its source references."}${answer.assisted ? " This answer followed prior coaching." : ""}`,
      practiceTask:
        f.improvements[0] ??
        "Explain this concept again using a different concrete example.",
    };
  });
  const uncoached = state.answers.filter(
    (a) => !feedback.some((f) => f.answerId === a.id),
  );
  for (const answer of uncoached.slice(0, 8 - findings.length)) {
    const topic = plan.topics.find((t) => t.id === answer.topicId)!;
    findings.push({
      id: randomUUID(),
      criterionId: criterionFor(topic.phase),
      conceptId: topic.conceptId,
      outcome: "unresolved",
      title: "Saved answer awaiting coaching",
      rationale:
        "This answer was accepted, but coaching did not finish before you ended the session. No correctness judgment was made.",
      answerQuotes: [
        { answerId: answer.id, quote: answer.text.slice(0, 2000) },
      ],
      evidenceIds: [],
      uncertainty: "No model or guided checklist evaluated this answer.",
      practiceTask: `Return to this objective and trace one concrete example: ${topic.objective}`,
    });
  }
  return validate<ReportContent>("ReportContent", {
    partial: plan.topics.some(
      (t) => !state.answers.some((a) => a.topicId === t.id),
    ),
    summary: `You practised ${latest.length} topics with ${state.answers.length} saved answers. ${uncoached.length ? `${uncoached.length} saved answer(s) did not receive coaching and remain unassessed. ` : ""}${feedback.some((f) => f.source === "guided_sample") ? "This report summarizes a guided checklist for the known Campus Tickets sample." : "Review the specific reasoning and source references below."} Focus on one concrete explanation, then retest it with a new scenario.`,
    criteria,
    findings,
    practiceTasks: [
      ...findings.filter((_, i) => latest[i]?.verdict !== "strong"),
      ...findings.filter((_, i) => latest[i]?.verdict === "strong"),
    ]
      .slice(0, 3)
      .map((f) => f.practiceTask),
    unassessedTopics: plan.topics
      .filter((t) => !state.answers.some((a) => a.topicId === t.id))
      .map((t) => t.id),
  });
}
