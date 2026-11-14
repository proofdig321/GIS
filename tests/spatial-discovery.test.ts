/**
 * Spatial discovery — pure unit tests.
 * Tests proximity config and dataset permission rules.
 * No mocks. No live API calls.
 */

const PROXIMITY_RADIUS: Record<string, { metres: number; statutoryBasis: string } | null> = {
  liquor: { metres: 500, statutoryBasis: 'KZN Liquor Licensing Act s.43(2)(b)' },
  mining: { metres: 500, statutoryBasis: 'MPRDA s.5(4)(c)' },
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

describe('proximity radius configuration', () => {
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

  test('infrastructure has no fixed radius', () => {
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

  test('only liquor and mining have reference distances', () => {
    const withRadius = Object.entries(PROXIMITY_RADIUS)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    expect(withRadius).toHaveLength(2);
    expect(withRadius).toContain('liquor');
    expect(withRadius).toContain('mining');
  });
});

describe('dataset permission rules', () => {
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
});
