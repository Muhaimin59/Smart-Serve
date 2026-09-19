import { logger } from "./logger";
import { processTimeouts, promoteScheduled } from "./matching";

/**
 * Background jobs (single-process in-memory scheduler):
 *  - expire stale provider invitations and trigger reassignment
 *  - promote due SCHEDULED bookings into the matching workflow
 * Runs every 10 seconds; each tick is guarded so one failure never stops it.
 */
export function startScheduler(intervalMs = 10_000): () => void {
  const tick = async () => {
    try {
      await processTimeouts();
    } catch (error) {
      logger.warn({ error }, "scheduler: processTimeouts failed");
    }
    try {
      await promoteScheduled();
    } catch (error) {
      logger.warn({ error }, "scheduler: promoteScheduled failed");
    }
  };
  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  id.unref?.();
  return () => clearInterval(id);
}
