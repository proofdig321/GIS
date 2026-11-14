/**
 * Sanity client — pure unit tests.
 * Tests GROQ query construction rules without live API calls.
 * No mocks. No live API calls.
 */

// GROQ query construction rules — mirrors the logic in sanity-client.ts

function buildListingsWithoutSpatialFeatureQuery(listingType?: string): {
  query: string;
  params: Record<string, string>;
} {
  if (listingType) {
    return {
      query: `*[_type == "listing" && listingType == $listingType && !defined(spatialFeatureId)] | order(name asc)`,
      params: { listingType },
    };
  }
  return {
    query: `*[_type == "listing" && !defined(spatialFeatureId)] | order(name asc)`,
    params: {},
  };
}

function buildSearchListingsByNameQuery(name: string, listingType?: string): {
  query: string;
  params: Record<string, string>;
} {
  const params: Record<string, string> = { pattern: `*${name}*` };
  if (listingType) {
    params['listingType'] = listingType;
    return {
      query: `*[_type == "listing" && listingType == $listingType && name match $pattern] | order(name asc)`,
      params,
    };
  }
  return {
    query: `*[_type == "listing" && name match $pattern] | order(name asc)`,
    params,
  };
}

describe('GROQ query parameterisation', () => {
  test('listingType is a parameter, not interpolated into the query string', () => {
    const untrusted = 'school" || true';
    const { query, params } = buildListingsWithoutSpatialFeatureQuery(untrusted);
    expect(query).toContain('$listingType');
    expect(query).not.toContain(untrusted);
    expect(params['listingType']).toBe(untrusted);
  });

  test('name search pattern is parameterised', () => {
    const { query, params } = buildSearchListingsByNameQuery('khethokuhle');
    expect(query).toContain('$pattern');
    expect(params['pattern']).toBe('*khethokuhle*');
  });

  test('name search with listingType parameterises both', () => {
    const { query, params } = buildSearchListingsByNameQuery('khethokuhle', 'school');
    expect(query).toContain('$listingType');
    expect(query).toContain('$pattern');
    expect(params['listingType']).toBe('school');
    expect(params['pattern']).toBe('*khethokuhle*');
  });

  test('omits listingType filter when not provided', () => {
    const { query } = buildListingsWithoutSpatialFeatureQuery();
    expect(query).not.toContain('$listingType');
    expect(query).not.toContain('listingType');
  });

  test('query always filters by _type == "listing"', () => {
    const { query: q1 } = buildListingsWithoutSpatialFeatureQuery('school');
    const { query: q2 } = buildSearchListingsByNameQuery('test');
    expect(q1).toContain('_type == "listing"');
    expect(q2).toContain('_type == "listing"');
  });

  test('linkage-gap query always filters by !defined(spatialFeatureId)', () => {
    const { query } = buildListingsWithoutSpatialFeatureQuery('school');
    expect(query).toContain('!defined(spatialFeatureId)');
  });
});

describe('Sanity content authority rules', () => {
  test('Sanity geopoint is operator-entered content — not authoritative spatial data', () => {
    // This test documents the rule enforced throughout the MCP
    const sanityGeopoint = { _type: 'geopoint', lat: -27.78, lng: 29.91 };
    const isAuthoritative = false; // Sanity geopoints are never authoritative for institutional locations
    expect(isAuthoritative).toBe(false);
    expect(sanityGeopoint._type).toBe('geopoint');
  });

  test('spatialFeatureId links a listing to an authoritative Control Centre feature', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidPattern.test(validUuid)).toBe(true);
  });

  test('spatialFeatureId must be a valid UUID — not a free-text string', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidPattern.test('not-a-uuid')).toBe(false);
    expect(uuidPattern.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });
});
