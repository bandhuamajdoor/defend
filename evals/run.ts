import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import cases from "../docs/fixtures/evaluation-cases.json";
import { initialState } from "../src/domain/controller";
import { prepare, evaluate } from "../src/providers/mock";
import { verifyReport } from "../src/services/evidence";
import { validate } from "../src/domain/contracts";
if (process.env.MODEL_PROVIDER !== "mock")
  throw new Error(
    "This harness only runs mechanical mock checks. Live semantic evaluations are not implemented.",
  );
const results = cases.cases.map((c) => {
  const plan = prepare(
    "Synthetic evaluation fixture.",
    "Synthetic contribution.",
    [],
  );
  const state = initialState();
  if (c.answer)
    state.answers.push({
      id: randomUUID(),
      questionId: randomUUID(),
      turnId: randomUUID(),
      text: c.answer,
      topicId: plan.topics[0].id,
      assisted: false,
    });
  const content = evaluate(state, plan);
  validate("ReportContent", content);
  verifyReport(content, state, []);
  return {
    caseId: c.id,
    scenario: c.scenario,
    mechanicalValidation: "passed",
    semanticEvaluation: "not_run",
    reason: "Mock adapter cannot establish the expected semantic properties.",
    expectedProperties: c.expected,
  };
});
await mkdir("output/evals", { recursive: true });
await writeFile(
  "output/evals/mock.json",
  JSON.stringify(
    {
      provider: "deterministic-mock-v1",
      createdAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);
console.log(
  `${results.length} mechanical fixture checks passed. Live semantic quality: NOT EVALUATED.`,
);
