import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../middlewares/auth";
import { ok, fail, handle } from "../lib/respond";
import { config } from "../config";
import { logger } from "../lib/logger";

const router: Router = Router();

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Image upload (base64 data URL in JSON). Validates type + size, stores with
 * a random filename outside any executable path. Used for problem photos,
 * completion proof, portfolio, documents and dispute evidence.
 */
router.post(
  "/uploads",
  requireAuth,
  handle(async (req, res) => {
    const dataUrl = typeof req.body?.data === "string" ? req.body.data : "";
    const purpose = typeof req.body?.purpose === "string" ? req.body.purpose : "general";
    const safePurpose = purpose.replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "general";
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/.exec(dataUrl);
    if (!match) return fail(res, 422, "invalid_image", "Only JPEG, PNG or WebP images are allowed (send a data URL).");
    const mime = ALLOWED[match[1].replace("jpg", "jpeg")] ? `image/${match[1].replace("jpg", "jpeg")}` : match[1];
    const ext = ALLOWED[mime] ?? "jpg";
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length > config.maxUploadMb * 1024 * 1024) return fail(res, 413, "too_large", `Image must be smaller than ${config.maxUploadMb} MB.`);
    if (buffer.length < 100) return fail(res, 422, "invalid_image", "The image appears to be corrupted or empty.");
    // sanity: JPEG/PNG magic bytes
    if (mime === "image/jpeg" && !(buffer[0] === 0xff && buffer[1] === 0xd8)) return fail(res, 422, "invalid_image", "File is not a valid JPEG.");
    if (mime === "image/png" && !(buffer[0] === 0x89 && buffer[1] === 0x50)) return fail(res, 422, "invalid_image", "File is not a valid PNG.");
    const dir = path.join(config.uploadDir, safePurpose);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    logger.info({ purpose: safePurpose, bytes: buffer.length }, "upload saved");
    ok(res, { url: `/uploads/${safePurpose}/${filename}`, size: buffer.length, mime }, 201);
  }),
);

export default router;
