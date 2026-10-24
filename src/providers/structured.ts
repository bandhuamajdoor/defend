import type { Job } from "@prisma/client";
import { db } from "../db/client";
import { AppError } from "../domain/errors";
import { validate } from "../domain/contracts";
import schema from "../../docs/contracts/domain.schema.json";
import { backend, validateBackend } from "./runtime";
export class ModelFailure extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public retryAfterMs = 0,
    public code = "DEPENDENCY_UNAVAILABLE",
  ) {
    super(message);
  }
}
export function retryDelay(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header),
    ms = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(header) - Date.now();
  return Number.isFinite(ms) ? Math.min(60000, Math.max(0, ms)) : 0;
}
type JsonSchema = Record<string, unknown>;
export function modelSchema(name: string): JsonSchema {
  const defs = schema.$defs as unknown as Record<string, JsonSchema>;
  function expand(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(expand);
    if (value && typeof value === "object") {
      const item = value as JsonSchema;
      if (typeof item.$ref === "string")
        return expand(defs[item.$ref.split("/").at(-1)!]);
      const out = Object.fromEntries(
        Object.entries(item)
          .filter(
            ([key]) =>
              ![
                "minLength",
                "maxLength",
                "minItems",
                "maxItems",
                "format",
                "description",
                "pattern",
              ].includes(key),
          )
          .map(([key, v]) => [key, expand(v)]),
      );
      if (out.type === "object" && out.properties) {
        const props = out.properties as JsonSchema;
        // Coverage is assigned by the retrieval layer, never invented by a model.
        delete props.coverage;
        out.required = Object.keys(props);
        out.additionalProperties = false;
      }
      return out;
    }
    return value;
  }
  return expand(defs[name]) as JsonSchema;
}
async function reserve(job: Job, provider: string, model: string) {
  const daily = Math.min(
    1000,
    Math.max(1, Number(process.env.MODEL_DAILY_REQUEST_LIMIT ?? 120)),
  );
  const sessionLimit = Math.min(
    50,
    Math.max(1, Number(process.env.MODEL_SESSION_REQUEST_LIMIT ?? 24)),
  );
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('defend-free-model-quota',0))`;
    const keys = [
      {
        key: `model:daily:${new Date().toISOString().slice(0, 10)}`,
        limit: daily,
      },
      { key: `model:entity:${job.entityId}`, limit: sessionLimit },
    ];
    for (const item of keys) {
      const bucket = await tx.rateBucket.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          count: 1,
          expiresAt: new Date(Date.now() + 86400000),
        },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > item.limit)
        throw new ModelFailure(
          "The configured free-model request allowance has been reached. Saved answers are safe.",
          false,
          0,
          "RATE_LIMITED",
        );
    }
    const active = await tx.job.findFirst({
      where: {
        id: job.id,
        leaseToken: job.leaseToken,
        status: "running",
        owner: { deletedAt: null, expiresAt: { gt: new Date() } },
      },
    });
    if (!active) throw new ModelFailure("This job has been cancelled.", false);
    return tx.modelCall.create({ data: { jobId: job.id, provider, model } });
  });
}
export async function structured<T>(
  job: Job,
  name: string,
  instructions: string,
  context: unknown,
): Promise<T> {
  validateBackend();
  const provider = backend();
  if (provider === "mock")
    throw new ModelFailure("Live model is not configured.", false);
  const model = process.env.MODEL_NAME!;
  const format = modelSchema(name);
  const messages = [
    { role: "system", content: instructions },
    { role: "user", content: JSON.stringify(context) },
  ];
  if (Buffer.byteLength(JSON.stringify({ messages, format }), "utf8") > 40000)
    throw new ModelFailure(
      "This request exceeds the bounded context pack. Reduce the scope or answer length.",
      false,
    );
  const call = await reserve(job, provider, model);
  const localUrl = provider==='ollama'?new URL('/api/chat',process.env.MODEL_BASE_URL||'http://127.0.0.1:11434').toString():'';
  const maxTokens = name === "PreparedPlan" ? 2200 : 1600;
  const payload =
    provider === "groq"
      ? {
          model,
          messages,
          max_completion_tokens: maxTokens,
          temperature: 0.2,
          ...(model.startsWith("openai/gpt-oss")
            ? { reasoning_effort: "low" }
            : {}),
          response_format: {
            type: "json_schema",
            json_schema: { name, schema: format, strict: true },
          },
        }
      : {
          model,
          messages,
          stream: false,
          format,
          options: { temperature: 0.2, num_ctx: 8192, num_predict: maxTokens },
        };
  try {
    const response = await fetch(
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : localUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(provider === "groq"
            ? {
                Authorization: `Bearer ${process.env.GROQ_API_KEY || process.env.MODEL_API_KEY}`,
              }
            : {}),
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(
          Math.min(
            90000,
            Math.max(
              5000,
              Number(process.env.PROVIDER_TIMEOUT_SECONDS ?? 45) * 1000,
            ),
          ),
        ),
      },
    );
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ModelFailure(
        response.status === 429
          ? "Free-model rate limit reached. Please wait before retrying."
          : "The configured model could not complete this request.",
        retryable,
        retryDelay(response.headers.get("retry-after")),
        response.status === 429 ? "RATE_LIMITED" : "DEPENDENCY_UNAVAILABLE",
      );
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 256000) {
          await reader.cancel();
          throw new ModelFailure(
            "Model output exceeded its response limit.",
            false,
          );
        }
        chunks.push(next.value);
      }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const raw =
      provider === "groq"
        ? data.choices?.[0]?.message?.content
        : data.message?.content;
    if (typeof raw !== "string")
      throw new ModelFailure(
        "The model did not return a usable structured response.",
        false,
      );
    const result = validate<T>(name, JSON.parse(raw));
    await db.modelCall.update({
      where: { id: call.id },
      data: {
        status: "completed",
        inputTokens: data.usage?.prompt_tokens ?? data.prompt_eval_count ?? 0,
        outputTokens: data.usage?.completion_tokens ?? data.eval_count ?? 0,
      },
    });
    return result;
  } catch (error) {
    await db.modelCall.update({
      where: { id: call.id },
      data: { status: "failed" },
    });
    if (error instanceof ModelFailure) throw error;
    if (error instanceof AppError || error instanceof SyntaxError)
      throw new ModelFailure(
        "The model output failed validation. No fabricated feedback was substituted.",
        false,
      );
    throw new ModelFailure(
      "The model connection failed or timed out. Your answer remains saved.",
      true,
    );
  }
}
