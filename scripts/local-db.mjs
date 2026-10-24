import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  user: "defend",
  password: "local-development-only",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(".data/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const database = process.env.DATABASE_URL
  ? decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1))
  : "defend";
if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(database))
  throw new Error("Use a simple local PostgreSQL database name.");
const { rows } = await client.query(
  "SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = $1",
  [database],
);
if (!rows.length)
  await client.query(
    `CREATE DATABASE "${database}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
else if (rows[0].encoding !== "UTF8")
  console.error(
    `Local database ${database} uses ${rows[0].encoding}. Stop web/worker and run npm run db:utf8 to preserve its data in UTF-8. No database has been reset.`,
  );
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
