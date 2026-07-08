import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import type { Filters } from "./filters.js";
import type { Citation } from "./provenance.js";

type SourceRef = {
  system: string;
  url: string;
  collected: string;
  refreshed: string;
};

type DemoComplaint = {
  date: string;
  summary: string;
  status: string;
};

type DemoContractor = {
  id: string;
  name: string;
  license: string;
  trades: string[];
  county: string;
  projects: number;
  bbb: string;
  complaints: DemoComplaint[];
  review: number;
  src: SourceRef[];
};

type DemoOwner = {
  id: string;
  name: string;
  type: string;
  since: string;
  props: string[];
  src: SourceRef[];
};

type DemoBusiness = {
  id: string;
  name: string;
  btype: string;
  sunbiz: string;
  status: string;
  owner: string;
  locations: string[];
  registered: string;
  src: SourceRef[];
};

type DemoTenant = {
  id: string;
  name: string;
  ttype: string;
  locations: string[];
  businesses: string[];
  activity: string;
  src: SourceRef[];
};

type DemoOwnerHistory = {
  owner: string;
  date: string;
  type: string;
};

type DemoPermit = {
  id: string;
  permit: string;
  trade: string;
  status: string;
  contractor: string;
  value: number;
  daysAgo: number;
  desc: string;
  major: boolean;
};

type DemoProperty = {
  id: string;
  address: string;
  city: string;
  neighborhood: string;
  parcel: string;
  class: string;
  year: number;
  owner: string;
  ownerHistory: DemoOwnerHistory[];
  tenants: string[];
  businesses: string[];
  permits: DemoPermit[];
  src: SourceRef[];
};

type DemoCorpus = {
  properties: number;
  permits: number;
  contractors: number;
  businesses: number;
  owners: number;
  tenants: number;
  sources: number;
  lastRefresh: string;
  county: string;
};

type DemoData = {
  contractors: DemoContractor[];
  owners: DemoOwner[];
  businesses: DemoBusiness[];
  tenants: DemoTenant[];
  properties: DemoProperty[];
  turnover: Record<string, string>;
  corpus: DemoCorpus;
};

type InquiryRow = Record<string, string | number | boolean | null>;

type InquiryResult<TRow extends InquiryRow = InquiryRow> = {
  rows: TRow[];
  total: number;
  citations: Citation[];
};

type DemoAnswer = {
  answer: string;
  citations: Citation[];
  evidence: {
    title: string;
    body: string;
    sourceUrl: string | null;
  }[];
  mode: string;
};

type DemoSummaryTemplate = {
  lead: string;
  detail: string;
};

let cachedDemoData: DemoData | null = null;

function nonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function usesDemoData(): boolean {
  return !(
    nonEmpty(process.env.DATABASE_URL) ||
    (nonEmpty(process.env.DATABASE_HOST) && nonEmpty(process.env.DATABASE_PASSWORD))
  );
}

function loadDemoData(): DemoData {
  if (cachedDemoData !== null) return cachedDemoData;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), "public/oracle-data.js"),
    path.resolve(process.cwd(), "apps/web/public/oracle-data.js"),
    path.resolve(here, "../../../oracle-data.js"),
  ];
  const sourcePath = candidatePaths.find((candidate) => {
    try {
      readFileSync(candidate, "utf8");
      return true;
    } catch {
      return false;
    }
  });
  if (!sourcePath) throw new Error("Demo dataset file was not found in the app bundle");

  const source = readFileSync(sourcePath, "utf8");
  const sandbox: { ORACLE_DATA?: DemoData; window?: unknown; globalThis?: unknown } = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);

  if (!sandbox.ORACLE_DATA) {
    throw new Error("Demo dataset failed to load from oracle-data.js");
  }
  cachedDemoData = normalizeDemoData(sandbox.ORACLE_DATA);
  return cachedDemoData;
}

type RawPermit = Partial<DemoPermit> & {
  type?: string;
  filed?: string;
  scope?: string;
};

type RawProperty = Omit<DemoProperty, "permits"> & {
  permits: RawPermit[];
};

type RawDemoData = Omit<DemoData, "properties"> & {
  properties: RawProperty[];
};

function daysAgoFromIso(iso: string | undefined): number {
  if (!iso) return 365;
  const base = new Date("2026-07-08T00:00:00Z").getTime();
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return 365;
  return Math.max(0, Math.round((base - target) / 86400000));
}

function normalizePermit(rawPermit: RawPermit): DemoPermit {
  const permitId = rawPermit.id ?? rawPermit.permit ?? `${rawPermit.type ?? "permit"}-${rawPermit.filed ?? "unknown"}`;
  return {
    id: permitId,
    permit: rawPermit.permit ?? rawPermit.id ?? permitId,
    trade: rawPermit.trade ?? rawPermit.type ?? "Unknown",
    status: rawPermit.status ?? "Closed",
    contractor: rawPermit.contractor ?? "",
    value: rawPermit.value ?? 0,
    daysAgo: rawPermit.daysAgo ?? daysAgoFromIso(rawPermit.filed),
    desc: rawPermit.desc ?? rawPermit.scope ?? "",
    major: rawPermit.major ?? false,
  };
}

function normalizeDemoData(rawData: RawDemoData): DemoData {
  return {
    contractors: rawData.contractors,
    owners: rawData.owners,
    businesses: rawData.businesses,
    tenants: rawData.tenants,
    turnover: rawData.turnover,
    corpus: rawData.corpus,
    properties: rawData.properties.map((property) => ({
      ...property,
      permits: property.permits.map((permit) => normalizePermit(permit)),
    })),
  };
}

function firstSourceUrl(src: SourceRef[] | undefined): string | null {
  return src?.[0]?.url ?? null;
}

function firstSourceSystem(src: SourceRef[] | undefined): string | null {
  return src?.[0]?.system ?? null;
}

function isoFromDaysAgo(daysAgo: number): string {
  const base = new Date("2026-07-08T00:00:00Z");
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base.toISOString().slice(0, 10);
}

function permitIsOpen(permit: DemoPermit): boolean {
  const status = permit.status.trim().toLowerCase();
  return status === "open" || status === "active";
}

function contractorScoreBand(contractor: DemoContractor): string {
  const rating = contractor.bbb.trim().toUpperCase();
  if (rating === "F" || rating.startsWith("D")) return "poor";
  if (rating.startsWith("C")) return "marginal";
  if (rating.startsWith("B")) return "fair";
  return "strong";
}

function categoriesForPermit(permit: DemoPermit): string[] {
  const trade = permit.trade.trim().toLowerCase();
  return [trade === "mechanical" ? "hvac" : trade];
}

function matchesText(value: string | null | undefined, needle: string | undefined): boolean {
  if (!needle) return true;
  if (!value) return false;
  return value.toLowerCase().includes(needle.toLowerCase());
}

function paginate<T>(rows: T[], filters: Filters): { rows: T[]; total: number } {
  const total = rows.length;
  const start = Math.max(0, (filters.page - 1) * filters.pageSize);
  return { rows: rows.slice(start, start + filters.pageSize), total };
}

function propertyById(id: string): DemoProperty | undefined {
  return loadDemoData().properties.find((property) => property.id === id);
}

function contractorById(id: string): DemoContractor | undefined {
  return loadDemoData().contractors.find((contractor) => contractor.id === id);
}

function ownerById(id: string): DemoOwner | undefined {
  return loadDemoData().owners.find((owner) => owner.id === id);
}

function businessById(id: string): DemoBusiness | undefined {
  return loadDemoData().businesses.find((business) => business.id === id);
}

function tenantById(id: string): DemoTenant | undefined {
  return loadDemoData().tenants.find((tenant) => tenant.id === id);
}

function propertyCitation(property: DemoProperty): Citation {
  return {
    entityType: "property",
    entityId: property.id,
    label: `${property.parcel} - ${property.address}`,
    sourceUrl: firstSourceUrl(property.src),
  };
}

function contractorCitation(contractor: DemoContractor): Citation {
  return {
    entityType: "contractor",
    entityId: contractor.id,
    label: contractor.name,
    sourceUrl: firstSourceUrl(contractor.src),
  };
}

function businessCitation(business: DemoBusiness): Citation {
  return {
    entityType: "business",
    entityId: business.id,
    label: business.name,
    sourceUrl: firstSourceUrl(business.src),
  };
}

function tenantCitation(tenant: DemoTenant): Citation {
  return {
    entityType: "tenant",
    entityId: tenant.id,
    label: tenant.name,
    sourceUrl: firstSourceUrl(tenant.src),
  };
}

function takePaged<TRow extends InquiryRow>(rows: TRow[], filters: Filters): InquiryResult<TRow> {
  const total = rows.length;
  const start = Math.max(0, (filters.page - 1) * filters.pageSize);
  const pageRows = rows.slice(start, start + filters.pageSize);
  const citations = pageRows.flatMap((row) => {
    if (typeof row.property_id === "string") {
      const property = propertyById(row.property_id);
      return property ? [propertyCitation(property)] : [];
    }
    if (typeof row.company_id === "string") {
      const contractor = contractorById(row.company_id);
      if (contractor) return [contractorCitation(contractor)];
      const business = businessById(row.company_id);
      return business ? [businessCitation(business)] : [];
    }
    if (typeof row.business_registration_id === "string") {
      const business = businessById(row.business_registration_id);
      if (business) return [businessCitation(business)];
      const tenant = tenantById(row.business_registration_id);
      return tenant ? [tenantCitation(tenant)] : [];
    }
    if (typeof row.tenant_id === "string") {
      const tenant = tenantById(row.tenant_id);
      return tenant ? [tenantCitation(tenant)] : [];
    }
    return [];
  });
  return { rows: pageRows, total, citations };
}

function sortByNumberDesc<TRow extends InquiryRow>(rows: TRow[], key: keyof TRow): TRow[] {
  return [...rows].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

export function demoListProperties(filters: Filters) {
  const rows = loadDemoData()
    .properties
    .filter((property) => matchesText(property.city, filters.municipality))
    .filter((property) => matchesText(property.class, filters.propertyClass))
    .filter((property) => {
      if (!filters.q) return true;
      const q = filters.q.toLowerCase();
      return property.address.toLowerCase().includes(q) || property.parcel.toLowerCase().includes(q);
    })
    .map((property) => ({
      property_id: property.id,
      parcel_identifier: property.parcel,
      address: property.address,
      city: property.city,
      property_type: property.class,
      built_year: property.year,
      owner: ownerById(property.owner)?.name ?? null,
      permit_count: property.permits.length,
      open_permits: property.permits.filter(permitIsOpen).length,
      source_url: firstSourceUrl(property.src),
    }))
    .sort((a, b) => a.parcel_identifier.localeCompare(b.parcel_identifier));

  return Promise.resolve(paginate(rows, filters));
}

export function demoGetProperty(id: string) {
  const property = propertyById(id);
  if (!property) return Promise.resolve(null);
  const owner = ownerById(property.owner);
  const permits = property.permits.map((permit) => ({
    property_improvement_id: permit.id,
    permit_number: permit.permit,
    improvement_type: permit.trade,
    improvement_status: permitIsOpen(permit) ? "open" : "closed",
    record_status: permit.status,
    completion_date: isoFromDaysAgo(permit.daysAgo),
    estimated_job_value: String(permit.value),
    project_description: permit.desc,
    source_url: `${firstSourceUrl(property.src) ?? ""}#${permit.permit}`,
    contractor_name: contractorById(permit.contractor)?.name ?? null,
    renovation_categories: permit.major ? categoriesForPermit(permit) : [],
  }));

  return Promise.resolve({
    property_id: property.id,
    parcel_identifier: property.parcel,
    property_type: property.class,
    property_usage_type: property.class === "Commercial" ? "business occupancy" : property.class,
    built_year: property.year,
    subdivision: property.neighborhood,
    zoning: property.class === "Residential" ? "residential" : "commercial",
    legal_description: `${property.neighborhood} parcel ${property.parcel}`,
    source_url: firstSourceUrl(property.src),
    source_system: firstSourceSystem(property.src),
    address: property.address,
    city: property.city,
    state: "FL",
    zip: null,
    latitude: null,
    longitude: null,
    county_name: "Lee County",
    parcel_id: property.parcel,
    ownership: property.ownerHistory.map((entry, index) => ({
      owned_by: entry.owner,
      ownership_percentage: index === 0 ? "100" : null,
      owner_occupied_indicator: property.class === "Residential",
      date_acquired: entry.date,
      date_sold: index > 0 ? property.ownerHistory[index - 1]?.date ?? null : null,
      source_system: firstSourceSystem(owner?.src),
    })),
    taxes: [
      {
        tax_year: 2026,
        property_assessed_value_amount: String(250000 + property.permits.reduce((sum, permit) => sum + permit.value, 0)),
        property_market_value_amount: String(320000 + property.permits.reduce((sum, permit) => sum + permit.value, 0)),
        property_land_amount: String(90000 + property.year * 10),
        yearly_tax_amount: String(4200 + Math.round(property.permits.reduce((sum, permit) => sum + permit.value, 0) / 250)),
      },
    ],
    permits,
    openPermits: permits.filter((permit) => permit.improvement_status === "open"),
    majorImprovements: permits.filter((permit) => (permit.renovation_categories?.length ?? 0) > 0),
    occupancy: property.businesses.flatMap((businessId) => {
      const business = businessById(businessId);
      return business
        ? [
            {
              business_registration_id: business.id,
              entity_name: business.name,
              status: business.status,
              filing_type: business.btype,
              filed_date: business.registered,
              source_system: firstSourceSystem(business.src),
            },
          ]
        : [];
    }),
    contractors: Array.from(new Set(property.permits.map((permit) => permit.contractor)))
      .map((contractorId) => contractorById(contractorId))
      .filter((contractor): contractor is DemoContractor => contractor !== undefined)
      .map((contractor) => ({
        company_id: contractor.id,
        name: contractor.name,
        bbb_rating: contractor.bbb,
        profile_url: firstSourceUrl(contractor.src),
        score_band: contractorScoreBand(contractor),
      })),
  });
}

export function demoListTenants(filters: Filters) {
  const rows = loadDemoData()
    .tenants
    .filter((tenant) => matchesText(tenant.name, filters.q))
    .filter((tenant) => {
      if (!filters.municipality) return true;
      return tenant.locations.some((propertyId) =>
        matchesText(propertyById(propertyId)?.city ?? null, filters.municipality)
      );
    })
    .map((tenant) => ({
      business_registration_id: tenant.id,
      entity_name: tenant.name,
      status: businessById(tenant.businesses[0] ?? "")?.status ?? "Active",
      filing_type: tenant.ttype,
      occupancy_count: tenant.locations.length,
      source_url: firstSourceUrl(tenant.src),
    }))
    .sort((a, b) => (a.entity_name ?? "").localeCompare(b.entity_name ?? ""));

  return Promise.resolve(paginate(rows, filters));
}

export function demoGetTenant(id: string) {
  const tenant = tenantById(id);
  if (!tenant) return Promise.resolve(null);
  const business = businessById(tenant.businesses[0] ?? "");
  const relatedProperties = tenant.locations
    .map((propertyId) => propertyById(propertyId))
    .filter((property): property is DemoProperty => property !== undefined);

  return Promise.resolve({
    business_registration_id: tenant.id,
    entity_name: tenant.name,
    status: business?.status ?? "Active",
    filing_type: tenant.ttype,
    filed_date: business?.registered ?? null,
    document_number: business?.sunbiz ?? tenant.id.toUpperCase(),
    fei_number: null,
    source_system: firstSourceSystem(tenant.src),
    source_url: firstSourceUrl(tenant.src),
    occupancyHistory: relatedProperties.map((property, index) => ({
      occupancy_id: `${tenant.id}-${property.id}-${index}`,
      property_id: property.id,
      parcel_identifier: property.parcel,
      address: property.address,
      city: property.city,
      county_name: "Lee County",
      occupancy_type: "derived_business_occupancy",
      start_date: business?.registered ?? null,
      end_date: null,
      source_system: firstSourceSystem(tenant.src),
      source_url: firstSourceUrl(tenant.src),
    })),
    relationships: relatedProperties.map((property) => ({
      property_id: property.id,
      parcel_identifier: property.parcel,
      address: property.address,
      city: property.city,
      relationship: "occupies",
    })),
    officers: business
      ? [
          {
            name: business.owner,
            title: "Manager",
            party_role: "OFFICER",
            source_system: firstSourceSystem(business.src),
            source_url: firstSourceUrl(business.src),
          },
        ]
      : [],
    permits: relatedProperties.flatMap((property) =>
      property.permits.map((permit) => ({
        property_improvement_id: permit.id,
        property_id: property.id,
        permit_number: permit.permit,
        improvement_type: permit.trade,
        improvement_status: permit.status,
        completion_date: isoFromDaysAgo(permit.daysAgo),
        project_description: permit.desc,
        source_url: `${firstSourceUrl(property.src) ?? ""}#${permit.permit}`,
        parcel_identifier: property.parcel,
      }))
    ),
  });
}

export function demoListBusinesses(filters: Filters) {
  const rows = loadDemoData()
    .businesses
    .filter((business) => matchesText(business.name, filters.q))
    .filter((business) => matchesText(business.btype, filters.businessType))
    .filter((business) => {
      if (!filters.municipality) return true;
      return business.locations.some((propertyId) =>
        matchesText(propertyById(propertyId)?.city ?? null, filters.municipality)
      );
    })
    .map((business) => ({
      business_registration_id: business.id,
      entity_name: business.name,
      status: business.status,
      filing_type: business.btype,
      document_number: business.sunbiz,
      location_count: business.locations.length,
      source_url: firstSourceUrl(business.src),
    }))
    .sort((a, b) => (a.entity_name ?? "").localeCompare(b.entity_name ?? ""));

  return Promise.resolve(paginate(rows, filters));
}

export function demoGetBusiness(id: string) {
  const business = businessById(id);
  if (!business) return Promise.resolve(null);
  const relatedProperties = business.locations
    .map((propertyId) => propertyById(propertyId))
    .filter((property): property is DemoProperty => property !== undefined);

  return Promise.resolve({
    business_registration_id: business.id,
    entity_name: business.name,
    document_number: business.sunbiz,
    status: business.status,
    filing_type: business.btype,
    filed_date: business.registered,
    fei_number: null,
    last_transaction_date: business.registered,
    source_system: firstSourceSystem(business.src),
    source_url: firstSourceUrl(business.src),
    officers: [
      {
        name: business.owner,
        title: "Manager",
        party_role: "OFFICER",
        source_system: firstSourceSystem(business.src),
        source_url: firstSourceUrl(business.src),
      },
    ],
    addresses: relatedProperties.map((property) => ({
      address_role: "principal",
      line_1: property.address,
      line_2: null,
      city: property.city,
      state: "FL",
      zip: null,
      source_system: firstSourceSystem(business.src),
      source_url: firstSourceUrl(business.src),
    })),
    relatedProperties: relatedProperties.map((property) => ({
      property_id: property.id,
      parcel_identifier: property.parcel,
      address: property.address,
      city: property.city,
      county_name: "Lee County",
      occupancy_type: "derived_business_occupancy",
      source_system: firstSourceSystem(business.src),
      source_url: firstSourceUrl(business.src),
    })),
    permits: relatedProperties.flatMap((property) =>
      property.permits.map((permit) => ({
        property_improvement_id: permit.id,
        property_id: property.id,
        permit_number: permit.permit,
        improvement_type: permit.trade,
        improvement_status: permit.status,
        completion_date: isoFromDaysAgo(permit.daysAgo),
        project_description: permit.desc,
        source_url: `${firstSourceUrl(property.src) ?? ""}#${permit.permit}`,
        parcel_identifier: property.parcel,
      }))
    ),
  });
}

export function demoListContractors(filters: Filters) {
  const rows = loadDemoData()
    .contractors
    .filter((contractor) => matchesText(contractor.name, filters.q))
    .filter((contractor) => matchesText(contractor.name, filters.contractor))
    .map((contractor) => ({
      business_reputation_profile_id: contractor.id,
      name: contractor.name,
      bbb_rating: contractor.bbb,
      is_accredited: ["A+", "A", "A-"].includes(contractor.bbb),
      score_band: contractorScoreBand(contractor),
      project_count: contractor.projects,
      complaint_count: contractor.complaints.length,
      review_count: Math.max(1, Math.round(contractor.projects / 3)),
      source_url: firstSourceUrl(contractor.src),
    }))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return Promise.resolve(paginate(rows, filters));
}

export function demoGetContractor(id: string) {
  const contractor = contractorById(id);
  if (!contractor) return Promise.resolve(null);
  const projects = loadDemoData().properties.flatMap((property) =>
    property.permits
      .filter((permit) => permit.contractor === contractor.id)
      .map((permit) => ({
        property_improvement_id: permit.id,
        property_id: property.id,
        permit_number: permit.permit,
        improvement_type: permit.trade,
        improvement_status: permit.status,
        completion_date: isoFromDaysAgo(permit.daysAgo),
        project_description: permit.desc,
        source_url: `${firstSourceUrl(property.src) ?? ""}#${permit.permit}`,
        parcel_identifier: property.parcel,
        address: property.address,
        city: property.city,
      }))
  );

  return Promise.resolve({
    company_id: contractor.id,
    business_reputation_profile_id: contractor.id,
    name: contractor.name,
    legal_name: contractor.name,
    bbb_rating: contractor.bbb,
    rating_score: contractor.review.toFixed(1),
    is_accredited: ["A+", "A", "A-"].includes(contractor.bbb),
    accreditation_status: ["A+", "A", "A-"].includes(contractor.bbb) ? "Accredited" : "Not accredited",
    accredited_since: "2023-01-01",
    review_average_rating: contractor.review.toFixed(1),
    review_count: Math.max(1, Math.round(contractor.projects / 3)),
    complaint_count: contractor.complaints.length,
    profile_url: firstSourceUrl(contractor.src),
    source_system: firstSourceSystem(contractor.src),
    source_url: firstSourceUrl(contractor.src),
    qualityScores: [
      {
        score: contractor.review.toFixed(1),
        score_band: contractorScoreBand(contractor),
        scoring_model: "demo-reputation-v1",
        match_confidence: "0.98",
      },
    ],
    projects,
    complaints: contractor.complaints.map((complaint) => ({
      complaint_date: complaint.date,
      complaint_type: "BBB complaint",
      complaint_status: complaint.status,
      complaint_summary: complaint.summary,
    })),
    reviews: [
      {
        review_date: "2026-06-01",
        review_rating: contractor.review.toFixed(1),
        review_title: "BBB summary review",
        review_text: `${contractor.name} carries an aggregate public review score of ${contractor.review.toFixed(1)} in the demo corpus.`,
        reviewer_display_name: "Oracle demo corpus",
      },
    ],
    relationships: projects.map((project) => ({
      property_id: project.property_id ?? contractor.id,
      parcel_identifier: project.parcel_identifier ?? "—",
      address: project.address,
      city: project.city,
      relationship: "worked_on",
    })),
  });
}

export function demoRunInquiry(key: string, filters: Filters): Promise<InquiryResult> {
  const data = loadDemoData();
  const rows: InquiryRow[] = (() => {
    switch (key) {
      case "properties-multiple-open-permits":
        return data.properties
          .filter((property) => property.permits.filter(permitIsOpen).length > 1)
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            open_permits: property.permits.filter(permitIsOpen).length,
            permit_count: property.permits.length,
            owner: ownerById(property.owner)?.name ?? null,
            source_url: firstSourceUrl(property.src),
          }));
      case "properties-open-roofing-permit":
      case "properties-open-electrical-permit": {
        const trade = key === "properties-open-roofing-permit" ? "Roofing" : "Electrical";
        return data.properties
          .filter((property) => property.permits.some((permit) => permitIsOpen(permit) && permit.trade === trade))
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            matching_open_permits: property.permits.filter((permit) => permitIsOpen(permit) && permit.trade === trade).length,
            source_url: firstSourceUrl(property.src),
          }));
      }
      case "properties-major-concrete-work":
      case "properties-major-roof-replacement":
      case "properties-major-electrical-upgrade": {
        const trade = key === "properties-major-concrete-work" ? "Concrete" : key === "properties-major-roof-replacement" ? "Roofing" : "Electrical";
        return data.properties
          .filter((property) => property.permits.some((permit) => permit.major && permit.trade === trade))
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            matching_permits: property.permits.filter((permit) => permit.major && permit.trade === trade).length,
            source_url: firstSourceUrl(property.src),
          }));
      }
      case "properties-highest-permit-activity":
        return sortByNumberDesc(
          data.properties.map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            permits_last_5y: property.permits.length,
            most_recent_activity: isoFromDaysAgo(Math.min(...property.permits.map((permit) => permit.daysAgo))),
            source_url: firstSourceUrl(property.src),
          })),
          "permits_last_5y"
        );
      case "properties-significant-renovation":
        return data.properties
          .filter((property) => property.permits.filter((permit) => permit.major).length >= 2)
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            major_permits: property.permits.filter((permit) => permit.major).length,
            categories: Array.from(new Set(property.permits.filter((permit) => permit.major).flatMap(categoriesForPermit))).join(", "),
            source_url: firstSourceUrl(property.src),
          }));
      case "contractors-roofing-lee-county":
      case "contractors-electrical-lee-county": {
        const trade = key === "contractors-roofing-lee-county" ? "Roofing" : "Electrical";
        return data.contractors
          .filter((contractor) => contractor.trades.includes(trade))
          .map((contractor) => ({
            company_id: contractor.id,
            contractor_name: contractor.name,
            matching_projects: contractor.projects,
            bbb_rating: contractor.bbb,
            score_band: contractorScoreBand(contractor),
            source_url: firstSourceUrl(contractor.src),
          }));
      }
      case "contractors-negative-bbb":
        return data.contractors
          .filter((contractor) => ["F", "D", "C"].some((rating) => contractor.bbb.startsWith(rating)))
          .map((contractor) => ({
            company_id: contractor.id,
            contractor_name: contractor.name,
            bbb_rating: contractor.bbb,
            score_band: contractorScoreBand(contractor),
            complaint_count: contractor.complaints.length,
            review_count: Math.max(1, Math.round(contractor.projects / 3)),
            is_accredited: ["A+", "A", "A-"].includes(contractor.bbb),
            projects: contractor.projects,
            source_url: firstSourceUrl(contractor.src),
          }));
      case "contractors-complaint-history":
        return data.contractors
          .filter((contractor) => contractor.complaints.length > 0)
          .map((contractor) => ({
            company_id: contractor.id,
            contractor_name: contractor.name,
            bbb_rating: contractor.bbb,
            complaint_count: contractor.complaints.length,
            closed_complaints_3y: contractor.complaints.filter((complaint) => complaint.status.toLowerCase() === "resolved").length,
            review_count: Math.max(1, Math.round(contractor.projects / 3)),
            projects: contractor.projects,
            source_url: firstSourceUrl(contractor.src),
          }));
      case "projects-negative-contractors":
        return data.properties.flatMap((property) =>
          property.permits
            .filter((permit) => {
              const contractor = contractorById(permit.contractor);
              return contractor ? contractor.complaints.length > 0 || contractorScoreBand(contractor) === "poor" : false;
            })
            .map((permit) => {
              const contractor = contractorById(permit.contractor);
              return {
                property_improvement_id: permit.id,
                permit_number: permit.permit,
                improvement_type: permit.trade,
                improvement_status: permit.status,
                property_id: property.id,
                parcel_identifier: property.parcel,
                address: property.address,
                contractor_name: contractor?.name ?? null,
                bbb_rating: contractor?.bbb ?? null,
                complaint_count: contractor?.complaints.length ?? 0,
                score_band: contractor ? contractorScoreBand(contractor) : null,
                source_url: `${firstSourceUrl(property.src) ?? ""}#${permit.permit}`,
              };
            })
        );
      case "businesses-multiple-properties":
      case "businesses-most-active-footprint":
        return sortByNumberDesc(
          data.businesses
            .filter((business) => key === "businesses-most-active-footprint" || business.locations.length > 1)
            .map((business) => ({
              company_id: business.id,
              business_registration_id: business.id,
              business_name: business.name,
              property_count: business.locations.length,
              status: business.status,
              source_url: firstSourceUrl(business.src),
            })),
          "property_count"
        );
      case "owners-multiple-properties":
        return sortByNumberDesc(
          data.owners
            .filter((owner) => owner.props.length > 1)
            .map((owner) => ({
              owner_name: owner.name,
              property_count: owner.props.length,
              source_url: firstSourceUrl(owner.src),
            })),
          "property_count"
        );
      case "tenants-multiple-locations":
        return sortByNumberDesc(
          data.tenants
            .filter((tenant) => tenant.locations.length > 1)
            .map((tenant) => ({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              location_count: tenant.locations.length,
              source_url: firstSourceUrl(tenant.src),
            })),
          "location_count"
        );
      case "properties-ownership-change-active-permits":
        return data.properties
          .filter((property) => property.ownerHistory.length > 1 && property.permits.some(permitIsOpen))
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            ownership_changes: property.ownerHistory.length - 1,
            active_permits: property.permits.filter(permitIsOpen).length,
            source_url: firstSourceUrl(property.src),
          }));
      case "properties-active-permits-business-turnover":
        return data.properties
          .filter((property) => property.permits.some(permitIsOpen) && Boolean(data.turnover[property.id]))
          .map((property) => ({
            property_id: property.id,
            parcel_identifier: property.parcel,
            address: property.address,
            city: property.city,
            active_permits: property.permits.filter(permitIsOpen).length,
            turnover_signal: data.turnover[property.id] ?? null,
            source_url: firstSourceUrl(property.src),
          }));
      case "neighborhoods-increasing-permits":
        return sortByNumberDesc(
          Array.from(
            data.properties.reduce((map, property) => {
              const count = map.get(property.neighborhood) ?? 0;
              map.set(property.neighborhood, count + property.permits.filter((permit) => permit.daysAgo <= 60).length);
              return map;
            }, new Map<string, number>())
          ).map(([neighborhood, recent_permits]) => ({
            neighborhood,
            recent_permits,
            source_url: firstSourceUrl(data.properties.find((property) => property.neighborhood === neighborhood)?.src),
          })),
          "recent_permits"
        );
      case "neighborhoods-major-renovation-concentration":
        return sortByNumberDesc(
          Array.from(
            data.properties.reduce((map, property) => {
              const count = map.get(property.neighborhood) ?? 0;
              map.set(property.neighborhood, count + property.permits.filter((permit) => permit.major).length);
              return map;
            }, new Map<string, number>())
          ).map(([neighborhood, major_permits]) => ({
            neighborhood,
            major_permits,
            source_url: firstSourceUrl(data.properties.find((property) => property.neighborhood === neighborhood)?.src),
          })),
          "major_permits"
        );
      case "contractors-most-active":
      case "stretch-contractors-most-complaint-projects":
        return sortByNumberDesc(
          data.contractors.map((contractor) => ({
            company_id: contractor.id,
            contractor_name: contractor.name,
            project_count: contractor.projects,
            complaint_count: contractor.complaints.length,
            bbb_rating: contractor.bbb,
            source_url: firstSourceUrl(contractor.src),
          })),
          key === "stretch-contractors-most-complaint-projects" ? "complaint_count" : "project_count"
        );
      case "stretch-redevelopment-candidates":
      case "stretch-value-add-investment":
        return sortByNumberDesc(
          data.properties
            .filter((property) => property.permits.some(permitIsOpen) || property.permits.some((permit) => permit.major))
            .map((property) => ({
              property_id: property.id,
              parcel_identifier: property.parcel,
              address: property.address,
              city: property.city,
              signal_count: property.permits.filter(permitIsOpen).length + property.permits.filter((permit) => permit.major).length,
              source_url: firstSourceUrl(property.src),
            })),
          "signal_count"
        );
      default:
        return [];
    }
  })();

  return Promise.resolve(takePaged(rows, filters));
}

function routeDemoQuestion(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("roof") && q.includes("contractor")) return "contractors-roofing-lee-county";
  if (q.includes("electric") && q.includes("contractor")) return "contractors-electrical-lee-county";
  if (q.includes("complaint") && q.includes("contractor")) return "contractors-complaint-history";
  if ((q.includes("poor") || q.includes("negative")) && q.includes("bbb")) return "contractors-negative-bbb";
  if (q.includes("business") && (q.includes("multiple") || q.includes("across"))) return "businesses-multiple-properties";
  if (q.includes("tenant") && (q.includes("multiple") || q.includes("across"))) return "tenants-multiple-locations";
  if (q.includes("owner") && q.includes("multiple")) return "owners-multiple-properties";
  if (q.includes("roof")) return "properties-open-roofing-permit";
  if (q.includes("electric")) return "properties-open-electrical-permit";
  if (q.includes("major") && q.includes("concrete")) return "properties-major-concrete-work";
  if (q.includes("permit")) return "properties-multiple-open-permits";
  return "contractors-most-active";
}

function summaryTemplateForInquiry(inquiryKey: string): DemoSummaryTemplate {
  switch (inquiryKey) {
    case "contractors-negative-bbb":
      return {
        lead: "I found contractors with weak BBB signals in the current Lee County demo corpus.",
        detail:
          "These results rank contractors with lower BBB ratings and related complaint history so you can inspect likely riskier operators first.",
      };
    case "contractors-complaint-history":
      return {
        lead: "I found contractors with complaint history in the current Lee County demo corpus.",
        detail:
          "These results prioritize firms with documented complaint activity so you can move directly into reputation review and linked project work.",
      };
    case "businesses-multiple-properties":
      return {
        lead: "I found businesses operating across multiple properties in the current Lee County demo corpus.",
        detail:
          "These results highlight multi-site business footprint and make it easy to pivot into related properties and occupancy patterns.",
      };
    case "tenants-multiple-locations":
      return {
        lead: "I found tenants operating across multiple locations in the current Lee County demo corpus.",
        detail:
          "These results surface occupancy relationships that span multiple properties and can be used to inspect expansion or clustering behavior.",
      };
    case "owners-multiple-properties":
      return {
        lead: "I found owners associated with multiple properties in the current Lee County demo corpus.",
        detail:
          "These results show portfolio-style ownership so you can move from a single parcel to a broader ownership footprint.",
      };
    case "properties-open-roofing-permit":
      return {
        lead: "I found properties with active roofing permits in the current Lee County demo corpus.",
        detail:
          "These results isolate properties with ongoing roofing work and make it easy to pivot into the permit, contractor, and property record.",
      };
    case "properties-open-electrical-permit":
      return {
        lead: "I found properties with active electrical permits in the current Lee County demo corpus.",
        detail:
          "These results isolate properties with ongoing electrical work and make it easy to inspect the linked improvement and contractor history.",
      };
    case "properties-active-permits-business-turnover":
      return {
        lead: "I found properties that combine active permits with business turnover signals in the current Lee County demo corpus.",
        detail:
          "These results bring operational activity and occupancy change into one view so you can inspect higher-signal redevelopment patterns.",
      };
    case "neighborhoods-increasing-permits":
      return {
        lead: "I found neighborhoods with rising permit activity in the current Lee County demo corpus.",
        detail:
          "These results rank areas with the strongest recent permit concentration so you can inspect broader activity patterns beyond a single parcel.",
      };
    default:
      return {
        lead: "I found grounded matches in the current Lee County demo corpus.",
        detail:
          "These results are drawn directly from the packaged records and can be inspected through the linked entity and source views.",
      };
  }
}

export async function demoAnswerQuestion(question: string): Promise<DemoAnswer> {
  const inquiryKey = routeDemoQuestion(question);
  const result = await demoRunInquiry(inquiryKey, { page: 1, pageSize: 6 });
  const template = summaryTemplateForInquiry(inquiryKey);
  const topMatches = result.citations.slice(0, 4).map((citation) => citation.label);
  return {
    answer:
      result.citations.length === 0
        ? "No demo records matched this question."
        : `${template.lead} ${template.detail} I found ${result.total} matching records. Top matches include ${topMatches.join("; ")}.`,
    citations: result.citations,
    evidence: result.citations.map((citation, index) => ({
      title: citation.label,
      body: `Grounded demo result ${index + 1} for this question in the packaged Oracle corpus.`,
      sourceUrl: citation.sourceUrl,
    })),
    mode: "demo answer",
  };
}
