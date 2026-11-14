/**
 * Sanity read client for the Umkhandlu GIS MCP.
 * Read-only. Never mutates Sanity documents.
 * Uses the Governance Node's Sanity project (60v9eb0r / production).
 */

import { createClient } from '@sanity/client';
import { env } from './env.js';

function buildClient() {
  return createClient({
    projectId: env.sanityProjectId,
    dataset: env.sanityDataset,
    apiVersion: env.sanityApiVersion,
    token: env.sanityReadToken || undefined,
    useCdn: false, // always fresh for MCP queries
  });
}

// Lazy singleton — created on first use so env is loaded
let _client: ReturnType<typeof buildClient> | null = null;
function client() {
  if (!_client) _client = buildClient();
  return _client;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SanityGeopoint {
  _type: 'geopoint';
  lat: number;
  lng: number;
  alt?: number;
}

export interface DevelopmentNotice {
  _id: string;
  _type: 'developmentNotice';
  title: string;
  slug: { current: string };
  noticeType: string;
  status: string;
  applicant: string;
  referenceNumber?: string;
  description: string;
  location: string;
  geopoint?: SanityGeopoint;
  locationPrecision?: string;
  siteFeatureId?: string;
  ccNoticeRef?: string;
  commentDeadline: string;
  publishDate?: string;
  relatedArea?: {
    _id: string;
    name: string;
    wardNumber?: number;
    municipality?: string;
    geopoint?: SanityGeopoint;
  };
}

export interface Listing {
  _id: string;
  _type: 'listing';
  name: string;
  slug: { current: string };
  listingType: string;
  description?: string;
  location?: string;
  geopoint?: SanityGeopoint;
  spatialFeatureId?: string;
  wardNumber?: number;
  municipality?: string;
  areaLevel?: string;
  mdbWardId?: string;
  verifiedByInduna?: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

const NOTICE_FIELDS = `
  _id, _type, title, slug, noticeType, status, applicant, referenceNumber,
  description, location, geopoint, locationPrecision, siteFeatureId, ccNoticeRef,
  commentDeadline, publishDate,
  relatedArea->{ _id, name, wardNumber, municipality, geopoint }
`;

const LISTING_FIELDS = `
  _id, _type, name, slug, listingType, description, location,
  geopoint, spatialFeatureId, wardNumber, municipality, areaLevel, mdbWardId, verifiedByInduna
`;

export async function fetchAllNotices(): Promise<DevelopmentNotice[]> {
  return client().fetch<DevelopmentNotice[]>(
    `*[_type == "developmentNotice"] | order(commentDeadline asc) { ${NOTICE_FIELDS} }`
  );
}

export async function fetchNoticeBySlug(slug: string): Promise<DevelopmentNotice | null> {
  return client().fetch<DevelopmentNotice | null>(
    `*[_type == "developmentNotice" && slug.current == $slug][0] { ${NOTICE_FIELDS} }`,
    { slug }
  );
}

export async function fetchNoticeById(id: string): Promise<DevelopmentNotice | null> {
  return client().fetch<DevelopmentNotice | null>(
    `*[_type == "developmentNotice" && _id == $id][0] { ${NOTICE_FIELDS} }`,
    { id }
  );
}

export async function fetchNoticesWithGeopoint(): Promise<DevelopmentNotice[]> {
  return client().fetch<DevelopmentNotice[]>(
    `*[_type == "developmentNotice" && defined(geopoint)] | order(commentDeadline asc) { ${NOTICE_FIELDS} }`
  );
}

export async function fetchNoticesWithoutSpatialFeature(): Promise<DevelopmentNotice[]> {
  return client().fetch<DevelopmentNotice[]>(
    `*[_type == "developmentNotice" && !defined(siteFeatureId)] | order(commentDeadline asc) { ${NOTICE_FIELDS} }`
  );
}

export async function fetchListingsByType(listingType: string): Promise<Listing[]> {
  return client().fetch<Listing[]>(
    `*[_type == "listing" && listingType == $listingType] | order(name asc) { ${LISTING_FIELDS} }`,
    { listingType }
  );
}

export async function fetchListingBySlug(slug: string): Promise<Listing | null> {
  return client().fetch<Listing | null>(
    `*[_type == "listing" && slug.current == $slug][0] { ${LISTING_FIELDS} }`,
    { slug }
  );
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  return client().fetch<Listing | null>(
    `*[_type == "listing" && _id == $id][0] { ${LISTING_FIELDS} }`,
    { id }
  );
}

export async function fetchListingsWithoutSpatialFeature(listingType?: string): Promise<Listing[]> {
  const typeFilter = listingType ? ' && listingType == $listingType' : '';
  return client().fetch<Listing[]>(
    `*[_type == "listing"${typeFilter} && !defined(spatialFeatureId)] | order(name asc) { ${LISTING_FIELDS} }`,
    listingType ? { listingType } : {}
  );
}

export async function searchListingsByName(name: string, listingType?: string): Promise<Listing[]> {
  const typeFilter = listingType ? ' && listingType == $listingType' : '';
  return client().fetch<Listing[]>(
    `*[_type == "listing"${typeFilter} && name match $pattern] | order(name asc) { ${LISTING_FIELDS} }`,
    listingType ? { listingType, pattern: `*${name}*` } : { pattern: `*${name}*` }
  );
}

export async function fetchSpatialSummary() {
  return client().fetch<{
    noticeCount: number;
    noticesWithGeopoint: number;
    noticesWithSiteFeature: number;
    listingCount: number;
    listingsWithGeopoint: number;
    listingsWithSpatialFeature: number;
    schoolCount: number;
    schoolsWithSpatialFeature: number;
  }>(`{
    "noticeCount": count(*[_type == "developmentNotice"]),
    "noticesWithGeopoint": count(*[_type == "developmentNotice" && defined(geopoint)]),
    "noticesWithSiteFeature": count(*[_type == "developmentNotice" && defined(siteFeatureId)]),
    "listingCount": count(*[_type == "listing"]),
    "listingsWithGeopoint": count(*[_type == "listing" && defined(geopoint)]),
    "listingsWithSpatialFeature": count(*[_type == "listing" && defined(spatialFeatureId)]),
    "schoolCount": count(*[_type == "listing" && listingType == "school"]),
    "schoolsWithSpatialFeature": count(*[_type == "listing" && listingType == "school" && defined(spatialFeatureId)])
  }`);
}
