import { AppError } from "../domain/errors";
export function checkConfig() {
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
  const url = new URL(origin());
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new AppError(
      "DEPENDENCY_UNAVAILABLE",
      "Production requires a configured HTTPS origin.",
      503,
    );
}
export const origin = () => process.env.APP_ORIGIN ?? "http://localhost:3000";
