/**
 * Control Centre HTTP client — pure unit tests.
 * Tests URL construction and parameter encoding logic without live calls.
 * No mocks. No live API calls.
 */

import { env } from '../src/lib/env.js';

describe('Control Centre URL construction', () => {
  test('base URL has no trailing slash', () => {
    expect(env.controlCentreUrl).not.toMatch(/\/$/);
  });

  test('base URL is a valid https URL', () => {
    expect(env.controlCentreUrl).toMatch(/^https?:\/\//);
  });

  test('spatial API paths are correctly formed', () => {
    const paths = [
      '/api/spatial/wards',
      '/api/spatial/features',
      '/api/spatial/map-layers',
      '/api/spatial/notice-context',
      '/api/spatial/notice-layers',
      '/api/spatial/ward-profile',
      '/api/spatial/integrity',
      '/api/spatial/probe',
    ];
    for (const path of paths) {
      const url = `${env.controlCentreUrl}${path}`;
      expect(() => new URL(url)).not.toThrow();
    }
  });

  test('feature query parameters are URL-safe', () => {
    const params = new URLSearchParams({
      id: '123e4567-e89b-12d3-a456-426614174000',
      lat: '-27.7569',
      lng: '29.9318',
      radiusMeters: '500',
    });
    const url = `${env.controlCentreUrl}/api/spatial/features?${params}`;
    expect(() => new URL(url)).not.toThrow();
    const parsed = new URL(url);
    expect(parsed.searchParams.get('lat')).toBe('-27.7569');
    expect(parsed.searchParams.get('lng')).toBe('29.9318');
  });

  test('bbox parameter is correctly formatted', () => {
    const bbox = '27.8,-28.9,30.2,-27.2';
    const params = new URLSearchParams({ bbox });
    const url = `${env.controlCentreUrl}/api/spatial/features?${params}`;
    const parsed = new URL(url);
    expect(parsed.searchParams.get('bbox')).toBe(bbox);
  });
});

describe('Governance Node URL construction', () => {
  test('governance node URL has no trailing slash', () => {
    expect(env.governanceNodeUrl).not.toMatch(/\/$/);
  });

  test('intelligence API paths are correctly formed', () => {
    const paths = [
      '/api/intelligence/health',
      '/api/intelligence/spatial',
      '/api/intelligence/notices/summary',
    ];
    for (const path of paths) {
      const url = `${env.governanceNodeUrl}${path}`;
      expect(() => new URL(url)).not.toThrow();
    }
  });
});
