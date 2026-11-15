/**
 * Tool group E — Notice and commercial intelligence.
 *
 * Analyse development notices against nearby institutions.
 * Amajuba District-wide spatial pilot with optional ward-level analysis.
 *
 * All analysis is evidence for operator review.
 * No legal or statutory determinations are made here.
 */

import { z } from 'zod';
import {
  fetchNoticeBySlug,
  fetchNoticeById,
  fetchAllNotices,
} from '../lib/sanity-client.js';
import {
  fetchNoticeContext,
  fetchNoticeLayers,
  fetchFeatures,
  fetchMapLayers,
  fetchPublishedFeatureById,
  fetchWards,
  type FeatureCollection,
  type MapLayersResponse,
  type SpatialFeature,
  type WardFeature,
} from '../lib/cc-client.js';
import { fetchListingById } from '../lib/sanity-client.js';
import {
  geodesicResult,
  pointFromGeoJSON,
  centroidFromPolygon,
  haversineMetres,
  coordinatePrecisionNote,
  pointInPolygon,
} from '../lib/geodesic.js';

// ── Tool: analyse_notice_spatial_context ──────────────────────────────────────

export const analyseNoticeSpatialContextSchema = z.object({
  identifier: z.string().describe(
    'Notice slug or Sanity document ID.'
  ),
  includeProximityLayers: z.boolean().default(true).describe(
    'Include proximity layer availability in the report.'
  ),
});

export async function analyseNoticeSpatialContext(
  input: z.infer<typeof analyseNoticeSpatialContextSchema>
): Promise<string> {
  const isId = input.identifier.startsWith('draft.') || /^[a-z0-9]{20,}$/.test(input.identifier);
  const notice = isId
    ? await fetchNoticeById(input.identifier)
    : await fetchNoticeBySlug(input.identifier);

  if (!notice) {
    return `No development notice found for: ${input.identifier}`;
  }

  const lines: string[] = [
    `Notice spatial context: ${notice.title}`,
    `Type: ${notice.noticeType} | Status: ${notice.status}`,
    `Applicant: ${notice.applicant}`,
    `Location: ${notice.location}`,
    '',
  ];

  // Coordinate provenance
  lines.push('── Coordinate provenance ──');
  if (notice.geopoint) {
    lines.push(`Geopoint: lat=${notice.geopoint.lat}, lng=${notice.geopoint.lng}`);
    lines.push(`Precision declared: ${notice.locationPrecision ?? 'not specified'}`);
    lines.push(`Coordinate precision: ${coordinatePrecisionNote(notice.geopoint.lat, notice.geopoint.lng)}`);
    lines.push('Source: Sanity geopoint — operator-entered. Not independently verified.');
    lines.push('');
    lines.push(
      'RULE: Development notice coordinates retain their own provenance. ' +
      'Do not move a notice to an institution\'s coordinates or use an institution\'s ' +
      'approximate location to manufacture a proximity result.'
    );
  } else {
    lines.push('No geopoint set on this notice.');
    lines.push('Proximity analysis requires a coordinate. Set geopoint in Sanity Studio.');
  }

  // Administrative context from Control Centre
  if (notice.geopoint) {
    lines.push('');
    lines.push('── Administrative context (from Control Centre) ──');
    const wardNumber = notice.relatedArea?.wardNumber ?? undefined;
    const catB = notice.relatedArea?.municipality
      ? municipalityToCatB(notice.relatedArea.municipality)
      : undefined;

    const ctxResult = await fetchNoticeContext({
      lat: notice.geopoint.lat,
      lng: notice.geopoint.lng,
      noticeType: notice.noticeType,
      wardNumber,
      catB,
      locationPrecision: notice.locationPrecision ?? undefined,
    });

    if (ctxResult.ok) {
      const ctx = ctxResult.data;
      lines.push(`Ward: ${ctx.administrative.ward.status} — ${ctx.administrative.ward.datasetName ?? 'n/a'} (${ctx.administrative.ward.featureCount} features)`);
      lines.push(`Municipality: ${ctx.administrative.municipality.status} — ${ctx.administrative.municipality.datasetName ?? 'n/a'}`);
      lines.push(`District: ${ctx.administrative.district.status} — ${ctx.administrative.district.datasetName ?? 'n/a'}`);
      if (ctx.wardDemographics) {
        const d = ctx.wardDemographics as Record<string, unknown>;
        lines.push(`Ward demographics: ${d['Ward_Label']} — pop. ${d['Total_Pop']}`);
      }
      if (ctx.proximityRadiusMetres) {
        lines.push('');
        lines.push(`Control Centre notice-type reference distance (${notice.noticeType}): ${ctx.proximityRadiusMetres}m`);
        if (ctx.proximityRadiusNote) lines.push(`Note: ${ctx.proximityRadiusNote}`);
      }
    } else {
      lines.push(`Could not fetch administrative context: ${ctxResult.error}`);
    }
  }

  // Proximity layers
  if (input.includeProximityLayers) {
    lines.push('');
    lines.push('── Proximity layers ──');
    const wardNumber = notice.relatedArea?.wardNumber ?? undefined;
    const catB = notice.relatedArea?.municipality
      ? municipalityToCatB(notice.relatedArea.municipality)
      : undefined;

    const layersResult = await fetchNoticeLayers({
      noticeType: notice.noticeType,
      wardNumber,
      catB,
      features: false,
    });

    if (layersResult.ok) {
      const { layers, summary } = layersResult.data;
      lines.push(`${summary.total} layers — ${summary.available} available, ${summary.pending} pending permission, ${summary.unavailable} not available`);
      for (const layer of layers) {
        const status = layer.availability === 'available' ? '✓' :
          layer.availability === 'pending-permission' ? '⏳' : '✗';
        lines.push(`  ${status} ${layer.label} (${layer.role})`);
        if (layer.permissionNote) lines.push(`    Note: ${layer.permissionNote}`);
      }
    } else {
      lines.push(`Could not fetch proximity layers: ${layersResult.error}`);
    }
  }

  lines.push('');
  lines.push(
    'DISCLAIMER: This analysis is for operator reference only. ' +
    'Proximity measurements are not proof of legal compliance or non-compliance.'
  );

  return lines.join('\n');
}

// ── Tool: find_institutions_near_notice ───────────────────────────────────────

export const findInstitutionsNearNoticeSchema = z.object({
  identifier: z.string().describe('Notice slug or Sanity document ID.'),
  institutionDatasetId: z.string().uuid().describe(
    'UUID of the institution dataset to search (e.g. HOT OSM Education, Giga Schools).'
  ),
  institutionDatasetName: z.string().describe(
    'Human name of the dataset (for provenance reporting).'
  ),
  radiusMeters: z.number().positive().max(5000).default(500).describe(
    'Search radius in metres. Default 500m is a search convenience, not a universal or statutory buffer. ' +
    'Use the notice-type reference distance from get_proximity_radius_config as a guide.'
  ),
  nameProperty: z.string().default('name').describe(
    'Property key containing the institution name in the dataset.'
  ),
});

export async function findInstitutionsNearNotice(
  input: z.infer<typeof findInstitutionsNearNoticeSchema>
): Promise<string> {
  const isId = input.identifier.startsWith('draft.') || /^[a-z0-9]{20,}$/.test(input.identifier);
  const notice = isId
    ? await fetchNoticeById(input.identifier)
    : await fetchNoticeBySlug(input.identifier);

  if (!notice) return `No notice found for: ${input.identifier}`;
  if (!notice.geopoint) {
    return `Notice "${notice.title}" has no geopoint. Set a coordinate in Sanity Studio first.`;
  }

  const { lat, lng } = notice.geopoint;
  const result = await fetchFeatures(input.institutionDatasetId, {
    lat,
    lng,
    radiusMeters: input.radiusMeters,
    limit: 100,
  });

  if (!result.ok) return `Error fetching institutions: ${result.error}`;
  const { features, meta } = result.data;

  const origin = { lat, lng };
  const withDist = features
    .map(f => {
      const pt = pointFromGeoJSON(f.geometry) ?? centroidFromPolygon(f.geometry);
      const dist = pt ? haversineMetres(origin, pt) : null;
      return { f, dist, pt };
    })
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  const lines: string[] = [
    `Institutions near notice: ${notice.title}`,
    `Notice location: lat=${lat}, lng=${lng} (${notice.locationPrecision ?? 'precision not specified'})`,
    `Search radius: ${input.radiusMeters}m`,
    `Dataset: ${input.institutionDatasetName} (${meta.datasetName})`,
    `Attribution: ${meta.attribution ?? 'unknown'}`,
    `Found: ${features.length} institution(s)`,
    '',
  ];

  if (features.length === 0) {
    lines.push(`No institutions found within ${input.radiusMeters}m.`);
    lines.push('This does not mean no institutions exist — dataset coverage may be incomplete.');
    return lines.join('\n');
  }

  for (const { f, dist, pt } of withDist) {
    const name = f.properties[input.nameProperty] ?? f.properties['NAME'] ?? f.properties['name'] ?? 'unnamed';
    lines.push(`${name}`);
    lines.push(`  Feature ID: ${f.id}`);
    if (dist !== null) lines.push(`  Distance from notice: ${Math.round(dist)}m`);
    if (pt) lines.push(`  Location: lat=${pt.lat.toFixed(6)}, lng=${pt.lng.toFixed(6)}`);
    const otherProps = Object.entries(f.properties)
      .filter(([k]) => !['name', 'NAME', input.nameProperty].includes(k))
      .slice(0, 6)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    if (otherProps) lines.push(otherProps);
    lines.push('');
  }

  lines.push(
    'DISCLAIMER: Proximity to institutions is evidence for operator review. ' +
    'It is not a legal determination of statutory compliance.'
  );

  return lines.join('\n');
}

// ── Tool: analyse_amajuba_spatial_pilot ──────────────────────────────────────

export const analyseAmajubaSpatialPilotInputShape = {
  datasetId: z.string().uuid().optional().describe(
    'Dataset UUID returned by list_spatial_datasets or this workflow. Omit to discover datasets.'
  ),
  featureId: z.string().min(1).optional().describe(
    'Exact feature ID within datasetId. Retrieval uses the existing dataset features API and exact ID matching.'
  ),
  searchTerm: z.string().min(1).optional().describe(
    'Optional text to discover candidate institutional features in the selected dataset. Text matches are leads, not verified identity.'
  ),
  nameProperty: z.string().default('name').describe(
    'Feature property to inspect for searchTerm (for example name, NAME, or SCHOOL_NAME).'
  ),
  wardNumber: z.number().int().positive().optional().describe(
    'Optional Amajuba ward test area. Requires municipalityCode; omit for district-wide scope.'
  ),
  municipalityCode: z.enum(['KZN252', 'KZN253', 'KZN254']).optional().describe(
    'Amajuba municipality code for ward selection: Newcastle, eMadlangeni, or Dannhauser.'
  ),
  sanityListingId: z.string().optional().describe(
    'Optional Sanity listing document ID for a read-only coordinate comparison; this does not establish feature identity.'
  ),
  maxFeatures: z.number().int().positive().max(100).default(20).describe(
    'Maximum candidate features to include in the report.'
  ),
};

export const analyseAmajubaSpatialPilotSchema = z.object(analyseAmajubaSpatialPilotInputShape).refine(
  input => !input.featureId || Boolean(input.datasetId),
  { message: 'datasetId is required when featureId is supplied.', path: ['datasetId'] }
).refine(
  input => (input.wardNumber === undefined) === (input.municipalityCode === undefined),
  { message: 'wardNumber and municipalityCode must be supplied together.' }
);

const MAX_BBOX_SPAN_DEGREES = 1.99;
const FEATURE_PAGE_SIZE = 500;

interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function coordinateBounds(wards: WardFeature[]): Bounds | null {
  const bounds: Bounds = {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity,
  };
  let found = false;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number' &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      bounds.west = Math.min(bounds.west, value[0]);
      bounds.east = Math.max(bounds.east, value[0]);
      bounds.south = Math.min(bounds.south, value[1]);
      bounds.north = Math.max(bounds.north, value[1]);
      found = true;
      return;
    }
    for (const child of value) visit(child);
  };
  for (const ward of wards) visit(ward.geometry.coordinates);
  return found ? bounds : null;
}

function boundsTiles(bounds: Bounds): Bounds[] {
  const tiles: Bounds[] = [];
  for (let west = bounds.west; west < bounds.east; west += MAX_BBOX_SPAN_DEGREES) {
    const east = Math.min(west + MAX_BBOX_SPAN_DEGREES, bounds.east);
    for (let south = bounds.south; south < bounds.north; south += MAX_BBOX_SPAN_DEGREES) {
      const north = Math.min(south + MAX_BBOX_SPAN_DEGREES, bounds.north);
      tiles.push({ west, south, east, north });
    }
  }
  if (tiles.length === 0) tiles.push(bounds);
  return tiles;
}

function pointInAmajuba(point: { lat: number; lng: number }, wards: WardFeature[]): boolean {
  return containingWards(point, wards).length > 0;
}

function containingWards(point: { lat: number; lng: number }, wards: WardFeature[]): WardFeature[] {
  return wards.filter(ward => {
    const geometry = ward.geometry as { type: string; coordinates: unknown };
    if (geometry.type === 'Polygon') return pointInPolygon(point, geometry);
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.some(coordinates =>
        pointInPolygon(point, { type: 'Polygon', coordinates })
      );
    }
    return false;
  });
}

function pointForFeature(feature: SpatialFeature): {
  point: { lat: number; lng: number } | null;
  method: 'Point geometry' | 'Polygon centroid (approximate)' | 'MultiPolygon centroid (approximate)' | 'unavailable';
} {
  const point = pointFromGeoJSON(feature.geometry);
  if (point) return { point, method: 'Point geometry' };
  const centroid = centroidFromPolygon(feature.geometry);
  if (centroid) return { point: centroid, method: 'Polygon centroid (approximate)' };
  if (
    feature.geometry.type === 'MultiPolygon' &&
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length > 0
  ) {
    const firstPolygonCentroid = centroidFromPolygon({
      type: 'Polygon',
      coordinates: feature.geometry.coordinates[0],
    });
    if (firstPolygonCentroid) {
      return { point: firstPolygonCentroid, method: 'MultiPolygon centroid (approximate)' };
    }
  }
  return { point: null, method: 'unavailable' };
}

function matchWard(
  ward: WardFeature,
  wardNumber?: number,
  municipalityCode?: string
): boolean {
  return wardNumber === undefined ||
    (ward.properties.WardNo === wardNumber && ward.properties.CAT_B === municipalityCode);
}

function datasetMetadata(catalog: MapLayersResponse): string[] {
  return catalog.layers.map(item => [
    `- ${item.label}`,
    `  Dataset ID: ${item.datasetId}`,
    `  Source identity: ${item.sourceName ?? 'not provided'}; institution: ${item.sourceInstitution ?? 'not provided'}; source ID: ${item.sourceId ?? 'not provided'}`,
    '  Permission: included by the public endpoint after source and dataset redistribution checks; exact classifications are not exposed',
    `  Attribution: ${item.attribution ?? 'not provided'}`,
    `  Vintage: ${item.datasetDate ?? 'not provided'}; published: ${item.publishedAt ?? 'not provided'}; feature count: ${item.featureCount ?? 'not provided'}`,
  ].join('\n'));
}

function metadataValue(value: string | null | undefined): string {
  return value === undefined
    ? 'not returned by the Control Centre'
    : value ?? 'not provided';
}

async function fetchDistrictFeatures(
  datasetId: string,
  wards: WardFeature[],
): Promise<{
  features: SpatialFeature[];
  metadata: FeatureCollection;
  complete: boolean;
  queryFeatureCount: number;
} | { error: string }> {
  const bounds = coordinateBounds(wards);
  if (!bounds) return { error: 'Could not derive an Amajuba search extent from the published ward geometries.' };

  const byId = new Map<string, SpatialFeature>();
  let lastMetadata: FeatureCollection | undefined;
  let complete = true;
  for (const tile of boundsTiles(bounds)) {
    const bbox = `${tile.west},${tile.south},${tile.east},${tile.north}`;
    let offset = 0;
    let tileComplete = false;
    for (let page = 0; page < 41; page++) {
      const result = await fetchFeatures(datasetId, {
        bbox,
        limit: FEATURE_PAGE_SIZE,
        offset,
      });
      if (!result.ok) return { error: `Feature retrieval failed for bbox ${bbox}: ${result.error}` };
      lastMetadata = result.data;
      if (result.data.meta.datasetId !== datasetId || result.data.meta.offset !== offset) {
        return { error: 'Control Centre returned a mismatched dataset identity or page offset.' };
      }
      for (const feature of result.data.features) byId.set(feature.id, feature);
      if (!result.data.meta.hasMore) {
        tileComplete = result.data.meta.complete;
        break;
      }
      if (result.data.meta.nextOffset === null || result.data.meta.nextOffset <= offset) {
        tileComplete = false;
        break;
      }
      offset = result.data.meta.nextOffset;
    }
    if (!tileComplete) complete = false;
  }
  if (!lastMetadata) return { error: 'No district feature query was made.' };
  const features = [...byId.values()].filter(feature => {
    const { point } = pointForFeature(feature);
    return point !== null && pointInAmajuba(point, wards);
  });
  return {
    features,
    metadata: lastMetadata,
    complete,
    queryFeatureCount: byId.size,
  };
}

export async function analyseAmajubaSpatialPilot(
  input: z.infer<typeof analyseAmajubaSpatialPilotSchema>
): Promise<string> {
  if (input.featureId && !input.datasetId) {
    return 'datasetId is required when featureId is supplied.';
  }
  if ((input.wardNumber === undefined) !== (input.municipalityCode === undefined)) {
    return 'wardNumber and municipalityCode must be supplied together.';
  }
  const catalogResult = await fetchMapLayers();
  if (!catalogResult.ok) return `Could not discover Control Centre spatial datasets: ${catalogResult.error}`;

  const catalog = catalogResult.data;
  const lines = [
    '── Amajuba District Spatial Pilot ──',
    'Scope: Amajuba District Municipality (DC25), KwaZulu-Natal; Ward 7 may be selected as one test area.',
    'This workflow is read-only. Sanity coordinates never replace authoritative institutional geometry.',
    'Optional reference: Khethokuhle Primary School is in Ward 7; its Sanity geopoint is known incorrect/unverified comparison evidence. Use retrieved dataset geometry only after verifying source authority, and never update Sanity.',
    '',
    `Control Centre dataset discovery: ${catalog.layers.length} public layer(s) returned.`,
    'The public map-layers endpoint filters by source and dataset redistribution permissions, but does not expose the per-layer permission classifications.',
    ...(catalog.permissionFiltered
      ? ['Some datasets were withheld by the Control Centre permission checks.']
      : []),
  ];
  const datasets = datasetMetadata(catalog);
  if (datasets.length > 0) lines.push('', '── Dataset/source metadata ──', ...datasets);
  if (!input.datasetId) {
    lines.push(
      '',
      'Select a datasetId from the catalogue above to retrieve institutional features.',
      'Then provide an exact feature ID for geometry retrieval or a searchTerm for candidate discovery.',
      'Authority must be assessed from source identity, attribution, permissions and provenance; a name match alone is not verification.'
    );
    return lines.join('\n');
  }

  const layer = catalog.layers.find(item => item.datasetId === input.datasetId);
  if (!layer) {
    lines.push('', `Dataset ID ${input.datasetId} was not returned by the Control Centre catalogue; no feature request was made.`);
    return lines.join('\n');
  }
  lines.push(
    '',
    '── Selected dataset ──',
    `Dataset: ${layer.label} (${layer.datasetId})`,
    `Source identity: ${layer.sourceName ?? 'not provided'}; institution: ${layer.sourceInstitution ?? 'not provided'}; source ID: ${layer.sourceId ?? 'not provided'}`,
    `Attribution: ${layer.attribution ?? 'not provided'} | Vintage: ${layer.datasetDate ?? 'not provided'}`,
    'Catalogue permission evidence: included by the public endpoint after source and dataset redistribution checks; exact classifications may be available from the feature endpoint.',
    'Authority designation: the existing Control Centre client contract has no explicit authoritative/official flag; verify the custodian and live source metadata before treating a candidate as authoritative.',
    'An exact feature ID confirms which dataset record was retrieved, not that the source is authoritative; name matches remain unverified candidates.'
  );
  if (!input.featureId && !input.searchTerm) {
    lines.push('', 'Provide datasetId plus an exact feature ID to retrieve geometry, or searchTerm to discover candidate institutions in the district.');
    return lines.join('\n');
  }

  const wardResult = await fetchWards();
  if (!wardResult.ok) return `${lines.join('\n')}\n\nCould not retrieve Amajuba ward geometries: ${wardResult.error}`;
  const wards = wardResult.data.features;
  const scopeWards = wards.filter(ward => matchWard(ward, input.wardNumber, input.municipalityCode));
  if (scopeWards.length === 0) {
    lines.push('', 'No published Amajuba ward geometry matched the requested test area.');
    return lines.join('\n');
  }

  let retrievedFeatures: SpatialFeature[];
  let retrievalMetadata: {
    datasetName: string;
    sourceId: string | null;
    sourceName: string | null;
    sourceInstitution: string | null;
    attribution: string | null;
    datasetDate: string | null;
    publishedAt: string | null;
    datasetLicenseTerms?: string | null;
    sourceLicenseTerms?: string | null;
    datasetProvenance?: string | null;
    datasetPermission?: string | null;
    sourcePermission?: string | null;
    sourceVintage?: string | null;
    total: number | null;
    queryFeatureCount: number;
    districtFeatureCount: number;
  };
  let retrievalComplete = true;
  if (input.featureId) {
    const result = await fetchPublishedFeatureById(input.datasetId, input.featureId);
    if (!result.ok) {
      lines.push('', `Exact feature retrieval failed: ${result.error}`);
      return lines.join('\n');
    }
    const feature = result.data;
    retrievedFeatures = [feature];
    retrievalMetadata = {
      datasetName: feature.meta.dataset,
      sourceId: feature.meta.sourceId,
      sourceName: feature.meta.sourceName,
      sourceInstitution: feature.meta.sourceInstitution,
      attribution: feature.meta.attribution,
      datasetDate: feature.meta.datasetDate,
      publishedAt: feature.meta.publishedAt,
      datasetLicenseTerms: feature.meta.datasetLicenseTerms,
      sourceLicenseTerms: feature.meta.sourceLicenseTerms,
      datasetProvenance: feature.meta.datasetProvenance,
      datasetPermission: feature.meta.datasetPermission,
      sourcePermission: feature.meta.sourcePermission,
      sourceVintage: feature.meta.sourceVintage,
      total: null,
      queryFeatureCount: 1,
      districtFeatureCount: 1,
    };
  } else {
    const retrieval = await fetchDistrictFeatures(input.datasetId, scopeWards);
    if ('error' in retrieval) {
      lines.push('', retrieval.error);
      return lines.join('\n');
    }
    retrievedFeatures = retrieval.features;
    retrievalComplete = retrieval.complete;
    retrievalMetadata = {
      datasetName: retrieval.metadata.meta.datasetName,
      sourceId: retrieval.metadata.meta.sourceId,
      sourceName: retrieval.metadata.meta.sourceName,
      sourceInstitution: retrieval.metadata.meta.sourceInstitution,
      attribution: retrieval.metadata.meta.attribution,
      datasetDate: retrieval.metadata.meta.datasetDate,
      publishedAt: retrieval.metadata.meta.publishedAt,
      datasetLicenseTerms: retrieval.metadata.meta.datasetLicenseTerms,
      sourceLicenseTerms: retrieval.metadata.meta.sourceLicenseTerms,
      datasetProvenance: retrieval.metadata.meta.datasetProvenance,
      datasetPermission: retrieval.metadata.meta.datasetPermission,
      sourcePermission: retrieval.metadata.meta.sourcePermission,
      sourceVintage: retrieval.metadata.meta.sourceVintage,
      total: retrieval.metadata.meta.total,
      queryFeatureCount: retrieval.queryFeatureCount,
      districtFeatureCount: retrieval.features.length,
    };
  }
  const lowerTerm = input.searchTerm?.toLocaleLowerCase();
  const matchingFeatures = retrievedFeatures.filter(feature => {
    if (input.featureId && feature.id !== input.featureId) return false;
    const { point } = pointForFeature(feature);
    if (point && !pointInAmajuba(point, scopeWards)) return false;
    if (!point && !input.featureId) return false;
    if (lowerTerm) {
      const value = feature.properties[input.nameProperty];
      return typeof value === 'string' && value.toLocaleLowerCase().includes(lowerTerm);
    }
    return true;
  });
  const candidates = matchingFeatures.slice(0, input.maxFeatures);

  lines.push(
    '',
    `── Institutional feature discovery/retrieval (${input.wardNumber === undefined ? 'Amajuba District' : `Ward ${input.wardNumber} (${input.municipalityCode})`}) ──`,
    input.featureId
      ? 'Retrieval scope: one exact feature ID; dataset inventory count is not returned by the by-ID endpoint.'
      : `Dataset inventory: ${retrievalMetadata.total ?? 'not provided'} feature(s); ${retrievalMetadata.queryFeatureCount} unique feature(s) returned by the spatial extent query; ${retrievalMetadata.districtFeatureCount} contained by the selected published ward geometries.`,
    `Feature source ID: ${retrievalMetadata.sourceId ?? layer.sourceId ?? 'not provided'}; source name: ${retrievalMetadata.sourceName ?? layer.sourceName ?? 'not provided'}; institution: ${retrievalMetadata.sourceInstitution ?? layer.sourceInstitution ?? 'not provided'}`,
    `Attribution: ${retrievalMetadata.attribution ?? layer.attribution ?? 'not provided'}; vintage: ${retrievalMetadata.datasetDate ?? layer.datasetDate ?? 'not provided'}; published: ${retrievalMetadata.publishedAt ?? layer.publishedAt ?? 'not provided'}`,
    `Permission: public retrieval passed the Control Centre's source and dataset permission checks; dataset=${metadataValue(retrievalMetadata.datasetPermission)}; source=${metadataValue(retrievalMetadata.sourcePermission)}.`,
    `Licence terms: dataset=${metadataValue(retrievalMetadata.datasetLicenseTerms)}; source=${metadataValue(retrievalMetadata.sourceLicenseTerms)}.`,
    `Dataset provenance: ${metadataValue(retrievalMetadata.datasetProvenance)}; source vintage: ${metadataValue(retrievalMetadata.sourceVintage)}.`,
    input.featureId
      ? 'Pagination: not applicable to the single exact feature-ID request.'
      : `Spatial-query pagination: ${retrievalComplete ? 'complete' : 'incomplete; the Control Centre did not confirm every requested page'}.`,
    `Candidate features matching criteria: ${matchingFeatures.length}; included in report: ${candidates.length}${matchingFeatures.length > candidates.length ? ` (limited by maxFeatures=${input.maxFeatures})` : ''}${input.searchTerm ? ` (text search on ${input.nameProperty} is discovery only)` : ''}`,
    ''
  );
  if (candidates.length === 0) {
    lines.push(input.featureId
      ? `No feature with exact ID ${input.featureId} was returned inside the selected Amajuba scope.`
      : `No feature matched "${input.searchTerm}" in property "${input.nameProperty}" inside the selected Amajuba scope.`);
  }

  const featurePoints = new Map<string, ReturnType<typeof pointForFeature>>();
  for (const feature of candidates) {
    const name = feature.properties[input.nameProperty] ?? feature.properties['name'] ??
      feature.properties['NAME'] ?? 'unnamed';
    const location = pointForFeature(feature);
    featurePoints.set(feature.id, location);
    lines.push(`${name} — Feature ID: ${feature.id}; source feature ID: ${feature.sourceFeatureId ?? 'not provided'}`);
    lines.push(`  Match basis: ${input.featureId ? 'exact dataset feature ID' : `candidate text match in ${input.nameProperty}; identity not verified`}`);
    lines.push(`  Geometry: ${JSON.stringify(feature.geometry)}`);
    if (location.point) {
      lines.push(`  Representative coordinate: lat=${location.point.lat}, lng=${location.point.lng} (${location.method})`);
      lines.push(`  Coordinate precision: ${coordinatePrecisionNote(location.point.lat, location.point.lng)}`);
      const featureWards = containingWards(location.point, scopeWards);
      if (featureWards.length > 0) {
        lines.push(`  Administrative context from published ward geometry: ${featureWards.map(item => `Ward ${item.properties.WardNo} (${item.properties.CAT_B}, ${item.properties.Municipality ?? 'municipality not provided'})`).join('; ')}; Amajuba DC25.`);
      } else {
        lines.push(`  Administrative context: representative coordinate is not contained by the selected published ward geometries${location.method.includes('approximate') ? ' (centroid is approximate)' : ''}.`);
      }
    } else {
      lines.push('  No supported representative point could be extracted; no distance is calculated.');
    }
    lines.push(`  Dataset/source: ${retrievalMetadata.datasetName} / ${retrievalMetadata.sourceName ?? layer.sourceName ?? 'not provided'}`);
    lines.push(`  Attribution: ${retrievalMetadata.attribution ?? layer.attribution ?? 'not provided'}; public access passed the Control Centre permission checks.`);
    lines.push('');
  }

  if (input.sanityListingId) {
    const listing = await fetchListingById(input.sanityListingId);
    lines.push('── Sanity comparison evidence (read-only) ──');
    if (!listing) {
      lines.push(`No Sanity listing found for ID ${input.sanityListingId}.`);
    } else {
      lines.push(`Listing: ${listing.name} (${listing._id}); type: ${listing.listingType}`);
      if (!listing.geopoint) {
        lines.push('Sanity geopoint: not set.');
      } else {
        lines.push(`Sanity geopoint: lat=${listing.geopoint.lat}, lng=${listing.geopoint.lng}; operator-entered and unverified, not authoritative.`);
        if (listing.spatialFeatureId) lines.push(`Existing spatialFeatureId: ${listing.spatialFeatureId}`);
        const exactLinkedFeature = candidates.find(feature => feature.id === listing.spatialFeatureId);
        for (const feature of candidates) {
          const point = featurePoints.get(feature.id)?.point;
          if (!point) continue;
          const distance = haversineMetres(
            { lat: listing.geopoint.lat, lng: listing.geopoint.lng },
            point
          );
          lines.push(
            `Comparison to dataset feature ${feature.id}: ${Math.round(distance)}m discrepancy. ` +
            `${exactLinkedFeature === feature ? 'Existing ID link present; still review the source evidence.' : 'No exact spatialFeatureId link; this is comparison evidence only and not a name-based identity match.'}`
          );
          lines.push('Use the dataset geometry for institutional spatial analysis; do not use or silently update the Sanity point.');
        }
      }
    }
    lines.push('');
  }

  const notices = await fetchAllNotices();
  const scopedNotices = notices.filter(notice => {
    if (notice.geopoint) {
      return pointInAmajuba(
        { lat: notice.geopoint.lat, lng: notice.geopoint.lng },
        scopeWards
      );
    }
    if (input.wardNumber !== undefined) {
      return notice.relatedArea?.wardNumber === input.wardNumber &&
        municipalityToCatB(notice.relatedArea.municipality ?? '') === input.municipalityCode;
    }
    return municipalityToCatB(notice.relatedArea?.municipality ?? '') !== undefined;
  });
  lines.push(
    `── Development notices (${input.wardNumber === undefined ? 'Amajuba District scope' : `Ward ${input.wardNumber} (${input.municipalityCode}) test area`}) ──`,
    `Sanity notices returned: ${notices.length}; located in selected scope (or matched to an Amajuba related area when unlocated): ${scopedNotices.length}.`,
    'Notice geopoints remain unchanged and retain their own Sanity/operator-entered provenance.'
  );
  if (scopedNotices.length === 0) lines.push('No notices matched the selected scope.');
  for (const notice of scopedNotices) {
    lines.push('', `${notice.title} (${notice._id}) — ${notice.noticeType}; status: ${notice.status}`);
    lines.push(`  Related area: ${notice.relatedArea?.name ?? 'not set'}; ward: ${notice.relatedArea?.wardNumber ?? 'not set'}; municipality: ${notice.relatedArea?.municipality ?? 'not set'}`);
    if (!notice.geopoint) {
      lines.push('  Stored notice coordinate: not set; distance and coordinate-based administrative context unavailable.');
      continue;
    }
    const noticePoint = { lat: notice.geopoint.lat, lng: notice.geopoint.lng };
    lines.push(`  Stored notice coordinate: lat=${noticePoint.lat}, lng=${noticePoint.lng}`);
    lines.push(`  Coordinate provenance: Sanity geopoint (operator-entered); declared precision: ${notice.locationPrecision ?? 'not specified'}; numeric precision: ${coordinatePrecisionNote(noticePoint.lat, noticePoint.lng)}`);
    const contextResult = await fetchNoticeContext({
      lat: noticePoint.lat,
      lng: noticePoint.lng,
      noticeType: notice.noticeType,
      wardNumber: notice.relatedArea?.wardNumber,
      catB: municipalityToCatB(notice.relatedArea?.municipality ?? ''),
      locationPrecision: notice.locationPrecision,
    });
    if (contextResult.ok) {
      const context = contextResult.data;
      lines.push(`  Administrative context from Control Centre: ward ${context.administrative.ward.status} (${context.administrative.ward.datasetName ?? 'dataset not provided'}; number ${context.wardNumber ?? 'not returned'}); municipality ${context.administrative.municipality.status} (${context.administrative.municipality.datasetName ?? 'dataset not provided'}; code ${context.catB ?? 'not returned'}); district ${context.administrative.district.status} (${context.administrative.district.datasetName ?? 'dataset not provided'}).`);
      if (context.proximityRadiusMetres !== null) {
        lines.push(`  Control Centre notice-type reference: ${context.proximityRadiusMetres}m${context.proximityRadiusNote ? ` — ${context.proximityRadiusNote}` : ''}. Not a universal buffer or legal determination.`);
      }
    } else {
      lines.push(`  Administrative context lookup failed: ${contextResult.error}`);
    }
    for (const feature of candidates) {
      const institutionPoint = featurePoints.get(feature.id)?.point;
      if (!institutionPoint || !pointInAmajuba(institutionPoint, scopeWards)) continue;
      const distance = geodesicResult(noticePoint, institutionPoint);
      lines.push(`  Distance to feature ${feature.id}: ${distance.distanceMetres}m (${distance.distanceKm}km); bearing ${distance.bearingDegrees}° ${distance.cardinalDirection}.`);

      lines.push('  The calculation uses the stored notice coordinate and the retrieved dataset geometry; neither source coordinate is changed.');
    }
  }

  lines.push(
    '',
    '── Provenance and limitations ──',
    'A feature text match is a discovery candidate, not an identity verification. Use dataset ID plus exact feature ID and review source/custodian metadata; never match or approve from name alone.',
    'The public map-layers catalogue omits exact permission classifications. The feature endpoint may provide source/dataset permissions, licence terms and provenance; missing fields are reported as not returned rather than inferred.',
    'All proximity measurements are operator evidence only, not a legal or statutory determination. Any notice-type reference distance returned by the Control Centre is not a universal buffer.'
  );
  return lines.join('\n');
}

// ── Helper ────────────────────────────────────────────────────────────────────

function municipalityToCatB(municipality: string): string | undefined {
  const map: Record<string, string> = {
    newcastle: 'KZN252',
    kzn252: 'KZN252',
    emadlangeni: 'KZN253',
    'e madlangeni': 'KZN253',
    kzn253: 'KZN253',
    dannhauser: 'KZN254',
    kzn254: 'KZN254',
  };
  return map[municipality.toLowerCase()];
}
