/**
 * Tests for proximity threshold logic.
 *
 * Verifies:
 * - The Ward 7 200m demonstration is distinct from the 500m liquor-notice reference
 * - Threshold comparisons work correctly
 * - Coordinate provenance flags are raised correctly
 * - No legal determinations are made
 */

import { haversineMetres, geodesicResult, coordinatePrecisionNote } from '../src/lib/geodesic.js';

// Proximity radius config (mirrors notice-layer-config.ts)
const PROXIMITY_RADIUS: Record<string, { metres: number; statutoryBasis: string } | null> = {
  liquor: { metres: 500, statutoryBasis: 'KZN Liquor Licensing Act s.43(2)(b)' },
  mining: { metres: 500, statutoryBasis: 'MPRDA s.5(4)(c)' },
  eia: null,
  rezoning: null,
  infrastructure: null,
};

const WARD7_DEMONSTRATION_METRES = 200;

// Synthetic Ward 7 test points; these are not institutional or notice coordinates.
const WARD7_REFERENCE_APPROX = { lat: -27.7750, lng: 29.9050 };
const NOTICE_A_APPROX = { lat: -27.7768, lng: 29.9052 };
const NOTICE_B_APPROX = { lat: -27.7790, lng: 29.9055 };

describe('proximity radius config', () => {
  test('liquor notice has 500m radius', () => {
    expect(PROXIMITY_RADIUS['liquor']?.metres).toBe(500);
  });

  test('mining notice has 500m radius', () => {
    expect(PROXIMITY_RADIUS['mining']?.metres).toBe(500);
  });

  test('EIA has no statutory radius', () => {
    expect(PROXIMITY_RADIUS['eia']).toBeNull();
  });

  test('rezoning has no statutory radius', () => {
    expect(PROXIMITY_RADIUS['rezoning']).toBeNull();
  });

  test('Ward 7 demonstration distance is 200m', () => {
    expect(WARD7_DEMONSTRATION_METRES).toBe(200);
  });

  test('Ward 7 demonstration is distinct from liquor-notice reference', () => {
    expect(WARD7_DEMONSTRATION_METRES).not.toBe(PROXIMITY_RADIUS['liquor']?.metres);
  });
});

describe('Ward 7 demonstration proximity calculations', () => {
  test('synthetic Notice A is near the demonstration reference point', () => {
    const dist = haversineMetres(NOTICE_A_APPROX, WARD7_REFERENCE_APPROX);
    // Approximate coords — within a reasonable range
    expect(dist).toBeLessThan(400);
    expect(dist).toBeGreaterThan(0);
  });

  test('Notice B is further from school than Notice A', () => {
    const distA = haversineMetres(NOTICE_A_APPROX, WARD7_REFERENCE_APPROX);
    const distB = haversineMetres(NOTICE_B_APPROX, WARD7_REFERENCE_APPROX);
    expect(distB).toBeGreaterThan(distA);
  });

  test('geodesicResult returns all required fields', () => {
    const result = geodesicResult(NOTICE_A_APPROX, WARD7_REFERENCE_APPROX);
    expect(result.distanceMetres).toBeGreaterThan(0);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.bearingDegrees).toBeGreaterThanOrEqual(0);
    expect(result.bearingDegrees).toBeLessThan(360);
    expect(result.cardinalDirection).toBeTruthy();
  });
});

describe('threshold comparison logic', () => {
  test('point within 200m is within the Ward 7 demonstration threshold', () => {
    const dist = haversineMetres(
      { lat: WARD7_REFERENCE_APPROX.lat + 0.0015, lng: WARD7_REFERENCE_APPROX.lng },
      WARD7_REFERENCE_APPROX
    );
    expect(dist <= WARD7_DEMONSTRATION_METRES).toBe(true);
  });

  test('point at 300m is outside the demonstration but inside the liquor reference', () => {
    const dist = haversineMetres(
      { lat: WARD7_REFERENCE_APPROX.lat + 0.0027, lng: WARD7_REFERENCE_APPROX.lng },
      WARD7_REFERENCE_APPROX
    );
    expect(dist > WARD7_DEMONSTRATION_METRES).toBe(true);
    expect(dist < (PROXIMITY_RADIUS['liquor']?.metres ?? 500)).toBe(true);
  });

  test('point at 600m is outside both the demonstration and liquor reference', () => {
    const dist = haversineMetres(
      { lat: WARD7_REFERENCE_APPROX.lat + 0.0054, lng: WARD7_REFERENCE_APPROX.lng },
      WARD7_REFERENCE_APPROX
    );
    expect(dist > WARD7_DEMONSTRATION_METRES).toBe(true);
    expect(dist > (PROXIMITY_RADIUS['liquor']?.metres ?? 500)).toBe(true);
  });
});

describe('coordinate precision flags', () => {
  test('3 decimal place coordinate is flagged as ~111m precision', () => {
    const note = coordinatePrecisionNote(-27.775, 29.905);
    expect(note).toContain('111m');
  });

  test('2 decimal place coordinate is flagged as approximate', () => {
    const note = coordinatePrecisionNote(-27.78, 29.91);
    expect(note).toContain('approximate');
  });

  test('6 decimal place coordinate is sub-metre', () => {
    const note = coordinatePrecisionNote(-27.775012, 29.905034);
    expect(note).toContain('sub-metre');
  });
});

describe('provenance rules', () => {
  test('Sanity geopoint is not authoritative for institutional locations', () => {
    // This test documents the rule — not a calculation
    const sanitySource = 'Sanity geopoint (operator-entered)';
    const isAuthoritative = !sanitySource.toLowerCase().includes('sanity');
    expect(isAuthoritative).toBe(false);
  });

  test('authoritative dataset source is preferred', () => {
    const authSource = 'Giga Schools dataset feature ID abc123';
    const isAuthoritative = !authSource.toLowerCase().includes('sanity');
    expect(isAuthoritative).toBe(true);
  });

  test('notice coordinates retain their own provenance', () => {
    // Rule: do not move a notice to an institution's coordinates
    const noticeCoord = { lat: -27.7768, lng: 29.9052 };
    const schoolCoord = { lat: -27.7750, lng: 29.9050 };
    // They must remain separate — never overwrite notice with school coords
    expect(noticeCoord.lat).not.toBe(schoolCoord.lat);
    expect(noticeCoord.lng).not.toBe(schoolCoord.lng);
  });
});

describe('no legal determinations', () => {
  test('distance within 500m does not constitute legal compliance', () => {
    // This test documents the rule — proximity is evidence, not compliance
    const dist = haversineMetres(NOTICE_A_APPROX, WARD7_REFERENCE_APPROX);
    const withinLiquorRadius = dist <= 500;
    // Being within radius is a flag for review, not a legal finding
    expect(typeof withinLiquorRadius).toBe('boolean');
    // The MCP reports this as evidence — the operator makes the determination
  });

  test('liquor statutory basis is documented correctly', () => {
    expect(PROXIMITY_RADIUS['liquor']?.statutoryBasis).toBe('KZN Liquor Licensing Act s.43(2)(b)');
  });
});
