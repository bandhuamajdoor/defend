import { AppError } from "../domain/errors";
export function checkConfig() {
  if (process.env.MODEL_PROVIDER !== "mock")
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Only the explicitly labelled mock adapter is implemented. Live AI is not enabled.",
      503,
    );
  if (
    !process.env.APP_SECRET ||
    process.env.APP_SECRET.length < 32 ||
    process.env.APP_SECRET.includes("replace-with")
  )
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Run npm run setup to configure the local environment.",
      503,
    );
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.APP_ORIGIN?.startsWith("https://") &&
    !process.env.APP_ORIGIN?.startsWith("http://localhost")
  )
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Production requires a configured HTTPS origin.",
      503,
    );
}
export const origin = () => process.env.APP_ORIGIN ?? "http://localhost:3000";
