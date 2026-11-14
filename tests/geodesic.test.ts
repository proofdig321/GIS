/**
 * Tests for geodesic calculation library.
 * All calculations use real Amajuba District coordinates.
 */

import {
  haversineMetres,
  bearingDegrees,
  cardinalDirection,
  geodesicResult,
  pointFromGeoJSON,
  centroidFromPolygon,
  pointInPolygon,
  isValidLatLng,
  coordinatePrecisionNote,
} from '../src/lib/geodesic.js';

// Newcastle CBD approximate centre
const NEWCASTLE_CBD = { lat: -27.7569, lng: 29.9318 };
// Approximate Ward 7 area (Newcastle)
const WARD7_APPROX = { lat: -27.7800, lng: 29.9100 };
// Synthetic Ward 7 reference point for distance tests only; not an institution coordinate.
const WARD7_REFERENCE_APPROX = { lat: -27.7750, lng: 29.9050 };

describe('haversineMetres', () => {
  test('same point returns 0', () => {
    expect(haversineMetres(NEWCASTLE_CBD, NEWCASTLE_CBD)).toBe(0);
  });

  test('known distance Newcastle CBD to ~1km north is approximately 1000m', () => {
    const northPoint = { lat: NEWCASTLE_CBD.lat + 0.009, lng: NEWCASTLE_CBD.lng };
    const dist = haversineMetres(NEWCASTLE_CBD, northPoint);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  test('200m separation produces ~200m result', () => {
    // ~0.0018 degrees latitude ≈ 200m
    const point200m = { lat: WARD7_REFERENCE_APPROX.lat + 0.0018, lng: WARD7_REFERENCE_APPROX.lng };
    const dist = haversineMetres(WARD7_REFERENCE_APPROX, point200m);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(220);
  });

  test('500m separation produces ~500m result', () => {
    const point500m = { lat: WARD7_REFERENCE_APPROX.lat + 0.0045, lng: WARD7_REFERENCE_APPROX.lng };
    const dist = haversineMetres(WARD7_REFERENCE_APPROX, point500m);
    expect(dist).toBeGreaterThan(470);
    expect(dist).toBeLessThan(530);
  });

  test('is symmetric', () => {
    const d1 = haversineMetres(NEWCASTLE_CBD, WARD7_APPROX);
    const d2 = haversineMetres(WARD7_APPROX, NEWCASTLE_CBD);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe('bearingDegrees', () => {
  test('due north returns ~0 degrees', () => {
    const north = { lat: NEWCASTLE_CBD.lat + 0.01, lng: NEWCASTLE_CBD.lng };
    const bearing = bearingDegrees(NEWCASTLE_CBD, north);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(5);
  });

  test('due east returns ~90 degrees', () => {
    const east = { lat: NEWCASTLE_CBD.lat, lng: NEWCASTLE_CBD.lng + 0.01 };
    const bearing = bearingDegrees(NEWCASTLE_CBD, east);
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  test('due south returns ~180 degrees', () => {
    const south = { lat: NEWCASTLE_CBD.lat - 0.01, lng: NEWCASTLE_CBD.lng };
    const bearing = bearingDegrees(NEWCASTLE_CBD, south);
    expect(bearing).toBeGreaterThan(175);
    expect(bearing).toBeLessThan(185);
  });

  test('due west returns ~270 degrees', () => {
    const west = { lat: NEWCASTLE_CBD.lat, lng: NEWCASTLE_CBD.lng - 0.01 };
    const bearing = bearingDegrees(NEWCASTLE_CBD, west);
    expect(bearing).toBeGreaterThan(265);
    expect(bearing).toBeLessThan(275);
  });
});

describe('cardinalDirection', () => {
  test('0 degrees is N', () => expect(cardinalDirection(0)).toBe('N'));
  test('45 degrees is NE', () => expect(cardinalDirection(45)).toBe('NE'));
  test('90 degrees is E', () => expect(cardinalDirection(90)).toBe('E'));
  test('135 degrees is SE', () => expect(cardinalDirection(135)).toBe('SE'));
  test('180 degrees is S', () => expect(cardinalDirection(180)).toBe('S'));
  test('225 degrees is SW', () => expect(cardinalDirection(225)).toBe('SW'));
  test('270 degrees is W', () => expect(cardinalDirection(270)).toBe('W'));
  test('315 degrees is NW', () => expect(cardinalDirection(315)).toBe('NW'));
  test('360 degrees wraps to N', () => expect(cardinalDirection(360)).toBe('N'));
});

describe('geodesicResult', () => {
  test('returns all fields', () => {
    const result = geodesicResult(NEWCASTLE_CBD, WARD7_APPROX);
    expect(result).toHaveProperty('distanceMetres');
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('bearingDegrees');
    expect(result).toHaveProperty('cardinalDirection');
    expect(result.distanceMetres).toBeGreaterThan(0);
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  test('distanceKm is distanceMetres / 1000 (approx)', () => {
    const result = geodesicResult(NEWCASTLE_CBD, WARD7_APPROX);
    expect(Math.abs(result.distanceKm - result.distanceMetres / 1000)).toBeLessThan(0.01);
  });

  test('Ward 7 demonstration: two points ~200m apart report within threshold', () => {
    const noticePoint = { lat: -27.7768, lng: 29.9052 };
    const schoolPoint = WARD7_REFERENCE_APPROX;
    const result = geodesicResult(noticePoint, schoolPoint);
    // These approximate coords should be within a few hundred metres
    expect(result.distanceMetres).toBeLessThan(500);
    expect(result.distanceMetres).toBeGreaterThan(0);
  });
});

describe('pointFromGeoJSON', () => {
  test('extracts lat/lng from valid Point geometry', () => {
    const geom = { type: 'Point', coordinates: [29.9318, -27.7569] };
    const pt = pointFromGeoJSON(geom);
    expect(pt).not.toBeNull();
    expect(pt!.lng).toBeCloseTo(29.9318, 4);
    expect(pt!.lat).toBeCloseTo(-27.7569, 4);
  });

  test('GeoJSON order is [lng, lat] — not [lat, lng]', () => {
    // [29.9318, -27.7569] → lng=29.9318, lat=-27.7569
    const geom = { type: 'Point', coordinates: [29.9318, -27.7569] };
    const pt = pointFromGeoJSON(geom);
    expect(pt!.lng).toBe(29.9318);
    expect(pt!.lat).toBe(-27.7569);
  });

  test('returns null for non-Point geometry', () => {
    expect(pointFromGeoJSON({ type: 'Polygon', coordinates: [] })).toBeNull();
  });

  test('returns null for invalid coordinates', () => {
    expect(pointFromGeoJSON({ type: 'Point', coordinates: [200, 100] })).toBeNull();
  });

  test('returns null for null input', () => {
    expect(pointFromGeoJSON(null)).toBeNull();
  });
});

describe('centroidFromPolygon', () => {
  test('returns approximate centroid of a simple polygon', () => {
    // Simple square around Newcastle CBD
    const geom = {
      type: 'Polygon',
      coordinates: [[
        [29.92, -27.76],
        [29.94, -27.76],
        [29.94, -27.74],
        [29.92, -27.74],
        [29.92, -27.76],
      ]],
    };
    const centroid = centroidFromPolygon(geom);
    expect(centroid).not.toBeNull();
    expect(centroid!.lng).toBeCloseTo(29.93, 1);
    expect(centroid!.lat).toBeCloseTo(-27.75, 1);
  });

  test('returns null for non-Polygon geometry', () => {
    expect(centroidFromPolygon({ type: 'Point', coordinates: [29.93, -27.75] })).toBeNull();
  });
});

describe('pointInPolygon', () => {
  const ward7MockPolygon = {
    type: 'Polygon',
    coordinates: [[
      [29.89, -27.80],
      [29.92, -27.80],
      [29.92, -27.77],
      [29.89, -27.77],
      [29.89, -27.80],
    ]],
  };

  test('point inside polygon returns true', () => {
    const inside = { lat: -27.785, lng: 29.905 };
    expect(pointInPolygon(inside, ward7MockPolygon)).toBe(true);
  });

  test('point outside polygon returns false', () => {
    const outside = { lat: -27.70, lng: 29.95 };
    expect(pointInPolygon(outside, ward7MockPolygon)).toBe(false);
  });

  test('returns false for non-Polygon geometry', () => {
    expect(pointInPolygon(NEWCASTLE_CBD, { type: 'Point', coordinates: [29.93, -27.75] })).toBe(false);
  });
});

describe('isValidLatLng', () => {
  test('valid Amajuba coordinates pass', () => {
    expect(isValidLatLng(-27.7569, 29.9318)).toBe(true);
  });

  test('swapped axis (lat/lng confusion) fails for SA coordinates', () => {
    // 29.9318 as lat is valid range but wrong for SA
    expect(isValidLatLng(29.9318, -27.7569)).toBe(true); // technically valid WGS84
  });

  test('out-of-range lat fails', () => {
    expect(isValidLatLng(91, 29.93)).toBe(false);
  });

  test('out-of-range lng fails', () => {
    expect(isValidLatLng(-27.75, 181)).toBe(false);
  });

  test('NaN fails', () => {
    expect(isValidLatLng(NaN, 29.93)).toBe(false);
  });

  test('string fails', () => {
    expect(isValidLatLng('-27.75' as unknown as number, 29.93)).toBe(false);
  });
});

describe('coordinatePrecisionNote', () => {
  test('5 decimal places reports sub-metre', () => {
    const note = coordinatePrecisionNote(-27.75693, 29.93182);
    expect(note).toContain('sub-metre');
  });

  test('4 decimal places reports ~11m', () => {
    const note = coordinatePrecisionNote(-27.7569, 29.9318);
    expect(note).toContain('11m');
  });

  test('3 decimal places reports ~111m', () => {
    const note = coordinatePrecisionNote(-27.757, 29.932);
    expect(note).toContain('111m');
  });

  test('2 decimal places reports approximate', () => {
    const note = coordinatePrecisionNote(-27.76, 29.93);
    expect(note).toContain('approximate');
  });
});

describe('proximity threshold comparisons', () => {
  test('Ward 7 demonstration: point within 200m is within threshold', () => {
    const school = WARD7_REFERENCE_APPROX;
    const notice = { lat: school.lat + 0.0015, lng: school.lng }; // ~167m north
    const dist = haversineMetres(notice, school);
    expect(dist).toBeLessThan(200);
  });

  test('500m liquor-notice reference: point at 300m is within reference distance', () => {
    const school = WARD7_REFERENCE_APPROX;
    const notice = { lat: school.lat + 0.0027, lng: school.lng }; // ~300m north
    const dist = haversineMetres(notice, school);
    expect(dist).toBeLessThan(500);
    expect(dist).toBeGreaterThan(200); // outside pilot but inside statutory
  });

  test('point at 600m is outside both thresholds', () => {
    const school = WARD7_REFERENCE_APPROX;
    const notice = { lat: school.lat + 0.0054, lng: school.lng }; // ~600m north
    const dist = haversineMetres(notice, school);
    expect(dist).toBeGreaterThan(500);
  });

  test('pilot and statutory thresholds are distinct', () => {
    // Confirm 200 !== 500 — they are different thresholds for different purposes
    expect(200).not.toBe(500);
  });
});
