export type Phase =
  | "introduction"
  | "walkthrough"
  | "technical_depth"
  | "failure_scenario"
  | "reflection"
  | "complete";
export type Status =
  | "preparing"
  | "awaiting_answer"
  | "generating"
  | "paused"
  | "generation_failed"
  | "evaluating"
  | "evaluation_failed"
  | "completed";
export type Criterion = "implementation" | "design" | "failure" | "limits";
export interface SourceInput {
  path: string;
  text: string;
}
export interface Upload {
  title: string;
  brief: string;
  contribution: string;
  consent: true;
  files: SourceInput[];
}
export interface Evidence {
  id: string;
  versionId: string;
  fileId: string;
  path: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  sha256: string;
}
export interface Topic {
  id: string;
  phase: Phase;
  conceptId: string;
  objective: string;
  openingQuestion: string;
  evidenceIds: string[];
}
export interface PlanContent {
  summary: string;
  contribution: string;
  uncertainties: string[];
  topics: Topic[];
}
export interface Question {
  id: string;
  topicId: string;
  text: string;
  kind: "opening" | "follow_up" | "clarification";
  evidence: Evidence[];
  createdAt: string;
}
export interface Turn {
  id: string;
  role: "interviewer" | "student" | "system";
  questionId: string | null;
  text: string;
  createdAt: string;
}
export interface AcceptedAnswer {
  id: string;
  questionId: string;
  turnId: string;
  text: string;
  topicId: string;
  assisted: boolean;
}
export interface State {
  topicIndex: number;
  followups: number;
  clarifications: number;
  count: number;
  activeMs: number;
  activeSince: number | null;
  currentQuestion: Question | null;
  turns: Turn[];
  answers: AcceptedAnswer[];
  skipped: string[];
  hinted: string[];
  pausedFrom: Status | null;
  next: "opening" | "follow_up" | "clarification";
  reportId: string | null;
}
export interface PublicSession {
  id: string;
  projectId: string;
  versionId: string;
  mode: string;
  status: Status;
  phase: Phase;
  revision: number;
  currentQuestion: Question | null;
  turns: Turn[];
  activeSeconds: number;
  budgetReached: boolean;
  reportId: string | null;
  jobId?: string | null;
}
export interface Quote {
  answerId: string;
  quote: string;
}
export interface Assessment {
  criterionId: Criterion;
  status: "demonstrated" | "partial" | "not_demonstrated" | "not_assessed";
  rationale: string;
  answerQuotes: Quote[];
  confidence: "low" | "medium" | "high";
}
export interface Finding {
  id: string;
  criterionId: Criterion;
  conceptId: string;
  outcome: "supported" | "contradicted" | "unresolved";
  title: string;
  rationale: string;
  answerQuotes: Quote[];
  evidenceIds: string[];
  uncertainty: string;
  practiceTask: string;
}
export interface ReportContent {
  partial: boolean;
  summary: string;
  criteria: Assessment[];
  findings: Finding[];
  practiceTasks: string[];
  unassessedTopics: string[];
}
export interface ReportDTO {
  id: string;
  sessionId: string;
  revision: number;
  rubricVersion: string;
  createdAt: string;
  content: ReportContent;
  evidence: Evidence[];
}
export interface PlanDTO {
  id: string;
  revision: number;
  confirmed: boolean;
  content: PlanContent;
}
export interface ProjectDTO {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  versions: {
    id: string;
    ordinal: number;
    status: string;
    files: { id: string; path: string; byteSize: number; lineCount: number }[];
    plan: PlanDTO | null;
  }[];
}
export interface Operation {
  resourceId: string;
  revision: number | null;
  jobId: string | null;
  status: "accepted";
}
