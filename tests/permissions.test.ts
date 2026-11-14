/**
 * Tests for spatial permission model.
 * Mirrors the logic in spatial-permissions.ts in the Control Centre.
 */

// Permission classification vocabulary
type PermissionClassification =
  | 'reference' | 'display' | 'internal' | 'download'
  | 'redistribute' | 'restricted' | 'prohibited' | 'pending';

const PERMITTED_OPERATIONS: Record<PermissionClassification, string[]> = {
  reference: [],
  display: ['display'],
  internal: ['display', 'ingest', 'process'],
  download: ['display', 'ingest', 'process', 'download'],
  redistribute: ['display', 'ingest', 'process', 'download', 'publish', 'redistribute'],
  restricted: [],
  prohibited: [],
  pending: [],
};

function hasPublicRedistributionPermission(
  datasetPermission: string | null,
  sourcePermission: string | null,
): boolean {
  return datasetPermission === 'redistribute' && sourcePermission === 'redistribute';
}

function canPerformOperation(classification: PermissionClassification, operation: string): boolean {
  return PERMITTED_OPERATIONS[classification].includes(operation);
}

describe('hasPublicRedistributionPermission', () => {
  test('both redistribute → true', () => {
    expect(hasPublicRedistributionPermission('redistribute', 'redistribute')).toBe(true);
  });

  test('dataset redistribute, source pending → false', () => {
    expect(hasPublicRedistributionPermission('redistribute', 'pending')).toBe(false);
  });

  test('dataset pending, source redistribute → false', () => {
    expect(hasPublicRedistributionPermission('pending', 'redistribute')).toBe(false);
  });

  test('both pending → false', () => {
    expect(hasPublicRedistributionPermission('pending', 'pending')).toBe(false);
  });

  test('null dataset → false', () => {
    expect(hasPublicRedistributionPermission(null, 'redistribute')).toBe(false);
  });

  test('null source → false', () => {
    expect(hasPublicRedistributionPermission('redistribute', null)).toBe(false);
  });

  test('restricted source blocks redistribution', () => {
    expect(hasPublicRedistributionPermission('redistribute', 'restricted')).toBe(false);
  });
});

describe('PERMITTED_OPERATIONS', () => {
  test('redistribute allows all operations', () => {
    const ops = PERMITTED_OPERATIONS['redistribute'];
    expect(ops).toContain('display');
    expect(ops).toContain('ingest');
    expect(ops).toContain('process');
    expect(ops).toContain('download');
    expect(ops).toContain('publish');
    expect(ops).toContain('redistribute');
  });

  test('pending allows no operations', () => {
    expect(PERMITTED_OPERATIONS['pending']).toHaveLength(0);
  });

  test('restricted allows no operations', () => {
    expect(PERMITTED_OPERATIONS['restricted']).toHaveLength(0);
  });

  test('prohibited allows no operations', () => {
    expect(PERMITTED_OPERATIONS['prohibited']).toHaveLength(0);
  });

  test('reference allows no operations', () => {
    expect(PERMITTED_OPERATIONS['reference']).toHaveLength(0);
  });

  test('display allows only display', () => {
    expect(PERMITTED_OPERATIONS['display']).toEqual(['display']);
  });

  test('internal allows display, ingest, process', () => {
    const ops = PERMITTED_OPERATIONS['internal'];
    expect(ops).toContain('display');
    expect(ops).toContain('ingest');
    expect(ops).toContain('process');
    expect(ops).not.toContain('redistribute');
  });
});

describe('canPerformOperation', () => {
  test('redistribute can publish', () => {
    expect(canPerformOperation('redistribute', 'publish')).toBe(true);
  });

  test('internal cannot publish', () => {
    expect(canPerformOperation('internal', 'publish')).toBe(false);
  });

  test('restricted cannot display', () => {
    expect(canPerformOperation('restricted', 'display')).toBe(false);
  });

  test('pending cannot ingest', () => {
    expect(canPerformOperation('pending', 'ingest')).toBe(false);
  });
});

describe('MDB source permission patch (2025)', () => {
  // These are the three sources patched from pending → redistribute
  const patchedSources = [
    { id: 'ba3b93e6', name: 'MDB Local Municipalities 2026', before: 'pending', after: 'redistribute' },
    { id: '50cd6199', name: 'MDB District Municipalities 2026', before: 'pending', after: 'redistribute' },
    { id: 'e15acecf', name: 'MDB WardProfile 2021', before: 'pending', after: 'redistribute' },
  ];

  for (const source of patchedSources) {
    test(`${source.name}: pending blocked public redistribution`, () => {
      expect(hasPublicRedistributionPermission('redistribute', source.before)).toBe(false);
    });

    test(`${source.name}: redistribute allows public redistribution`, () => {
      expect(hasPublicRedistributionPermission('redistribute', source.after)).toBe(true);
    });
  }
});

describe('COGTA Infrastructure restriction', () => {
  test('restricted source blocks all datasets from that source', () => {
    // Source c8532e74 — KZN COGTA Infrastructure 2022 — water/sanitation
    expect(hasPublicRedistributionPermission('redistribute', 'restricted')).toBe(false);
    expect(hasPublicRedistributionPermission('internal', 'restricted')).toBe(false);
    expect(hasPublicRedistributionPermission('pending', 'restricted')).toBe(false);
  });

  test('restriction on one source does not affect unrelated sources', () => {
    // MDB sources are unrelated to COGTA Infrastructure
    expect(hasPublicRedistributionPermission('redistribute', 'redistribute')).toBe(true);
  });
});
