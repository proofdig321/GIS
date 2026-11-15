# Report

**Umkhandlu GIS / GratisGIS integration update — 2026-11-15**

## Access recheck — 2026-11-15 04:22 UTC

Re-read the current `/workspaces/GIS/.env.test` by variable name and checked only whether values are set; no values were printed. It contains Sanity read/write tokens and a Supabase service-role key, but **does not contain a GitHub PAT** (no GitHub credential variable), `SUPABASE_ACCESS_TOKEN`, direct database connection string/password, Vercel token, persistent GratisGIS URL/credential, or operator token. The active GitHub CLI identity is `proofdig321`; fresh GitHub API permission checks return `push=false` and `admin=false` for both application repositories. The local app commits therefore remain unpushed.

The Supabase and Vercel CLIs are not installed. No approved SQL execution connection or deployment credential/target is available. The Supabase service-role key is for authorized API operations and is not an SQL migration credential; no attempt was made to execute DDL through an unverified API surface. Migrations 014/015 remain unapplied and no app deployment was triggered. Remote refs were refreshed: Control Centre is 2 commits ahead of `origin/main`, and Governance Node is 3 commits ahead of `origin/trunk` (neither is behind).

## Current implementation update — 2026-11-15

The full delivery mandate is still **in progress**. This increment adds an operator-only, read-only coverage review on the Control Centre dataset detail page. It discovers an MDB district dataset by source identity, then verifies Amajuba DC25 using both the district-code and district-name properties rather than a hard-coded dataset UUID. It supports Polygon/MultiPolygon point containment, holes and boundary points, retrieves the full bounded inventory in pages, reports operator-status/invalid/non-point counts, and lists up to 100 out-of-polygon staging records for review. It does not clip, delete, relabel, approve, publish, or change permissions. A missing or ambiguous boundary fails closed; an unverified source authority is visibly marked as reference evidence.

The supplied test configuration was used for **read-only** database verification. Current database evidence:

- Giga dataset `b02a30ea-d240-4834-95e4-fa7a3a95c063` is active and published; its database feature count and stored rows are both **834**, all currently `approved`.
- Both dataset- and source-level permission classifications are `redistribute`. However, the source authority status is `unknown`; dataset/source licence-term fields and dataset provenance are not recorded. Redistribution classification is not treated as a substitute for missing licence evidence.
- The matched MDB 2026 Amajuba boundary has the expected DC25/name identity, but the boundary source authority status is also `unknown`, and licence terms are not recorded. The operator report therefore presents the 192/642 point-in-polygon comparison as **unverified geometric evidence**, not authoritative coverage.
- Selecting `source_feature_id` from the staged table returns SQLSTATE `42703`; the upstream identity migration/schema is not present in this database.
- An anonymous REST read of `spatial_staged_features` is denied (HTTP 401 / SQLSTATE `42501`). This verifies anonymous table denial only; authenticated non-operator access and all deployed RLS/grants remain unverified.

### Increment files

- Control Centre `apps/umkhandlu/src/lib/gis/coverage-review.ts` — boundary identity, point extraction and Polygon/MultiPolygon containment including holes.
- Control Centre `apps/umkhandlu/src/app/(umkhandlu)/spatial/coverage-actions.ts` — operator-authenticated, bounded, read-only coverage analysis.
- Control Centre `apps/umkhandlu/src/app/(umkhandlu)/spatial/datasets/_components/DatasetCoverageReview.tsx` and `apps/umkhandlu/src/app/(umkhandlu)/spatial/datasets/[id]/page.tsx` — operator UI and outlier review.
- Control Centre `apps/umkhandlu/src/lib/gis/__tests__/coverage-review.test.mjs` and `apps/umkhandlu/package.json` — five geometry/identity tests and a focused test command.

### Increment validation

- Control Centre coverage tests: **5 passed**; GratisGIS adapter tests: **2 passed**; permission tests: **30 passed**; spatial API tests: **9 passed**.
- Control Centre production build passed. Its focused application `tsc --noEmit` still reports the pre-existing duplicate global `test`/`expect` declarations in `permission-enforcement.test.ts`; no coverage implementation errors remained, and the Next production build’s TypeScript check passed.
- Governance Node: full test suite **35 passed**; typecheck passed; production build now passed using allowlisted test environment variables.
- GIS MCP: typecheck, build, and all **150 tests** passed.
- `git diff --check` passes in all three repositories.

### Delivery access and remaining barriers

GitHub identity is `proofdig321`; repository permission is `ADMIN` for `proofdig321/GIS` but `push:false` for both application repositories. New application work was committed locally to preserve it, but no app push was attempted. The current `.env.test` has no `SUPABASE_ACCESS_TOKEN`, direct database URL/password, `VERCEL_TOKEN`, `GRATISGIS_OGC_API_URL`, GratisGIS credential, or `UMKHANDLU_OPERATOR_TOKEN`; Supabase and Vercel CLIs are also unavailable. A Supabase service-role key does not provide a verified SQL migration or deployment route. No operator session was available to exercise the UI. No migration or deployment was performed. See **Remaining blockers** below.

## Executive summary

Continued from the existing three-repository work without resetting or replacing it. Protected the supplied `.env.test`, used only selected values for read-only connectivity/build checks, verified the deployed MCP and Control Centre APIs, and improved the MCP’s feature metadata and Amajuba inventory reporting.

The live checks establish that the Giga/UNICEF/ITU catalogue entry reports 834 features and that all 834 can be paginated from the public Control Centre feature API. Against the published Municipal Demarcation Board (MDB) Amajuba DC25 polygon and the union of its 55 published 2026 wards, 192 school points are inside and 642 are outside. The previously reported 106 candidates are reproduced by searching the in-district features’ `name` for `primary`; this is a text-search result, not the dataset inventory or verified school identity.

Important deployment gaps remain: the live feature API omits source-feature IDs and detailed permission/licence/provenance metadata present in the current local Control Centre source; the live Governance Node spatial response omits coordinate-provenance fields present in its local source; and no adopted persistent GratisGIS URL or auth contract is configured. No production data, permissions, migrations, Sanity records, or deployments were changed.

## Repository state

Remote refs were fetched before recording this status. Existing work was preserved.

| Repository | Branch / relevant commit | Upstream divergence | Worktree |
|---|---|---:|---|
| GIS MCP (`proofdig321/GIS`) | `main` / implementation `e2605f4f4939d62528ae59940731d9501584662b` | 0 ahead, 0 behind | Changes committed and pushed; `.env.test` ignored |
| Control Centre (`prooftv/unami-platform-core`) | `main` / `f2e26bac2a732ed55a77d570fdef494ba46a4dbf` | 2 ahead, 0 behind | Local changes committed; not pushed |
| Governance Node (`prooftv/Umkhandlu`) | `trunk` / `d6c10dc0ca1575f87733a6b4ada7ee434ed6c02d` | 3 ahead, 0 behind | Local changes committed; not pushed |

GIS MCP changes were committed and pushed to `proofdig321/GIS` `main` as `e2605f4f4939d62528ae59940731d9501584662b`, with the report update at `87d9ff6a8469a0b877326990412b03d48910b585`. Application changes are preserved in local commits `prooftv/unami-platform-core` `f2e26bac2a732ed55a77d570fdef494ba46a4dbf` and `prooftv/Umkhandlu` `d6c10dc0ca1575f87733a6b4ada7ee434ed6c02d`; they were not pushed because GitHub reports `push:false`. No production deployment or database migration was run.

## `.env.test` handling

- `/workspaces/GIS/.env.test` is present, untracked, and now explicitly ignored by the GIS MCP repository’s `.gitignore`. `git check-ignore` confirms it is ignored.
- Its values were not printed, copied, committed, or written into reports. Read-only MCP checks used an allowlist of required values; the MCP child process was not given the Sanity write token, Supabase service-role key, an operator token, or any GratisGIS credential.
- The Control Centre build received only the Supabase variables it needs from the supplied test environment. Build output was checked for and scrubbed of those exact values before display.
- The root `.env.test` is not automatically loaded from the nested application repository directories. No blanket loader or cross-repository secret copy was added. The GIS MCP loads `.env` or host-injected variables, not `.env.test`.
- Missing from the supplied file are `GRATISGIS_OGC_API_URL`, any verified GratisGIS credential, `UMKHANDLU_OPERATOR_TOKEN`, `SUPABASE_ACCESS_TOKEN`, a database URL/password, and `VERCEL_TOKEN`. The file does include a Supabase service-role key and a Sanity write token; neither was used for migration, deployment, or write operations. The MCP’s `SANITY_READ_TOKEN` name also differs from the Governance Node’s `SANITY_API_READ_TOKEN`; the latter was mapped only in the isolated read-only check.

## Live integration verification

All requests below were read-only and used existing source-verified API routes.

### MCP and service health

- Started the built MCP using stdio and completed MCP initialization. It registered 27 tools, including `analyse_amajuba_spatial_pilot`, `list_spatial_datasets`, `check_api_health`, and `check_integration_health`.
- MCP health/integration calls succeeded against the configured Control Centre and Governance Node endpoints.
- Control Centre wards API: HTTP 200, 55 ward features.
- Control Centre public map-layers API: HTTP 200, 16 layers, `permissionFiltered=true`.
- Authenticated Governance Node `/api/intelligence/health`: HTTP 200, `healthy`.
- The authenticated Governance Node `/api/intelligence/spatial` route returned HTTP 200, 11 georeferences, but zero municipality and ward entries. Its live georeferences did not contain `coordinateSource`, `coordinateRole`, or `locationPrecision`, despite those fields existing in the current local route source.
- The MCP integration summary reported 0 of 4 Sanity school records linked with `spatialFeatureId`. This is a linkage gap, not evidence that the official feature geometry is missing; Sanity points were not used or changed.

### Public Control Centre catalogue

The MCP listed 16 public layers. The response includes layers only after the public endpoint’s source/dataset permission checks; it does not, by itself, reveal the underlying permission records.

| Public layer | Catalogue feature count |
|---|---:|
| HOT OSM Roads — Amajuba DC25 | 14,738 |
| HOT OSM Railways — Amajuba DC25 | 1,673 |
| HOT OSM Points of Interest — Amajuba DC25 | 4,160 |
| HOT OSM Waterways — Amajuba DC25 | 19,098 |
| HOT OSM Financial Services — Amajuba DC25 | 61 |
| HOT OSM Populated Places — Amajuba DC25 | 1,917 |
| HOT OSM Cultural Places — Amajuba DC25 | 158 |
| HOT OSM Health Facilities — Amajuba DC25 | 50 |
| Giga Schools — Amajuba DC25 | 834 |
| HOT OSM Education Facilities — Amajuba DC25 | 129 |
| KZN DARD Local Municipalities — Amajuba DC25 | 3 |
| KZN DARD District Municipality — Amajuba DC25 | 1 |
| MDB WardProfile 2021 — Amajuba DC25 | 53 |
| MDB District Municipality 2026 — Amajuba DC25 | 1 |
| MDB Local Municipalities 2026 — Amajuba DC25 | 3 |
| MDB Wards 2026 — Amajuba DC25 | 55 |

### Giga / UNICEF / ITU inventory and geographic check

- **Dataset:** `b02a30ea-d240-4834-95e4-fa7a3a95c063` — Giga Schools — Amajuba DC25.
- **Source:** `8571804f-dab8-4b03-a7bc-cd597612d608` — Giga / ITU — School Geolocation & Connectivity (ZAF), institution Giga (UNICEF / ITU).
- The catalogue reports 834 features. A read-only fetch retrieved **834/834** using four offset pages of 250, with 834 unique Control Centre feature IDs and complete pagination. All 834 returned geometries were Points.
- **Boundary used:** MDB District Municipality 2026 dataset `7bd6d9ba-3336-42a8-b8be-a66ca636e0c9`, source `50cd6199-c8e4-48dc-b4f7-a95c62278f85`, feature `c5e2a981-98c2-4f1c-a023-b368aacbb11b`. Its returned properties identify district code DC25 and Amajuba; attribution is Municipal Demarcation Board (MDB) — public domain; vintage 2026.
- The point-in-polygon count was **192 inside Amajuba** and **642 outside** the district boundary. An independent containment check against all 55 MDB 2026 ward polygons produced the same 192/642 split, with no features matching multiple ward polygons.
- The MCP district query returned 214 unique points in the bounding extent; exact ward-polygon containment reduced that to 192. Searching those in-district names for the substring `primary` returned **106 candidates**. Thus 106 is a filtered name-search count, not the total inventory; name matching is discovery only.
- The public attribution string says “Giga (UNICEF/ITU) — CC-BY 4.0. School connectivity data.” The live feature response did not supply independent dataset/source licence terms or provenance, so the attribution string is not treated as a substitute for those records.
- **Scope/data-quality risk:** although named “Amajuba DC25,” 642 of the 834 geometries are outside Amajuba. Do not treat all 834 as an Amajuba-only inventory or use the label as proof of coverage. An operator must investigate the source clipping/registration and correct it through the approved workflow; no dataset or production permission was changed.
- The deployed feature response returns dataset/source IDs, attribution, dataset vintage and publication timestamp, but omits `sourceFeatureId`, `datasetPermission`, `sourcePermission`, licence terms, and dataset provenance. Consequently, the current live endpoint demonstrates that the dataset is publicly retrievable through its checks, but does **not** expose enough evidence to independently confirm the exact source and dataset classifications or reconcile upstream feature IDs.

### Notice radius

The Control Centre-backed MCP lookup returned a **500 m liquor-notice reference** citing KZN Liquor Licensing Act s.43(2)(b). The MCP reports this as notice-specific context, not a universal buffer or legal determination. No 200 m universal/statutory radius is claimed.

## Code changes in this continuation

GIS MCP changes:

- `.gitignore` — explicitly ignore the supplied root `.env.test`.
- `src/lib/cc-client.ts` — type optional source/dataset permission, licensing, provenance and source-vintage metadata; preserve upstream `sourceFeatureId` when returned.
- `src/tools/feature-search.ts` — include source feature IDs and report permission/licence/provenance fields when present, distinguishing “not provided” from “not returned.”
- `src/tools/notice-intelligence.ts` — report total dataset inventory, bounding-extent retrieval, administrative-boundary inclusion, and text-match counts separately; correct pagination completion handling across pages/tiles; retain source feature IDs and report optional metadata without inferring absent values.
- `.env.example`, `.gitignore`, `README.md`, and `mcp.json` — remove literal credentials from the tracked runtime config, ignore `.env.test`, document protected environment setup and credential rotation. Historical Git copies remain; rotation is still required.
- `tests/mcp-config-security.test.ts` — ensure credential-bearing environment-variable names are not embedded in tracked MCP config.
- `report.md` — this report.

Current application-repository worktree files (uncommitted; none were pushed):

- Control Centre:
  - `.env.example`
  - `apps/umkhandlu/package.json`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/_actions.ts`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/datasets/[id]/page.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/coverage-actions.ts`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/datasets/_components/DatasetCoverageReview.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/datasets/_components/GratisGisFetchTrigger.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/sources/[id]/page.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/sources/_components/GratisGisCatalogue.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/sources/_components/SourceForm.tsx`
  - `apps/umkhandlu/src/app/(umkhandlu)/spatial/sources/page.tsx`
  - `apps/umkhandlu/src/app/api/spatial/features/[id]/route.ts`
  - `apps/umkhandlu/src/app/api/spatial/features/route.ts`
  - `apps/umkhandlu/src/app/api/spatial/map-layers/route.ts`
  - `apps/umkhandlu/src/app/api/spatial/notice-context/route.ts`
  - `apps/umkhandlu/src/app/api/spatial/notice-layers/route.ts`
  - `apps/umkhandlu/src/app/api/spatial/wards/route.ts`
  - `apps/umkhandlu/src/lib/gis/__tests__/spatial-public-access.test.mjs`
  - `apps/umkhandlu/src/lib/gis/__tests__/coverage-review.test.mjs`
  - `apps/umkhandlu/src/lib/gis/__tests__/gratisgis-client.test.mjs`
  - `apps/umkhandlu/src/lib/gis/coverage-review.ts`
  - `apps/umkhandlu/src/lib/gis/gratisgis-client.ts`
  - `apps/umkhandlu/src/lib/gis/spatial-permissions.ts`
  - `apps/umkhandlu/src/lib/gis/spatial-pipeline.ts`
  - `apps/umkhandlu/src/lib/gis/spatial-sources-fetcher.ts`
  - `apps/umkhandlu/supabase/migrations/014_restrict_spatial_staging_reads.sql`
  - `apps/umkhandlu/supabase/migrations/015_gratisgis_feature_identity.sql`
  - `apps/umkhandlu/supabase/migrations/APPLY_IN_SQL_EDITOR.sql`
- Governance Node: `src/lib/spatial/map-layers.ts`, `src/lib/spatial/map-layers.test.ts`.

The Control Centre coverage-review files above were added in this continuation; the other listed Control Centre and Governance Node worktree changes were preserved. No changes were made to production Sanity, Supabase, GratisGIS, or deployment state.

## Validation

- GIS MCP: `npm run typecheck`, `npm run build`, and `npm test` passed; **9 suites / 150 tests passed**.
- Control Centre: coverage review **5 tests**, GratisGIS client **2 tests**, permissions **30 tests**, and spatial API **9 tests** passed. Production Next build passed with the allowlisted test environment; it emitted a workspace-root warning because multiple lockfiles were detected. Direct `tsc --noEmit` still encounters the existing duplicate global `test`/`expect` declarations in `permission-enforcement.test.ts`.
- Governance Node: `npm run typecheck` and all **35 tests** passed. The configured `vercel-build` task was rerun and Next.js exited with `SIGTERM`; a prior build run had passed, so build success is not reproducible in the latest attempt.
- `git diff --check` passed in all three repositories. `.env.test` ignore status was verified.
- Read-only `.env.test` database inspection confirmed the 834 staged rows, permission classifications, missing license/provenance and unknown authority fields, plus anonymous table denial. No production migration, deployment, data write, or publication was performed.

## Remaining blockers

1. No adopted persistent GratisGIS endpoint or authentication contract is available in `.env.test` or verified in the environment. The public demo was not treated as Umkhandlu’s deployment.
2. The GIS MCP operator token is absent, so the operator-only integrity report and exact protected source/dataset permission records could not be checked.
3. The live Control Centre feature API is behind the current local contract for upstream feature IDs and detailed permission/licence/provenance fields. Test-database evidence shows `source_feature_id` is absent (SQLSTATE `42703`), consistent with migration 015 not being reflected there. Authenticated non-operator access and deployed grants/RLS remain unverified. No migration was applied.
4. The live Governance Node spatial API is missing coordinate provenance and administrative-area data returned by current local source. Governance Node build now passes locally, but deployed API behavior remains unverified.
5. The Giga collection’s Amajuba label conflicts with its geometry coverage (642 features outside the district). An operator must verify the source export and decide the approved correction before publishing it as an Amajuba-only dataset.
6. Credential rotation for the previously committed credentials remains an owner action. Credential values are not in the current `mcp.json` or this report; historical Git revisions still contain them and were not rewritten.
7. Control Centre and Governance Node changes are preserved as local commits `f2e26bac2a732ed55a77d570fdef494ba46a4dbf` and `d6c10dc0ca1575f87733a6b4ada7ee434ed6c02d`; they are respectively 2 and 3 commits ahead of the fetched remotes. GitHub reports `push:false` for both, so no push was attempted. An authorized maintainer must push these commits or grant write access. The separate GIS MCP changes are committed and pushed at `e2605f4f4939d62528ae59940731d9501584662b`.
8. The supplied test environment cannot apply migrations: it lacks Supabase CLI, project-management access token, and a direct database connection string. Its service-role API key is not used as an unverified SQL execution mechanism. Migrations 014/015 are included in the local Control Centre commit but remain unapplied.
9. No application deployment was triggered. There is no Vercel CLI/token or verified deployment target in the supplied environment, and pushing the app branches is not authorized by current GitHub permissions.
