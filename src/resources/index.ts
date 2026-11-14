/**
 * MCP Resources — static reference data for the Umkhandlu GIS MCP.
 * Read-only reference documents. No live API calls.
 */

export const resources = [
  {
    uri: 'umkhandlu://spatial/amajuba-district',
    name: 'Amajuba District — Spatial Reference',
    description: 'Geographic reference for the Amajuba District pilot area.',
    mimeType: 'text/plain',
    text: `Amajuba District Municipality (DC25) — Spatial Reference
Pilot area: Amajuba District, KwaZulu-Natal, South Africa

── Administrative hierarchy ──
District: Amajuba District Municipality (DC25)
Local municipalities:
  KZN252 — Newcastle Local Municipality
  KZN253 — eMadlangeni Local Municipality
  KZN254 — Dannhauser Local Municipality

── Ward baseline (MDB 2026) ──
Total wards: 55
Ward profiles (2021): 53
Unmatched wards: KZN252_35, KZN252_36 (new 2026 delimitations, no 2021 profile)
Match key: CAT_B + WardNo (compound key)

── Bounding box (WGS84) ──
West: 27.8 | South: -28.9 | East: 30.2 | North: -27.2

── Pilot scope ──
The pilot area is Amajuba District as a whole.
Ward 7, Newcastle is an optional geographic test area within the district.
Khethokuhle Primary School is an optional Ward 7 reference institution, not the pilot focus.
Its Sanity geopoint is incorrect/unverified comparison evidence. Never use it as
institutional geometry or silently update it; use the geometry retrieved from an
identified authoritative dataset and exact feature ID. All tools support district-wide use.

── Geographic hierarchy (Governance Node) ──
Amajuba District Municipality
├── Newcastle Local Municipality
│   ├── Wards 1–N (KZN252)
│   └── Traditional Authority areas
│       └── Khathide Traditional Council (Mndozo area)
│           ├── Mndozo Traditional Area
│           │   ├── KwaGudlucingo (isigodi)
│           │   └── Umndozo Omdala (isigodi)
│           ├── KwaNtuli (isigodi)
│           └── KwaMthembu (isigodi)
├── Dannhauser Local Municipality (KZN254)
└── eMadlangeni Local Municipality (KZN253)
`,
  },

  {
    uri: 'umkhandlu://spatial/permission-model',
    name: 'Spatial Permission Model',
    description: 'Permission classification vocabulary and public redistribution rules.',
    mimeType: 'text/plain',
    text: `Umkhandlu Spatial Permission Model

── Classification vocabulary ──
reference    — internal reference only
display      — may be displayed, not redistributed
internal     — display, ingest, process
download     — display, ingest, process, download
redistribute — all operations including public API
restricted   — no operations (explicit custodian restriction)
prohibited   — no operations (legal prohibition)
pending      — not yet confirmed

── Public redistribution rule ──
BOTH dataset AND source must have permission_classification = 'redistribute'.
Source-level 'pending' silently blocks all datasets from that source.

── Restricted datasets ──
KZN COGTA Infrastructure 2022 (source c8532e74):
  Water/sanitation data — RESTRICTED by Amajuba District Municipality.
  Contact: Ms Thubelihle Buthelezi (thubelihleb@amajuba.gov.za)
  This restriction applies ONLY to this source.

── MDB sources (patched 2025) ──
MDB Local Municipalities 2026 (ba3b93e6): pending → redistribute
MDB District Municipalities 2026 (50cd6199): pending → redistribute
MDB WardProfile 2021 (e15acecf): pending → redistribute
`,
  },

  {
    uri: 'umkhandlu://spatial/proximity-config',
    name: 'Proximity Radius Configuration',
    description: 'Control Centre notice-type proximity references and the separate Ward 7 200m demonstration.',
    mimeType: 'text/plain',
    text: `Umkhandlu Proximity Radius Configuration

Control Centre notice-layers API is the runtime source for notice-type references.

── Notice-type references ──
Retrieve current notice-type values from the Control Centre at runtime.
The 500m liquor-notice value is a reference only, where returned; it is not a
universal exclusion buffer or legal determination.

── Ward 7 test-area demonstration ──
The 200m proximity may be used for a Ward 7 demonstration. It is:
  • NOT a statutory radius
  • DISTINCT from the 500m liquor notice reference distance
  • A reference to demonstrate the MCP's proximity calculation capability

Never describe the 200m demonstration measurement as proof of legal compliance.

── Rules ──
1. Control Centre values are references, not universal buffers or legal determinations.
2. The Ward 7 200m demonstration is distinct from the 500m liquor-notice reference.
3. Notice coordinates retain their own provenance.
4. Do not move a notice to an institution's coordinates.
5. Do not manufacture a proximity result from an approximate location.
`,
  },

  {
    uri: 'umkhandlu://spatial/institutional-authority-rules',
    name: 'Institutional Location Authority Rules',
    description: 'Rules governing authoritative institutional locations vs Sanity geopoints.',
    mimeType: 'text/plain',
    text: `Umkhandlu Institutional Location Authority Rules

── Core rule ──
Institutional locations must be sourced from authoritative datasets.
Do NOT use Sanity geopoints as the authoritative location for schools, clinics,
hospitals, public facilities or government institutions when an official dataset exists.
Khethokuhle Primary School's Sanity geopoint is known incorrect/unverified comparison
evidence. Only use its retrieved authoritative dataset geometry for spatial analysis.

── Authoritative sources ──
Schools:    Giga Schools dataset, DBE EMIS (pending permission)
            HOT OSM Education Facilities (surrogate, ODbL)
Health:     Official health-facility datasets, HOT OSM Health Facilities (surrogate)
Municipal:  MDB administrative boundaries (CC-BY, public domain)
Traditional: COGTA ILIS Land Tenure Component v2 (pending IP allowlisting)

── Required workflow ──
1. Discover datasets and metadata through the existing Control Centre APIs.
2. Verify dataset custodian/authority; a name match is only a discovery lead.
3. Retrieve actual feature geometry by dataset ID and exact feature ID.
4. Preserve source ID, dataset ID, attribution, permission, vintage and provenance where exposed.
5. Keep authoritative geometry separate from Sanity content; compare Sanity geopoints only as unverified evidence.
6. Flag conflicts, missing metadata or duplicate locations for operator review.
7. Any spatialFeatureId association requires operator review; this MCP is read-only and never writes Sanity.

── Prohibited ──
• Never silently substitute a Sanity coordinate for an authoritative location.
• Never match institutions solely by name and auto-approve.
• Never automatically approve uncertain matches.
• Record evidence and method used to verify any association.

── Sanity role ──
Sanity owns: descriptions, names, categories, images, notices, publication status.
Sanity is NOT the default spatial authority for institutional locations.

── Commercial listings ──
For businesses without an authoritative institutional dataset, establish
location provenance explicitly. Not every listing belongs to the
institutional-location workflow.
`,
  },

  {
    uri: 'umkhandlu://platform/integration-contracts',
    name: 'Platform Integration Contracts',
    description: 'Control Centre ↔ Governance Node integration contracts and known gaps.',
    mimeType: 'text/plain',
    text: `Umkhandlu Platform Integration Contracts

── Architecture ──
Control Centre (unami-platform-core/apps/umkhandlu):
  Operator-only. Spatial catalogue, datasets, sources, pipelines.
  Serves spatial APIs consumed by the Governance Node.
  Polls Governance Node intelligence APIs.

Governance Node (umkhandlu.unamifoundation.org):
  Public-facing. Sanity CMS. Notices, listings, records, campaigns.
  Registers notices with Control Centre.
  Exposes intelligence APIs for Control Centre polling.

── CC → Node spatial APIs (public, no auth) ──
  GET /api/spatial/wards              — 55 MDB ward boundaries
  GET /api/spatial/map-layers         — all public datasets
  GET /api/spatial/notice-context     — administrative context for a notice
  GET /api/spatial/notice-layers      — layer profile for a notice type
  GET /api/spatial/features           — individual dataset features
  GET /api/spatial/ward-profile       — ward demographics

── CC → Node spatial APIs (operator auth) ──
  GET /api/spatial/integrity          — data quality report
  GET /api/spatial/probe              — source health check

── Node → CC notice registration ──
  POST /api/notices/register (CC)
  Requires: CONTROL_CENTRE_URL + INTELLIGENCE_API_KEY on Node
  On success: patches ccNoticeRef onto Sanity document

── CC → Node intelligence polling (Bearer INTELLIGENCE_API_KEY) ──
  GET /api/intelligence/health
  GET /api/intelligence/node
  GET /api/intelligence/notices/summary
  GET /api/intelligence/spatial
  GET /api/intelligence/records/summary
  GET /api/intelligence/commercial/summary
  GET /api/intelligence/evidence/summary
  GET /api/intelligence/participation/summary
  GET /api/intelligence/tcrs/summary
  GET /api/intelligence/lineage/summary
  GET /api/intelligence/operators

── Known integration gaps ──
1. spatialFeatureId: 0 of 10 listings set.
   CommunityMap shows empty state on all 4 pages.
   Action: operator content task.

2. INTELLIGENCE_API_KEY must be set on both CC and Node.
   Missing on Node → /api/intelligence/* returns 503.

3. /api/intelligence/spatial uses Sanity geopoints, not CC verified geometry.
   Known limitation — not a code defect.

── D-036 — Node Sovereignty ──
The Control Centre never edits, mutates or creates content belonging to a node.
`,
  },
];
