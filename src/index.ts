#!/usr/bin/env node
/**
 * Umkhandlu GIS & Spatial Intelligence MCP Server
 *
 * Provides specialist tool interface for understanding, retrieving, validating,
 * connecting, analysing and managing the spatial data that powers Umkhandlu's
 * Control Centre and Governance Node.
 *
 * Pilot area: Amajuba District, KwaZulu-Natal.
 * Ward 7 is an optional test area; institutions are discovered from Control Centre datasets.
 *
 * Transport: stdio (for use with Amazon Q, Claude Desktop, VS Code MCP clients).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Tool imports ──────────────────────────────────────────────────────────────
import {
  listSpatialDatasetsSchema,
  listSpatialDatasets,
  getIntegrityReportSchema,
  getIntegrityReport,
  getProximityRadiusConfigSchema,
  getProximityRadiusConfig,
} from './tools/spatial-discovery.js';

import {
  getWardBoundariesSchema,
  getWardBoundaries,
  getWardDemographicsSchema,
  getWardDemographics,
  searchFeaturesByNameSchema,
  searchFeaturesByName,
  getFeaturesNearPointSchema,
  getFeaturesNearPoint,
  getAdministrativeContextSchema,
  getAdministrativeContext,
} from './tools/feature-search.js';

import {
  calculateGeodesicDistanceSchema,
  calculateGeodesicDistance,
  analyseNoticeProximitySchema,
  analyseNoticeProximity,
  validateGeojsonGeometrySchema,
  validateGeojsonGeometry,
  checkPointInWardSchema,
  checkPointInWard,
  compareInstitutionCandidatesSchema,
  compareInstitutionCandidates,
} from './tools/spatial-verification.js';

import {
  getSpatialContentSummarySchema,
  getSpatialContentSummary,
  listDevelopmentNoticesSchema,
  listDevelopmentNotices,
  getNoticeDetailSchema,
  getNoticeDetail,
  listListingsWithoutSpatialFeatureSchema,
  listListingsWithoutSpatialFeature,
  searchListingsSchema,
  searchListings,
} from './tools/sanity-relationships.js';

import {
  analyseNoticeSpatialContextSchema,
  analyseNoticeSpatialContext,
  findInstitutionsNearNoticeSchema,
  findInstitutionsNearNotice,
  analyseAmajubaSpatialPilotSchema,
  analyseAmajubaSpatialPilotInputShape,
  analyseAmajubaSpatialPilot,
} from './tools/notice-intelligence.js';

import {
  getMapLayerProfileSchema,
  getMapLayerProfile,
  getAllMapLayerProfilesSchema,
  getAllMapLayerProfiles,
} from './tools/map-context.js';

import {
  checkApiHealthSchema,
  checkApiHealth,
  checkIntegrationHealthSchema,
  checkIntegrationHealth,
  getFullIntegrityReportSchema,
  getFullIntegrityReport,
  probeSpatialSourceSchema,
  probeSpatialSource,
} from './tools/data-integrity.js';

// ── Resource imports ──────────────────────────────────────────────────────────
import { resources } from './resources/index.js';

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'umkhandlu-gis',
  version: '1.0.0',
});

// ── Group A: Spatial source and dataset discovery ─────────────────────────────

server.tool(
  'list_spatial_datasets',
  'List publicly available spatial datasets from the Control Centre. ' +
  'Filter by notice type context or bounding box. ' +
  'Returns dataset names, sources, permissions, attribution and feature counts.',
  listSpatialDatasetsSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await listSpatialDatasets(input) }],
  })
);

server.tool(
  'get_spatial_integrity_report',
  'Operator tool: fetch the Control Centre spatial integrity report. ' +
  'Reports dataset counts, permission conflicts, pipeline failures, orphan sources, ' +
  'and geographic verification status for Amajuba DC25. ' +
  'Requires UMKHANDLU_OPERATOR_TOKEN.',
  getIntegrityReportSchema.shape,
  async () => ({
    content: [{ type: 'text', text: await getIntegrityReport() }],
  })
);

server.tool(
  'get_proximity_radius_config',
  'Retrieve notice-type proximity reference values from the existing Control Centre notice-layers API. ' +
  'Values are not universal buffers or legal determinations.',
  getProximityRadiusConfigSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getProximityRadiusConfig(input) }],
  })
);

// ── Group B: Spatial feature discovery ───────────────────────────────────────

server.tool(
  'get_ward_boundaries',
  'Retrieve MDB 2026 ward boundaries for Amajuba DC25 (55 wards across KZN252/KZN253/KZN254). ' +
  'Filter by ward number or municipality code. ' +
  'Returns ward metadata and approximate centroids. ' +
  'Set includeGeometry=true for full GeoJSON.',
  getWardBoundariesSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getWardBoundaries(input) }],
  })
);

server.tool(
  'get_ward_demographics',
  'Retrieve 2021 ward demographic profile for a specific ward in Amajuba DC25. ' +
  'Returns population, employment, education, services data from MDB WardProfile 2021. ' +
  'Note: wards 35 and 36 in KZN252 are new 2026 delimitations with no 2021 profile.',
  getWardDemographicsSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getWardDemographics(input) }],
  })
);

server.tool(
  'search_features_by_name',
  'Search features within a dataset by a name property. ' +
  'Paginates the full eligible dataset (subject to the Control Centre request cap) before counting matches; use offset and maxResults to continue through matches. ' +
  'Use to discover candidate institutions, including schools, in a selected dataset. ' +
  'A text match is not identity verification; use dataset and exact feature IDs to retrieve/verify geometry. ' +
  'Optionally filter by lat/lng/radius.',
  searchFeaturesByNameSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await searchFeaturesByName(input) }],
  })
);

server.tool(
  'get_features_near_point',
  'Find spatial features within a radius of a given point. ' +
  'Returns features sorted by distance from the origin. ' +
  'Use to find institutions, facilities or infrastructure near a notice site. ' +
  'Max radius 20,000m.',
  getFeaturesNearPointSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getFeaturesNearPoint(input) }],
  })
);

server.tool(
  'get_administrative_context',
  'Resolve the ward, municipality, district and ward demographics for a given coordinate. ' +
  'Returns administrative boundary status from the Control Centre spatial catalogue. ' +
  'Includes proximity radius for the specified notice type.',
  getAdministrativeContextSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getAdministrativeContext(input) }],
  })
);

// ── Group C: Spatial verification and analysis ────────────────────────────────

server.tool(
  'calculate_geodesic_distance',
  'Calculate the geodesic (great-circle) distance and bearing between two WGS84 points. ' +
  'Optionally compare against a proximity threshold. ' +
  'Reports coordinate precision for both points. ' +
  'Result is evidence for operator review — not a legal determination.',
  calculateGeodesicDistanceSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await calculateGeodesicDistance(input) }],
  })
);

server.tool(
  'analyse_notice_proximity',
  'Analyse the proximity between a development notice site and an institution. ' +
  'Reports geodesic distance, bearing, coordinate precision, provenance flags ' +
  'and threshold comparison. ' +
  'Result is evidence for operator review — not a legal determination.',
  analyseNoticeProximitySchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await analyseNoticeProximity(input) }],
  })
);

server.tool(
  'validate_geojson_geometry',
  'Validate a GeoJSON geometry string. ' +
  'Checks axis order (GeoJSON [lng,lat] vs Leaflet [lat,lng]), ' +
  'verifies coordinates are within South Africa and Amajuba DC25 bounding boxes, ' +
  'and reports geometry type and structure.',
  validateGeojsonGeometrySchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await validateGeojsonGeometry(input) }],
  })
);

server.tool(
  'check_point_in_ward',
  'Check whether a coordinate falls within a published MDB 2026 ward boundary. ' +
  'Optionally verify against an expected ward number and municipality code. ' +
  'Uses ray-casting point-in-polygon against the full ward boundary geometry.',
  checkPointInWardSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await checkPointInWard(input) }],
  })
);

server.tool(
  'compare_institution_candidates',
  'Compare a Sanity geopoint against an authoritative dataset coordinate for an institution. ' +
  'Reports discrepancy distance, precision assessment and recommended action. ' +
  'Enforces the rule that authoritative datasets take precedence over Sanity geopoints. ' +
  'Never automatically approves uncertain matches.',
  compareInstitutionCandidatesSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await compareInstitutionCandidates(input) }],
  })
);

// ── Group D: Sanity content relationships ─────────────────────────────────────

server.tool(
  'get_spatial_content_summary',
  'Summarise the spatial linkage state of Sanity content in the Governance Node. ' +
  'Reports how many notices, listings and schools have geopoints, ' +
  'spatialFeatureId and ccNoticeRef set.',
  getSpatialContentSummarySchema.shape,
  async () => ({
    content: [{ type: 'text', text: await getSpatialContentSummary() }],
  })
);

server.tool(
  'list_development_notices',
  'List development notices from the Governance Node Sanity CMS. ' +
  'Filter to notices with geopoints or without siteFeatureId. ' +
  'Returns coordinate provenance, precision and spatial linkage status for each notice.',
  listDevelopmentNoticesSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await listDevelopmentNotices(input) }],
  })
);

server.tool(
  'get_notice_detail',
  'Get full spatial detail for a development notice by slug or Sanity ID. ' +
  'Returns coordinate provenance, location precision, siteFeatureId, ccNoticeRef ' +
  'and related area information.',
  getNoticeDetailSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getNoticeDetail(input) }],
  })
);

server.tool(
  'list_listings_without_spatial_feature',
  'List Sanity listings that have no spatialFeatureId set. ' +
  'Filter by listing type (school, clinic, business, etc.). ' +
  'These listings are not linked to any authoritative spatial feature in the Control Centre.',
  listListingsWithoutSpatialFeatureSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await listListingsWithoutSpatialFeature(input) }],
  })
);

server.tool(
  'search_listings',
  'Search Sanity listings by name fragment. ' +
  'Filter by listing type. ' +
  'Returns geopoint, spatialFeatureId, ward and municipality for each match.',
  searchListingsSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await searchListings(input) }],
  })
);

// ── Group E: Notice and commercial intelligence ───────────────────────────────

server.tool(
  'analyse_notice_spatial_context',
  'Full spatial context analysis for a development notice. ' +
  'Fetches administrative context (ward/municipality/district), ' +
  'proximity layer availability, notice-type reference distance and coordinate provenance. ' +
  'Works across all notice types and all wards in Amajuba District.',
  analyseNoticeSpatialContextSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await analyseNoticeSpatialContext(input) }],
  })
);

server.tool(
  'find_institutions_near_notice',
  'Find institution features from a selected spatial dataset within a radius of a notice site. ' +
  'Returns institutions sorted by distance with feature IDs and coordinates. ' +
  'A 500m default search radius is a search convenience, not a universal or statutory buffer. ' +
  'Works for any notice and institution dataset in Amajuba District.',
  findInstitutionsNearNoticeSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await findInstitutionsNearNotice(input) }],
  })
);

server.tool(
  'analyse_amajuba_spatial_pilot',
  'District-wide Amajuba spatial intelligence workflow. First discovers Control Centre datasets and reports source identity, attribution, vintage and permissions. ' +
  'With a selected dataset, discovers candidate institutional features or retrieves geometry by exact dataset and feature IDs; optionally select a ward such as Ward 7. ' +
  'Analyses Sanity development notices using their stored coordinates and provenance, and resolves administrative context without changing coordinates. ' +
  'Sanity institution geopoints are unverified comparison evidence and never override retrieved dataset geometry; name matches are not identity verification. ' +
  'Neither the 500m liquor-notice reference nor any other notice-type reference is a universal buffer or legal determination.',
  analyseAmajubaSpatialPilotInputShape,
  async (input) => ({
    content: [{ type: 'text', text: await analyseAmajubaSpatialPilot(input) }],
  })
);

// ── Group F: Map and page-context intelligence ────────────────────────────────

server.tool(
  'get_map_layer_profile',
  'Get contextual layer recommendations for a specific page or workflow. ' +
  'Covers: notice-detail, governance-map, listing-detail, directory, community-map, ' +
  'control-centre-notice-intake, control-centre-spatial-catalogue. ' +
  'Optionally checks live layer availability from the Control Centre.',
  getMapLayerProfileSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getMapLayerProfile(input) }],
  })
);

server.tool(
  'get_all_map_layer_profiles',
  'List all map layer profiles for all page contexts. ' +
  'Shows required and optional layers per context with implementation notes.',
  getAllMapLayerProfilesSchema.shape,
  async () => ({
    content: [{ type: 'text', text: await getAllMapLayerProfiles() }],
  })
);

// ── Group G: Data integrity and operational monitoring ────────────────────────

server.tool(
  'check_api_health',
  'Check the health of all Umkhandlu platform APIs: ' +
  'Control Centre spatial APIs, Governance Node intelligence API. ' +
  'Reports configuration status for tokens and credentials.',
  checkApiHealthSchema.shape,
  async () => ({
    content: [{ type: 'text', text: await checkApiHealth() }],
  })
);

server.tool(
  'check_integration_health',
  'Check the health of the Control Centre ↔ Governance Node integration. ' +
  'Verifies spatial API contracts, notice registration, intelligence polling, ' +
  'and Sanity content spatial linkage gaps.',
  checkIntegrationHealthSchema.shape,
  async () => ({
    content: [{ type: 'text', text: await checkIntegrationHealth() }],
  })
);

server.tool(
  'get_full_integrity_report',
  'Operator tool: full spatial integrity report combining Control Centre catalogue ' +
  'issues and Sanity content spatial gaps. ' +
  'Requires UMKHANDLU_OPERATOR_TOKEN.',
  getFullIntegrityReportSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await getFullIntegrityReport(input) }],
  })
);

server.tool(
  'probe_spatial_source',
  'Operator tool: probe a spatial source URL for reachability, response time and layer count. ' +
  'Requires UMKHANDLU_OPERATOR_TOKEN.',
  probeSpatialSourceSchema.shape,
  async (input) => ({
    content: [{ type: 'text', text: await probeSpatialSource(input) }],
  })
);

// ── Resources ─────────────────────────────────────────────────────────────────

for (const resource of resources) {
  server.resource(
    resource.name,
    resource.uri,
    { description: resource.description, mimeType: resource.mimeType },
    async () => ({
      contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text }],
    })
  );
}

// ── Prompts ───────────────────────────────────────────────────────────────────

server.prompt(
  'amajuba_spatial_session',
  'Start an Umkhandlu GIS session for the Amajuba District-wide pilot.',
  {},
  () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `You are working with the Umkhandlu GIS & Spatial Intelligence MCP.

Pilot area: Amajuba District Municipality (DC25), KwaZulu-Natal.
  KZN252 — Newcastle | KZN253 — eMadlangeni | KZN254 — Dannhauser
  55 MDB 2026 wards | Ward 7 is one optional test area, not the pilot scope.

Key rules:
1. Discover datasets and metadata from the Control Centre; do not assume dataset IDs or invent endpoints.
2. Retrieve institutional geometry by dataset ID and exact feature ID. A name match is only a discovery lead.
3. Authoritative institutional geometry takes precedence over Sanity geopoints; Sanity points are comparison evidence only.
4. Preserve notice coordinates and provenance; do not move them to institution coordinates.
5. Notice-type reference distances from the Control Centre are not universal buffers or legal determinations.
6. Never auto-approve uncertain institution-to-feature matches or mutate Sanity.

Start with check_api_health and list_spatial_datasets. For the complete workflow, use analyse_amajuba_spatial_pilot.`,
      },
    }],
  })
);

server.prompt(
  'verify_institution_location',
  'Workflow prompt for verifying an institutional location against an authoritative dataset.',
  {
    institutionName: z.string().describe('Name of the institution to verify.'),
    listingType: z.string().describe('Listing type: school | clinic | facility etc.'),
  },
  ({ institutionName, listingType }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Verify the authoritative location for: ${institutionName} (${listingType}) in Amajuba District.

Steps:
1. search_listings — find the Sanity listing and note its geopoint and spatialFeatureId.
2. list_spatial_datasets — identify available authoritative datasets for this institution type.
3. Treat the institution name as a discovery term only; do not assume identity from name similarity.
4. Use analyse_amajuba_spatial_pilot with the selected datasetId and exact featureId to retrieve geometry and metadata.
5. Supply sanityListingId only for read-only comparison. Report the Sanity point as unverified, and use the dataset geometry for spatial analysis.
6. Report dataset/source identity, attribution, vintage, permission, provenance and any missing metadata.
7. Do NOT automatically set spatialFeatureId or update Sanity — present evidence for operator review.`,
      },
    }],
  })
);

server.prompt(
  'notice_proximity_analysis',
  'Workflow prompt for analysing a development notice against nearby institutions.',
  {
    noticeIdentifier: z.string().describe('Notice slug or Sanity ID.'),
    institutionDatasetId: z.string().describe('Dataset UUID returned by Control Centre discovery.'),
  },
  ({ noticeIdentifier, institutionDatasetId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Analyse development notice proximity: ${noticeIdentifier}

Steps:
1. get_notice_detail — retrieve notice coordinates and provenance.
2. get_administrative_context — resolve ward, municipality, district.
3. analyse_notice_spatial_context — full spatial context and layer availability.
4. find_institutions_near_notice — search dataset ${institutionDatasetId} using an explicitly selected reference/search radius.
5. For each institution found: analyse_notice_proximity — calculate distance with provenance.
6. Report findings for operator review. Do not make legal determinations or treat default search radii as universal buffers.
7. Prefer analyse_amajuba_spatial_pilot for district-wide dataset discovery, exact feature retrieval and coordinate-provenance reporting.`,
      },
    }],
  })
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is reserved for MCP protocol
  process.stderr.write('Umkhandlu GIS & Spatial Intelligence MCP started\n');
  process.stderr.write(`Control Centre: ${process.env['CONTROL_CENTRE_URL'] ?? 'https://unami-platform-core-umkhandlu.vercel.app'}\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
