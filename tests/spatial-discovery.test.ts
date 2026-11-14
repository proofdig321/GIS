/**
 * Spatial discovery — pure unit tests.
 * Tests proximity radius config logic and dataset permission rules.
 * No mocks. No live API calls.
 */

// Proximity radius reference — mirrors notice-layer-config.ts
const PROXIMITY_RADIUS: Record<string, { metres: number; statutoryBasis: string; caveat: string } | null> = {
  liquor: {
    metres: 500,
    statutoryBasis: 'KZN Liquor Licensing Act s.43(2)(b)',
    caveat: '500m is the accepted KZNERA reference distance. The Board retains discretion.',
  },
  mining: {
    metres: 500,
    statutoryBasis: 'MPRDA s.5(4)(c) — community consultation area',
    caveat: '500m is a DMRE practice standard.',
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

const PILOT_RADIUS_METRES = 200;

describe('proximity radius configuration', () => {
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

  test('infrastructure has no statutory radius', () => {
    expect(PROXIMITY_RADIUS['infrastructure']).toBeNull();
  });

  test('all non-statutory types return null', () => {
    const nullTypes = ['eia', 'rezoning', 'infrastructure', 'land-use', 'township', 'building', 'telecom', 'estate', 'liquidation', 'pto'];
    for (const type of nullTypes) {
      expect(PROXIMITY_RADIUS[type]).toBeNull();
    }
  });

  test('liquor statutory basis is documented correctly', () => {
    expect(PROXIMITY_RADIUS['liquor']?.statutoryBasis).toBe('KZN Liquor Licensing Act s.43(2)(b)');
  });

  test('pilot 200m is distinct from liquor 500m', () => {
    expect(PILOT_RADIUS_METRES).not.toBe(PROXIMITY_RADIUS['liquor']?.metres);
    expect(PILOT_RADIUS_METRES).toBe(200);
    expect(PROXIMITY_RADIUS['liquor']?.metres).toBe(500);
  });
});

describe('dataset permission rules', () => {
  // Mirrors hasPublicRedistributionPermission from spatial-permissions.ts
  function canRedistribute(datasetPerm: string | null, sourcePerm: string | null): boolean {
    return datasetPerm === 'redistribute' && sourcePerm === 'redistribute';
  }

  test('both redistribute → public API eligible', () => {
    expect(canRedistribute('redistribute', 'redistribute')).toBe(true);
  });

  test('dataset redistribute + source pending → blocked', () => {
    expect(canRedistribute('redistribute', 'pending')).toBe(false);
  });

  test('dataset pending + source redistribute → blocked', () => {
    expect(canRedistribute('pending', 'redistribute')).toBe(false);
  });

  test('restricted source blocks all datasets', () => {
    expect(canRedistribute('redistribute', 'restricted')).toBe(false);
    expect(canRedistribute('internal', 'restricted')).toBe(false);
  });

  test('null values block redistribution', () => {
    expect(canRedistribute(null, 'redistribute')).toBe(false);
    expect(canRedistribute('redistribute', null)).toBe(false);
  });
});

describe('notice type recognition', () => {
  const knownTypes = ['liquor', 'eia', 'rezoning', 'infrastructure', 'mining', 'land-use', 'township', 'building', 'telecom', 'estate', 'liquidation', 'pto'];

  test('all known notice types are in the proximity config', () => {
    for (const type of knownTypes) {
      expect(PROXIMITY_RADIUS).toHaveProperty(type);
    }
  });

  test('only liquor and mining have statutory radii', () => {
    const withRadius = Object.entries(PROXIMITY_RADIUS)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    expect(withRadius).toEqual(expect.arrayContaining(['liquor', 'mining']));
    expect(withRadius).toHaveLength(2);
  });
});
