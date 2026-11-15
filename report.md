# Report

**Umkhandlu GIS / GratisGIS integration update — 2026-11-15**

## Access, migration, and deployment update — 2026-11-15 04:45 UTC

The user clarified that a GitHub PAT was included as a note in `/workspaces/GIS/env.md`, not as an environment assignment. The PAT was read in memory only, never printed, and used for authenticated permission checks and pushes. GitHub identified its owner as `prooftv`, with `push=true` and `admin=true` on both original application repositories.

Successfully pushed the existing application commits without force-pushing:

- Control Centre `prooftv/unami-platform-core` `main`: `f2e26bac2a732ed55a77d570fdef494ba46a4dbf`.
- Governance Node `prooftv/Umkhandlu` `trunk`: `d6c10dc0ca1575f87733a6b4ada7ee434ed6c02d`.

Both branches are now equal to their fetched `origin` branches and both app worktrees are clean. All four Control Centre Vercel checks completed successfully. Both Governance Node Vercel checks failed; GitHub’s status response points to `vercel inspect ... --logs` for details, but no Vercel token is available to retrieve the deployment logs. Public health checks still returned HTTP 200: 55 Control Centre wards and Governance Node `healthy`. These check results do not prove the new Governance Node commit was deployed.

The Supabase PAT was embedded in a note and was used through the official Supabase CLI (via `npx`) against project `Umkhandlu` / `ufsmpqxniswdnsywjzje`, which the CLI identified as **production**. Migrations 014 and 015 were applied individually and their migration versions recorded as applied. Read-only post-checks confirmed: anonymous and authenticated `SELECT` are denied on `spatial_staged_features`; the service role retains `SELECT`; the authenticated policy is gone; `source_feature_id` and its partial unique index exist; and `gratisgis-fetch` is allowed by the pipeline constraint.

The legacy migration history remains inconsistent: remote history contains versions 000, 001, 002, 014, and 015; local versions 003–013 are not recorded remotely (although their target tables/policies exist), and `db push --dry-run` reports remote version 000 is missing from the local migration directory. I did not replay the broad `APPLY_IN_SQL_EDITOR.sql` bundle: it includes legacy DDL and data updates, while several target tables/policies already exist and its policy creation is not idempotent.

After the successful Control Centre release, the public Giga feature endpoint returned HTTP 200, reported inventory total 834, and included attribution and the `sourceFeatureId` response field. The sampled existing feature's source ID is `null`; migration 015 added the storage column but did not backfill upstream IDs. No feature data was changed.

Governance Node Vercel deployments `umkhandlu-dlamini` (`dpl_FYo4hAspL27RHCKMDMwENkikESrQ`) and `umkhandlu` (`dpl_DgvoxPWwaMKustCdoHheiCumf7HM`) failed. The Vercel status check points to `vercel inspect <deployment> --logs`; that requires Vercel authentication not present in the notes. The public Governance Node health endpoint returned healthy, but that does not verify the failed commit was deployed.

## Current implementation update — 2026-11-15

The full delivery mandate is still **in progress**. This increment adds an operator-only, read-only coverage review on the Control Centre dataset detail page. It discovers an MDB district dataset by source identity, then verifies Amajuba DC25 using both the district-code and district-name properties rather than a hard-coded dataset UUID. It supports Polygon/MultiPolygon point containment, holes and boundary points, retrieves the full bounded inventory in pages, reports operator-status/invalid/non-point counts, and lists up to 100 out-of-polygon staging records for review. It does not clip, delete, relabel, approve, publish, or change permissions. A missing or ambiguous boundary fails closed; an unverified source authority is visibly marked as reference evidence.

The supplied test configuration was used for **read-only** database verification. Current database evidence:

- Giga dataset `b02a30ea-d240-4834-95e4-fa7a3a95c063` is active and published; its database feature count and stored rows are both **834**, all currently `approved`.
- Both dataset- and source-level permission classifications are `redistribute`. However, the source authority status is `unknown`; dataset/source licence-term fields and dataset provenance are not recorded. Redistribution classification is not treated as a substitute for missing licence evidence.
- The matched MDB 2026 Amajuba boundary has the expected DC25/name identity, but the boundary source authority status is also `unknown`, and licence terms are not recorded. The operator report therefore presents the 192/642 point-in-polygon comparison as **unverified geometric evidence**, not authoritative coverage.
- Migrations 014/015 were applied to the configured production Supabase project on 2026-11-15. Post-apply catalog checks confirmed staged-feature `SELECT` is false for `anon` and `authenticated`, true for `service_role`, the old authenticated read policy is absent, `source_feature_id` is present, its partial unique index is present, and GratisGIS is accepted by the pipeline type constraint.
- The previous anonymous REST request was denied. Authenticated direct table access is now denied by explicit privilege and policy verification. Other deployed RLS/grants were not exhaustively audited.

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

The GIS MCP and both application branches are pushed. Control Centre Vercel deployments completed successfully; Governance Node deployments failed. Migrations 014/015 are applied and verified. There is still no configured persistent GratisGIS endpoint/credential or `UMKHANDLU_OPERATOR_TOKEN`, and no operator session was available to exercise the UI.

## Executive summary

Continued from the existing three-repository work without resetting or replacing it. Protected the supplied `.env.test`, used only selected values for read-only connectivity/build checks, verified the deployed MCP and Control Centre APIs, and improved the MCP’s feature metadata and Amajuba inventory reporting.

The live checks establish that the Giga/UNICEF/ITU catalogue entry reports 834 features and that all 834 can be paginated from the public Control Centre feature API. Against the published Municipal Demarcation Board (MDB) Amajuba DC25 polygon and the union of its 55 published 2026 wards, 192 school points are inside and 642 are outside. The previously reported 106 candidates are reproduced by searching the in-district features’ `name` for `primary`; this is a text-search result, not the dataset inventory or verified school identity.

Important integration gaps remain: the live feature API now includes `sourceFeatureId` but existing records return it as null, and detailed permission/licence/provenance metadata is still missing; the live Governance Node spatial response omits coordinate-provenance fields present in its local source; and no adopted persistent GratisGIS URL or auth contract is configured. No source/dataset records or Sanity records were changed. Production database permissions/schema were changed only by the explicitly requested migrations 014/015.

## Repository state

Remote refs were fetched before recording this status. Existing work was preserved.

| Repository | Branch / relevant commit | Upstream divergence | Worktree |
|---|---|---:|---|
| GIS MCP (`proofdig321/GIS`) | `main` / latest report commit (see this report commit) | 0 ahead, 0 behind | Changes pushed; `env.md` untracked |
| Control Centre (`prooftv/unami-platform-core`) | `main` / `f2e26bac2a732ed55a77d570fdef494ba46a4dbf` | 0 ahead, 0 behind | Pushed; clean |
| Governance Node (`prooftv/Umkhandlu`) | `trunk` / `d6c10dc0ca1575f87733a6b4ada7ee434ed6c02d` | 0 ahead, 0 behind | Pushed; clean |

GIS MCP code changes are committed and pushed at `e2605f4f4939d62528ae59940731d9501584662b`; subsequent report commits are recorded on `main`. The application commits listed above are pushed to their original remotes. Control Centre Vercel checks succeeded; both Governance Node Vercel checks failed. Production Supabase migrations 014/015 were applied and verified.

## Credential notes and environment handling

- The supplied notes file is now `/workspaces/GIS/env.md`; it is ignored by the GIS MCP `.gitignore` and was not committed. Credential values were not printed or written to the report. The GitHub and Supabase PATs were read in memory and used only with their respective services; the Supabase service-role key was used only for the earlier read-only REST probe.
- The Control Centre build received only the Supabase variables it needs from the supplied test environment. Build output was checked for and scrubbed of those exact values before display.
- The root `.env.test` is not automatically loaded from the nested application repository directories. No blanket loader or cross-repository secret copy was added. The GIS MCP loads `.env` or host-injected variables, not `.env.test`.
- Missing from the supplied notes are `GRATISGIS_OGC_API_URL`, any verified GratisGIS credential, `UMKHANDLU_OPERATOR_TOKEN`, a database URL/password, and `VERCEL_TOKEN`. The Supabase PAT was supplied as a note and used by the CLI. The notes also include a Supabase service-role key and Sanity write token; neither was used to perform writes. The MCP’s `SANITY_READ_TOKEN` name also differs from the Governance Node’s `SANITY_API_READ_TOKEN`; the latter was mapped only in the isolated read-only check.

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
- At the initial live check, the deployed feature response returned dataset/source IDs, attribution, dataset vintage and publication timestamp, but omitted `sourceFeatureId`, `datasetPermission`, `sourcePermission`, licence terms, and dataset provenance. After the later Control Centre deployment it includes the `sourceFeatureId` field, but sampled existing records contain `null`; permission classifications, licence terms, and provenance remain absent from the response.

### Notice radius

The Control Centre-backed MCP lookup returned a **500 m liquor-notice reference** citing KZN Liquor Licensing Act s.43(2)(b). The MCP reports this as notice-specific context, not a universal buffer or legal determination. No 200 m universal/statutory radius is claimed.

## Code changes in this continuation

GIS MCP changes:

- `.gitignore` — ignore the supplied root `.env.test` and, after it was renamed, `/env.md`.
- `src/lib/cc-client.ts` — type optional source/dataset permission, licensing, provenance and source-vintage metadata; preserve upstream `sourceFeatureId` when returned.
- `src/tools/feature-search.ts` — include source feature IDs and report permission/licence/provenance fields when present, distinguishing “not provided” from “not returned.”
- `src/tools/notice-intelligence.ts` — report total dataset inventory, bounding-extent retrieval, administrative-boundary inclusion, and text-match counts separately; correct pagination completion handling across pages/tiles; retain source feature IDs and report optional metadata without inferring absent values.
- `.env.example`, `.gitignore`, `README.md`, and `mcp.json` — remove literal credentials from the tracked runtime config, ignore `.env.test`, document protected environment setup and credential rotation. Historical Git copies remain; rotation is still required.
- `tests/mcp-config-security.test.ts` — ensure credential-bearing environment-variable names are not embedded in tracked MCP config.
- `report.md` — this report.

Application-repository files included in the pushed commits:

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

The Control Centre coverage-review files above were added in this continuation; the other listed Control Centre and Governance Node worktree changes were preserved. No production Sanity or source/dataset record changes were made. The explicitly requested 014/015 database migrations were applied; app deployment checks completed with Control Centre success and Governance Node failure.

## Validation

- GIS MCP: `npm run typecheck`, `npm run build`, and `npm test` passed; **9 suites / 150 tests passed**.
- Control Centre: coverage review **5 tests**, GratisGIS client **2 tests**, permissions **30 tests**, and spatial API **9 tests** passed. Production Next build passed with the allowlisted test environment; it emitted a workspace-root warning because multiple lockfiles were detected. Direct `tsc --noEmit` still encounters the existing duplicate global `test`/`expect` declarations in `permission-enforcement.test.ts`.
- Governance Node: `npm run typecheck` and all **35 tests** passed. The configured `vercel-build` task was rerun and Next.js exited with `SIGTERM`; a prior build run had passed, so build success is not reproducible in the latest attempt.
- `git diff --check` passed in all three repositories. `.env.test` ignore status was verified.
- Read-only `.env.test` database inspection confirmed the 834 staged rows, permission classifications, missing license/provenance and unknown authority fields, and anonymous table denial. The later production migrations added `source_feature_id` and removed authenticated staged-table reads. No feature/source/dataset records were changed or published.

## Remaining blockers

1. No adopted persistent GratisGIS endpoint or authentication contract is available in `env.md` or verified in the environment. The public demo was not treated as Umkhandlu’s deployment.
2. The GIS MCP operator token is absent, so the operator-only integrity report and exact protected source/dataset permission records could not be checked.
3. Migration history is inconsistent: remote history contains 000–002 and 014–015, while local 003–013 are not recorded remotely; remote schema objects exist, suggesting earlier manual application. Standard `db push --dry-run` fails because remote version 000 has no matching local migration file. The broad legacy bundle was not replayed because it contains non-idempotent policies and data updates.
4. Both new Governance Node Vercel deployments failed. The public health endpoint still returns healthy, but does not prove the new commit is live. Vercel deployment logs require Vercel CLI authentication, which is not configured in `env.md`.
5. The Giga collection’s Amajuba label conflicts with its geometry coverage (642 features outside the district). An operator must verify the source export and decide the approved correction before publishing it as an Amajuba-only dataset.
6. Credential rotation for the previously committed credentials remains an owner action. Credential values are not in the current `mcp.json` or this report; historical Git revisions still contain them and were not rewritten.
7. The application commits have been pushed and the GitHub branches are synchronized. All four Control Centre deployments succeeded; both Governance Node deployments failed. Inspect/fix those deployments with Vercel access and rerun checks.
8. Migrations 014/015 were applied to the production Supabase project and verified; migration history was repaired for those two versions. The remaining 003–013 history discrepancy and missing local 000 file still prevent normal `db push` workflow.
9. No Vercel token is configured, so deployment failure logs and reruns cannot be operated through Vercel CLI from this workspace.
