import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const handle = (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

// Canonical health check.
router.get("/healthz", handle);
// Alias used by load balancers / deployment probes.
router.get("/health", handle);

export default router;
