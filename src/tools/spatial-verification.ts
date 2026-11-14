/**
 * Tool group C — Spatial verification and analysis.
 *
 * Geodesic distance, bearing, proximity checks, geometry validation.
 * Supports district-wide coordinate and geometry analysis.
 *
 * IMPORTANT: Distance calculations are evidence for operator review.
 * They are NOT legal determinations of statutory compliance.
 * Proximity reference distances are retrieved from the Control Centre per notice type.
 */

import { z } from 'zod';
import {
  haversineMetres,
  geodesicResult,
  pointFromGeoJSON,
  centroidFromPolygon,
  nearestBoundaryPoint,
  pointInPolygon,
  isValidLatLng,
  coordinatePrecisionNote,
} from '../lib/geodesic.js';
import { fetchFeatures, fetchWards } from '../lib/cc-client.js';

// ── Tool: calculate_geodesic_distance ─────────────────────────────────────────

export const calculateGeodesicDistanceSchema = z.object({
  fromLat: z.number().min(-90).max(90).describe('Origin latitude (WGS84).'),
  fromLng: z.number().min(-180).max(180).describe('Origin longitude (WGS84).'),
  toLat: z.number().min(-90).max(90).describe('Destination latitude (WGS84).'),
  toLng: z.number().min(-180).max(180).describe('Destination longitude (WGS84).'),
  fromLabel: z.string().default('Origin').describe('Human label for the origin point.'),
  toLabel: z.string().default('Destination').describe('Human label for the destination point.'),
  proximityThresholdMetres: z.number().positive().optional().describe(
    'Optional threshold to compare against (e.g. the notice-type reference distance from the Control Centre). ' +
    'Result will state whether the distance is within the threshold. ' +
    'This is NOT a legal compliance determination.'
  ),
});

export async function calculateGeodesicDistance(
  input: z.infer<typeof calculateGeodesicDistanceSchema>
): Promise<string> {
  const from = { lat: input.fromLat, lng: input.fromLng };
  const to = { lat: input.toLat, lng: input.toLng };
  const result = geodesicResult(from, to);

  const lines: string[] = [
    `Geodesic distance: ${result.distanceMetres}m (${result.distanceKm}km)`,
    `From: ${input.fromLabel} (lat=${input.fromLat}, lng=${input.fromLng})`,
    `To:   ${input.toLabel} (lat=${input.toLat}, lng=${input.toLng})`,
    `Bearing: ${result.bearingDegrees}° (${result.cardinalDirection})`,
    '',
    `Coordinate precision — ${input.fromLabel}: ${coordinatePrecisionNote(input.fromLat, input.fromLng)}`,
    `Coordinate precision — ${input.toLabel}: ${coordinatePrecisionNote(input.toLat, input.toLng)}`,
  ];

  if (input.proximityThresholdMetres !== undefined) {
    const within = result.distanceMetres <= input.proximityThresholdMetres;
    lines.push('');
    lines.push(`Threshold: ${input.proximityThresholdMetres}m`);
    lines.push(`Within threshold: ${within ? 'YES' : 'NO'} (${result.distanceMetres}m vs ${input.proximityThresholdMetres}m)`);
    lines.push('');
    lines.push(
      'IMPORTANT: This is a geodesic distance calculation for operator reference only. ' +
      'It is not a legal determination of statutory compliance, proximity buffer satisfaction, ' +
      'or any regulatory requirement. Statutory proximity assessments require professional ' +
      'spatial analysis against verified coordinates.'
    );
  }

  return lines.join('\n');
}

// ── Tool: analyse_notice_proximity_to_institution ─────────────────────────────

export const analyseNoticeProximitySchema = z.object({
  noticeLat: z.number().min(-90).max(90).describe('Notice site latitude.'),
  noticeLng: z.number().min(-180).max(180).describe('Notice site longitude.'),
  noticeLabel: z.string().describe('Notice title or reference (e.g. "Liquor licence — Mndozo Road").'),
  noticeLocationPrecision: z.string().optional().describe(
    'How the notice coordinate was determined: verified | operator-provided | approximate | locality-only.'
  ),
  institutionLat: z.number().min(-90).max(90).describe('Institution latitude.'),
  institutionLng: z.number().min(-180).max(180).describe('Institution longitude.'),
  institutionLabel: z.string().describe('Institution name or identifier.'),
  institutionCoordinateSource: z.string().describe(
    'How the institution coordinate was obtained: e.g. "Giga Schools dataset feature ID abc123", ' +
    '"HOT OSM Education Facilities feature ID xyz", "Sanity geopoint (operator-entered — not authoritative)".'
  ),
  proximityThresholdMetres: z.number().positive().optional().describe(
    'Threshold to compare against (e.g. the notice-type reference distance from the Control Centre). ' +
    'Omit if no specific threshold applies.'
  ),
  thresholdContext: z.string().optional().describe(
    'What the threshold represents (e.g. "KZN Liquor Licensing Act s.43(2)(b) reference distance").',
  ),
});

export async function analyseNoticeProximity(
  input: z.infer<typeof analyseNoticeProximitySchema>
): Promise<string> {
  const noticePoint = { lat: input.noticeLat, lng: input.noticeLng };
  const institutionPoint = { lat: input.institutionLat, lng: input.institutionLng };
  const result = geodesicResult(noticePoint, institutionPoint);

  const lines: string[] = [
    '── Notice proximity analysis ──',
    '',
    `Notice: ${input.noticeLabel}`,
    `  Coordinates: lat=${input.noticeLat}, lng=${input.noticeLng}`,
    `  Precision: ${input.noticeLocationPrecision ?? 'not specified'}`,
    `  Coordinate precision note: ${coordinatePrecisionNote(input.noticeLat, input.noticeLng)}`,
    '',
    `Institution: ${input.institutionLabel}`,
    `  Coordinates: lat=${input.institutionLat}, lng=${input.institutionLng}`,
    `  Coordinate source: ${input.institutionCoordinateSource}`,
    `  Coordinate precision note: ${coordinatePrecisionNote(input.institutionLat, input.institutionLng)}`,
    '',
    '── Distance ──',
    `Geodesic distance: ${result.distanceMetres}m (${result.distanceKm}km)`,
    `Bearing from notice to institution: ${result.bearingDegrees}° (${result.cardinalDirection})`,
  ];

  if (input.proximityThresholdMetres !== undefined) {
    const within = result.distanceMetres <= input.proximityThresholdMetres;
    lines.push('');
    lines.push(`── Threshold comparison ──`);
    lines.push(`Threshold: ${input.proximityThresholdMetres}m`);
    if (input.thresholdContext) lines.push(`Context: ${input.thresholdContext}`);
    lines.push(`Result: ${within ? 'WITHIN' : 'OUTSIDE'} threshold (${result.distanceMetres}m vs ${input.proximityThresholdMetres}m)`);
  }

  lines.push('');
  lines.push('── Confidence assessment ──');

  const precisionFlags: string[] = [];
  if (!input.noticeLocationPrecision || input.noticeLocationPrecision === 'approximate') {
    precisionFlags.push('Notice coordinate is approximate — actual site may differ.');
  }
  if (input.noticeLocationPrecision === 'locality-only') {
    precisionFlags.push('Notice has locality-only precision — no reliable point coordinate.');
  }
  if (input.institutionCoordinateSource.toLowerCase().includes('sanity')) {
    precisionFlags.push(
      'Institution coordinate sourced from Sanity geopoint — this is operator-entered content, ' +
      'NOT an authoritative institutional location. Verify against Giga Schools or official dataset.'
    );
  }
  if (precisionFlags.length === 0) {
    lines.push('No precision flags raised. Both coordinates appear to have defined sources.');
  } else {
    for (const flag of precisionFlags) lines.push(`⚠ ${flag}`);
  }

  lines.push('');
  lines.push(
    'DISCLAIMER: This analysis is for operator reference only. It is not a legal determination ' +
    'of statutory compliance. Proximity reference distances are not universal buffers. ' +
    'Do not describe proximity measurements as proof of legal compliance.'
  );

  return lines.join('\n');
}

// ── Tool: validate_geojson_geometry ───────────────────────────────────────────

export const validateGeojsonGeometrySchema = z.object({
  geometry: z.string().describe(
    'GeoJSON geometry object as a JSON string. ' +
    'Remember: GeoJSON uses [longitude, latitude] order, NOT [latitude, longitude].'
  ),
});

export async function validateGeojsonGeometry(
  input: z.infer<typeof validateGeojsonGeometrySchema>
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.geometry);
  } catch {
    return 'Invalid JSON — could not parse geometry string.';
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'Not a GeoJSON geometry object.';
  }

  const geom = parsed as Record<string, unknown>;
  const type = geom['type'];
  const lines: string[] = [`Geometry type: ${type ?? 'missing'}`];

  // Axis order check
  lines.push('');
  lines.push('── Axis order ──');
  lines.push('GeoJSON standard: [longitude, latitude] (x, y)');
  lines.push('Leaflet standard: [latitude, longitude] (y, x)');
  lines.push('This tool always interprets geometry as GeoJSON [lng, lat].');

  // Try to extract a representative point
  const pt = pointFromGeoJSON(parsed);
  if (pt) {
    lines.push('');
    lines.push(`Point coordinates: lng=${pt.lng}, lat=${pt.lat}`);
    lines.push(`Interpreted as: lat=${pt.lat.toFixed(6)}, lng=${pt.lng.toFixed(6)}`);
    // Sanity check for South Africa
    const inSA = pt.lat >= -35 && pt.lat <= -22 && pt.lng >= 16 && pt.lng <= 33;
    lines.push(`Within South Africa bounding box: ${inSA ? 'YES' : 'NO — check axis order'}`);
    const inAmajuba = pt.lat >= -28.9 && pt.lat <= -27.2 && pt.lng >= 27.8 && pt.lng <= 30.2;
    lines.push(`Within Amajuba DC25 bounding box: ${inAmajuba ? 'YES' : 'NO'}`);
  }

  const centroid = centroidFromPolygon(parsed);
  if (centroid) {
    lines.push('');
    lines.push(`Polygon centroid (approx): lat=${centroid.lat.toFixed(6)}, lng=${centroid.lng.toFixed(6)}`);
    const inSA = centroid.lat >= -35 && centroid.lat <= -22 && centroid.lng >= 16 && centroid.lng <= 33;
    lines.push(`Centroid within South Africa bounding box: ${inSA ? 'YES' : 'NO — check axis order'}`);
  }

  // Coordinate count
  const coords = geom['coordinates'];
  if (Array.isArray(coords)) {
    lines.push('');
    lines.push(`Coordinates structure: ${JSON.stringify(coords).slice(0, 120)}...`);
  }

  return lines.join('\n');
}

// ── Tool: check_point_in_ward ─────────────────────────────────────────────────

export const checkPointInWardSchema = z.object({
  lat: z.number().min(-90).max(90).describe('Point latitude.'),
  lng: z.number().min(-180).max(180).describe('Point longitude.'),
  wardNumber: z.number().int().positive().optional().describe(
    'Expected ward number. If provided, checks containment in that specific ward.'
  ),
  catB: z.string().optional().describe(
    'Expected municipality code (e.g. KZN252). Required if wardNumber is provided.'
  ),
});

export async function checkPointInWard(
  input: z.infer<typeof checkPointInWardSchema>
): Promise<string> {
  if (!isValidLatLng(input.lat, input.lng)) {
    return `Invalid coordinates: lat=${input.lat}, lng=${input.lng}`;
  }

  const result = await fetchWards();
  if (!result.ok) return `Error fetching ward boundaries: ${result.error}`;

  const point = { lat: input.lat, lng: input.lng };
  const lines: string[] = [
    `Point containment check: lat=${input.lat}, lng=${input.lng}`,
    '',
  ];

  const containingWards = result.data.features.filter(f =>
    pointInPolygon(point, f.geometry)
  );

  if (containingWards.length === 0) {
    lines.push('Point is not contained within any published MDB 2026 ward boundary.');
    lines.push('This may indicate the point is outside Amajuba DC25, or the coordinate is incorrect.');
  } else {
    lines.push(`Contained in ${containingWards.length} ward(s):`);
    for (const w of containingWards) {
      const p = w.properties;
      lines.push(`  Ward ${p.WardNo} — ${p.CAT_B} (${p.Municipality ?? 'unknown'})`);
      if (p.WardID) lines.push(`    WardID: ${p.WardID}`);
    }
  }

  if (input.wardNumber !== undefined && input.catB) {
    lines.push('');
    const expectedWard = result.data.features.find(
      f => f.properties.WardNo === input.wardNumber && f.properties.CAT_B === input.catB
    );
    if (!expectedWard) {
      lines.push(`Expected ward Ward ${input.wardNumber} (${input.catB}) not found in published dataset.`);
    } else {
      const inExpected = pointInPolygon(point, expectedWard.geometry);
      lines.push(
        `Expected ward Ward ${input.wardNumber} (${input.catB}): ` +
        `point is ${inExpected ? 'INSIDE' : 'OUTSIDE'} this ward boundary.`
      );
      if (!inExpected) {
        const centroid = centroidFromPolygon(expectedWard.geometry);
        if (centroid) {
          const dist = haversineMetres(point, centroid);
          lines.push(`  Distance to ward centroid: ${Math.round(dist)}m`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ── Tool: compare_institution_candidates ──────────────────────────────────────

export const compareInstitutionCandidatesSchema = z.object({
  institutionName: z.string().describe(
    'Name or identifier of the institution to verify.'
  ),
  sanityLat: z.number().optional().describe('Latitude from Sanity geopoint (operator-entered).'),
  sanityLng: z.number().optional().describe('Longitude from Sanity geopoint (operator-entered).'),
  datasetFeatureId: z.string().optional().describe(
    'Feature ID from an authoritative dataset (e.g. Giga Schools, HOT OSM Education).'
  ),
  datasetId: z.string().uuid().optional().describe(
    'Dataset UUID containing the authoritative feature.'
  ),
  datasetName: z.string().optional().describe(
    'Name of the authoritative dataset (for provenance reporting).'
  ),
  authoritativeLat: z.number().optional().describe(
    'Latitude from the authoritative dataset feature.'
  ),
  authoritativeLng: z.number().optional().describe(
    'Longitude from the authoritative dataset feature.'
  ),
});

export async function compareInstitutionCandidates(
  input: z.infer<typeof compareInstitutionCandidatesSchema>
): Promise<string> {
  const lines: string[] = [
    `Institution location comparison: ${input.institutionName}`,
    '',
    '── Spatial authority rules ──',
    'Authoritative institutional datasets (Giga Schools, official health registers, etc.) take',
    'precedence over Sanity geopoints for institutional locations.',
    'Sanity geopoints are operator-entered content — they are NOT authoritative spatial data.',
    '',
  ];

  const hasSanity = input.sanityLat !== undefined && input.sanityLng !== undefined;
  const hasAuthoritative = input.authoritativeLat !== undefined && input.authoritativeLng !== undefined;

  if (hasSanity) {
    lines.push(`Sanity geopoint: lat=${input.sanityLat}, lng=${input.sanityLng}`);
    lines.push(`  Precision: ${coordinatePrecisionNote(input.sanityLat!, input.sanityLng!)}`);
    lines.push('  Authority: OPERATOR-ENTERED — not authoritative for institutional location.');
  } else {
    lines.push('Sanity geopoint: not provided');
  }

  lines.push('');

  if (hasAuthoritative) {
    lines.push(`Authoritative dataset: ${input.datasetName ?? 'not specified'}`);
    if (input.datasetFeatureId) lines.push(`  Feature ID: ${input.datasetFeatureId}`);
    lines.push(`  Coordinates: lat=${input.authoritativeLat}, lng=${input.authoritativeLng}`);
    lines.push(`  Precision: ${coordinatePrecisionNote(input.authoritativeLat!, input.authoritativeLng!)}`);
    lines.push('  Authority: AUTHORITATIVE — use this coordinate for spatial analysis.');
  } else {
    lines.push('Authoritative dataset coordinate: not provided');
    lines.push('  Action required: search Giga Schools or HOT OSM Education dataset for this institution.');
  }

  if (hasSanity && hasAuthoritative) {
    lines.push('');
    lines.push('── Discrepancy analysis ──');
    const sanityPt = { lat: input.sanityLat!, lng: input.sanityLng! };
    const authPt = { lat: input.authoritativeLat!, lng: input.authoritativeLng! };
    const dist = haversineMetres(sanityPt, authPt);
    lines.push(`Distance between Sanity geopoint and authoritative coordinate: ${Math.round(dist)}m`);

    if (dist < 50) {
      lines.push('Assessment: Coordinates are very close (<50m), but the Sanity geopoint remains unverified. Use the authoritative dataset coordinate for spatial analysis.');
    } else if (dist < 200) {
      lines.push('Assessment: Moderate discrepancy (50–200m). Use authoritative coordinate for spatial analysis.');
      lines.push('  The Sanity geopoint may be a nearby road or entrance — not the building centroid.');
    } else if (dist < 500) {
      lines.push('Assessment: Significant discrepancy (200–500m). Sanity geopoint is unreliable for proximity analysis.');
      lines.push('  Use authoritative coordinate only. Flag Sanity geopoint for operator review.');
    } else {
      lines.push(`Assessment: Large discrepancy (${Math.round(dist)}m). Sanity geopoint is likely incorrect.`);
      lines.push('  Do NOT use Sanity geopoint for any spatial analysis. Operator must review and correct.');
    }

    lines.push('');
    lines.push('Recommendation: Link Sanity listing to authoritative feature via spatialFeatureId field.');
    lines.push('Do not automatically approve this association — operator review required.');
  }

  lines.push('');
  lines.push(
    'RULE: Never silently substitute a Sanity coordinate for an authoritative institutional location. ' +
    'Never match institutions solely by similar names and automatically approve the association. ' +
    'Record the evidence and method used to verify any association.'
  );

  return lines.join('\n');
}
