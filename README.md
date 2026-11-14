# Umkhandlu GIS & Spatial Intelligence MCP

Specialist tool interface for understanding, retrieving, validating, connecting, analysing and managing the spatial data that powers Umkhandlu's Control Centre and Governance Node.

**Pilot area:** Amajuba District Municipality (DC25), KwaZulu-Natal — Newcastle (KZN252), eMadlangeni (KZN253), Dannhauser (KZN254).

Ward 7 is one optional test area within the district. Khethokuhle Primary School is an optional Ward 7 reference institution, not the pilot focus. Its Sanity geopoint is incorrect/unverified comparison evidence; only retrieved dataset geometry from a source verified as authoritative may be used for institutional spatial analysis. The MCP never updates Sanity.

---

## Setup

### 1. Install and build

```bash
cd /workspaces/GIS
npm install
npm run build
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in:
# UMKHANDLU_OPERATOR_TOKEN  — for operator tools (integrity report, probe)
# SANITY_READ_TOKEN         — for Sanity content queries
# INTELLIGENCE_API_KEY      — for Governance Node intelligence API
```

Credentials required per tool group:

| Tool group | Auth required |
|---|---|
| A — Dataset discovery (public layers) | None |
| A — Integrity report | `UMKHANDLU_OPERATOR_TOKEN` |
| B — Ward boundaries, demographics, features | None |
| C — Geodesic calculations, geometry validation | None |
| D — Sanity content (notices, listings) | `SANITY_READ_TOKEN` (or public if token omitted) |
| E — Notice intelligence, pilot analysis | None + `SANITY_READ_TOKEN` |
| F — Map layer profiles | None |
| G — API health, integration health | None |
| G — Full integrity report, probe | `UMKHANDLU_OPERATOR_TOKEN` |

### 3. Register with Amazon Q CLI

Copy `mcp.json` to `~/.aws/amazonq/mcp.json` (or merge into existing):

```bash
cp /workspaces/GIS/mcp.json ~/.aws/amazonq/mcp.json
```

Add sensitive tokens to the `env` block in `~/.aws/amazonq/mcp.json` — never commit them.

### 4. Run tests

```bash
npm test
```

98 tests across 7 suites: geodesic math, permission model, proximity thresholds, district pilot workflow, Sanity query safety, Control Centre timeout handling and live proximity-configuration sourcing.

---

## Tool inventory

### Group A — Spatial source and dataset discovery

| Tool | Auth | Description |
|---|---|---|
| `list_spatial_datasets` | None | List public datasets; filter by notice type or bbox |
| `get_spatial_integrity_report` | Operator | Control Centre data quality report |
| `get_proximity_radius_config` | None | Retrieve notice-type reference distances from the Control Centre |

### Group B — Spatial feature discovery

| Tool | Auth | Description |
|---|---|---|
| `get_ward_boundaries` | None | MDB 2026 ward boundaries for Amajuba DC25 (55 wards) |
| `get_ward_demographics` | None | 2021 ward demographic profile |
| `search_features_by_name` | None | Search dataset features by name property |
| `get_features_near_point` | None | Features within radius of a point, sorted by distance |
| `get_administrative_context` | None | Resolve ward/municipality/district for a coordinate |

### Group C — Spatial verification and analysis

| Tool | Auth | Description |
|---|---|---|
| `calculate_geodesic_distance` | None | Haversine distance and bearing between two points |
| `analyse_notice_proximity` | None | Distance from notice to institution with provenance flags |
| `validate_geojson_geometry` | None | Validate GeoJSON, check axis order, SA bounding box |
| `check_point_in_ward` | None | Point-in-polygon against MDB 2026 ward boundaries |
| `compare_institution_candidates` | None | Sanity geopoint vs authoritative dataset coordinate |

### Group D — Sanity content relationships

| Tool | Auth | Description |
|---|---|---|
| `get_spatial_content_summary` | Sanity | Spatial linkage state of all Sanity content |
| `list_development_notices` | Sanity | List notices with coordinate and linkage status |
| `get_notice_detail` | Sanity | Full spatial detail for a notice by slug or ID |
| `list_listings_without_spatial_feature` | Sanity | Listings with no `spatialFeatureId` |
| `search_listings` | Sanity | Search listings by name fragment |

### Group E — Notice and commercial intelligence

| Tool | Auth | Description |
|---|---|---|
| `analyse_notice_spatial_context` | Sanity | Full spatial context for a notice (admin + layers + radius) |
| `find_institutions_near_notice` | Sanity | Institution features from a selected dataset near a notice |
| `analyse_amajuba_spatial_pilot` | Control Centre + Sanity | Discover datasets, retrieve institution features by dataset/feature ID, and analyse district-wide notices; optionally select Ward 7 |

### Group F — Map and page-context intelligence

| Tool | Auth | Description |
|---|---|---|
| `get_map_layer_profile` | None | Layer recommendations for a specific page/workflow |
| `get_all_map_layer_profiles` | None | All page context profiles |

### Group G — Data integrity and operational monitoring

| Tool | Auth | Description |
|---|---|---|
| `check_api_health` | None | Health of all platform APIs |
| `check_integration_health` | None | CC ↔ Node integration status and known gaps |
| `get_full_integrity_report` | Operator | Combined CC catalogue + Sanity spatial gaps |
| `probe_spatial_source` | Operator | Probe a spatial source URL for reachability |

---

## Resources

| URI | Description |
|---|---|
| `umkhandlu://spatial/amajuba-district` | Geographic reference for the Amajuba District pilot area |
| `umkhandlu://spatial/permission-model` | Permission classification vocabulary and redistribution rules |
| `umkhandlu://spatial/proximity-config` | Control Centre notice-type references and the separate Ward 7 200m demonstration |
| `umkhandlu://spatial/institutional-authority-rules` | Authoritative location rules vs Sanity geopoints |
| `umkhandlu://platform/integration-contracts` | CC ↔ Node integration contracts and known gaps |

## Prompts

| Prompt | Description |
|---|---|
| `amajuba_spatial_session` | Start a GIS session with key rules loaded |
| `verify_institution_location` | Workflow for verifying an institution against an authoritative dataset |
| `notice_proximity_analysis` | Workflow for analysing a notice against nearby institutions |

---

## Proximity system

Notice-type proximity values are retrieved from the existing Control Centre notice-layers API; the MCP does not keep a parallel hardcoded radius table.

**Ward 7 test-area demonstration**:
- 200m — a demonstration distance available when Ward 7 is selected
- It is **distinct** from the 500m liquor-notice reference
- It is **not** a statutory radius or universal buffer, and is **not** a legal determination

The 500m value is a liquor-notice reference only where returned for that notice type; neither value is a universal buffer. All distance calculations are evidence for operator review. The MCP never makes legal or statutory compliance determinations.

---

## Spatial authority rules

1. Discover candidate datasets through the Control Centre and report their identity, attribution, permission, vintage and provenance where exposed. Verify custodian/authority rather than inferring it from a dataset name.
2. Sanity geopoints are operator-entered content — not authoritative spatial data.
3. Retrieve institutional geometry with the selected dataset ID and exact feature ID. Name matches are discovery leads only.
4. Never use a Sanity point in place of authoritative geometry. For Khethokuhle Primary School, the Sanity point is incorrect/unverified comparison evidence; do not silently update it.
5. Never match institutions solely by name and auto-approve.
6. Notice coordinates retain their own provenance — never move them to an institution's coordinates.
7. Record evidence and method used to verify any association.

---

## Architecture

```
/workspaces/GIS/
├── src/
│   ├── index.ts              — MCP server entry point (22 tools, 5 resources, 3 prompts)
│   ├── lib/
│   │   ├── env.ts            — Environment configuration
│   │   ├── geodesic.ts       — Haversine distance, bearing, point-in-polygon, centroid
│   │   ├── cc-client.ts      — Control Centre spatial API client
│   │   └── sanity-client.ts  — Governance Node Sanity read client
│   ├── tools/
│   │   ├── spatial-discovery.ts    — Group A: dataset discovery, integrity, proximity config
│   │   ├── feature-search.ts       — Group B: ward boundaries, demographics, feature search
│   │   ├── spatial-verification.ts — Group C: geodesic distance, geometry validation
│   │   ├── sanity-relationships.ts — Group D: notices, listings, spatial linkage gaps
│   │   ├── notice-intelligence.ts  — Group E: notice context, Amajuba district pilot analysis
│   │   ├── map-context.ts          — Group F: map layer profiles per page context
│   │   └── data-integrity.ts       — Group G: API health, integration health, integrity
│   └── resources/
│       └── index.ts          — Static reference resources
├── tests/
│   ├── geodesic.test.ts              — 47 tests: Haversine, bearing, GeoJSON, point-in-polygon
│   ├── permissions.test.ts           — 26 tests: permission model, MDB patch, COGTA restriction
│   ├── proximity.test.ts             — 18 tests: demonstration/reference distinction and provenance
│   ├── amajuba-spatial-pilot.test.ts — District workflow and source-coordinate behavior
│   ├── spatial-discovery.test.ts     — Live Control Centre proximity configuration
│   ├── sanity-client.test.ts         — Parameterized listing type filters
│   └── cc-client.test.ts             — Timeout cleanup
├── .env.example
├── mcp.json                  — Amazon Q CLI client configuration
└── README.md
```

No new database. No new Sanity project. No new infrastructure.
Calls existing Control Centre spatial APIs and Governance Node Sanity project.

---

## Supported capabilities

- ✅ Spatial source and dataset discovery (public + operator)
- ✅ Ward boundary retrieval (55 MDB 2026 wards, Amajuba DC25)
- ✅ Ward demographic profiles (MDB WardProfile 2021)
- ✅ Feature search by name and proximity
- ✅ Administrative context resolution (ward/municipality/district)
- ✅ Geodesic distance and bearing calculations
- ✅ GeoJSON geometry validation and axis-order checking
- ✅ Point-in-polygon ward containment
- ✅ Institution candidate comparison (Sanity vs authoritative)
- ✅ Development notice inspection and spatial context
- ✅ Notice proximity analysis with provenance flags
- ✅ Amajuba District-wide spatial pilot with optional Ward 7 test area
- ✅ Control Centre dataset discovery and exact dataset/feature-ID geometry retrieval
- ✅ Proximity comparison (Ward 7 200m demonstration vs applicable 500m liquor-notice reference)
- ✅ Sanity content spatial linkage gap reporting
- ✅ Map layer profiles per page/workflow context
- ✅ API and integration health checks
- ✅ Control Centre integrity report (operator)
- ✅ Source health probe (operator)

## Integration verification / pending

- ⏳ Live Control Centre dataset discovery and authoritative education dataset availability (must be verified against actual API responses)
- ⏳ COGTA ILIS traditional authority boundaries (IP allowlisting pending)
- ⏳ NGI cadastral data (formal licence required)
- ⏳ KZNERA licensed premises register (not machine-readable)
- ⏳ Write operations of any kind (read-only by design)
- ⏳ Automatic `spatialFeatureId` assignment (operator review required)
- ⏳ Legal or statutory compliance determinations (out of scope by design)
