import { AppError } from "../domain/errors";
export type Backend = "mock" | "groq" | "ollama";
export function backend(): Backend {
  const value = process.env.MODEL_PROVIDER ?? "mock";
  if (!["mock", "groq", "ollama"].includes(value))
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Choose guided practice, Groq Free or local Ollama. Paid providers are disabled in this build.",
      503,
    );
  return value as Backend;
}
export function runtimeInfo() {
  const provider = backend();
  return {
    provider,
    mode: provider === "mock" ? "guided" : "live",
    label:
      provider === "mock"
        ? "Guided practice"
        : provider === "groq"
          ? "Groq Free"
          : "Local Ollama",
    model: provider === "mock" ? null : (process.env.MODEL_NAME ?? null),
    consentVersion:
      provider === "mock" ? "local-coach-v2" : `${provider}-coach-v2`,
    dataDisclosure:
      provider === "groq"
        ? "Your selected source excerpts and answers are sent to Groq for coaching. Keep your account on its Free plan."
        : provider === "ollama"
          ? "Your source excerpts and answers are sent to the locally configured Ollama server. Cloud models are disabled."
          : "No model calls are made. The known sample uses a guided checklist; own projects receive communication-structure coaching.",
  };
}
export function validateBackend() {
  const provider = backend();
  if (provider === "mock") return;
  for (const [key, fallback, max] of [
    ["MODEL_DAILY_REQUEST_LIMIT", 120, 1000],
    ["MODEL_SESSION_REQUEST_LIMIT", 24, 50],
    ["PROVIDER_TIMEOUT_SECONDS", 45, 90],
  ] as const) {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new AppError(
        "DEPENDENCY_UNAVAILABLE",
        `${key} must be a positive integer up to ${max}.`,
        503,
      );
  }
  if (!process.env.MODEL_NAME)
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Set MODEL_NAME for your free or local model.",
      503,
    );
  if (
    provider === "groq" &&
    (!(process.env.GROQ_API_KEY || process.env.MODEL_API_KEY) ||
      process.env.MODEL_FREE_TIER_ONLY !== "true")
  )
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Configure a Groq Free key and MODEL_FREE_TIER_ONLY=true. No paid fallback is available.",
      503,
    );
  if (provider === "ollama") {
    const url = new URL(process.env.MODEL_BASE_URL || "http://127.0.0.1:11434");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.protocol !== "http:" ||
      url.username ||
      url.password ||
      /cloud/i.test(process.env.MODEL_NAME!)
    )
      throw new AppError(
        "DEPENDENCY_UNAVAILABLE",
        "Ollama must use a loopback HTTP server and a local model.",
        503,
      );
  }
}
