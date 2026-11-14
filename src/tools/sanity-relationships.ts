/**
 * Tool group D — Sanity content relationships.
 *
 * Inspect development notices and listings.
 * Identify records lacking spatial relationships.
 * Recommend spatialFeatureId candidates with evidence.
 * Never automatically approve uncertain matches.
 */

import { z } from 'zod';
import {
  fetchAllNotices,
  fetchNoticeBySlug,
  fetchNoticeById,
  fetchListingsByType,
  fetchListingBySlug,
  fetchListingById,
  fetchListingsWithoutSpatialFeature,
  searchListingsByName,
  fetchSpatialSummary,
  fetchNoticesWithGeopoint,
  fetchNoticesWithoutSpatialFeature,
} from '../lib/sanity-client.js';
import { coordinatePrecisionNote } from '../lib/geodesic.js';

// ── Tool: get_spatial_content_summary ─────────────────────────────────────────

export const getSpatialContentSummarySchema = z.object({});

export async function getSpatialContentSummary(): Promise<string> {
  const summary = await fetchSpatialSummary();
  const lines: string[] = [
    'Sanity spatial content summary — Governance Node',
    '',
    '── Development notices ──',
    `Total notices: ${summary.noticeCount}`,
    `With geopoint: ${summary.noticesWithGeopoint}`,
    `With siteFeatureId (linked to Control Centre): ${summary.noticesWithSiteFeature}`,
    `Without siteFeatureId: ${summary.noticeCount - summary.noticesWithSiteFeature}`,
    '',
    '── Listings ──',
    `Total listings: ${summary.listingCount}`,
    `With geopoint: ${summary.listingsWithGeopoint}`,
    `With spatialFeatureId (linked to Control Centre): ${summary.listingsWithSpatialFeature}`,
    `Without spatialFeatureId: ${summary.listingCount - summary.listingsWithSpatialFeature}`,
    '',
    '── Schools ──',
    `Total school listings: ${summary.schoolCount}`,
    `Schools with spatialFeatureId: ${summary.schoolsWithSpatialFeature}`,
    `Schools without spatialFeatureId: ${summary.schoolCount - summary.schoolsWithSpatialFeature}`,
    '',
    'Action: Schools without spatialFeatureId should be matched to authoritative dataset features',
    '(Giga Schools or HOT OSM Education) via the verify_institution_location tool.',
  ];
  return lines.join('\n');
}

// ── Tool: list_development_notices ────────────────────────────────────────────

export const listDevelopmentNoticesSchema = z.object({
  withGeopointOnly: z.boolean().default(false).describe(
    'Only return notices that have a geopoint set.'
  ),
  withoutSiteFeatureOnly: z.boolean().default(false).describe(
    'Only return notices that have no siteFeatureId (not yet linked to Control Centre).'
  ),
});

export async function listDevelopmentNotices(
  input: z.infer<typeof listDevelopmentNoticesSchema>
): Promise<string> {
  let notices;
  if (input.withGeopointOnly) {
    notices = await fetchNoticesWithGeopoint();
  } else if (input.withoutSiteFeatureOnly) {
    notices = await fetchNoticesWithoutSpatialFeature();
  } else {
    notices = await fetchAllNotices();
  }

  if (notices.length === 0) {
    return 'No development notices found matching the filter criteria.';
  }

  const lines: string[] = [
    `Development notices — ${notices.length} found`,
    '',
  ];

  for (const n of notices) {
    lines.push(`${n.title}`);
    lines.push(`  ID: ${n._id}`);
    lines.push(`  Slug: ${n.slug.current}`);
    lines.push(`  Type: ${n.noticeType} | Status: ${n.status}`);
    lines.push(`  Applicant: ${n.applicant}`);
    if (n.referenceNumber) lines.push(`  Reference: ${n.referenceNumber}`);
    lines.push(`  Location: ${n.location}`);
    if (n.geopoint) {
      lines.push(`  Geopoint: lat=${n.geopoint.lat}, lng=${n.geopoint.lng}`);
      lines.push(`  Location precision: ${n.locationPrecision ?? 'not specified'}`);
      lines.push(`  Coordinate precision: ${coordinatePrecisionNote(n.geopoint.lat, n.geopoint.lng)}`);
    } else {
      lines.push('  Geopoint: NOT SET');
    }
    if (n.siteFeatureId) {
      lines.push(`  siteFeatureId: ${n.siteFeatureId} (linked to Control Centre)`);
    } else {
      lines.push('  siteFeatureId: NOT SET (not linked to Control Centre)');
    }
    if (n.ccNoticeRef) lines.push(`  ccNoticeRef: ${n.ccNoticeRef}`);
    if (n.relatedArea) {
      lines.push(`  Related area: ${n.relatedArea.name} (Ward ${n.relatedArea.wardNumber ?? '?'}, ${n.relatedArea.municipality ?? '?'})`);
    }
    lines.push(`  Comment deadline: ${n.commentDeadline}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Tool: get_notice_detail ────────────────────────────────────────────────────

export const getNoticeDetailSchema = z.object({
  identifier: z.string().describe(
    'Notice slug (e.g. "liquor-licence-mndozo-road") or Sanity document ID.'
  ),
});

export async function getNoticeDetail(
  input: z.infer<typeof getNoticeDetailSchema>
): Promise<string> {
  // Try slug first, then ID
  const isId = input.identifier.startsWith('draft.') || /^[a-z0-9]{20,}$/.test(input.identifier);
  const notice = isId
    ? await fetchNoticeById(input.identifier)
    : await fetchNoticeBySlug(input.identifier);

  if (!notice) {
    return `No development notice found for identifier: ${input.identifier}`;
  }

  const lines: string[] = [
    `Development Notice: ${notice.title}`,
    `ID: ${notice._id} | Slug: ${notice.slug.current}`,
    `Type: ${notice.noticeType} | Status: ${notice.status}`,
    `Applicant: ${notice.applicant}`,
    notice.referenceNumber ? `Reference: ${notice.referenceNumber}` : '',
    `Description: ${notice.description}`,
    `Location: ${notice.location}`,
    `Comment deadline: ${notice.commentDeadline}`,
    notice.publishDate ? `Published: ${notice.publishDate}` : '',
    '',
    '── Spatial data ──',
  ];

  if (notice.geopoint) {
    lines.push(`Geopoint: lat=${notice.geopoint.lat}, lng=${notice.geopoint.lng}`);
    lines.push(`Location precision: ${notice.locationPrecision ?? 'not specified'}`);
    lines.push(`Coordinate precision: ${coordinatePrecisionNote(notice.geopoint.lat, notice.geopoint.lng)}`);
    lines.push('Coordinate provenance: Sanity geopoint — operator-entered, not independently verified.');
  } else {
    lines.push('Geopoint: NOT SET — no map coordinate for this notice.');
  }

  if (notice.siteFeatureId) {
    lines.push(`siteFeatureId: ${notice.siteFeatureId}`);
    lines.push('  This notice is linked to a Control Centre spatial feature.');
    lines.push('  Use get_features_near_point or search_features_by_name to inspect the feature.');
  } else {
    lines.push('siteFeatureId: NOT SET — not linked to a Control Centre spatial feature.');
  }

  if (notice.ccNoticeRef) {
    lines.push(`ccNoticeRef: ${notice.ccNoticeRef}`);
    lines.push('  This notice is registered with the Control Centre.');
  } else {
    lines.push('ccNoticeRef: NOT SET — not registered with the Control Centre.');
  }

  if (notice.relatedArea) {
    lines.push('');
    lines.push('── Related area ──');
    lines.push(`Name: ${notice.relatedArea.name}`);
    lines.push(`Ward: ${notice.relatedArea.wardNumber ?? 'unknown'} | Municipality: ${notice.relatedArea.municipality ?? 'unknown'}`);
    if (notice.relatedArea.geopoint) {
      lines.push(`Area geopoint: lat=${notice.relatedArea.geopoint.lat}, lng=${notice.relatedArea.geopoint.lng}`);
      lines.push('Note: Area geopoint is a centroid/representative point — not the notice site.');
    }
  }

  return lines.filter(l => l !== '').join('\n');
}

// ── Tool: list_listings_without_spatial_feature ───────────────────────────────

export const listListingsWithoutSpatialFeatureSchema = z.object({
  listingType: z.enum(['school', 'clinic', 'business', 'accommodation', 'church', 'facility', 'area']).optional().describe(
    'Filter by listing type. Omit for all types.'
  ),
});

export async function listListingsWithoutSpatialFeature(
  input: z.infer<typeof listListingsWithoutSpatialFeatureSchema>
): Promise<string> {
  const listings = await fetchListingsWithoutSpatialFeature(input.listingType);

  if (listings.length === 0) {
    return `All ${input.listingType ?? 'listing'} records have a spatialFeatureId set.`;
  }

  const lines: string[] = [
    `Listings without spatialFeatureId — ${listings.length} found`,
    input.listingType ? `Type filter: ${input.listingType}` : 'All types',
    '',
    'These listings have no link to an authoritative spatial feature in the Control Centre.',
    'For schools, clinics and other institutions, a spatialFeatureId should be set after',
    'verifying the match against an authoritative dataset (Giga Schools, HOT OSM, etc.).',
    '',
  ];

  for (const l of listings) {
    lines.push(`${l.name}`);
    lines.push(`  ID: ${l._id} | Slug: ${l.slug.current}`);
    lines.push(`  Type: ${l.listingType}`);
    if (l.location) lines.push(`  Location: ${l.location}`);
    if (l.geopoint) {
      lines.push(`  Geopoint: lat=${l.geopoint.lat}, lng=${l.geopoint.lng}`);
      lines.push(`  Coordinate precision: ${coordinatePrecisionNote(l.geopoint.lat, l.geopoint.lng)}`);
      lines.push('  Provenance: Sanity geopoint — operator-entered, not authoritative.');
    } else {
      lines.push('  Geopoint: NOT SET');
    }
    if (l.wardNumber) lines.push(`  Ward: ${l.wardNumber} | Municipality: ${l.municipality ?? 'unknown'}`);
    if (l.verifiedByInduna) lines.push(`  Verification: ${l.verifiedByInduna}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Tool: search_listings ──────────────────────────────────────────────────────

export const searchListingsSchema = z.object({
  name: z.string().describe('Name fragment to search for (case-insensitive).'),
  listingType: z.enum(['school', 'clinic', 'business', 'accommodation', 'church', 'facility', 'area']).optional().describe(
    'Filter by listing type.'
  ),
});

export async function searchListings(
  input: z.infer<typeof searchListingsSchema>
): Promise<string> {
  const listings = await searchListingsByName(input.name, input.listingType);

  if (listings.length === 0) {
    return `No listings found matching "${input.name}"${input.listingType ? ` of type "${input.listingType}"` : ''}.`;
  }

  const lines: string[] = [
    `Found ${listings.length} listing(s) matching "${input.name}"`,
    '',
  ];

  for (const l of listings) {
    lines.push(`${l.name}`);
    lines.push(`  ID: ${l._id} | Slug: ${l.slug.current}`);
    lines.push(`  Type: ${l.listingType}`);
    if (l.location) lines.push(`  Location: ${l.location}`);
    if (l.geopoint) {
      lines.push(`  Geopoint: lat=${l.geopoint.lat}, lng=${l.geopoint.lng}`);
      lines.push(`  Coordinate precision: ${coordinatePrecisionNote(l.geopoint.lat, l.geopoint.lng)}`);
    }
    if (l.spatialFeatureId) {
      lines.push(`  spatialFeatureId: ${l.spatialFeatureId} ✓`);
    } else {
      lines.push('  spatialFeatureId: NOT SET');
    }
    if (l.wardNumber) lines.push(`  Ward: ${l.wardNumber} | Municipality: ${l.municipality ?? 'unknown'}`);
    lines.push('');
  }

  return lines.join('\n');
}
