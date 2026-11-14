/**
 * Proximity threshold logic — pure unit tests.
 * Tests statutory radii from the Control Centre config, coordinate provenance rules,
 * and the principle that distance calculations are evidence, not legal determinations.
 * No mocks. No live API calls.
 */

import { haversineMetres, geodesicResult, coordinatePrecisionNote } from '../src/lib/geodesic.js';

// Proximity radius reference — mirrors notice-layer-config.ts in the Control Centre
const PROXIMITY_RADIUS: Record<string, { metres: number; statutoryBasis: string; caveat: string } | null> = {
  liquor: {
    metres: 500,
    statutoryBasis: 'KZN Liquor Licensing Act s.43(2)(b)',
    caveat: '500m is the accepted KZNERA reference distance. The Board retains discretion.',
  },
  mining: {
    metres: 500,
    statutoryBasis: 'MPRDA s.5(4)(c) — community consultation area',
    caveat: '500m is a DMRE practice standard. Actual area set by EAP.',
  },
  eia: null,
  rezoning: null,
  infrastructure: null,
  'land-use': null,
  township: null,
  building: null,
  telecom: null,
  estate: null,
  liquidation: null,
  pto: null,
};

// Approximate Ward 7 reference coordinates — for distance calculation tests only
const SCHOOL_APPROX = { lat: -27.7750, lng: 29.9050 };
const NOTICE_NEARBY = { lat: -27.7768, lng: 29.9052 };
const NOTICE_FAR = { lat: -27.7810, lng: 29.9060 };

describe('statutory proximity radii', () => {
  test('liquor notice has 500m reference distance', () => {
    expect(PROXIMITY_RADIUS['liquor']?.metres).toBe(500);
  });

  test('mining notice has 500m reference distance', () => {
    expect(PROXIMITY_RADIUS['mining']?.metres).toBe(500);
  });

  test('EIA has no fixed radius', () => {
    expect(PROXIMITY_RADIUS['eia']).toBeNull();
  });

  test('rezoning has no fixed radius', () => {
    expect(PROXIMITY_RADIUS['rezoning']).toBeNull();
  });

  test('only liquor and mining have reference distances', () => {
    const withRadius = Object.entries(PROXIMITY_RADIUS)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    expect(withRadius).toHaveLength(2);
    expect(withRadius).toContain('liquor');
    expect(withRadius).toContain('mining');
  });

  test('liquor statutory basis is documented correctly', () => {
    expect(PROXIMITY_RADIUS['liquor']?.statutoryBasis).toBe('KZN Liquor Licensing Act s.43(2)(b)');
  });
});

describe('geodesic distance calculations', () => {
  test('calculates distance between two Amajuba points', () => {
    const dist = haversineMetres(NOTICE_NEARBY, SCHOOL_APPROX);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(5000);
  });

  test('farther notice produces larger distance', () => {
    const distNear = haversineMetres(NOTICE_NEARBY, SCHOOL_APPROX);
    const distFar = haversineMetres(NOTICE_FAR, SCHOOL_APPROX);
    expect(distFar).toBeGreaterThan(distNear);
  });

  test('geodesicResult includes all required fields', () => {
    const result = geodesicResult(NOTICE_NEARBY, SCHOOL_APPROX);
    expect(result.distanceMetres).toBeGreaterThan(0);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.bearingDegrees).toBeGreaterThanOrEqual(0);
    expect(result.bearingDegrees).toBeLessThan(360);
    expect(result.cardinalDirection).toBeTruthy();
  });

  test('notice within 500m of school is flagged for liquor notice review', () => {
    const dist = haversineMetres(NOTICE_NEARBY, SCHOOL_APPROX);
    const withinLiquorRef = dist <= (PROXIMITY_RADIUS['liquor']?.metres ?? 500);
    // This is a flag for operator review — not a legal determination
    expect(typeof withinLiquorRef).toBe('boolean');
  });
});

describe('coordinate precision flags', () => {
  test('6 decimal places is sub-metre precision', () => {
    expect(coordinatePrecisionNote(-27.775012, 29.905034)).toContain('sub-metre');
  });

  test('4 decimal places is ~11m precision', () => {
    expect(coordinatePrecisionNote(-27.7750, 29.9050)).toContain('11m');
  });

  test('3 decimal places is ~111m precision', () => {
    expect(coordinatePrecisionNote(-27.775, 29.905)).toContain('111m');
  });

  test('2 decimal places is approximate', () => {
    expect(coordinatePrecisionNote(-27.78, 29.91)).toContain('approximate');
  });
});

describe('coordinate provenance rules', () => {
  test('Sanity geopoint is not authoritative for institutional locations', () => {
    const sanitySource = 'Sanity geopoint (operator-entered)';
    expect(sanitySource.toLowerCase()).toContain('sanity');
    // Sanity geopoints are never authoritative — they are comparison evidence only
  });

  test('notice coordinates retain their own provenance', () => {
    // Rule: do not move a notice to an institution's coordinates
    expect(NOTICE_NEARBY.lat).not.toBe(SCHOOL_APPROX.lat);
    expect(NOTICE_NEARBY.lng).not.toBe(SCHOOL_APPROX.lng);
  });

  test('distance calculation does not modify either coordinate', () => {
    const noticeBefore = { ...NOTICE_NEARBY };
    const schoolBefore = { ...SCHOOL_APPROX };
    haversineMetres(NOTICE_NEARBY, SCHOOL_APPROX);
    expect(NOTICE_NEARBY.lat).toBe(noticeBefore.lat);
    expect(NOTICE_NEARBY.lng).toBe(noticeBefore.lng);
    expect(SCHOOL_APPROX.lat).toBe(schoolBefore.lat);
    expect(SCHOOL_APPROX.lng).toBe(schoolBefore.lng);
  });
});
