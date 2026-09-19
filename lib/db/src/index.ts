import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Never let a dropped/idle connection take the whole process down. pg will
// reconnect transparently; we just log so the event is observable.
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] idle pool client error (will auto-reconnect):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
