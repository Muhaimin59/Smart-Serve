#!/usr/bin/env node
// ---------------------------------------------------------------------------
// SmartServe - zero-setup local PostgreSQL for development.
//
// Boots an embedded PostgreSQL (prebuilt binaries installed from npm) with a
// persistent data directory at .data/postgres, creates the smartserve role
// and database, and keeps the server running until stopped (Ctrl+C).
//
// Usage: pnpm pg:dev
// ---------------------------------------------------------------------------
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const PG_PORT = Number(process.env.PG_PORT || 5432);
const PG_USER = "smartserve";
const PG_PASS = "smartserve";
const PG_DB = "smartserve";
const dataDir = process.env.PG_DATA_DIR || path.join(repoRoot, ".data", "postgres");
const readyFile = path.join(dataDir, ".smartserv-ready");

// --- sanity: check that the binary is installed -----------------------------
const { default: EmbeddedPostgres } = await import("embedded-postgres").catch(() => ({ default: null }));
if (!EmbeddedPostgres) {
  console.error("embedded-postgres is not installed. Run `pnpm install` first.");
  process.exit(1);
}

// --- first boot: initialise the cluster --------------------------------------
if (!existsSync(readyFile)) {
  console.log(`[pg] first run - initialising cluster at ${dataDir}`);
  await mkdir(dataDir, { recursive: true });
  const boot = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG_USER,
    password: PG_PASS,
    port: PG_PORT,
    persistent: true,
  });
  await boot.initialise();
  await boot.start();
  await boot.createDatabase(PG_DB);
  // grant createdb so tooling (drizzle-kit) can create scratch DBs
  const c = boot.getPgClient(PG_DB, "127.0.0.1");
  await c.connect();
  await c.query(`ALTER ROLE ${PG_USER} CREATEDB`);
  await c.end();
  await boot.stop();
  await writeFile(readyFile, `ok\ncreated=${new Date().toISOString()}\n`, "utf8");
  console.log(`[pg] cluster initialised (user=${PG_USER}, db=${PG_DB})`);
}

// --- run the cluster -----------------------------------------------------------
console.log(`[pg] starting PostgreSQL on 127.0.0.1:${PG_PORT} (db=${PG_DB})`);
console.log(`[pg] DATABASE_URL=postgres://${PG_USER}:${PG_PASS}@127.0.0.1:${PG_PORT}/${PG_DB}`);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: PG_USER,
  password: PG_PASS,
  port: PG_PORT,
  persistent: true,
});
await pg.start();

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\n[pg] shutting down...");
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
// keep the process alive
setInterval(() => {}, 1 << 30);
