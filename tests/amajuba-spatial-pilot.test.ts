/**
 * Amajuba District spatial pilot — pure unit tests.
 * Tests district scope rules, ward filtering, and coordinate provenance.
 * No mocks. No live API calls.
 */

import { haversineMetres, geodesicResult, pointFromGeoJSON } from '../src/lib/geodesic.js';

const AMAJUBA_BBOX = { west: 27.8, south: -28.9, east: 30.2, north: -27.2 };

function isInAmajuba(lat: number, lng: number): boolean {
  return lat >= AMAJUBA_BBOX.south && lat <= AMAJUBA_BBOX.north &&
    lng >= AMAJUBA_BBOX.west && lng <= AMAJUBA_BBOX.east;
}

function municipalityToCatB(municipality: string): string | undefined {
  const map: Record<string, string> = {
    newcastle: 'KZN252', kzn252: 'KZN252',
    emadlangeni: 'KZN253', kzn253: 'KZN253',
    dannhauser: 'KZN254', kzn254: 'KZN254',
  };
  return map[municipality.toLowerCase()];
}

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

describe('municipality code mapping', () => {
  test('newcastle maps to KZN252', () => expect(municipalityToCatB('newcastle')).toBe('KZN252'));
  test('emadlangeni maps to KZN253', () => expect(municipalityToCatB('emadlangeni')).toBe('KZN253'));
  test('dannhauser maps to KZN254', () => expect(municipalityToCatB('dannhauser')).toBe('KZN254'));
  test('unknown municipality returns undefined', () => expect(municipalityToCatB('durban')).toBeUndefined());
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

describe('distance calculations with Amajuba coordinates', () => {
  const SCHOOL_APPROX = { lat: -27.7750, lng: 29.9050 };
  const NOTICE_A = { lat: -27.7768, lng: 29.9052 };
  const NOTICE_B = { lat: -27.7790, lng: 29.9055 };

  test('calculates a positive distance between two Ward 7 points', () => {
    const dist = haversineMetres(NOTICE_A, SCHOOL_APPROX);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(5000);
  });

  test('notice B is further from school than notice A', () => {
    const distA = haversineMetres(NOTICE_A, SCHOOL_APPROX);
    const distB = haversineMetres(NOTICE_B, SCHOOL_APPROX);
    expect(distB).toBeGreaterThan(distA);
  });

  test('geodesicResult returns all required fields', () => {
    const result = geodesicResult(NOTICE_A, SCHOOL_APPROX);
    expect(result.distanceMetres).toBeGreaterThan(0);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.bearingDegrees).toBeGreaterThanOrEqual(0);
    expect(result.bearingDegrees).toBeLessThan(360);
    expect(result.cardinalDirection).toBeTruthy();
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

  test('GeoJSON [lng, lat] order is preserved', () => {
    const geom = { type: 'Point', coordinates: [29.9050, -27.7750] };
    const pt = pointFromGeoJSON(geom);
    expect(pt!.lng).toBeCloseTo(29.9050, 4);
    expect(pt!.lat).toBeCloseTo(-27.7750, 4);
    expect(pt!.lng).toBeGreaterThan(0);
    expect(pt!.lat).toBeLessThan(0);
  });

  test('Sanity geopoint discrepancy is evidence for review, not authoritative', () => {
    const sanityGeopoint = { lat: -27.7800, lng: 29.9100 };
    const authoritativePoint = { lat: -27.7750, lng: 29.9050 };
    const discrepancy = haversineMetres(sanityGeopoint, authoritativePoint);
    expect(discrepancy).toBeGreaterThan(0);
  });
});
