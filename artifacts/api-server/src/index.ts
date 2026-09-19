import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { config } from "./config";
import { runMigrations } from "./lib/migrate";
import { runSeed } from "./lib/seed";
import { attachRealtime } from "./lib/realtime";
import { startScheduler } from "./lib/scheduler";

const rawPort = process.env["PORT"] ?? String(config.port);
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  logger.info({ env: config.env }, "SmartServe API starting");
  await runMigrations();
  if (config.demoMode) {
    try {
      await runSeed();
    } catch (error) {
      logger.error({ error }, "Seed failed - continuing with existing data");
    }
  }
  const server = http.createServer(app);
  attachRealtime(server);
  startScheduler();

  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
  server.on("listening", () => {
    logger.info({ port }, `Server listening on 0.0.0.0:${port}`);
  });
  server.listen({ port, host: "0.0.0.0" });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error({ error }, "Fatal startup error");
  process.exit(1);
});
