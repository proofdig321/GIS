/**
 * Geodesic calculations for the Umkhandlu GIS MCP.
 *
 * GeoJSON coordinate order is [longitude, latitude].
 * Leaflet / human-readable order is [latitude, longitude].
 * All functions in this module accept explicit lat/lng parameters to avoid
 * silent axis confusion. GeoJSON geometry is parsed with explicit axis extraction.
 *
 * Earth radius: WGS84 mean radius 6,371,008.8 m (same constant as spatial-proximity.ts).
 */

const EARTH_RADIUS_M = 6_371_008.8;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeodesicResult {
  distanceMetres: number;
  distanceKm: number;
  bearingDegrees: number;
  cardinalDirection: string;
}

/** Degrees → radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians → degrees */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine geodesic distance between two WGS84 points.
 * Returns metres.
 */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing from a → b (degrees, 0–360, clockwise from north).
 */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Convert bearing degrees to 8-point cardinal direction string. */
export function cardinalDirection(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8] ?? 'N';
}

/** Full geodesic result between two points. */
export function geodesicResult(a: LatLng, b: LatLng): GeodesicResult {
  const distanceMetres = haversineMetres(a, b);
  const bearing = bearingDegrees(a, b);
  return {
    distanceMetres: Math.round(distanceMetres),
    distanceKm: Math.round(distanceMetres / 10) / 100,
    bearingDegrees: Math.round(bearing * 10) / 10,
    cardinalDirection: cardinalDirection(bearing),
  };
}

/**
 * Extract a LatLng from a GeoJSON Point geometry.
 * GeoJSON order: [longitude, latitude].
 * Returns null if the geometry is not a valid Point.
 */
export function pointFromGeoJSON(geometry: unknown): LatLng | null {
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    (geometry as Record<string, unknown>).type !== 'Point'
  ) return null;
  const coords = (geometry as Record<string, unknown>).coordinates;
  if (
    !Array.isArray(coords) ||
    coords.length < 2 ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number'
  ) return null;
  // GeoJSON: [lng, lat]
  const lng = coords[0] as number;
  const lat = coords[1] as number;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Centroid of a GeoJSON Polygon (outer ring only).
 * Returns null if geometry is not a valid Polygon.
 */
export function centroidFromPolygon(geometry: unknown): LatLng | null {
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    (geometry as Record<string, unknown>).type !== 'Polygon'
  ) return null;
  const coords = (geometry as Record<string, unknown>).coordinates;
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
  const ring = coords[0] as number[][];
  if (ring.length < 3) return null;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const pos of ring) {
    if (Array.isArray(pos) && pos.length >= 2) {
      sumLng += pos[0] as number;
      sumLat += pos[1] as number;
      count++;
    }
  }
  if (count === 0) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Nearest point on a polygon boundary to a given origin.
 * Used to measure distance from a point to a polygon edge (not centroid).
 */
export function nearestBoundaryPoint(origin: LatLng, geometry: unknown): LatLng | null {
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    (geometry as Record<string, unknown>).type !== 'Polygon'
  ) return null;
  const coords = (geometry as Record<string, unknown>).coordinates;
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
  const ring = coords[0] as number[][];
  let best: LatLng | null = null;
  let bestDist = Infinity;
  for (const pos of ring) {
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const pt: LatLng = { lat: pos[1] as number, lng: pos[0] as number };
    const d = haversineMetres(origin, pt);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

/**
 * Point-in-polygon test using ray casting.
 * geometry must be a GeoJSON Polygon.
 */
export function pointInPolygon(point: LatLng, geometry: unknown): boolean {
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    (geometry as Record<string, unknown>).type !== 'Polygon'
  ) return false;
  const coords = (geometry as Record<string, unknown>).coordinates;
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return false;
  const ring = coords[0] as number[][];
  // Ray casting in lng/lat space (acceptable for small areas like wards)
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Validate a WGS84 coordinate pair.
 */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Describe coordinate precision based on decimal places.
 * 5+ dp ≈ 1m, 4 dp ≈ 11m, 3 dp ≈ 111m, 2 dp ≈ 1.1km, 1 dp ≈ 11km.
 */
export function coordinatePrecisionNote(lat: number, lng: number): string {
  const latDp = (lat.toString().split('.')[1] ?? '').length;
  const lngDp = (lng.toString().split('.')[1] ?? '').length;
  const dp = Math.min(latDp, lngDp);
  if (dp >= 5) return `${dp} decimal places — sub-metre precision`;
  if (dp === 4) return `${dp} decimal places — ~11m precision`;
  if (dp === 3) return `${dp} decimal places — ~111m precision`;
  if (dp === 2) return `${dp} decimal places — ~1.1km precision (approximate)`;
  if (dp === 1) return `${dp} decimal place — ~11km precision (locality only)`;
  return `${dp} decimal places — very low precision`;
}
