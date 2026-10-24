import { Client } from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Application-specific copy, not a general PostgreSQL backup tool. Fixed table
// names and typed JSON preserve IDs, timestamps, JSON, arrays and foreign keys.
const tables = [
  "Owner",
  "Project",
  "Version",
  "SourceFile",
  "Evidence",
  "Plan",
  "Session",
  "Question",
  "Answer",
  "SessionEvent",
  "Job",
  "Report",
  "ModelCall",
  "Feedback",
  "Idempotency",
  "RateBucket",
  "DeletionReceipt",
  "WorkerHeartbeat",
];
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function fingerprint(rows) {
  return createHash("sha256")
    .update(rows.map(canonical).sort().join("\n"))
    .digest("hex");
}
async function rows(client, table) {
  return (
    await client.query(
      `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS rows FROM ${quote(table)} t`,
    )
  ).rows[0].rows;
}
function migrateSchema(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      {
        env: { ...process.env, DATABASE_URL: url },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Target schema migration failed; the original database is preserved.",
            ),
          ),
    );
  });
}
export async function migrateLocalUtf8(
  connectionString,
  backupDirectory = ".data/backups",
) {
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("This repair is restricted to a local PostgreSQL server.");
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,35}$/.test(name))
    throw new Error(
      "Use a simple local database name of at most 36 characters for this repair.",
    );
  const stamp = Date.now().toString(36);
  const staging = `${name}_utf8_${stamp}`,
    backup = `${name}_legacy_${stamp}`;
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const targetUrl = new URL(url);
  targetUrl.pathname = "/" + staging;
  const admin = new Client({ connectionString: adminUrl.toString() });
  const source = new Client({ connectionString });
  let locked = false,
    renamed = false,
    complete = false,
    sourceOpen = false;
  await admin.connect();
  try {
    await source.connect();
    sourceOpen = true;
    const encoding = (await source.query("SHOW server_encoding")).rows[0]
      .server_encoding;
    if (encoding === "UTF8") return { changed: false, database: name };
    const others = (
      await source.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()",
      )
    ).rows[0].n;
    if (others)
      throw new Error(
        "Stop web, worker and other connections to the app database before running the UTF-8 repair.",
      );
    const schema = (
      await source.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows.map((r) => r.table_name);
    if (
      schema.some((t) => !tables.includes(t) && t !== "_prisma_migrations") ||
      tables.some((t) => !schema.includes(t))
    )
      throw new Error(
        "The database does not match the supported Defend schema. Use native PostgreSQL backup/restore; no changes were made.",
      );
    await admin.query(`ALTER DATABASE ${quote(name)} ALLOW_CONNECTIONS false`);
    locked = true;
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = {};
    for (const table of tables) data[table] = await rows(source, table);
    const migrations = await rows(source, "_prisma_migrations");
    await source.query("COMMIT");
    await source.end();
    sourceOpen = false;
    await mkdir(backupDirectory, { recursive: true });
    const snapshot = path.join(backupDirectory, `${name}-${stamp}.json`);
    await writeFile(
      snapshot,
      JSON.stringify({
        format: "defend-app-db-v1",
        capturedAt: new Date().toISOString(),
        database: name,
        encoding,
        tables: { ...data, _prisma_migrations: migrations },
      }),
      { flag: "wx", mode: 0o600 },
    );
    await admin.query(
      `CREATE DATABASE ${quote(staging)} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    await migrateSchema(targetUrl.toString());
    const target = new Client({ connectionString: targetUrl.toString() });
    await target.connect();
    try {
      await target.query("BEGIN");
      for (const table of tables) {
        if (data[table].length)
          await target.query(
            `INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`,
            [JSON.stringify(data[table])],
          );
      }
      for (const table of tables)
        if (fingerprint(data[table]) !== fingerprint(await rows(target, table)))
          throw new Error(
            `Data verification failed for ${table}; the original database is preserved.`,
          );
      await target.query("COMMIT");
    } catch (error) {
      await target.query("ROLLBACK");
      throw error;
    } finally {
      await target.end();
    }
    // Keep the configured database name, credentials and browser access intact.
    // The old database is retained with connections disabled as a rollback copy.
    await admin.query(
      `ALTER DATABASE ${quote(name)} RENAME TO ${quote(backup)}`,
    );
    renamed = true;
    await admin.query(
      `ALTER DATABASE ${quote(staging)} RENAME TO ${quote(name)}`,
    );
    complete = true;
    const counts = Object.fromEntries(tables.map((t) => [t, data[t].length]));
    await writeFile(
      path.join(backupDirectory, `${name}-${stamp}-receipt.json`),
      JSON.stringify(
        {
          database: name,
          rollbackDatabase: backup,
          snapshot,
          counts,
          verified: true,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    return {
      changed: true,
      database: name,
      rollbackDatabase: backup,
      snapshot,
      counts,
    };
  } finally {
    if (sourceOpen) await source.end();
    if (locked && !complete) {
      if (renamed)
        await admin.query(
          `ALTER DATABASE ${quote(backup)} RENAME TO ${quote(name)}`,
        );
      await admin.query(`ALTER DATABASE ${quote(name)} ALLOW_CONNECTIONS true`);
    }
    await admin.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await migrateLocalUtf8(process.env.DATABASE_URL);
    console.log(
      result.changed
        ? `UTF-8 repair verified. Existing rows and IDs are preserved; original database retained as ${result.rollbackDatabase}. Restart web and worker.`
        : "The configured database already uses UTF-8. No changes made.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "UTF-8 repair failed. The original database is preserved.",
    );
    process.exitCode = 1;
  }
}
