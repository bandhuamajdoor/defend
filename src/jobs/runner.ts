import { randomUUID } from "node:crypto";
import type { Job } from "@prisma/client";
import { db, json } from "../db/client";
import { checkConfig } from "../services/config";
import { evidenceDTO } from "../services/views";
import { verifyEvidence, verifyReport } from "../services/evidence";
import { prepare, nextQuestion, evaluate } from "../providers/mock";
import { publish } from "../domain/controller";
import type { State, PlanContent } from "../domain/types";
export async function claim(): Promise<Job | null> {
  const token = randomUUID();
  const rows = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET status='running', "leaseToken"=${token}::uuid,
      "leaseUntil"=NOW()+INTERVAL '120 seconds', attempts=attempts+1
    WHERE id=(SELECT id FROM "Job" WHERE (status='queued' AND "runAfter"<=NOW())
      OR (status='running' AND "leaseUntil"<NOW()) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`;
  return rows[0] ?? null;
}
export async function runJob(
  job: Job,
  options: {
    fail?: boolean;
    delayMs?: number;
    beforeCommit?: Promise<void>;
  } = {},
) {
  const heartbeat = setInterval(() => {
    void db.job
      .updateMany({
        where: { id: job.id, leaseToken: job.leaseToken, status: "running" },
        data: { leaseUntil: new Date(Date.now() + 120000) },
      })
      .catch(() => {});
  }, 20000);
  try {
    checkConfig();
    const owner = await db.owner.findFirst({
      where: {
        id: job.ownerId,
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!owner) {
      await db.job.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken },
        data: { status: "cancelled" },
      });
      return;
    }
    const version =
      job.kind === "prepare_project"
        ? await db.version.findFirst({
            where: {
              id: job.entityId,
              project: {
                ownerId: job.ownerId,
                deletedAt: null,
                expiresAt: { gt: new Date() },
              },
            },
            include: { evidence: { include: { file: true } } },
          })
        : null;
    const session =
      job.kind !== "prepare_project"
        ? await db.session.findFirst({
            where: {
              id: job.entityId,
              ownerId: job.ownerId,
              version: {
                project: { deletedAt: null, expiresAt: { gt: new Date() } },
              },
            },
            include: {
              plan: true,
              version: { include: { evidence: { include: { file: true } } } },
            },
          })
        : null;
    if (!version && !session) {
      await db.job.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken },
        data: { status: "cancelled" },
      });
      return;
    }
    if (session && session.revision !== job.expectedRevision) {
      await db.job.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken },
        data: { status: "cancelled" },
      });
      return;
    }
    const evidence = (version?.evidence ?? session!.version.evidence).map(
      evidenceDTO,
    );
    verifyEvidence(evidence, version?.id ?? session!.versionId);
    await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 250));
    if (options.fail || process.env.MOCK_FAILURE_MODE === "1")
      throw new Error("Injected dependency failure");
    const plan = session?.plan.content as unknown as PlanContent;
    const state = session?.state as unknown as State;
    const result = version
      ? prepare(version.brief, version.contribution, evidence)
      : job.kind === "evaluate_session"
        ? evaluate(state, plan)
        : nextQuestion(state, plan, evidence);
    // A controlled publication barrier lets integration tests exercise actual
    // race orderings without depending on CI machine speed.
    if (options.beforeCommit) await options.beforeCommit;
    await db.$transaction(
      async (tx) => {
        // The same lock order as API mutations fences pause, end, delete and stale workers.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${job.ownerId}, 0))`;
        const lease = await tx.job.findFirst({
          where: {
            id: job.id,
            leaseToken: job.leaseToken,
            status: "running",
            leaseUntil: { gt: new Date() },
          },
        });
        const activeOwner = await tx.owner.findFirst({
          where: {
            id: job.ownerId,
            deletedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!lease || !activeOwner) return;
        const activeVersion = await tx.version.findFirst({
          where: {
            id: version?.id ?? session!.versionId,
            project: { deletedAt: null, expiresAt: { gt: new Date() } },
          },
        });
        if (!activeVersion) {
          await tx.job.update({
            where: { id: job.id },
            data: { status: "cancelled" },
          });
          return;
        }
        let resultId: string;
        if (version) {
          const prepared = await tx.plan.create({
            data: { versionId: version.id, revision: 1, content: json(result) },
          });
          resultId = prepared.id;
          await tx.version.update({
            where: { id: version.id },
            data: { status: "ready" },
          });
        } else {
          const current = await tx.session.findUnique({
            where: { id: session!.id },
          });
          if (
            !current ||
            current.revision !== job.expectedRevision ||
            !["preparing", "generating", "evaluating"].includes(current.status)
          ) {
            await tx.job.update({
              where: { id: job.id },
              data: { status: "cancelled" },
            });
            return;
          }
          resultId = current.id;
          if (job.kind === "evaluate_session") {
            const report = result as ReturnType<typeof evaluate>;
            verifyReport(report, state, evidence);
            const created = await tx.report.create({
              data: { sessionId: current.id, content: json(report) },
            });
            state.reportId = created.id;
            state.currentQuestion = null;
            state.activeSince = null;
            await tx.session.update({
              where: { id: current.id },
              data: {
                status: "completed",
                revision: { increment: 1 },
                state: json(state),
              },
            });
            resultId = created.id;
          } else {
            const question = result as ReturnType<typeof nextQuestion>;
            publish(state, question, Date.now());
            const sequence =
              (await tx.question.count({ where: { sessionId: current.id } })) +
              1;
            await tx.question.create({
              data: {
                id: question.id,
                sessionId: current.id,
                sequence,
                topicId: question.topicId,
                text: question.text,
                kind: question.kind,
                evidenceIds: question.evidence.map((e) => e.id),
              },
            });
            await tx.session.update({
              where: { id: current.id },
              data: {
                status: "awaiting_answer",
                revision: { increment: 1 },
                state: json(state),
              },
            });
          }
        }
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: "succeeded",
            resultId,
            leaseToken: null,
            leaseUntil: null,
            errorCode: null,
          },
        });
      },
      { timeout: 15000 },
    );
  } catch {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${job.ownerId}, 0))`;
      const current = await tx.job.findFirst({
        where: { id: job.id, leaseToken: job.leaseToken, status: "running" },
      });
      if (!current) return;
      const terminal = current.attempts >= 3;
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: terminal ? "failed" : "queued",
          leaseToken: null,
          leaseUntil: null,
          errorCode: "DEPENDENCY_UNAVAILABLE",
          runAfter: new Date(
            Date.now() + Math.min(10000, 500 * 2 ** current.attempts),
          ),
        },
      });
      if (terminal) {
        if (job.kind === "prepare_project")
          await tx.version.updateMany({
            where: { id: job.entityId },
            data: { status: "failed" },
          });
        else
          await tx.session.updateMany({
            where: { id: job.entityId, revision: job.expectedRevision },
            data: {
              status:
                job.kind === "evaluate_session"
                  ? "evaluation_failed"
                  : "generation_failed",
            },
          });
      }
    });
  } finally {
    clearInterval(heartbeat);
  }
}
export async function runOne(options?: { fail?: boolean; delayMs?: number }) {
  const job = await claim();
  if (!job) return false;
  await runJob(job, options);
  return true;
}
export async function maintain() {
  // Deletion receipts survive content purges, so restored backups can reapply them.
  await db.project.deleteMany({
    where: {
      OR: [{ deletedAt: { not: null } }, { expiresAt: { lte: new Date() } }],
    },
  });
  await db.owner.deleteMany({
    where: {
      OR: [{ deletedAt: { not: null } }, { expiresAt: { lte: new Date() } }],
    },
  });
  await db.idempotency.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  await db.rateBucket.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.deletionReceipt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } },
  });
}
