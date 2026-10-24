import type {
  Evidence as DbEvidence,
  SourceFile,
  Project,
  Version,
  Plan,
  Session,
  Report,
} from "@prisma/client";
import type {
  Evidence,
  State,
  PlanContent,
  ProjectDTO,
  PublicSession,
  Status,
  ReportContent,
  ReportDTO,
} from "../domain/types";
import { budgetReached, elapsed } from "../domain/controller";
export const evidenceDTO = (
  e: DbEvidence & { file: SourceFile },
): Evidence => ({
  id: e.id,
  versionId: e.versionId,
  fileId: e.fileId,
  path: e.file.path,
  startLine: e.startLine,
  endLine: e.endLine,
  excerpt: e.excerpt,
  sha256: e.sha256,
});
export function projectDTO(
  p: Project & {
    versions: (Version & { files: SourceFile[]; plans: Plan[] })[];
  },
): ProjectDTO {
  return {
    id: p.id,
    title: p.title,
    createdAt: p.createdAt.toISOString(),
    expiresAt: p.expiresAt.toISOString(),
    versions: p.versions.map((v) => ({
      id: v.id,
      ordinal: v.ordinal,
      status: v.status,
      files: v.files.map((f) => ({
        id: f.id,
        path: f.path,
        byteSize: f.byteSize,
        lineCount: f.lineCount,
      })),
      plan: v.plans[0]
        ? {
            id: v.plans[0].id,
            revision: v.plans[0].revision,
            confirmed: !!v.plans[0].confirmedAt,
            content: v.plans[0].content as unknown as PlanContent,
          }
        : null,
    })),
  };
}
export function sessionDTO(
  s: Session & { version: Version; plan: Plan },
): PublicSession {
  const state = s.state as unknown as State;
  const plan = s.plan.content as unknown as PlanContent;
  return {
    id: s.id,
    projectId: s.version.projectId,
    versionId: s.versionId,
    mode: s.mode,
    status: s.status as Status,
    phase:
      s.status === "completed"
        ? "complete"
        : (plan.topics[state.topicIndex]?.phase ?? "reflection"),
    revision: s.revision,
    currentQuestion: state.currentQuestion,
    turns: state.turns,
    activeSeconds: Math.floor(elapsed(state, Date.now()) / 1000),
    budgetReached: budgetReached(state, s.mode, Date.now()),
    reportId: state.reportId,
  };
}
export function reportDTO(r: Report, evidence: Evidence[]): ReportDTO {
  return {
    id: r.id,
    sessionId: r.sessionId,
    revision: r.revision,
    rubricVersion: "v1-mock-preview",
    createdAt: r.createdAt.toISOString(),
    content: r.content as unknown as ReportContent,
    evidence,
  };
}
