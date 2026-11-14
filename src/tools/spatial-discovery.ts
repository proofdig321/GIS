/**
 * Tool group A — Spatial source and dataset discovery.
 * Lists sources, datasets, permissions, integrity.
 * Operator tools require UMKHANDLU_OPERATOR_TOKEN.
 */

import { z } from 'zod';
import { fetchMapLayers, fetchIntegrityReport, fetchNoticeLayers } from '../lib/cc-client.js';
import { requireOperatorToken, env } from '../lib/env.js';

// ── Tool: list_spatial_datasets ───────────────────────────────────────────────

export const listSpatialDatasetsSchema = z.object({
  noticeType: z.string().optional().describe(
    'Filter layers by notice type context (liquor, eia, rezoning, infrastructure, mining). Omit for all public layers.'
  ),
  bbox: z.string().optional().describe(
    'WGS84 bounding box as "west,south,east,north" to filter by geography. Max 2 degrees span.'
  ),
});

export async function listSpatialDatasets(
  input: z.infer<typeof listSpatialDatasetsSchema>
): Promise<string> {
  if (input.noticeType) {
    const result = await fetchNoticeLayers({ noticeType: input.noticeType, features: false });
    if (!result.ok) return `Error fetching notice layers: ${result.error}`;
    const { layers, summary, proximityRadius } = result.data;
    const lines: string[] = [
      `Notice layer profile: ${input.noticeType}`,
      `Layers: ${summary.total} total — ${summary.available} available, ${summary.pending} pending permission, ${summary.unavailable} not available`,
    ];
    if (proximityRadius) {
      lines.push(`Proximity radius: ${proximityRadius.metres}m — ${proximityRadius.statutoryBasis}`);
      if (proximityRadius.caveat) lines.push(`Caveat: ${proximityRadius.caveat}`);
    }
    lines.push('');
    for (const layer of layers) {
      lines.push(`[${layer.availability.toUpperCase()}] ${layer.label}`);
      lines.push(`  Role: ${layer.role} | Geometry: ${layer.geometryType}`);
      lines.push(`  Source: ${layer.sourceOrg}`);
      if (layer.sourceDataset) lines.push(`  Dataset: ${layer.sourceDataset}`);
      lines.push(`  Statutory: ${layer.statutoryRelevance}`);
      if (layer.permissionNote) lines.push(`  Permission note: ${layer.permissionNote}`);
      if (layer.attribution) lines.push(`  Attribution: ${layer.attribution}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  // General map layers
  const params: Parameters<typeof fetchMapLayers>[0] = {};
  if (input.bbox) params.bbox = input.bbox;
  const result = await fetchMapLayers(params);
  if (!result.ok) return `Error fetching map layers: ${result.error}`;
  const { layers, permissionFiltered, generatedAt } = result.data;
  const lines: string[] = [
    `Public spatial datasets — ${layers.length} returned by the Control Centre`,
    `Catalogue response generated: ${generatedAt}`,
    'Only datasets whose dataset and source permissions allow redistribution are returned by this public endpoint.',
    'Per-layer permission classifications are not exposed by this endpoint.',
    ...(permissionFiltered
      ? ['Some datasets were withheld by the Control Centre permission checks.']
      : []),
    '',
  ];
  for (const layer of layers) {
    lines.push(`Dataset: ${layer.label}`);
    lines.push(`  ID: ${layer.datasetId}`);
    lines.push(`  Source: ${layer.sourceName ?? 'unknown'} (${layer.sourceInstitution ?? 'unknown institution'})`);
    lines.push('  Permission: included by the public endpoint after source and dataset redistribution checks; exact classifications not exposed');
    lines.push(`  Published status: ${layer.status}`);
    lines.push(`  Features: ${layer.featureCount ?? 'unknown'}`);
    lines.push(`  Returned in this response: ${layer.returnedCount}`);
    if (layer.attribution) lines.push(`  Attribution: ${layer.attribution}`);
    if (layer.datasetDate) lines.push(`  Dataset date: ${layer.datasetDate}`);
    if (layer.publishedAt) lines.push(`  Published at: ${layer.publishedAt}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ── Tool: get_spatial_integrity_report ───────────────────────────────────────

export const getIntegrityReportSchema = z.object({});

export async function getIntegrityReport(): Promise<string> {
  const token = requireOperatorToken();
  const result = await fetchIntegrityReport(token);
  if (!result.ok) {
    if (result.status === 401) return 'Unauthorized. Check UMKHANDLU_OPERATOR_TOKEN.';
    return `Error fetching integrity report: ${result.error}`;
  }
  const r = result.data;
  const lines: string[] = [
    `Spatial Integrity Report — generated ${r.generatedAt}`,
    `Status: ${r.integrity.status.toUpperCase()} (${r.integrity.errors} errors, ${r.integrity.warnings} warnings)`,
    '',
    '── Catalogue summary ──',
    `Sources: ${r.summary.sources}`,
    `Datasets: ${r.summary.datasets} (${r.summary.publishedDatasets} published, ${r.summary.stagedDatasets} staged, ${r.summary.archivedDatasets} archived)`,
    `Features: ${r.summary.totalFeatures} total — ${r.summary.approvedFeatures} approved, ${r.summary.pendingFeatures} pending, ${r.summary.rejectedFeatures} rejected`,
    `Pipeline runs: ${r.summary.pipelineRuns}`,
    `Orphan sources (no datasets): ${r.summary.orphanSources}`,
    '',
    '── Geographic verification ──',
    `District: ${r.geographicVerification.districtCode}`,
    `Municipalities: ${r.geographicVerification.municipalities.map(m => `${m.name} (${m.code})`).join(', ')}`,
    `Wards 2026: ${r.geographicVerification.wards2026}`,
    `Ward profiles 2021: ${r.geographicVerification.wardProfiles2021}`,
    `Unmatched wards: ${r.geographicVerification.unmatchedWards.join(', ')}`,
    `Note: ${r.geographicVerification.unmatchedNote}`,
    '',
  ];
  if (r.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    lines.push(`── Issues (${r.issues.length}) ──`);
    for (const issue of r.issues) {
      lines.push(`[${issue.severity.toUpperCase()}] [${issue.category}] ${issue.message}`);
      if (issue.datasetId) lines.push(`  Dataset ID: ${issue.datasetId}`);
      if (issue.sourceId) lines.push(`  Source ID: ${issue.sourceId}`);
    }
  }
  return lines.join('\n');
}

// ── Tool: get_proximity_radius_config ─────────────────────────────────────────

export const getProximityRadiusConfigSchema = z.object({
  noticeType: z.string().optional().describe(
    'Notice type to look up (liquor, eia, rezoning, infrastructure, mining, etc.). Omit to query the supported notice types.'
  ),
});

const NOTICE_TYPES = [
  'liquor', 'mining', 'eia', 'rezoning', 'infrastructure', 'land-use',
  'township', 'building', 'telecom', 'estate', 'liquidation', 'pto',
];

export async function getProximityRadiusConfig(
  input: z.infer<typeof getProximityRadiusConfigSchema>
): Promise<string> {
  const lines: string[] = [
    'Proximity radius configuration returned by the Control Centre',
    'IMPORTANT: These are reference distances for operator context only.',
    'They are NOT universal buffers or legal determinations. Statutory compliance requires professional assessment.',
    '',
    'Ward 7 may be selected as a test area. Its 200m demonstration distance is not a statutory radius',
    'and is distinct from a 500m liquor-notice reference returned by the Control Centre.',
    '',
  ];

  const types = input.noticeType ? [input.noticeType] : NOTICE_TYPES;
  const results = await Promise.all(types.map(async type => ({
    type,
    result: await fetchNoticeLayers({ noticeType: type, features: false }),
  })));
  for (const { type, result } of results) {
    if (!result.ok) {
      lines.push(`${type}: Control Centre lookup failed: ${result.error}`);
      lines.push('');
      continue;
    }
    const config = result.data.proximityRadius;
    if (config) {
      lines.push(`${type}: ${config.metres}m — ${config.statutoryBasis}`);
      if (config.caveat) lines.push(`  Caveat: ${config.caveat}`);
      lines.push('  Treat as a notice-specific reference, not a universal exclusion buffer or legal determination.');
    } else {
      lines.push(`${type}: no proximity radius returned by the Control Centre.`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
