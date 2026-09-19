/* Renders SmartServe icons procedurally (no external deps) and writes PNGs. */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const S = 1024; // supersample size

// --- shape helpers -------------------------------------------------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function sdRoundedBox(px, py, hx, hy, r) {
  const qx = Math.abs(px) - (hx - r);
  const qy = Math.abs(py) - (hy - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

// 4-point star (concave diamond) via negative superellipse
function sdStar(px, py, cx, cy, a) {
  const dx = Math.abs(px - cx) / a;
  const dy = Math.abs(py - cy) / a;
  const n = 0.32;
  const v = Math.pow(Math.pow(dx, 1 / n) + Math.pow(dy, 1 / n), n);
  return v - 1; // negative inside (scaled)
}

const PINK = [236, 72, 153];
const ORANGE = [249, 115, 22];

function render(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = S / size;
  // maskable: shrink content to safe zone
  const pad = maskable ? 0.78 : 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2 supersample
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = (x + (sx + 0.5) / 2) * scale;
          const py = (y + (sy + 0.5) / 2) * scale;
          // rounded square background
          const d = sdRoundedBox(px - S / 2, py - S / 2, (S / 2 - 2) * pad, (S / 2 - 2) * pad, 112 * pad);
          const aa = clamp01(-d / 2 + 0.5);
          if (aa <= 0) continue;
          const t = (px / S + py / S) / 2;
          let cr = PINK[0] + (ORANGE[0] - PINK[0]) * t;
          let cg = PINK[1] + (ORANGE[1] - PINK[1]) * t;
          let cb = PINK[2] + (ORANGE[2] - PINK[2]) * t;
          let ca = aa;
          // white shapes (in supersample space)
          const X = ((px - S / 2) / pad) + S / 2;
          const Y = ((py - S / 2) / pad) + S / 2;
          const k = S / 1024;
          const dCheck = Math.min(
            sdSegment(X, Y, 150 * k, 268 * k, 222 * k, 340 * k),
            sdSegment(X, Y, 222 * k, 340 * k, 368 * k, 188 * k),
          );
          const dCheckAa = clamp01((-dCheck + 26 * k) / (2 * k) + 0.5);
          const dStar = sdStar(X, Y, 430 * k, 104 * k, 46 * k) * 46 * k;
          const dStarAa = clamp01(-dStar / (2 * k) + 0.5);
          const dDot = Math.hypot(X - 120 * k, Y - 404 * k) - 22 * k;
          const dDotAa = clamp01(-dDot / (2 * k) + 0.5);
          const white = Math.max(dCheckAa, dStarAa);
          cr = cr + (255 - cr) * white;
          cg = cg + (255 - cg) * white;
          cb = cb + (255 - cb) * white;
          const dotW = dDotAa * 0.7;
          cr = cr + (255 - cr) * dotW;
          cg = cg + (255 - cg) * dotW;
          cb = cb + (255 - cb) * dotW;
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / 4);
      buf[i + 1] = Math.round(g / 4);
      buf[i + 2] = Math.round(b / 4);
      buf[i + 3] = Math.round((a / 4) * 255);
    }
  }
  return buf;
}

// --- minimal PNG encoder ---------------------------------------------------
function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

import { mkdirSync } from "node:fs";
mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["icon-512.png", 512, {}],
  ["icon-192.png", 192, {}],
  ["maskable-512.png", 512, { maskable: true }],
];
for (const [name, size, opts] of jobs) {
  const png = encodePng(size, render(size, opts));
  writeFileSync("public/icons/" + name, png);
  console.log("wrote", name, png.length, "bytes");
}
