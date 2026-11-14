/**
 * Control Centre API client for the Umkhandlu GIS MCP.
 *
 * Calls the live Control Centre spatial APIs.
 * Public endpoints need no auth.
 * Operator endpoints require UMKHANDLU_OPERATOR_TOKEN.
 *
 * All functions return typed results — never throw on API errors,
 * always return { ok: false, error } so callers can surface clean messages.
 */

import { env } from './env.js';

const TIMEOUT_MS = 20_000;

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function get<T>(
  path: string,
  params?: Record<string, string>,
  token?: string,
): Promise<ApiResult<T>> {
  const url = new URL(`${env.controlCentreUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = { 'User-Agent': 'UmkhandluGIS-MCP/1.0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, status: res.status };
    }
    const data = await res.json() as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Public spatial API types ──────────────────────────────────────────────────

export interface WardFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: {
    WardNo?: number;
    CAT_B?: string;
    WardID?: string;
    Municipality?: string;
    Province?: string;
    [key: string]: unknown;
  };
}

export interface WardCollection {
  type: 'FeatureCollection';
  features: WardFeature[];
  meta: {
    source: string;
    dataset: string;
    datasetDate: string | null;
    attribution: string;
    count: number;
  };
}

export interface SpatialFeature {
  type: 'Feature';
  id: string;
  geometry: { type: string; coordinates?: unknown; geometries?: unknown };
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: SpatialFeature[];
  meta: {
    datasetId: string;
    datasetName: string;
    attribution: string | null;
    sourceId: string | null;
    sourceName: string | null;
    sourceInstitution: string | null;
    datasetDate: string | null;
    publishedAt: string | null;
    total: number | null;
    offset: number;
    limit: number;
    returned: number;
    radiusMeters: number | null;
    bounds: unknown;
    filtered: boolean;
    complete: boolean;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export interface MapLayer {
  id: string;
  datasetId: string;
  status: 'available' | 'empty';
  label: string;
  colour: string;
  weight: number;
  fillOpacity: number;
  attribution: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceInstitution: string | null;
  publishedAt: string | null;
  datasetDate: string | null;
  featureCount: number | null;
  returnedCount: number;
  loadOnDemand: boolean;
  truncated: boolean;
  radiusKm: number | null;
  radiusFiltered: boolean;
  features: SpatialFeature[];
}

export interface MapLayersResponse {
  layers: MapLayer[];
  filterLat: number | null;
  filterLng: number | null;
  filterBounds: { west: number; south: number; east: number; north: number } | null;
  permissionFiltered: boolean;
  permissionRequiredDatasetIds?: string[];
  generatedAt: string;
}

export interface PublishedSpatialFeature extends SpatialFeature {
  meta: {
    source: string;
    featureId: string;
    datasetId: string;
    dataset: string;
    sourceId: string | null;
    sourceName: string | null;
    sourceInstitution: string | null;
    attribution: string | null;
    datasetDate: string | null;
    publishedAt: string | null;
  };
}

export interface NoticeContextResponse {
  noticeType: string;
  wardNumber: number | null;
  catB: string | null;
  lat: number | null;
  lng: number | null;
  locationPrecision: string | null;
  administrative: {
    ward: DatasetResult;
    municipality: DatasetResult;
    district: DatasetResult;
  };
  wardDemographics: Record<string, unknown> | null;
  proximity: Record<string, DatasetResult>;
  siteContext: Record<string, DatasetResult>;
  proximityRadiusMetres: number | null;
  proximityRadiusNote: string | null;
  generatedAt: string;
  disclaimer: string;
}

export interface DatasetResult {
  status: 'found' | 'not-found' | 'unavailable' | 'pending-permission' | 'not-applicable';
  datasetName: string | null;
  attribution: string | null;
  datasetDate: string | null;
  featureCount: number;
  features: SpatialFeature[];
  note: string | null;
}

export interface NoticeLayersResponse {
  noticeType: string;
  wardNumber: number | null;
  catB: string | null;
  proximityRadius: { metres: number; statutoryBasis: string; caveat: string | null } | null;
  layers: NoticeLayer[];
  summary: { total: number; available: number; pending: number; unavailable: number; withFeatures: number };
  generatedAt: string;
  disclaimer: string;
}

export interface NoticeLayer {
  id: string;
  label: string;
  role: string;
  geometryType: string;
  sourceOrg: string;
  sourceDataset: string | null;
  availability: 'available' | 'pending-permission' | 'not-available';
  permissionNote: string | null;
  attribution: string | null;
  statutoryRelevance: string;
  featureCount?: number | null;
  features?: unknown;
}

export interface IntegrityReport {
  generatedAt: string;
  summary: {
    sources: number;
    datasets: number;
    publishedDatasets: number;
    stagedDatasets: number;
    archivedDatasets: number;
    totalFeatures: number;
    approvedFeatures: number;
    pendingFeatures: number;
    rejectedFeatures: number;
    pipelineRuns: number;
    auditRecords: number;
    orphanSources: number;
  };
  integrity: { errors: number; warnings: number; status: 'ok' | 'warning' | 'error' };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    datasetId?: string;
    sourceId?: string;
  }>;
  geographicVerification: {
    districtCode: string;
    municipalities: Array<{ code: string; name: string }>;
    wards2026: number;
    wardProfiles2021: number;
    unmatchedWards: string[];
    unmatchedNote: string;
  };
}

export interface WardProfileResponse {
  datasetName: string;
  attribution: string;
  datasetDate: string;
  wardCount: number;
  wards: Array<Record<string, unknown>>;
}

// ── API call functions ────────────────────────────────────────────────────────

export async function fetchWards(): Promise<ApiResult<WardCollection>> {
  return get<WardCollection>('/api/spatial/wards');
}

export async function fetchFeatures(
  datasetId: string,
  opts: { lat?: number; lng?: number; radiusMeters?: number; bbox?: string; limit?: number; offset?: number } = {},
): Promise<ApiResult<FeatureCollection>> {
  const params: Record<string, string> = { id: datasetId };
  if (opts.lat !== undefined) params['lat'] = String(opts.lat);
  if (opts.lng !== undefined) params['lng'] = String(opts.lng);
  if (opts.radiusMeters !== undefined) params['radiusMeters'] = String(opts.radiusMeters);
  if (opts.bbox) params['bbox'] = opts.bbox;
  if (opts.limit !== undefined) params['limit'] = String(opts.limit);
  if (opts.offset !== undefined) params['offset'] = String(opts.offset);
  return get<FeatureCollection>('/api/spatial/features', params);
}

export async function fetchPublishedFeatureById(
  datasetId: string,
  featureId: string,
): Promise<ApiResult<PublishedSpatialFeature>> {
  const result = await get<PublishedSpatialFeature>(
    `/api/spatial/features/${encodeURIComponent(featureId)}`,
  );
  if (!result.ok) return result;
  if (result.data.meta?.datasetId !== datasetId) {
    return {
      ok: false,
      error: `Feature ${featureId} does not belong to requested dataset ${datasetId}.`,
    };
  }
  return result;
}

export async function fetchMapLayers(
  opts: { bbox?: string; lat?: number; lng?: number; radiusMetres?: number } = {},
): Promise<ApiResult<MapLayersResponse>> {
  const params: Record<string, string> = {};
  if (opts.bbox) params['bbox'] = opts.bbox;
  if (opts.lat !== undefined) params['lat'] = String(opts.lat);
  if (opts.lng !== undefined) params['lng'] = String(opts.lng);
  if (opts.radiusMetres !== undefined) params['radiusMetres'] = String(opts.radiusMetres);
  return get<MapLayersResponse>('/api/spatial/map-layers', params);
}

export async function fetchNoticeContext(opts: {
  noticeType?: string;
  wardNumber?: number;
  catB?: string;
  lat?: number;
  lng?: number;
  locationPrecision?: string;
}): Promise<ApiResult<NoticeContextResponse>> {
  const params: Record<string, string> = {};
  if (opts.noticeType) params['noticeType'] = opts.noticeType;
  if (opts.wardNumber !== undefined) params['wardNumber'] = String(opts.wardNumber);
  if (opts.catB) params['catB'] = opts.catB;
  if (opts.lat !== undefined) params['lat'] = String(opts.lat);
  if (opts.lng !== undefined) params['lng'] = String(opts.lng);
  if (opts.locationPrecision) params['locationPrecision'] = opts.locationPrecision;
  return get<NoticeContextResponse>('/api/spatial/notice-context', params);
}

export async function fetchNoticeLayers(opts: {
  noticeType?: string;
  wardNumber?: number;
  catB?: string;
  features?: boolean;
}): Promise<ApiResult<NoticeLayersResponse>> {
  const params: Record<string, string> = {};
  if (opts.noticeType) params['noticeType'] = opts.noticeType;
  if (opts.wardNumber !== undefined) params['wardNumber'] = String(opts.wardNumber);
  if (opts.catB) params['catB'] = opts.catB;
  if (opts.features !== undefined) params['features'] = String(opts.features);
  return get<NoticeLayersResponse>('/api/spatial/notice-layers', params);
}

export async function fetchWardProfile(opts: {
  catB?: string;
  wardNo?: number;
}): Promise<ApiResult<WardProfileResponse>> {
  const params: Record<string, string> = {};
  if (opts.catB) params['catB'] = opts.catB;
  if (opts.wardNo !== undefined) params['wardNo'] = String(opts.wardNo);
  return get<WardProfileResponse>('/api/spatial/ward-profile', params);
}

export async function fetchIntegrityReport(token: string): Promise<ApiResult<IntegrityReport>> {
  return get<IntegrityReport>('/api/spatial/integrity', undefined, token);
}

export async function probeSource(
  url: string,
  type: string,
  token: string,
): Promise<ApiResult<{ reachable: boolean; responseMs: number; layerCount?: number; sampleFeatureCount?: number; error?: string }>> {
  return get('/api/spatial/probe', { url, type }, token);
}
