/**
 * Tool group B — Spatial feature discovery.
 * Search features by name, ward, municipality, dataset.
 * Find nearby facilities. Retrieve administrative boundaries.
 */

import { z } from 'zod';
import {
  fetchWards,
  fetchFeatures,
  fetchWardProfile,
  fetchNoticeContext,
  type FeatureCollection,
} from '../lib/cc-client.js';
import {
  pointFromGeoJSON,
  centroidFromPolygon,
  haversineMetres,
} from '../lib/geodesic.js';

// ── Tool: get_ward_boundaries ─────────────────────────────────────────────────

export const getWardBoundariesSchema = z.object({
  wardNumber: z.number().int().positive().optional().describe(
    'Filter to a specific ward number.'
  ),
  catB: z.string().optional().describe(
    'Filter to a specific municipality code (e.g. KZN252 for Newcastle).'
  ),
  includeGeometry: z.boolean().default(false).describe(
    'Include full GeoJSON geometry. Default false — returns metadata only.'
  ),
});

export async function getWardBoundaries(
  input: z.infer<typeof getWardBoundariesSchema>
): Promise<string> {
  const result = await fetchWards();
  if (!result.ok) return `Error fetching ward boundaries: ${result.error}`;
  const { features, meta } = result.data;

  let filtered = features;
  if (input.wardNumber !== undefined) {
    filtered = filtered.filter(f => f.properties.WardNo === input.wardNumber);
  }
  if (input.catB) {
    filtered = filtered.filter(f => f.properties.CAT_B === input.catB);
  }

  const lines: string[] = [
    `MDB Ward Boundaries 2026 — Amajuba DC25`,
    `Dataset: ${meta.dataset} | Date: ${meta.datasetDate ?? 'unknown'} | Attribution: ${meta.attribution}`,
    `Total wards in catalogue: ${meta.count} | Showing: ${filtered.length}`,
    '',
  ];

  for (const f of filtered) {
    const p = f.properties;
    lines.push(`Ward ${p.WardNo} — ${p.CAT_B} (${p.Municipality ?? 'unknown municipality'})`);
    if (p.WardID) lines.push(`  WardID: ${p.WardID}`);
    if (p.Province) lines.push(`  Province: ${p.Province}`);
    const centroid = centroidFromPolygon(f.geometry);
    if (centroid) {
      lines.push(`  Centroid (approx): lat=${centroid.lat.toFixed(6)}, lng=${centroid.lng.toFixed(6)}`);
    }
    if (input.includeGeometry) {
      lines.push(`  Geometry: ${JSON.stringify(f.geometry)}`);
    }
    lines.push('');
  }

  if (filtered.length === 0) {
    lines.push('No wards matched the filter criteria.');
  }
  return lines.join('\n');
}

// ── Tool: get_ward_demographics ───────────────────────────────────────────────

export const getWardDemographicsSchema = z.object({
  wardNumber: z.number().int().positive().describe(
    'Ward number (e.g. 7 for Ward 7 Newcastle).'
  ),
  catB: z.string().describe(
    'Municipality code (e.g. KZN252 for Newcastle).'
  ),
});

export async function getWardDemographics(
  input: z.infer<typeof getWardDemographicsSchema>
): Promise<string> {
  const result = await fetchWardProfile({ catB: input.catB, wardNo: input.wardNumber });
  if (!result.ok) return `Error fetching ward profile: ${result.error}`;
  const { wards, datasetName, attribution, datasetDate } = result.data;

  if (wards.length === 0) {
    return (
      `No ward profile found for Ward ${input.wardNumber} (${input.catB}).\n` +
      `Note: wards 35 and 36 in KZN252 are new 2026 delimitations with no 2021 profile.`
    );
  }

  const w = wards[0] as Record<string, unknown>;
  const lines: string[] = [
    `Ward Profile — ${w['Ward_Label'] ?? `Ward ${input.wardNumber}`}`,
    `Dataset: ${datasetName} | Date: ${datasetDate} | Attribution: ${attribution}`,
    '',
    `Municipality: ${w['Municipality']} | Province: ${w['Province']}`,
    `WardID: ${w['WardID']} | CAT_B: ${w['CAT_B']}`,
    '',
    '── Population ──',
    `Total population: ${w['Total_Pop']}`,
    `Population density: ${w['Pop_Density']} per km²`,
    `Area: ${w['Area_SqKm']} km²`,
    `Registered voters: ${w['Reg_Voters']}`,
    '',
    '── Race ──',
    `Black African: ${w['Black_African']} | White: ${w['White']} | Coloured: ${w['Coloured']} | Indian/Asian: ${w['Indian_or_Asian']}`,
    '',
    '── Employment ──',
    `Employed: ${w['Employed']} | Unemployed: ${w['Unemployed']}`,
    `Discouraged work seekers: ${w['Discouraged_Work_Seeker']} | Not economically active: ${w['Not_Economically_Active']}`,
    '',
    '── Education ──',
    `Grade 12/Std 10: ${w['Grade_12_Std10']} | Higher: ${w['Higher']}`,
    `No schooling: ${w['No_schooling']} | Some primary: ${w['Some_Primary']}`,
    '',
    '── Services ──',
    `Flush toilet (sewer): ${w['Flush_Toilet_SewerSystem']} | Pit toilet (no vent): ${w['Pit_Toilet_NoVentilation']}`,
    `Tap in dwelling: ${w['Tap_In_Dwelling']} | No piped water: ${w['No_access_to_piped_water']}`,
    `Refuse removed weekly: ${w['Removed_Weekly']} | No disposal: ${w['No_Disposal']}`,
  ];
  return lines.join('\n');
}

// ── Tool: search_features_by_name ─────────────────────────────────────────────

export const searchFeaturesByNameSchema = z.object({
  datasetId: z.string().uuid().describe(
    'UUID of the dataset to search within.'
  ),
  nameProperty: z.string().describe(
    'Property key to search (e.g. "name", "NAME", "SCHOOL_NAME").'
  ),
  searchTerm: z.string().describe(
    'Name fragment to search for (case-insensitive).'
  ),
  lat: z.number().optional().describe('Search centre latitude for nearby results.'),
  lng: z.number().optional().describe('Search centre longitude for nearby results.'),
  radiusMeters: z.number().positive().max(20000).optional().describe(
    'Search radius in metres (max 20,000). Requires lat and lng.'
  ),
  offset: z.number().int().min(0).max(20000).default(0).describe(
    'Offset within the matching results; use the reported next offset to continue.'
  ),
  maxResults: z.number().int().positive().max(500).default(100).describe(
    'Maximum matching features to include in this response.'
  ),
});

const FEATURE_PAGE_SIZE = 500;
const MAX_FEATURE_PAGES = 41;

export async function searchFeaturesByName(
  input: z.infer<typeof searchFeaturesByNameSchema>
): Promise<string> {
  const pointFilterParts = [input.lat, input.lng, input.radiusMeters];
  if (
    !pointFilterParts.every(value => value === undefined) &&
    !pointFilterParts.every(value => value !== undefined)
  ) {
    return 'lat, lng and radiusMeters must be provided together.';
  }

  const opts: { lat?: number; lng?: number; radiusMeters?: number } = {};
  if (input.lat !== undefined && input.lng !== undefined && input.radiusMeters !== undefined) {
    opts.lat = input.lat;
    opts.lng = input.lng;
    opts.radiusMeters = input.radiusMeters;
  }

  const features: FeatureCollection['features'] = [];
  let metadata: FeatureCollection['meta'] | null = null;
  let offset = 0;
  let complete = false;
  for (let page = 0; page < MAX_FEATURE_PAGES; page++) {
    const result = await fetchFeatures(input.datasetId, {
      ...opts,
      limit: FEATURE_PAGE_SIZE,
      offset,
    });
    if (!result.ok) return `Error fetching features at offset ${offset}: ${result.error}`;
    metadata = result.data.meta;
    features.push(...result.data.features);
    if (!metadata.hasMore) {
      complete = metadata.complete;
      break;
    }
    if (
      metadata.nextOffset === null ||
      metadata.nextOffset <= offset ||
      metadata.nextOffset > 20000
    ) {
      break;
    }
    offset = metadata.nextOffset;
  }

  const term = input.searchTerm.toLocaleLowerCase();
  const matched = features.filter(f => {
    const val = f.properties[input.nameProperty];
    return typeof val === 'string' && val.toLocaleLowerCase().includes(term);
  });
  const selected = matched.slice(input.offset, input.offset + input.maxResults);
  const nextOffset = input.offset + selected.length;

  const lines: string[] = [
    `Dataset: ${metadata?.datasetName ?? input.datasetId} (${input.datasetId})`,
    `Source: ${metadata?.sourceName ?? 'unknown'} (${metadata?.sourceId ?? 'source ID not provided'}); institution: ${metadata?.sourceInstitution ?? 'not provided'}`,
    `Attribution: ${metadata?.attribution ?? 'not provided'}; vintage: ${metadata?.datasetDate ?? 'not provided'}; published: ${metadata?.publishedAt ?? 'not provided'}`,
    'Permission: features were returned by the public Control Centre endpoint after source and dataset redistribution checks; exact classifications are not exposed.',
    `Inventory: ${features.length} of ${metadata?.total ?? 'unknown'} dataset feature(s) retrieved; pagination ${complete ? 'complete' : 'incomplete'}.`,
    `Name matches for "${input.searchTerm}" in "${input.nameProperty}": ${matched.length}.`,
    nextOffset < matched.length
      ? `Returning ${selected.length} match(es) from offset ${input.offset}; next offset: ${nextOffset}.`
      : `Returning ${selected.length} match(es) from offset ${input.offset}; no further matching results.`,
  ];

  if (matched.length === 0) {
    lines.push(
      `No features found matching "${input.searchTerm}" in property "${input.nameProperty}" ` +
      `within dataset ${input.datasetId}.`
    );
    return lines.join('\n');
  }

  lines.push('');
  for (const f of selected) {
    lines.push(`Feature ID: ${f.id}`);
    lines.push(`  ${input.nameProperty}: ${f.properties[input.nameProperty]}`);
    const pt = pointFromGeoJSON(f.geometry) ?? centroidFromPolygon(f.geometry);
    if (pt) {
      lines.push(`  Location (lat, lng): ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`);
      lines.push(`  GeoJSON coords [lng, lat]: [${pt.lng.toFixed(6)}, ${pt.lat.toFixed(6)}]`);
    }
    const propLines = Object.entries(f.properties)
      .filter(([k]) => k !== input.nameProperty)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    if (propLines) lines.push(propLines);
    lines.push('');
  }
  if (!complete) {
    lines.push(
      'WARNING: The Control Centre did not confirm complete pagination. ' +
      'The reported name-match count covers only retrieved pages and may be partial.'
    );
  }
  return lines.join('\n');
}

// ── Tool: get_features_near_point ─────────────────────────────────────────────

export const getFeaturesNearPointSchema = z.object({
  datasetId: z.string().uuid().describe('UUID of the dataset to query.'),
  lat: z.number().min(-90).max(90).describe('Centre latitude (WGS84).'),
  lng: z.number().min(-180).max(180).describe('Centre longitude (WGS84).'),
  radiusMeters: z.number().positive().max(20000).describe(
    'Search radius in metres (max 20,000).'
  ),
  limit: z.number().int().positive().max(500).default(50).describe(
    'Maximum features to return.'
  ),
});

export async function getFeaturesNearPoint(
  input: z.infer<typeof getFeaturesNearPointSchema>
): Promise<string> {
  const result = await fetchFeatures(input.datasetId, {
    lat: input.lat,
    lng: input.lng,
    radiusMeters: input.radiusMeters,
    limit: input.limit,
  });
  if (!result.ok) return `Error fetching nearby features: ${result.error}`;
  const { features, meta } = result.data;

  if (features.length === 0) {
    return (
      `No features found within ${input.radiusMeters}m of ` +
      `(lat=${input.lat}, lng=${input.lng}) in dataset "${meta.datasetName}".`
    );
  }

  const origin = { lat: input.lat, lng: input.lng };
  const withDist = features
    .map(f => {
      const pt = pointFromGeoJSON(f.geometry) ?? centroidFromPolygon(f.geometry);
      const dist = pt ? haversineMetres(origin, pt) : null;
      return { f, dist, pt };
    })
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  const lines: string[] = [
    `Features within ${input.radiusMeters}m of (lat=${input.lat}, lng=${input.lng})`,
    `Dataset: ${meta.datasetName} | Attribution: ${meta.attribution ?? 'unknown'}`,
    `Found: ${features.length}${meta.hasMore ? ' (more available — increase limit or use offset)' : ''}`,
    '',
  ];

  for (const { f, dist, pt } of withDist) {
    lines.push(`Feature ID: ${f.id}`);
    if (dist !== null) lines.push(`  Distance: ${Math.round(dist)}m`);
    if (pt) lines.push(`  Location (lat, lng): ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`);
    const props = Object.entries(f.properties)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    if (props) lines.push(props);
    lines.push('');
  }
  return lines.join('\n');
}

// ── Tool: get_administrative_context ──────────────────────────────────────────

export const getAdministrativeContextSchema = z.object({
  lat: z.number().min(-90).max(90).describe('Latitude of the point to resolve.'),
  lng: z.number().min(-180).max(180).describe('Longitude of the point to resolve.'),
  wardNumber: z.number().int().positive().optional().describe(
    'Known ward number (speeds up resolution).'
  ),
  catB: z.string().optional().describe(
    'Known municipality code (e.g. KZN252).'
  ),
  noticeType: z.string().default('other').describe(
    'Notice type for proximity radius context.'
  ),
});

export async function getAdministrativeContext(
  input: z.infer<typeof getAdministrativeContextSchema>
): Promise<string> {
  const result = await fetchNoticeContext({
    lat: input.lat,
    lng: input.lng,
    wardNumber: input.wardNumber,
    catB: input.catB,
    noticeType: input.noticeType,
  });
  if (!result.ok) return `Error fetching administrative context: ${result.error}`;
  const ctx = result.data;

  const lines: string[] = [
    `Administrative context for (lat=${input.lat}, lng=${input.lng})`,
    `Generated: ${ctx.generatedAt}`,
    '',
    '── Ward ──',
    `Status: ${ctx.administrative.ward.status}`,
    `Dataset: ${ctx.administrative.ward.datasetName ?? 'n/a'}`,
    `Features: ${ctx.administrative.ward.featureCount}`,
  ];
  if (ctx.administrative.ward.note) lines.push(`Note: ${ctx.administrative.ward.note}`);

  lines.push('', '── Municipality ──');
  lines.push(`Status: ${ctx.administrative.municipality.status}`);
  lines.push(`Dataset: ${ctx.administrative.municipality.datasetName ?? 'n/a'}`);
  lines.push(`Features: ${ctx.administrative.municipality.featureCount}`);
  if (ctx.administrative.municipality.note) lines.push(`Note: ${ctx.administrative.municipality.note}`);

  lines.push('', '── District ──');
  lines.push(`Status: ${ctx.administrative.district.status}`);
  lines.push(`Dataset: ${ctx.administrative.district.datasetName ?? 'n/a'}`);
  lines.push(`Features: ${ctx.administrative.district.featureCount}`);

  if (ctx.wardDemographics) {
    const d = ctx.wardDemographics as Record<string, unknown>;
    lines.push('', '── Ward demographics (2021) ──');
    lines.push(`Ward: ${d['Ward_Label']} | Municipality: ${d['Municipality']}`);
    lines.push(`Population: ${d['Total_Pop']} | Density: ${d['Pop_Density']}/km²`);
  }

  if (ctx.proximityRadiusMetres) {
    lines.push('', `Proximity radius (${input.noticeType}): ${ctx.proximityRadiusMetres}m`);
    if (ctx.proximityRadiusNote) lines.push(`Note: ${ctx.proximityRadiusNote}`);
  }

  lines.push('', `Disclaimer: ${ctx.disclaimer}`);
  return lines.join('\n');
}
