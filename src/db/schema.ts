/**
 * Oracle Property Intelligence — canonical data model.
 *
 * Modeled on the Elephant Lexicon query-db schema (Drizzle/Postgres). This is a
 * faithful, demo-scoped subset of the production lexicon: the entities and fields
 * required to power the Property / Tenant / Business / Contractor views and the
 * RAG knowledge layer, with full source provenance preserved on every record.
 *
 * Lexicon parity: addresses, parcels, properties, ownerships, sales_histories,
 * companies, people, property_improvements (permits), inspections, permit_contacts,
 * business_registrations (+ parties), business_reputation_profiles (BBB) with
 * complaints/reviews, contractor_quality_scores. Plus two extensions: `occupancies`
 * (tenant/occupancy — derived) and `entity_documents` (the RAG-accessible index).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Source provenance columns present on every source-derived record. */
const prov = () => ({
  sourceSystem: text("source_system").notNull(),
  sourceRecordKey: text("source_record_key").notNull(),
  sourceUrl: text("source_url"),
  sourceArtifactUri: text("source_artifact_uri"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
  sourcePayload: jsonb("source_payload").$type<Record<string, unknown>>(),
});

const stamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────────────────────── CORE ───────────────────────────── */

export const addresses = pgTable(
  "addresses",
  {
    addressId: uuid("address_id").primaryKey().defaultRandom(),
    streetNumber: text("street_number"),
    streetName: text("street_name"),
    streetSuffixType: text("street_suffix_type"),
    unitIdentifier: text("unit_identifier"),
    cityName: text("city_name"),
    municipalityName: text("municipality_name"),
    countyName: text("county_name"),
    stateCode: text("state_code"),
    postalCode: text("postal_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    unnormalizedAddress: text("unnormalized_address"),
    normalizedAddressKey: text("normalized_address_key"),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("addresses_postal_idx").on(t.postalCode),
    index("addresses_city_idx").on(t.cityName),
    index("addresses_normkey_idx").on(t.normalizedAddressKey),
  ],
);

export const people = pgTable(
  "people",
  {
    personId: uuid("person_id").primaryKey().defaultRandom(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name"),
    normalizedName: text("normalized_name"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("people_norm_idx").on(t.normalizedName)],
);

export const companies = pgTable(
  "companies",
  {
    companyId: uuid("company_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name"),
    /** Coarse role flags for convenience in the demo (a company can be several). */
    isContractor: boolean("is_contractor").default(false),
    isOwner: boolean("is_owner").default(false),
    isTenant: boolean("is_tenant").default(false),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("companies_norm_idx").on(t.normalizedName), index("companies_name_idx").on(t.name)],
);

/* ─────────────────────────── APPRAISAL ─────────────────────────── */

export const parcels = pgTable(
  "parcels",
  {
    parcelId: uuid("parcel_id").primaryKey().defaultRandom(),
    parcelIdentifier: text("parcel_identifier").notNull(),
    countyName: text("county_name"),
    stateCode: text("state_code"),
    jurisdictionKey: text("jurisdiction_key"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("parcels_identifier_idx").on(t.parcelIdentifier)],
);

export const properties = pgTable(
  "properties",
  {
    propertyId: uuid("property_id").primaryKey().defaultRandom(),
    parcelId: uuid("parcel_id").references(() => parcels.parcelId),
    addressId: uuid("address_id").references(() => addresses.addressId),
    parcelIdentifier: text("parcel_identifier").notNull(),
    propertyType: text("property_type"),
    propertyUsageType: text("property_usage_type"),
    propertyLegalDescriptionText: text("property_legal_description_text"),
    propertyStructureBuiltYear: integer("property_structure_built_year"),
    propertyEffectiveBuiltYear: integer("property_effective_built_year"),
    livableFloorAreaSqft: integer("livable_floor_area_sqft"),
    totalAreaSqft: integer("total_area_sqft"),
    numberOfUnits: integer("number_of_units"),
    subdivision: text("subdivision"),
    neighborhood: text("neighborhood"),
    zoning: text("zoning"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    marketValueAmount: integer("market_value_amount"),
    assessedValueAmount: integer("assessed_value_amount"),
    /** Denormalized rollups (computed during load) to keep view queries fast. */
    openPermitCount: integer("open_permit_count").default(0),
    openPermitCategories: integer("open_permit_categories").default(0),
    permitCount5y: integer("permit_count_5y").default(0),
    majorRenovationCount: integer("major_renovation_count").default(0),
    improvementScore: integer("improvement_score").default(0),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("properties_parcel_idx").on(t.parcelId),
    index("properties_address_idx").on(t.addressId),
    index("properties_usage_idx").on(t.propertyUsageType),
    index("properties_neighborhood_idx").on(t.neighborhood),
    index("properties_openpermits_idx").on(t.openPermitCount),
  ],
);

export const ownerships = pgTable(
  "ownerships",
  {
    ownershipId: uuid("ownership_id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.propertyId),
    ownerPersonId: uuid("owner_person_id").references(() => people.personId),
    ownerCompanyId: uuid("owner_company_id").references(() => companies.companyId),
    mailingAddressId: uuid("mailing_address_id").references(() => addresses.addressId),
    ownedBy: text("owned_by"), // 'person' | 'company'
    ownershipPercentage: doublePrecision("ownership_percentage"),
    ownerOccupiedIndicator: boolean("owner_occupied_indicator"),
    dateAcquired: date("date_acquired"),
    dateSold: date("date_sold"),
    isCurrent: boolean("is_current").default(true),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("ownerships_property_idx").on(t.propertyId),
    index("ownerships_person_idx").on(t.ownerPersonId),
    index("ownerships_company_idx").on(t.ownerCompanyId),
    index("ownerships_current_idx").on(t.isCurrent),
  ],
);

export const salesHistories = pgTable(
  "sales_histories",
  {
    salesHistoryId: uuid("sales_history_id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.propertyId),
    ownershipTransferDate: date("ownership_transfer_date"),
    purchasePriceAmount: integer("purchase_price_amount"),
    saleType: text("sale_type"),
    deedBook: text("deed_book"),
    deedPage: text("deed_page"),
    instrumentNumber: text("instrument_number"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("sales_property_date_idx").on(t.propertyId, t.ownershipTransferDate)],
);

/* ──────────────────────── PERMITS / PROJECTS ───────────────────── */

export const propertyImprovements = pgTable(
  "property_improvements",
  {
    propertyImprovementId: uuid("property_improvement_id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.propertyId),
    parcelId: uuid("parcel_id").references(() => parcels.parcelId),
    addressId: uuid("address_id").references(() => addresses.addressId),
    contractorCompanyId: uuid("contractor_company_id").references(() => companies.companyId),
    permitNumber: text("permit_number"),
    improvementType: text("improvement_type"), // category: Roofing/Electrical/Plumbing/HVAC/Concrete/Structural/...
    improvementStatus: text("improvement_status"), // normalized: Open | Closed | Expired | ...
    sourceStatus: text("source_status"), // raw portal status
    recordStatus: text("record_status"),
    commRes: text("comm_res"), // Commercial | Residential
    applicationReceivedDate: date("application_received_date"),
    permitIssueDate: date("permit_issue_date"),
    finalInspectionDate: date("final_inspection_date"),
    permitCloseDate: date("permit_close_date"),
    completionDate: date("completion_date"),
    expirationDate: date("expiration_date"),
    isOwnerBuilder: boolean("is_owner_builder"),
    isMajorRenovation: boolean("is_major_renovation").default(false),
    isOpen: boolean("is_open").default(false),
    fee: integer("fee"),
    estimatedJobValue: integer("estimated_job_value"),
    projectDescription: text("project_description"),
    applicant: text("applicant"),
    licensedProfessional: text("licensed_professional"),
    workLocation: text("work_location"),
    parcelIdentifier: text("parcel_identifier"),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("pi_property_idx").on(t.propertyId),
    index("pi_contractor_idx").on(t.contractorCompanyId),
    index("pi_type_idx").on(t.improvementType),
    index("pi_status_idx").on(t.improvementStatus),
    index("pi_open_idx").on(t.isOpen),
    index("pi_major_idx").on(t.isMajorRenovation),
    index("pi_issue_idx").on(t.permitIssueDate),
  ],
);

export const inspections = pgTable(
  "inspections",
  {
    inspectionId: uuid("inspection_id").primaryKey().defaultRandom(),
    propertyImprovementId: uuid("property_improvement_id").references(
      () => propertyImprovements.propertyImprovementId,
    ),
    inspectionType: text("inspection_type"),
    result: text("result"),
    scheduledDate: date("scheduled_date"),
    completedDate: date("completed_date"),
    inspectorName: text("inspector_name"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("inspections_permit_idx").on(t.propertyImprovementId)],
);

export const permitContacts = pgTable(
  "permit_contacts",
  {
    permitContactId: uuid("permit_contact_id").primaryKey().defaultRandom(),
    propertyImprovementId: uuid("property_improvement_id").references(
      () => propertyImprovements.propertyImprovementId,
    ),
    contactRole: text("contact_role").notNull(),
    companyId: uuid("company_id").references(() => companies.companyId),
    personId: uuid("person_id").references(() => people.personId),
    rawName: text("raw_name"),
    licenseNumber: text("license_number"),
    licenseType: text("license_type"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("permit_contacts_permit_idx").on(t.propertyImprovementId)],
);

/* ───────────────────────────── SUNBIZ ──────────────────────────── */

export const businessRegistrations = pgTable(
  "business_registrations",
  {
    businessRegistrationId: uuid("business_registration_id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.companyId),
    documentNumber: text("document_number").notNull(),
    entityName: text("entity_name"),
    status: text("status"), // ACTIVE | INACTIVE | DISSOLVED | ...
    filingType: text("filing_type"), // Florida Limited Liability Company | Florida Profit Corporation | ...
    filedDate: date("filed_date"),
    feiNumber: text("fei_number"),
    principalAddressId: uuid("principal_address_id").references(() => addresses.addressId),
    lastTransactionDate: date("last_transaction_date"),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("br_company_idx").on(t.companyId),
    index("br_entity_idx").on(t.entityName),
    index("br_status_idx").on(t.status),
  ],
);

export const businessRegistrationParties = pgTable(
  "business_registration_parties",
  {
    businessRegistrationPartyId: uuid("business_registration_party_id").primaryKey().defaultRandom(),
    businessRegistrationId: uuid("business_registration_id").references(
      () => businessRegistrations.businessRegistrationId,
    ),
    partyPersonId: uuid("party_person_id").references(() => people.personId),
    partyRole: text("party_role").notNull(), // Registered Agent | Manager | President | ...
    name: text("name").notNull(),
    title: text("title"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("brp_reg_idx").on(t.businessRegistrationId)],
);

/* ────────────────────── BBB / REPUTATION ───────────────────────── */

export const businessReputationProfiles = pgTable(
  "business_reputation_profiles",
  {
    businessReputationProfileId: uuid("business_reputation_profile_id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.companyId),
    addressId: uuid("address_id").references(() => addresses.addressId),
    provider: text("provider").default("BBB"),
    profileUrl: text("profile_url"),
    name: text("name"),
    normalizedName: text("normalized_name"),
    bbbRating: text("bbb_rating"), // A+ ... F | NR
    ratingScore: doublePrecision("rating_score"), // 0..100
    isAccredited: boolean("is_accredited"),
    accreditationStatus: text("accreditation_status"),
    accreditedSince: date("accredited_since"),
    reviewAverageRating: doublePrecision("review_average_rating"), // 1..5
    reviewCount: integer("review_count").default(0),
    complaintCount: integer("complaint_count").default(0),
    closedComplaintsPastThreeYears: integer("closed_complaints_past_three_years").default(0),
    unansweredComplaints: integer("unanswered_complaints").default(0),
    yearsInBusiness: integer("years_in_business"),
    primaryCategory: text("primary_category"),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("brep_company_idx").on(t.companyId),
    index("brep_rating_idx").on(t.bbbRating),
    index("brep_category_idx").on(t.primaryCategory),
  ],
);

export const businessReputationComplaints = pgTable(
  "business_reputation_complaints",
  {
    businessReputationComplaintId: uuid("business_reputation_complaint_id").primaryKey().defaultRandom(),
    businessReputationProfileId: uuid("business_reputation_profile_id").references(
      () => businessReputationProfiles.businessReputationProfileId,
    ),
    complaintDate: date("complaint_date"),
    complaintClosedDate: date("complaint_closed_date"),
    complaintType: text("complaint_type"),
    complaintCategory: text("complaint_category"),
    complaintStatus: text("complaint_status"),
    complaintSummary: text("complaint_summary"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("brc_profile_idx").on(t.businessReputationProfileId)],
);

export const businessReputationReviews = pgTable(
  "business_reputation_reviews",
  {
    businessReputationReviewId: uuid("business_reputation_review_id").primaryKey().defaultRandom(),
    businessReputationProfileId: uuid("business_reputation_profile_id").references(
      () => businessReputationProfiles.businessReputationProfileId,
    ),
    reviewDate: date("review_date"),
    reviewRating: doublePrecision("review_rating"),
    reviewTitle: text("review_title"),
    reviewText: text("review_text"),
    reviewerDisplayName: text("reviewer_display_name"),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("brr_profile_idx").on(t.businessReputationProfileId)],
);

export const contractorQualityScores = pgTable(
  "contractor_quality_scores",
  {
    contractorQualityScoreId: uuid("contractor_quality_score_id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.companyId),
    businessReputationProfileId: uuid("business_reputation_profile_id").references(
      () => businessReputationProfiles.businessReputationProfileId,
    ),
    scoringModel: text("scoring_model").notNull(),
    score: doublePrecision("score"), // 0..100
    scoreBand: text("score_band"), // Excellent | Good | Fair | Poor | At Risk
    matchConfidence: text("match_confidence"),
    factorPayload: jsonb("factor_payload").$type<Record<string, unknown>>(),
    ...prov(),
    ...stamps(),
  },
  (t) => [index("cqs_company_idx").on(t.companyId), index("cqs_score_idx").on(t.score)],
);

/* ───────────── EXTENSION: TENANT / OCCUPANCY (derived) ──────────── */

export const occupancies = pgTable(
  "occupancies",
  {
    occupancyId: uuid("occupancy_id").primaryKey().defaultRandom(),
    businessCompanyId: uuid("business_company_id").references(() => companies.companyId),
    propertyId: uuid("property_id").references(() => properties.propertyId),
    addressId: uuid("address_id").references(() => addresses.addressId),
    occupancyType: text("occupancy_type"), // tenant | owner-occupant
    spaceName: text("space_name"), // suite / unit label
    startDate: date("start_date"),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").default(true),
    ...prov(),
    ...stamps(),
  },
  (t) => [
    index("occ_business_idx").on(t.businessCompanyId),
    index("occ_property_idx").on(t.propertyId),
    index("occ_current_idx").on(t.isCurrent),
  ],
);

/* ───────────── RAG KNOWLEDGE LAYER (index of entities) ──────────── */

export const entityDocuments = pgTable(
  "entity_documents",
  {
    documentId: uuid("document_id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // property | contractor | business | owner | tenant | permit | neighborhood
    entityId: uuid("entity_id").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sourceSystems: text("source_systems").array(),
    citations: jsonb("citations").$type<Array<Record<string, unknown>>>(),
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entdoc_type_idx").on(t.entityType),
    index("entdoc_entity_idx").on(t.entityId),
  ],
);

/** Provenance/refresh ledger for the data sources (lineage metadata). */
export const ingestionRuns = pgTable("ingestion_runs", {
  ingestionRunId: uuid("ingestion_run_id").primaryKey().defaultRandom(),
  sourceSystem: text("source_system").notNull(),
  sourceLabel: text("source_label"),
  sourceUrl: text("source_url"),
  recordsLoaded: integer("records_loaded").default(0),
  collectionStartedAt: timestamp("collection_started_at", { withTimezone: true }),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").default("complete"),
  notes: text("notes"),
});
