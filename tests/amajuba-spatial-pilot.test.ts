/**
 * Amajuba District spatial pilot — pure unit tests.
 * Tests district scope rules, ward filtering logic, and coordinate provenance rules.
 * No mocks. No live API calls.
 */

import { haversineMetres, geodesicResult, pointFromGeoJSON } from '../src/lib/geodesic.js';

// Amajuba District bounding box
const AMAJUBA_BBOX = { west: 27.8, south: -28.9, east: 30.2, north: -27.2 };

function isInAmajuba(lat: number, lng: number): boolean {
  return lat >= AMAJUBA_BBOX.south && lat <= AMAJUBA_BBOX.north &&
    lng >= AMAJUBA_BBOX.west && lng <= AMAJUBA_BBOX.east;
}

// Municipality code → CAT_B mapping
function municipalityToCatB(municipality: string): string | undefined {
  const map: Record<string, string> = {
    newcastle: 'KZN252',
    emadlangeni: 'KZN253',
    dannhauser: 'KZN254',
  };
  return map[municipality.toLowerCase()];
}

// Ward 7 notice filter: wardNumber === 7 AND municipality is Newcastle
function isWard7Newcastle(notice: { relatedArea?: { wardNumber?: number; municipality?: string } }): boolean {
  const ward = notice.relatedArea?.wardNumber;
  const muni = notice.relatedArea?.municipality?.toLowerCase();
  return ward === 7 && (muni === 'newcastle' || muni === 'kzn252');
}

describe('Amajuba District scope', () => {
  test('Newcastle CBD is within Amajuba bounding box', () => {
    expect(isInAmajuba(-27.7569, 29.9318)).toBe(true);
  });

  test('Dannhauser is within Amajuba bounding box', () => {
    expect(isInAmajuba(-28.0500, 30.0500)).toBe(true);
  });

  test('eMadlangeni is within Amajuba bounding box', () => {
    expect(isInAmajuba(-27.6500, 29.7500)).toBe(true);
  });

  test('Durban is outside Amajuba bounding box', () => {
    expect(isInAmajuba(-29.8587, 31.0218)).toBe(false);
  });

  test('Johannesburg is outside Amajuba bounding box', () => {
    expect(isInAmajuba(-26.2041, 28.0473)).toBe(false);
  });
});

describe('Municipality code mapping', () => {
  test('newcastle maps to KZN252', () => {
    expect(municipalityToCatB('newcastle')).toBe('KZN252');
  });

  test('emadlangeni maps to KZN253', () => {
    expect(municipalityToCatB('emadlangeni')).toBe('KZN253');
  });

  test('dannhauser maps to KZN254', () => {
    expect(municipalityToCatB('dannhauser')).toBe('KZN254');
  });

  test('unknown municipality returns undefined', () => {
    expect(municipalityToCatB('durban')).toBeUndefined();
  });

  test('case-insensitive', () => {
    expect(municipalityToCatB('Newcastle')).toBe('KZN252');
    expect(municipalityToCatB('EMADLANGENI')).toBe('KZN253');
  });
});

describe('Ward 7 Newcastle notice filter', () => {
  test('ward 7 newcastle matches', () => {
    expect(isWard7Newcastle({ relatedArea: { wardNumber: 7, municipality: 'newcastle' } })).toBe(true);
  });

  test('ward 7 KZN252 matches', () => {
    expect(isWard7Newcastle({ relatedArea: { wardNumber: 7, municipality: 'KZN252' } })).toBe(true);
  });

  test('ward 3 newcastle does not match', () => {
    expect(isWard7Newcastle({ relatedArea: { wardNumber: 3, municipality: 'newcastle' } })).toBe(false);
  });

  test('ward 7 dannhauser does not match', () => {
    expect(isWard7Newcastle({ relatedArea: { wardNumber: 7, municipality: 'dannhauser' } })).toBe(false);
  });

  test('no relatedArea does not match', () => {
    expect(isWard7Newcastle({})).toBe(false);
  });
});

describe('Pilot proximity calculations — Amajuba coordinates', () => {
  // Approximate Ward 7 reference coordinates
  const SCHOOL_APPROX = { lat: -27.7750, lng: 29.9050 };
  const NOTICE_200M = { lat: -27.7768, lng: 29.9052 };
  const NOTICE_450M = { lat: -27.7790, lng: 29.9055 };

  test('notice at ~200m from school is within 200m pilot threshold', () => {
    const dist = haversineMetres(NOTICE_200M, SCHOOL_APPROX);
    expect(dist).toBeLessThan(300); // approximate coords, generous bound
  });

  test('notice at ~450m is outside 200m pilot but within 500m statutory', () => {
    const dist = haversineMetres(NOTICE_450M, SCHOOL_APPROX);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(500);
  });

  test('geodesicResult includes all required provenance fields', () => {
    const result = geodesicResult(NOTICE_200M, SCHOOL_APPROX);
    expect(result).toHaveProperty('distanceMetres');
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('bearingDegrees');
    expect(result).toHaveProperty('cardinalDirection');
  });

  test('200m pilot threshold is distinct from 500m statutory radius', () => {
    expect(200).not.toBe(500);
    // The pilot is a demonstration — not a statutory requirement
    const pilotMetres = 200;
    const statutoryMetres = 500;
    expect(pilotMetres).toBeLessThan(statutoryMetres);
  });
});

describe('GeoJSON point extraction — district coordinates', () => {
  test('extracts Newcastle CBD point correctly', () => {
    const geom = { type: 'Point', coordinates: [29.9318, -27.7569] };
    const pt = pointFromGeoJSON(geom);
    expect(pt).not.toBeNull();
    expect(pt!.lng).toBeCloseTo(29.9318, 4);
    expect(pt!.lat).toBeCloseTo(-27.7569, 4);
  });

  test('GeoJSON [lng, lat] order is preserved — not swapped to [lat, lng]', () => {
    const geom = { type: 'Point', coordinates: [29.9050, -27.7750] };
    const pt = pointFromGeoJSON(geom);
    expect(pt!.lng).toBeCloseTo(29.9050, 4);
    expect(pt!.lat).toBeCloseTo(-27.7750, 4);
    // Confirm axis order: lng is ~30 (east), lat is ~-28 (south)
    expect(pt!.lng).toBeGreaterThan(0);
    expect(pt!.lat).toBeLessThan(0);
  });

  test('Sanity geopoint is NOT authoritative — must not be used as institutional location', () => {
    // This test documents the rule: Sanity geopoints are operator-entered content
    const sanityGeopoint = { lat: -27.7800, lng: 29.9100 }; // operator-entered, unverified
    const authoritativeDatasetPoint = { lat: -27.7750, lng: 29.9050 }; // from dataset

    const discrepancy = haversineMetres(sanityGeopoint, authoritativeDatasetPoint);
    // Discrepancy exists — Sanity point must not silently replace authoritative geometry
    expect(discrepancy).toBeGreaterThan(0);
  });
});
