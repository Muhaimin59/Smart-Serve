import { Router } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, services } from "@workspace/db";
import { ok, handle } from "../lib/respond";

const router: Router = Router();

/** Public service catalog with optional category / search filters. */
router.get(
  "/services",
  handle(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rows = await db
      .select()
      .from(services)
      .where(
        or(
          eq(services.status, "active"),
          category ? eq(services.category, category) : undefined,
          q ? or(ilike(services.name, `%${q}%`), ilike(services.description, `%${q}%`), ilike(services.slug, `%${q}%`)) : undefined,
        ),
      )
      .orderBy(sql`${services.name} asc`);
    res.json({ services: rows.filter((s) => s.status === "active") });
  }),
);

export default router;
