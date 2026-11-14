/**
 * Tool group G — Data integrity and operational monitoring.
 *
 * Checks dataset counts, API availability, pipeline health,
 * missing spatial relationships, permission inconsistencies,
 * and Control Centre ↔ Governance Node integration status.
 *
 * Operator tools require UMKHANDLU_OPERATOR_TOKEN.
 * Read-only tools work without auth.
 */

import { z } from 'zod';
import { fetchIntegrityReport, fetchMapLayers, fetchWards, probeSource } from '../lib/cc-client.js';
import { fetchSpatialSummary, fetchListingsWithoutSpatialFeature, fetchNoticesWithoutSpatialFeature } from '../lib/sanity-client.js';
import { requireOperatorToken, env } from '../lib/env.js';

// ── Tool: check_api_health ─────────────────────────────────────────────────────

export const checkApiHealthSchema = z.object({});

export async function checkApiHealth(): Promise<string> {
  const lines: string[] = [
    'API health check — Umkhandlu platform',
    `Control Centre URL: ${env.controlCentreUrl}`,
    `Governance Node URL: ${env.governanceNodeUrl}`,
    '',
  ];

  // Check Control Centre public spatial APIs
  const checks: Array<{ label: string; fn: () => Promise<{ ok: boolean; error?: string; detail?: string }> }> = [
    {
      label: 'CC /api/spatial/wards',
      fn: async () => {
        const r = await fetchWards();
        if (!r.ok) return { ok: false, error: r.error };
        return { ok: true, detail: `${r.data.features.length} ward features` };
      },
    },
    {
      label: 'CC /api/spatial/map-layers',
      fn: async () => {
        const r = await fetchMapLayers();
        if (!r.ok) return { ok: false, error: r.error };
        return {
          ok: true,
          detail: `${r.data.layers.length} publicly redistributable layers`,
        };
      },
    },
  ];

  // Check Governance Node intelligence API if key is configured
  if (env.intelligenceApiKey && env.governanceNodeUrl) {
    checks.push({
      label: 'Node /api/intelligence/health',
      fn: async () => {
        try {
          const res = await fetch(`${env.governanceNodeUrl}/api/intelligence/health`, {
            headers: { Authorization: `Bearer ${env.intelligenceApiKey}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
          const data = await res.json() as Record<string, unknown>;
          return {
            ok: data['status'] === 'healthy',
            detail: `status=${data['status']}, records=${data['recordCount']}, notices=${data['noticeCount']}`,
          };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
    });
  }

  for (const check of checks) {
    const result = await check.fn();
    const icon = result.ok ? '✓' : '✗';
    lines.push(`${icon} ${check.label}`);
    if (result.detail) lines.push(`  ${result.detail}`);
    if (result.error) lines.push(`  Error: ${result.error}`);
  }

  lines.push('');
  lines.push('Sanity configuration:');
  lines.push(`  Project: ${env.sanityProjectId} / ${env.sanityDataset}`);
  lines.push(`  Read token: ${env.sanityReadToken ? 'configured' : 'NOT SET — public queries only'}`);
  lines.push(`  Intelligence API key: ${env.intelligenceApiKey ? 'configured' : 'NOT SET — Node intelligence API unavailable'}`);
  lines.push(`  Operator token: ${env.operatorToken ? 'configured' : 'NOT SET — operator tools unavailable'}`);

  return lines.join('\n');
}

// ── Tool: check_integration_health ────────────────────────────────────────────

export const checkIntegrationHealthSchema = z.object({});

export async function checkIntegrationHealth(): Promise<string> {
  const lines: string[] = [
    'Control Centre ↔ Governance Node integration health',
    '',
    'Integration architecture:',
    '  Governance Node → registers notices via /api/notices/register (CC)',
    '  Control Centre → polls Node via /api/intelligence/* (Node)',
    '  Control Centre → serves spatial APIs consumed by Node map components',
    '  Node map components → fetch ward boundaries from CC /api/spatial/wards',
    '  Node map components → fetch map layers from CC /api/spatial/map-layers',
    '',
  ];

  // Check CC → Node spatial API contract
  lines.push('── CC spatial APIs (consumed by Governance Node) ──');
  const wardsResult = await fetchWards();
  if (wardsResult.ok) {
    lines.push(`✓ /api/spatial/wards — ${wardsResult.data.features.length} ward features`);
    lines.push(`  Attribution: ${wardsResult.data.meta.attribution}`);
  } else {
    lines.push(`✗ /api/spatial/wards — ${wardsResult.error}`);
    lines.push('  BROKEN: GovernanceMapLeaflet.tsx will fail to load ward boundaries.');
  }

  const layersResult = await fetchMapLayers();
  if (layersResult.ok) {
    lines.push(
      `✓ /api/spatial/map-layers — ${layersResult.data.layers.length} publicly redistributable layers`,
    );
    if (layersResult.data.permissionFiltered) {
      lines.push('  Some datasets were withheld by the source/dataset redistribution permission checks.');
    }
  } else {
    lines.push(`✗ /api/spatial/map-layers — ${layersResult.error}`);
    lines.push('  BROKEN: use-spatial-map-layers.ts hook will fail.');
  }

  // Check Node → CC notice registration contract
  lines.push('');
  lines.push('── Node → CC notice registration ──');
  lines.push(`CC notices/register endpoint: ${env.controlCentreUrl}/api/notices/register`);
  lines.push('  This endpoint requires a node API key (INTELLIGENCE_API_KEY on the Node).');
  lines.push('  Registration is triggered by registerNoticeWithCC server action in the Node.');
  lines.push('  Check: does the Node have CONTROL_CENTRE_URL and INTELLIGENCE_API_KEY set?');

  // Check Node intelligence API
  lines.push('');
  lines.push('── CC → Node intelligence polling ──');
  if (!env.intelligenceApiKey) {
    lines.push('⚠ INTELLIGENCE_API_KEY not set in MCP environment.');
    lines.push('  Cannot verify Node intelligence API from this MCP.');
    lines.push('  The Control Centre polls these Node endpoints:');
    lines.push('    /api/intelligence/health');
    lines.push('    /api/intelligence/node');
    lines.push('    /api/intelligence/notices/summary');
    lines.push('    /api/intelligence/spatial');
    lines.push('    /api/intelligence/records/summary');
  } else {
    try {
      const res = await fetch(`${env.governanceNodeUrl}/api/intelligence/health`, {
        headers: { Authorization: `Bearer ${env.intelligenceApiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        lines.push(`✓ /api/intelligence/health — status=${data['status']}`);
      } else {
        lines.push(`✗ /api/intelligence/health — HTTP ${res.status}`);
        if (res.status === 503) {
          lines.push('  BROKEN: INTELLIGENCE_API_KEY not configured on the Governance Node.');
          lines.push('  Set INTELLIGENCE_API_KEY in the Node .env.local to enable CC polling.');
        }
      }
    } catch (e) {
      lines.push(`✗ /api/intelligence/health — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Sanity content spatial linkage
  lines.push('');
  lines.push('── Sanity content spatial linkage ──');
  try {
    const summary = await fetchSpatialSummary();
    lines.push(`Notices with ccNoticeRef (registered with CC): ${summary.noticesWithSiteFeature}`);
    lines.push(`Listings with spatialFeatureId (linked to CC): ${summary.listingsWithSpatialFeature}`);
    lines.push(`Schools with spatialFeatureId: ${summary.schoolsWithSpatialFeature} of ${summary.schoolCount}`);
    if (summary.listingsWithSpatialFeature === 0) {
      lines.push('⚠ No listings are linked to Control Centre spatial features.');
      lines.push('  CommunityMap sections will show empty state on all pages.');
      lines.push('  Action: operator must set spatialFeatureId on listings after verifying against authoritative datasets.');
    }
  } catch (e) {
    lines.push(`Could not fetch Sanity summary: ${e instanceof Error ? e.message : String(e)}`);
  }

  return lines.join('\n');
}

// ── Tool: get_full_integrity_report ───────────────────────────────────────────

export const getFullIntegrityReportSchema = z.object({
  includeSanity: z.boolean().default(true).describe(
    'Include Sanity content spatial linkage gaps in the report.'
  ),
});

export async function getFullIntegrityReport(
  input: z.infer<typeof getFullIntegrityReportSchema>
): Promise<string> {
  const token = requireOperatorToken();
  const ccResult = await fetchIntegrityReport(token);

  const lines: string[] = ['Full spatial integrity report', ''];

  if (!ccResult.ok) {
    if (ccResult.status === 401) {
      lines.push('Control Centre integrity report: Unauthorized. Check UMKHANDLU_OPERATOR_TOKEN.');
    } else {
      lines.push(`Control Centre integrity report: Error — ${ccResult.error}`);
    }
  } else {
    const r = ccResult.data;
    lines.push(`── Control Centre catalogue ──`);
    lines.push(`Status: ${r.integrity.status.toUpperCase()} (${r.integrity.errors} errors, ${r.integrity.warnings} warnings)`);
    lines.push(`Sources: ${r.summary.sources} | Datasets: ${r.summary.datasets} (${r.summary.publishedDatasets} published)`);
    lines.push(`Features: ${r.summary.totalFeatures} total — ${r.summary.approvedFeatures} approved`);
    lines.push(`Pipeline runs: ${r.summary.pipelineRuns}`);
    lines.push('');

    lines.push(`── Geographic verification ──`);
    lines.push(`District: ${r.geographicVerification.districtCode} (Amajuba)`);
    lines.push(`Municipalities: ${r.geographicVerification.municipalities.map(m => `${m.name} (${m.code})`).join(', ')}`);
    lines.push(`Wards 2026: ${r.geographicVerification.wards2026} | Ward profiles 2021: ${r.geographicVerification.wardProfiles2021}`);
    lines.push(`Unmatched wards: ${r.geographicVerification.unmatchedWards.join(', ')}`);
    lines.push(`Note: ${r.geographicVerification.unmatchedNote}`);
    lines.push('');

    if (r.issues.length > 0) {
      lines.push(`── Issues (${r.issues.length}) ──`);
      for (const issue of r.issues) {
        lines.push(`[${issue.severity.toUpperCase()}] [${issue.category}] ${issue.message}`);
        if (issue.datasetId) lines.push(`  Dataset: ${issue.datasetId}`);
        if (issue.sourceId) lines.push(`  Source: ${issue.sourceId}`);
      }
      lines.push('');
    } else {
      lines.push('No Control Centre issues found.');
      lines.push('');
    }
  }

  if (input.includeSanity) {
    lines.push('── Sanity content spatial gaps ──');
    try {
      const [unlinkedListings, unlinkedNotices] = await Promise.all([
        fetchListingsWithoutSpatialFeature(),
        fetchNoticesWithoutSpatialFeature(),
      ]);

      lines.push(`Listings without spatialFeatureId: ${unlinkedListings.length}`);
      const schoolsUnlinked = unlinkedListings.filter(l => l.listingType === 'school');
      const clinicsUnlinked = unlinkedListings.filter(l => l.listingType === 'clinic');
      if (schoolsUnlinked.length > 0) {
        lines.push(`  Schools: ${schoolsUnlinked.length} — ${schoolsUnlinked.map(l => l.name).join(', ')}`);
      }
      if (clinicsUnlinked.length > 0) {
        lines.push(`  Clinics: ${clinicsUnlinked.length} — ${clinicsUnlinked.map(l => l.name).join(', ')}`);
      }

      lines.push(`Notices without siteFeatureId: ${unlinkedNotices.length}`);
      if (unlinkedNotices.length > 0) {
        for (const n of unlinkedNotices.slice(0, 10)) {
          lines.push(`  ${n.title} (${n.noticeType}, ${n.status})`);
        }
        if (unlinkedNotices.length > 10) {
          lines.push(`  ... and ${unlinkedNotices.length - 10} more`);
        }
      }
    } catch (e) {
      lines.push(`Could not fetch Sanity gaps: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return lines.join('\n');
}

// ── Tool: probe_spatial_source ─────────────────────────────────────────────────

export const probeSpatialSourceSchema = z.object({
  url: z.string().url().describe('Base URL of the spatial source to probe.'),
  sourceType: z.string().default('arcgis-featureserver').describe(
    'Source type: arcgis-featureserver | arcgis-mapserver | wfs | wms'
  ),
});

export async function probeSpatialSource(
  input: z.infer<typeof probeSpatialSourceSchema>
): Promise<string> {
  const token = requireOperatorToken();
  const result = await probeSource(input.url, input.sourceType, token);

  if (!result.ok) {
    if (result.status === 401) return 'Unauthorized. Check UMKHANDLU_OPERATOR_TOKEN.';
    return `Probe failed: ${result.error}`;
  }

  const d = result.data;
  const lines: string[] = [
    `Source probe: ${input.url}`,
    `Type: ${input.sourceType}`,
    `Reachable: ${d.reachable ? 'YES' : 'NO'}`,
    `Response time: ${d.responseMs}ms`,
  ];
  if (d.layerCount !== undefined) lines.push(`Layers: ${d.layerCount}`);
  if (d.sampleFeatureCount !== undefined) lines.push(`Sample feature count (layer 0): ${d.sampleFeatureCount}`);
  if (d.error) lines.push(`Error: ${d.error}`);

  return lines.join('\n');
}
