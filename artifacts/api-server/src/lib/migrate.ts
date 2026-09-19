import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { repoRoot } from "../config";
import { logger } from "./logger";

/**
 * Minimal structural view of the pg Pool query API (plain text + params only;
 * pg@8.22's Query constructor rejects tagged-template arguments).
 */
type PgQueryClient = {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T }>;
};

/**
 * Runs every SQL migration in lib/db/drizzle in filename order, tracking
 * applied files in schema_migrations. All migrations are idempotent, so a
 * partially applied database recovers cleanly. Startup never fails because
 * of migration ordering: files are plain SQL applied sequentially.
 */
export async function runMigrations(): Promise<void> {
  const dir = path.join(repoRoot, "lib", "db", "drizzle");
  const client = (db as unknown as { $client: unknown }).$client as PgQueryClient;
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now() NOT NULL)",
  );
  const { rows } = await client.query<{ name: string }[]>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    logger.info({ file }, "Applying migration");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
  }
}
