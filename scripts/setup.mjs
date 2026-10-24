import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    readFileSync(".env.example", "utf8").replace(
      "replace-with-a-random-secret-before-running",
      randomBytes(32).toString("hex"),
    ),
  );
  console.log("Created .env.local with a random app secret.");
} else console.log("Kept existing .env.local.");
