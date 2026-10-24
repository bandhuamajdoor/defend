import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  user: "defend",
  password: "local-development-only",
  port: 5432,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(".data/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const { rows } = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'defend'",
);
if (!rows.length) await client.query("CREATE DATABASE defend");
await client.end();
console.log(
  "Local PostgreSQL is ready on port 5432. Keep this process running.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
