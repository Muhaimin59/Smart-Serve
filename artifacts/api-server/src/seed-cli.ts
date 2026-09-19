/**
 * Manual seed runner: `pnpm --filter @workspace/api-server seed`
 * Seeds demo data only when the database has no users.
 */
import { runMigrations } from "./lib/migrate";
import { runSeed } from "./lib/seed";
import { logger } from "./lib/logger";

async function main() {
  await runMigrations();
  await runSeed();
  logger.info("Seed complete. You can exit.");
  process.exit(0);
}

main().catch((error) => {
  logger.error({ error }, "Seed failed");
  process.exit(1);
});
