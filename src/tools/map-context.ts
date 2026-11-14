/**
 * Tool group F — Map and page-context intelligence.
 *
 * Contextual layer recommendations per page type and workflow.
 * Does not load every dataset into every map.
 */

import { z } from 'zod';
import { fetchNoticeLayers, fetchMapLayers } from '../lib/cc-client.js';

// ── Layer profiles per page context ───────────────────────────────────────────

const PAGE_LAYER_PROFILES: Record<string, {
  description: string;
  requiredLayers: string[];
  optionalLayers: string[];
  notes: string[];
}> = {
  'notice-detail': {
    description: 'Development notice detail page — shows notice location, ward, municipality, proximity context.',
    requiredLayers: ['wards', 'municipalities', 'district'],
    optionalLayers: ['schools', 'health-facilities', 'religious-institutions', 'traditional-areas', 'land-use', 'cadastre'],
    notes: [
      'Load ward/municipality/district boundaries from notice-context API.',
      'Load proximity layers from notice-layers API filtered by noticeType.',
      'Do not load all datasets — use notice type to select relevant proximity layers.',
      'Proximity circle radius comes from PROXIMITY_RADIUS config in notice-layer-config.ts.',
    ],
  },
  'governance-map': {
    description: 'Governance map page — shows all 55 MDB ward boundaries for Amajuba DC25.',
    requiredLayers: ['wards'],
    optionalLayers: ['municipalities', 'district', 'populated-places'],
    notes: [
      'Load all 55 wards from /api/spatial/wards.',
      'Ward boundaries are the primary layer — do not add unrelated datasets.',
      'Deep-link ward selection via initialWard prop.',
    ],
  },
  'listing-detail': {
    description: 'Listing detail page — shows listing location in ward context.',
    requiredLayers: ['wards'],
    optionalLayers: ['municipalities'],
    notes: [
      'Show the ward boundary for the listing\'s ward.',
      'Use spatialFeatureId to fetch the authoritative feature geometry if set.',
      'Do not use Sanity geopoint as authoritative location for institutional listings.',
    ],
  },
  'directory': {
    description: 'Directory page — community map showing listings with spatialFeatureId.',
    requiredLayers: [],
    optionalLayers: ['wards', 'schools', 'health-facilities'],
    notes: [
      'Only show listings that have spatialFeatureId set.',
      'Currently 0 listings have spatialFeatureId — map will show empty state.',
      'Do not show listings using Sanity geopoints as authoritative pins.',
    ],
  },
  'community-map': {
    description: 'Community map section — listings filtered by spatialFeatureId.',
    requiredLayers: [],
    optionalLayers: ['wards'],
    notes: [
      'CommunityMap component filters listings by spatialFeatureId.',
      'Shows empty state if no listings have spatialFeatureId.',
      'Populating spatialFeatureId is an operator content task.',
    ],
  },
  'control-centre-notice-intake': {
    description: 'Control Centre notice intake — operator verifies notice location and spatial context.',
    requiredLayers: ['wards', 'municipalities', 'district'],
    optionalLayers: ['schools', 'health-facilities', 'religious-institutions', 'traditional-areas', 'land-use', 'cadastre', 'roads'],
    notes: [
      'Operator tool — requires authentication.',
      'Load full notice-layers profile for the notice type.',
      'Show integrity report alongside map.',
      'Flag coordinate precision issues.',
    ],
  },
  'control-centre-spatial-catalogue': {
    description: 'Control Centre spatial catalogue — operator manages datasets and sources.',
    requiredLayers: [],
    optionalLayers: [],
    notes: [
      'Operator tool — requires authentication.',
      'Use spatial/integrity endpoint for data quality overview.',
      'Use spatial/probe endpoint to check source health.',
      'No map rendering — tabular data management interface.',
    ],
  },
};

// ── Tool: get_map_layer_profile ────────────────────────────────────────────────

export const getMapLayerProfileSchema = z.object({
  pageContext: z.enum([
    'notice-detail',
    'governance-map',
    'listing-detail',
    'directory',
    'community-map',
    'control-centre-notice-intake',
    'control-centre-spatial-catalogue',
  ]).describe('The page or workflow context to get layer recommendations for.'),
  noticeType: z.string().optional().describe(
    'For notice-detail and control-centre-notice-intake: the notice type (liquor, eia, rezoning, etc.).'
  ),
  wardNumber: z.number().int().positive().optional().describe(
    'Ward number for filtering layers to a specific ward.'
  ),
  catB: z.string().optional().describe(
    'Municipality code for filtering layers.'
  ),
  includeAvailability: z.boolean().default(true).describe(
    'Check live availability of layers from the Control Centre.'
  ),
});

export async function getMapLayerProfile(
  input: z.infer<typeof getMapLayerProfileSchema>
): Promise<string> {
  const profile = PAGE_LAYER_PROFILES[input.pageContext];
  if (!profile) return `Unknown page context: ${input.pageContext}`;

  const lines: string[] = [
    `Map layer profile: ${input.pageContext}`,
    `Description: ${profile.description}`,
    '',
    `Required layers: ${profile.requiredLayers.length > 0 ? profile.requiredLayers.join(', ') : 'none'}`,
    `Optional layers: ${profile.optionalLayers.length > 0 ? profile.optionalLayers.join(', ') : 'none'}`,
    '',
    '── Notes ──',
    ...profile.notes.map(n => `• ${n}`),
  ];

  // For notice contexts, fetch live layer availability
  if (
    input.includeAvailability &&
    (input.pageContext === 'notice-detail' || input.pageContext === 'control-centre-notice-intake') &&
    input.noticeType
  ) {
    lines.push('');
    lines.push(`── Live layer availability (noticeType: ${input.noticeType}) ──`);
    const result = await fetchNoticeLayers({
      noticeType: input.noticeType,
      wardNumber: input.wardNumber,
      catB: input.catB,
      features: false,
    });
    if (result.ok) {
      const { layers, summary, proximityRadius } = result.data;
      lines.push(`${summary.total} layers — ${summary.available} available, ${summary.pending} pending, ${summary.unavailable} not available`);
      if (proximityRadius) {
        lines.push(`Proximity radius: ${proximityRadius.metres}m — ${proximityRadius.statutoryBasis}`);
      }
      lines.push('');
      for (const layer of layers) {
        const icon = layer.availability === 'available' ? '✓' :
          layer.availability === 'pending-permission' ? '⏳' : '✗';
        lines.push(`${icon} [${layer.role}] ${layer.label}`);
        if (layer.featureCount != null) lines.push(`  Features: ${layer.featureCount}`);
        if (layer.permissionNote) lines.push(`  Note: ${layer.permissionNote}`);
      }
    } else {
      lines.push(`Could not fetch live availability: ${result.error}`);
    }
  }

  // For governance-map, show ward count
  if (input.includeAvailability && input.pageContext === 'governance-map') {
    lines.push('');
    lines.push('── Live layer availability ──');
    const result = await fetchMapLayers();
    if (result.ok) {
      const wardLayer = result.data.layers.find(l => l.label.includes('MDB Wards 2026'));
      if (wardLayer) {
        lines.push(`MDB Wards 2026: ${wardLayer.featureCount ?? 'unknown'} features`);
        lines.push(`Attribution: ${wardLayer.attribution ?? 'unknown'}`);
      }
    }
  }

  return lines.join('\n');
}

// ── Tool: get_all_map_layer_profiles ──────────────────────────────────────────

export const getAllMapLayerProfilesSchema = z.object({});

export async function getAllMapLayerProfiles(): Promise<string> {
  const lines: string[] = [
    'Map layer profiles — all page contexts',
    '',
    'Principle: Do not load every available dataset into every map.',
    'Use contextual layer profiles and reusable map infrastructure.',
    '',
  ];

  for (const [context, profile] of Object.entries(PAGE_LAYER_PROFILES)) {
    lines.push(`── ${context} ──`);
    lines.push(profile.description);
    lines.push(`Required: ${profile.requiredLayers.join(', ') || 'none'}`);
    lines.push(`Optional: ${profile.optionalLayers.join(', ') || 'none'}`);
    lines.push('');
  }

  return lines.join('\n');
}
