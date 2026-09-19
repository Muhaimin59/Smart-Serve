import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import pinoHttp from "pino-http";
import apiRouter from "./routes";
import { logger } from "./lib/logger";
import { ApiError } from "./lib/respond";
import { repoRoot, config } from "./config";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(pinoHttp({
  logger,
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
  autoLogging: { ignore: (req) => req.url?.startsWith("/uploads/") ?? false },
}));

app.use(
  cors({
    origin: config.corsOrigin ? config.corsOrigin.split(",").map((s) => s.trim()) : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);

app.use(express.json({ limit: "12mb" }));

// basic security headers (frame headers intentionally omitted so the app can
// be embedded in preview iframes)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self)");
  next();
});

// uploaded files (images/documents) - never cached so edits are visible
app.use(
  "/uploads",
  express.static(config.uploadDir, {
    maxAge: 0,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.use("/api", apiRouter);

// 404 for unknown API routes
app.use("/api", (_req, res) => res.status(404).json({ success: false, error: { code: "not_found", message: "Route not found." } }));

// Root health probe for deployment/load-balancer checks.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// serve the built web app (artifacts/smart-serve-web/dist) with SPA fallback
const webDist = path.resolve(repoRoot, "artifacts", "smart-serve-web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist, { maxAge: config.isProduction ? "7d" : 0, index: "index.html" }));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ name: "SmartServe API", status: "ok", hint: "Web frontend not built yet - run: pnpm --filter @workspace/smart-serve-web build" });
  });
}

// central error handler - user-friendly messages, technical details in logs
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (error instanceof ApiError) {
    res.status(error.status).json({ success: false, error: { code: error.code, message: error.message }, ...(error.data ? { data: error.data } : {}) });
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const isValidation = /must|required|valid|Choose|Enter|invalid/i.test(message);
  const status = isValidation ? 400 : 500;
  if (status === 500) logger.error({ error, url: req.url }, "Unhandled API error");
  res.status(status).json({ success: false, error: { code: isValidation ? "validation" : "server_error", message: isValidation ? message : "Something went wrong on our side. Please try again." } });
});

export default app;
