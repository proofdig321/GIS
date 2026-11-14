/**
 * Feature search — pure unit tests.
 * Tests name matching, distance sorting, and coordinate extraction logic.
 * No mocks. No live API calls.
 */

import {
  haversineMetres,
  pointFromGeoJSON,
  centroidFromPolygon,
} from '../src/lib/geodesic.js';

// Simulate the name-matching logic used in searchFeaturesByName
function matchByName(
  features: Array<{ properties: Record<string, unknown> }>,
  nameProperty: string,
  searchTerm: string,
): typeof features {
  const term = searchTerm.toLowerCase();
  return features.filter(f => {
    const val = f.properties[nameProperty];
    return typeof val === 'string' && val.toLowerCase().includes(term);
  });
}

// Simulate distance sorting used in getFeaturesNearPoint
function sortByDistance(
  features: Array<{ id: string; geometry: unknown }>,
  origin: { lat: number; lng: number },
): Array<{ id: string; dist: number }> {
  return features
    .map(f => {
      const pt = pointFromGeoJSON(f.geometry) ?? centroidFromPolygon(f.geometry);
      const dist = pt ? haversineMetres(origin, pt) : Infinity;
      return { id: f.id, dist };
    })
    .sort((a, b) => a.dist - b.dist);
}

const NEWCASTLE_CBD = { lat: -27.7569, lng: 29.9318 };

describe('name matching logic', () => {
  const features = [
    { properties: { name: 'Khethokuhle Primary School' } },
    { properties: { name: 'Newcastle High School' } },
    { properties: { name: 'Mndozo Clinic' } },
    { properties: { name: 'KHETHOKUHLE SECONDARY' } },
  ];

  test('matches partial name case-insensitively', () => {
    const results = matchByName(features, 'name', 'khethokuhle');
    expect(results).toHaveLength(2);
  });

  test('matches school substring', () => {
    const results = matchByName(features, 'name', 'school');
    expect(results).toHaveLength(2);
  });

  test('returns empty array when no match', () => {
    const results = matchByName(features, 'name', 'hospital');
    expect(results).toHaveLength(0);
  });

  test('does not match on wrong property key', () => {
    const results = matchByName(features, 'SCHOOL_NAME', 'khethokuhle');
    expect(results).toHaveLength(0);
  });

  test('skips non-string property values', () => {
    const mixed = [
      { properties: { name: 42 } },
      { properties: { name: null } },
      { properties: { name: 'Khethokuhle Primary' } },
    ];
    const results = matchByName(mixed, 'name', 'khethokuhle');
    expect(results).toHaveLength(1);
  });
});

describe('distance sorting logic', () => {
  const features = [
    {
      id: 'far',
      geometry: { type: 'Point', coordinates: [29.9500, -27.7400] }, // ~2km from CBD
    },
    {
      id: 'near',
      geometry: { type: 'Point', coordinates: [29.9320, -27.7580] }, // ~100m from CBD
    },
    {
      id: 'medium',
      geometry: { type: 'Point', coordinates: [29.9380, -27.7600] }, // ~600m from CBD
    },
  ];

  test('sorts features nearest first', () => {
    const sorted = sortByDistance(features, NEWCASTLE_CBD);
    expect(sorted[0]!.id).toBe('near');
    expect(sorted[sorted.length - 1]!.id).toBe('far');
  });

  test('all distances are positive', () => {
    const sorted = sortByDistance(features, NEWCASTLE_CBD);
    for (const item of sorted) {
      expect(item.dist).toBeGreaterThan(0);
    }
  });

  test('distances increase monotonically after sorting', () => {
    const sorted = sortByDistance(features, NEWCASTLE_CBD);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.dist).toBeGreaterThanOrEqual(sorted[i - 1]!.dist);
    }
  });

  test('feature with no extractable point gets Infinity distance', () => {
    const withBadGeom = [{ id: 'bad', geometry: { type: 'Unknown' } }];
    const sorted = sortByDistance(withBadGeom, NEWCASTLE_CBD);
    expect(sorted[0]!.dist).toBe(Infinity);
  });
});

describe('coordinate extraction from dataset features', () => {
  test('Point geometry returns correct lat/lng', () => {
    const geom = { type: 'Point', coordinates: [29.9050, -27.7750] };
    const pt = pointFromGeoJSON(geom);
    expect(pt).not.toBeNull();
    expect(pt!.lat).toBeCloseTo(-27.7750, 4);
    expect(pt!.lng).toBeCloseTo(29.9050, 4);
  });

  test('Polygon geometry returns approximate centroid', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [[
        [29.90, -27.78],
        [29.92, -27.78],
        [29.92, -27.76],
        [29.90, -27.76],
        [29.90, -27.78],
      ]],
    };
    const centroid = centroidFromPolygon(geom);
    expect(centroid).not.toBeNull();
    expect(centroid!.lat).toBeCloseTo(-27.77, 1);
    expect(centroid!.lng).toBeCloseTo(29.91, 1);
  });

  test('invalid geometry returns null', () => {
    expect(pointFromGeoJSON(null)).toBeNull();
    expect(pointFromGeoJSON({ type: 'Unknown' })).toBeNull();
    expect(centroidFromPolygon({ type: 'Point', coordinates: [29.93, -27.75] })).toBeNull();
  });
});
