/** Geo helpers: haversine distance and rough road ETA. */

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Rough ETA in minutes assuming ~24 km/h city average with a 4 minute buffer. */
export function etaMinutes(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  return Math.max(2, Math.round((distance / 24) * 60 + 4));
}

export function validCoordinate(value: unknown, min: number, max: number): boolean {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max;
}

export function toNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
