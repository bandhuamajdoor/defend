import { db } from "./db/client";
import { checkConfig } from "./services/config";
import { runOne, maintain } from "./jobs/runner";
checkConfig();
let stopped = false;
let nextMaintenance = 0;
let nextHeartbeat = 0;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
  });
console.log(
  "Defend worker ready · deterministic mock mode · no provider calls",
);
const concurrency = Math.max(
  1,
  Math.min(4, Number(process.env.WORKER_CONCURRENCY ?? 2)),
);
try {
  while (!stopped) {
    if (Date.now() >= nextHeartbeat) {
      await db.workerHeartbeat.upsert({
        where: { id: "worker" },
        create: { id: "worker", updatedAt: new Date() },
        update: { updatedAt: new Date() },
      });
      nextHeartbeat = Date.now() + 15000;
    }
    if (Date.now() >= nextMaintenance) {
      await maintain();
      nextMaintenance = Date.now() + 60000;
    }
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => runOne()),
    );
    if (!results.some(Boolean))
      await new Promise((resolve) => setTimeout(resolve, 750));
  }
} finally {
  await db.$disconnect();
}
