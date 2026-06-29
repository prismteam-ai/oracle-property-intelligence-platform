import "server-only";

import { desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  addresses,
  businessRegistrations,
  businessReputationProfiles,
  companies,
  entityDocuments,
  occupancies,
  ownerships,
  projectContractors,
  projects,
  properties,
  propertyImprovements,
  propertySignalRollups,
  tenants,
} from "@/db/schema";
import type { PropertySignalRollup } from "@/db/schema/types";
import type { Citation, DashboardStats, FilterFacets } from "@/server/ports";
import { rowDisplayLimit } from "@/lib/dataset";
import { MAJOR_RENOVATION_VALUE_THRESHOLD } from "@/lib/renovation";

const DEFAULT_LIMIT = rowDisplayLimit();
const NEGATIVE_RATINGS = ["D", "D-", "D+", "F", "NR"];

export async function getDashboardStats(): Promise<DashboardStats> {
  const scalar = async (q: Promise<{ n: number }[]>): Promise<number> =>
    Number((await q)[0]?.n ?? 0);

  const [
    propertiesN,
    permitsN,
    openPermitsN,
    contractorsN,
    negativeContractorsN,
    businessesN,
    tenantsN,
    projectsN,
    majorRenovationsN,
    multiOpenN,
  ] = await Promise.all([
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(properties)),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(propertyImprovements)),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(propertyImprovements)
        .where(eq(propertyImprovements.improvementStatus, "open")),
    ),
    scalar(
      db
        .select({
          n: sql<number>`count(distinct ${propertyImprovements.contractorCompanyId})::int`,
        })
        .from(propertyImprovements),
    ),
    scalar(
      db
        .select({
          n: sql<number>`count(distinct ${businessReputationProfiles.companyId})::int`,
        })
        .from(businessReputationProfiles)
        .where(
          sql`${businessReputationProfiles.bbbRating} IN (${sql.join(
            NEGATIVE_RATINGS.map((r) => sql`${r}`),
            sql`, `,
          )})`,
        ),
    ),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(businessRegistrations)),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(tenants)),
    scalar(db.select({ n: sql<number>`count(*)::int` }).from(projects)),
    scalar(
      db
        .select({
          n: sql<number>`coalesce(sum(${propertySignalRollups.majorRenovationCount}),0)::int`,
        })
        .from(propertySignalRollups),
    ),
    scalar(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(propertySignalRollups)
        .where(gt(propertySignalRollups.openPermitCount, 1)),
    ),
  ]);

  return {
    properties: propertiesN,
    permits: permitsN,
    openPermits: openPermitsN,
    contractors: contractorsN,
    negativeContractors: negativeContractorsN,
    businesses: businessesN,
    tenants: tenantsN,
    projects: projectsN,
    majorRenovations: majorRenovationsN,
    multiOpenPermitProperties: multiOpenN,
  };
}

export async function getFilterFacets(): Promise<FilterFacets> {
  const distinct = async (
    q: Promise<{ v: string | null }[]>,
  ): Promise<string[]> =>
    (await q).map((r) => r.v).filter((v): v is string => !!v).sort();

  const [counties, municipalities, permitTypes, propertyClasses, businessTypes, trades] =
    await Promise.all([
      distinct(
        db.selectDistinct({ v: addresses.countyName }).from(addresses),
      ),
      distinct(
        db.selectDistinct({ v: addresses.municipalityName }).from(addresses),
      ),
      distinct(
        db
          .selectDistinct({ v: propertyImprovements.improvementType })
          .from(propertyImprovements),
      ),
      distinct(
        db.selectDistinct({ v: properties.propertyUsageType }).from(properties),
      ),
      distinct(
        db.selectDistinct({ v: businessRegistrations.filingType }).from(businessRegistrations),
      ),
      distinct(
        db.selectDistinct({ v: propertyImprovements.contractorType }).from(propertyImprovements),
      ),
    ]);

  return {
    counties,
    municipalities,
    permitTypes,
    propertyClasses,
    businessTypes,
    contractorTrades: trades,
  };
}

export async function getRollupForProperty(
  propertyId: string,
): Promise<PropertySignalRollup | null> {
  const rows = await db
    .select()
    .from(propertySignalRollups)
    .where(eq(propertySignalRollups.propertyId, propertyId))
    .limit(1);
  return rows[0] ?? null;
}

export async function propertiesWithMultipleOpenPermits(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(gt(propertySignalRollups.openPermitCount, 1))
    .orderBy(desc(propertySignalRollups.openPermitCount))
    .limit(limit);
}

export async function propertiesWithMultiCategoryOpenPermits(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(sql`cardinality(${propertySignalRollups.openPermitCategories}) > 1`)
    .orderBy(sql`cardinality(${propertySignalRollups.openPermitCategories}) desc`)
    .limit(limit);
}

export async function highestPermitActivity5y(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .orderBy(desc(propertySignalRollups.permitCount5y))
    .limit(limit);
}

export async function significantRenovationActivity(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .orderBy(desc(propertySignalRollups.improvementScore))
    .limit(limit);
}

export async function ownershipChangeWithOpenPermits(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`${propertySignalRollups.ownershipChangeCount} > 0 and ${propertySignalRollups.openPermitCount} > 0`,
    )
    .orderBy(desc(propertySignalRollups.ownershipChangeCount))
    .limit(limit);
}

export async function openPermitsWithBusinessTurnover(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`${propertySignalRollups.openPermitCount} > 0 and ${propertySignalRollups.businessTurnoverCount} > 0`,
    )
    .orderBy(desc(propertySignalRollups.businessTurnoverCount))
    .limit(limit);
}

export type NeighborhoodConcentrationRow = {
  municipalityName: string | null;
  propertyCount: number;
  majorRenovations: number;
  openPermits: number;
  representativePropertyId: string | null;
  representativeParcelIdentifier: string | null;
  sourceArtifactUri: string | null;
  sourceRecordKey: string | null;
  sourceSystem: string | null;
};

export async function neighborhoodRenovationConcentration(
  limit = DEFAULT_LIMIT,
): Promise<NeighborhoodConcentrationRow[]> {
  const rows = await db.execute<{
    municipality_name: string | null;
    property_count: number;
    major_renovations: number;
    open_permits: number;
    representative_property_id: string | null;
    representative_parcel_identifier: string | null;
    source_artifact_uri: string | null;
    source_record_key: string | null;
    source_system: string | null;
  }>(sql`
    with ranked as (
      select
        rl.municipality_name, rl.property_id, rl.parcel_identifier,
        p.source_artifact_uri, p.source_record_key, p.source_system,
        row_number() over (
          partition by rl.municipality_name
          order by rl.major_renovation_count desc, rl.permit_count_5y desc
        ) as rn
      from property_signal_rollups rl
      left join properties p on p.property_id = rl.property_id
    )
    select
      r.municipality_name,
      agg.property_count,
      agg.major_renovations,
      agg.open_permits,
      r.property_id as representative_property_id,
      r.parcel_identifier as representative_parcel_identifier,
      r.source_artifact_uri,
      r.source_record_key,
      r.source_system
    from (
      select
        municipality_name,
        count(*)::int as property_count,
        sum(major_renovation_count)::int as major_renovations,
        sum(open_permit_count)::int as open_permits
      from property_signal_rollups
      group by municipality_name
    ) agg
    join ranked r on r.municipality_name is not distinct from agg.municipality_name and r.rn = 1
    order by agg.major_renovations desc
    limit ${limit}
  `);
  return rows.rows.map((r) => ({
    municipalityName: r.municipality_name,
    propertyCount: Number(r.property_count ?? 0),
    majorRenovations: Number(r.major_renovations ?? 0),
    openPermits: Number(r.open_permits ?? 0),
    representativePropertyId: r.representative_property_id,
    representativeParcelIdentifier: r.representative_parcel_identifier,
    sourceArtifactUri: r.source_artifact_uri,
    sourceRecordKey: r.source_record_key,
    sourceSystem: r.source_system,
  }));
}

export type NeighborhoodTrendRow = {
  municipalityName: string | null;
  recentPermits: number;
  priorPermits: number;
  permitIncrease: number;
  growthRatePct: number | null;
  representativePropertyId: string | null;
  representativeParcelIdentifier: string | null;
  sourceArtifactUri: string | null;
  sourceRecordKey: string | null;
  sourceSystem: string | null;
};

const TREND_WINDOW_MONTHS = Number(process.env.NEIGHBORHOOD_TREND_WINDOW_MONTHS ?? 24);

export async function neighborhoodPermitActivity(
  limit = DEFAULT_LIMIT,
  windowMonths = TREND_WINDOW_MONTHS,
): Promise<NeighborhoodTrendRow[]> {
  const rows = await db.execute<{
    municipality_name: string | null;
    recent_permits: number;
    prior_permits: number;
    permit_increase: number;
    growth_rate_pct: number | null;
    representative_property_id: string | null;
    representative_parcel_identifier: string | null;
    source_artifact_uri: string | null;
    source_record_key: string | null;
    source_system: string | null;
  }>(sql`
    with bounds as (
      select max(permit_issue_date) as anchor from property_improvements
    ),
    windows as (
      select
        anchor,
        (anchor - (${windowMonths} || ' months')::interval)::date as recent_start,
        (anchor - (${2 * windowMonths} || ' months')::interval)::date as prior_start
      from bounds
    ),
    dated as (
      select
        rl.municipality_name,
        pi.permit_issue_date
      from property_improvements pi
      join property_signal_rollups rl on rl.property_id = pi.property_id
      where pi.permit_issue_date is not null
    ),
    counted as (
      select
        d.municipality_name,
        count(*) filter (
          where d.permit_issue_date > w.recent_start and d.permit_issue_date <= w.anchor
        )::int as recent_permits,
        count(*) filter (
          where d.permit_issue_date > w.prior_start and d.permit_issue_date <= w.recent_start
        )::int as prior_permits
      from dated d cross join windows w
      group by d.municipality_name
    ),
    ranked as (
      select
        rl.municipality_name, rl.property_id, rl.parcel_identifier,
        p.source_artifact_uri, p.source_record_key, p.source_system,
        row_number() over (
          partition by rl.municipality_name order by rl.permit_count_5y desc
        ) as rn
      from property_signal_rollups rl
      left join properties p on p.property_id = rl.property_id
    )
    select
      c.municipality_name,
      c.recent_permits,
      c.prior_permits,
      (c.recent_permits - c.prior_permits) as permit_increase,
      case when c.prior_permits > 0
        then round(100.0 * (c.recent_permits - c.prior_permits)::numeric / c.prior_permits, 1)
        else null end as growth_rate_pct,
      r.property_id as representative_property_id,
      r.parcel_identifier as representative_parcel_identifier,
      r.source_artifact_uri,
      r.source_record_key,
      r.source_system
    from counted c
    join ranked r on r.municipality_name is not distinct from c.municipality_name and r.rn = 1
    where c.recent_permits > c.prior_permits
    order by (c.recent_permits - c.prior_permits) desc
    limit ${limit}
  `);
  return rows.rows.map((r) => ({
    municipalityName: r.municipality_name,
    recentPermits: Number(r.recent_permits ?? 0),
    priorPermits: Number(r.prior_permits ?? 0),
    permitIncrease: Number(r.permit_increase ?? 0),
    growthRatePct: r.growth_rate_pct === null ? null : Number(r.growth_rate_pct),
    representativePropertyId: r.representative_property_id,
    representativeParcelIdentifier: r.representative_parcel_identifier,
    sourceArtifactUri: r.source_artifact_uri,
    sourceRecordKey: r.source_record_key,
    sourceSystem: r.source_system,
  }));
}

export async function propertiesWithOpenCategory(category: string, limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(sql`${category} = ANY(${propertySignalRollups.openPermitCategories})`)
    .orderBy(desc(propertySignalRollups.openPermitCount))
    .limit(limit);
}

export async function propertiesWithMajorTrade(trade: string, limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`${trade} = ANY(${propertySignalRollups.renovationTrades}) and ${propertySignalRollups.majorRenovationCount} > 0`,
    )
    .orderBy(desc(propertySignalRollups.improvementScore))
    .limit(limit);
}

export async function significantRenovationAboveScore(
  minScore: number,
  limit = DEFAULT_LIMIT,
) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(sql`${propertySignalRollups.improvementScore} >= ${minScore}`)
    .orderBy(desc(propertySignalRollups.improvementScore))
    .limit(limit);
}

export async function valueAddProperties(minScore: number, limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`${propertySignalRollups.improvementScore} >= ${minScore} and ${propertySignalRollups.majorRenovationCount} > 0`,
    )
    .orderBy(desc(propertySignalRollups.improvementScore))
    .limit(limit);
}

export async function acquisitionCandidateRollups(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`${propertySignalRollups.openPermitCount} > 0 and ${propertySignalRollups.ownershipChangeCount} > 0 and ${propertySignalRollups.businessTurnoverCount} > 0`,
    )
    .orderBy(
      sql`(${propertySignalRollups.openPermitCount} * 2 + ${propertySignalRollups.ownershipChangeCount} * 3 + ${propertySignalRollups.businessTurnoverCount} * 3) desc`,
    )
    .limit(limit);
}

export async function redevelopmentRollups(limit = DEFAULT_LIMIT) {
  return db
    .select()
    .from(propertySignalRollups)
    .where(
      sql`(${"structural"} = ANY(${propertySignalRollups.renovationTrades}) or ${"concrete"} = ANY(${propertySignalRollups.renovationTrades}))
        and ${propertySignalRollups.majorRenovationCount} > 0
        and (${propertySignalRollups.ownershipChangeCount} > 0 or ${propertySignalRollups.openPermitCount} > 1)`,
    )
    .orderBy(desc(propertySignalRollups.improvementScore))
    .limit(limit);
}

export async function businessesWithMultipleProperties(limit = DEFAULT_LIMIT) {
  return db
    .select({
      businessRegistrationId: occupancies.businessRegistrationId,
      entityName: businessRegistrations.entityName,
      documentNumber: businessRegistrations.documentNumber,
      sourceArtifactUri: businessRegistrations.sourceArtifactUri,
      sourceRecordKey: businessRegistrations.sourceRecordKey,
      propertyCount: sql<number>`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text))`.as(
        "property_count",
      ),
    })
    .from(occupancies)
    .innerJoin(
      businessRegistrations,
      eq(businessRegistrations.businessRegistrationId, occupancies.businessRegistrationId),
    )
    .groupBy(
      occupancies.businessRegistrationId,
      businessRegistrations.entityName,
      businessRegistrations.documentNumber,
      businessRegistrations.sourceArtifactUri,
      businessRegistrations.sourceRecordKey,
    )
    .having(
      sql`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text)) > 1`,
    )
    .orderBy(
      sql`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text)) desc`,
    )
    .limit(limit);
}

const TRADE_NAME_PATTERN: Record<string, string> = {
  roofing: "roof",
  electrical: "electric",
  plumbing: "plumb",
  hvac: "(hvac|air condition|cooling|heating)",
  concrete: "concrete",
};

export async function contractorsByTrade(trade: string, limit = DEFAULT_LIMIT) {
  const pattern = TRADE_NAME_PATTERN[trade.toLowerCase()] ?? trade.toLowerCase();
  return db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      trade: sql<string | null>`${trade}`.as("trade"),
      permitCount: businessReputationProfiles.reviewCount,
      bbbRating: businessReputationProfiles.bbbRating,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(companies)
    .innerJoin(
      businessReputationProfiles,
      eq(businessReputationProfiles.companyId, companies.companyId),
    )
    .where(sql`${companies.name} ~* ${pattern}`)
    .orderBy(
      desc(businessReputationProfiles.reviewCount),
      desc(businessReputationProfiles.reviewAverageRating),
    )
    .limit(limit);
}

export async function mostActiveContractors(limit = DEFAULT_LIMIT) {
  return db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      projectCount: businessReputationProfiles.reviewCount,
      permitCount: businessReputationProfiles.complaintCount,
      bbbRating: businessReputationProfiles.bbbRating,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(companies)
    .innerJoin(
      businessReputationProfiles,
      eq(businessReputationProfiles.companyId, companies.companyId),
    )
    .orderBy(
      desc(businessReputationProfiles.reviewCount),
      desc(businessReputationProfiles.complaintCount),
    )
    .limit(limit);
}

export async function contractorsWithComplaints(limit = DEFAULT_LIMIT) {
  return db
    .select({
      companyId: businessReputationProfiles.companyId,
      name: businessReputationProfiles.name,
      complaintCount: businessReputationProfiles.complaintCount,
      bbbRating: businessReputationProfiles.bbbRating,
      profileUrl: businessReputationProfiles.profileUrl,
      sourceRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(businessReputationProfiles)
    .where(gt(businessReputationProfiles.complaintCount, 0))
    .orderBy(desc(businessReputationProfiles.complaintCount))
    .limit(limit);
}

export async function permitPatternPrecedingTurnover(limit = DEFAULT_LIMIT) {
  return db
    .select({
      propertyId: propertySignalRollups.propertyId,
      parcelIdentifier: propertySignalRollups.parcelIdentifier,
      municipalityName: propertySignalRollups.municipalityName,
      businessTurnoverCount: propertySignalRollups.businessTurnoverCount,
      permitCount5y: propertySignalRollups.permitCount5y,
      renovationTrades: propertySignalRollups.renovationTrades,
      sourceArtifactUri: propertySignalRollups.sourceArtifactUri,
      sourceRecordKey: propertySignalRollups.sourceRecordKey,
      sourceSystem: propertySignalRollups.sourceSystem,
    })
    .from(propertySignalRollups)
    .where(
      sql`${propertySignalRollups.businessTurnoverCount} > 0 and ${propertySignalRollups.permitCount5y} > 0`,
    )
    .orderBy(desc(propertySignalRollups.businessTurnoverCount))
    .limit(limit);
}

export async function projectsByBadContractors(limit = DEFAULT_LIMIT) {
  return db
    .select({
      projectName: projects.projectName,
      projectStatus: projects.projectStatus,
      propertyId: projects.propertyId,
      parcelIdentifier: properties.parcelIdentifier,
      contractor: companies.name,
      contractorCompanyId: companies.companyId,
      bbbRating: businessReputationProfiles.bbbRating,
      complaintCount: businessReputationProfiles.complaintCount,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(projects)
    .innerJoin(projectContractors, eq(projectContractors.projectId, projects.projectId))
    .innerJoin(companies, eq(companies.companyId, projectContractors.companyId))
    .innerJoin(
      businessReputationProfiles,
      eq(businessReputationProfiles.companyId, companies.companyId),
    )
    .leftJoin(properties, eq(properties.propertyId, projects.propertyId))
    .where(
      sql`(${businessReputationProfiles.bbbRating} IN (${sql.join(
        NEGATIVE_RATINGS.map((r) => sql`${r}`),
        sql`, `,
      )}) OR coalesce(${businessReputationProfiles.complaintCount}, 0) > 0)`,
    )
    .orderBy(desc(businessReputationProfiles.complaintCount))
    .limit(limit);
}

export async function complaintLinkedProjectContractors(limit = DEFAULT_LIMIT) {
  const projectCount = sql<number>`count(distinct ${projectContractors.projectId})`;
  return db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      complaintCount: businessReputationProfiles.complaintCount,
      bbbRating: businessReputationProfiles.bbbRating,
      projectCount: projectCount.as("project_count"),
      complaintLinkedProjects:
        sql<number>`coalesce(${businessReputationProfiles.complaintCount},0) * count(distinct ${projectContractors.projectId})`.as(
          "complaint_linked_projects",
        ),
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(businessReputationProfiles)
    .innerJoin(companies, eq(companies.companyId, businessReputationProfiles.companyId))
    .innerJoin(projectContractors, eq(projectContractors.companyId, companies.companyId))
    .where(gt(businessReputationProfiles.complaintCount, 0))
    .groupBy(
      companies.companyId,
      companies.name,
      businessReputationProfiles.complaintCount,
      businessReputationProfiles.bbbRating,
      businessReputationProfiles.profileUrl,
      businessReputationProfiles.sourceRecordKey,
    )
    .orderBy(
      sql`coalesce(${businessReputationProfiles.complaintCount},0) * count(distinct ${projectContractors.projectId}) desc`,
    )
    .limit(limit);
}

export async function cleanMajorRenovationContractors(limit = DEFAULT_LIMIT) {
  return db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      majorRenovations: businessReputationProfiles.reviewCount,
      bbbRating: businessReputationProfiles.bbbRating,
      reviewAverageRating: businessReputationProfiles.reviewAverageRating,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(companies)
    .innerJoin(
      businessReputationProfiles,
      eq(businessReputationProfiles.companyId, companies.companyId),
    )
    .where(
      sql`(${businessReputationProfiles.bbbRating} is null
             or ${businessReputationProfiles.bbbRating} not in (${sql.join(
               NEGATIVE_RATINGS.map((r) => sql`${r}`),
               sql`, `,
             )}))
        and coalesce(${businessReputationProfiles.complaintCount}, 0) = 0
        and coalesce(${businessReputationProfiles.reviewCount}, 0) > 0`,
    )
    .orderBy(
      desc(businessReputationProfiles.reviewAverageRating),
      desc(businessReputationProfiles.reviewCount),
    )
    .limit(limit);
}

export async function expandingBusinesses(limit = DEFAULT_LIMIT) {
  const locationCount = sql<number>`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text))`;
  return db
    .select({
      businessRegistrationId: occupancies.businessRegistrationId,
      entityName: businessRegistrations.entityName,
      documentNumber: businessRegistrations.documentNumber,
      sourceArtifactUri: businessRegistrations.sourceArtifactUri,
      sourceRecordKey: businessRegistrations.sourceRecordKey,
      locationCount: locationCount.as("location_count"),
      firstSeen: sql<string | null>`min(${occupancies.startDate})`.as("first_seen"),
      latestSeen: sql<string | null>`max(${occupancies.startDate})`.as("latest_seen"),
    })
    .from(occupancies)
    .innerJoin(
      businessRegistrations,
      eq(businessRegistrations.businessRegistrationId, occupancies.businessRegistrationId),
    )
    .groupBy(
      occupancies.businessRegistrationId,
      businessRegistrations.entityName,
      businessRegistrations.documentNumber,
      businessRegistrations.sourceArtifactUri,
      businessRegistrations.sourceRecordKey,
    )
    .having(
      sql`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text)) > 1`,
    )
    .orderBy(
      sql`count(distinct coalesce(${occupancies.propertyId}::text, ${occupancies.addressId}::text)) desc`,
    )
    .limit(limit);
}

export async function anomalousPermitProperties(limit = DEFAULT_LIMIT) {
  const rows = await db.execute<{
    property_id: string | null;
    parcel_identifier: string | null;
    municipality_name: string | null;
    permit_count_5y: number | null;
    source_artifact_uri: string | null;
    source_record_key: string | null;
    source_system: string | null;
    neighborhood_mean: number | null;
    ratio_vs_neighborhood: number | null;
  }>(sql`
    with scored as (
      select
        property_id, parcel_identifier, municipality_name, permit_count_5y,
        source_artifact_uri, source_record_key, source_system,
        avg(permit_count_5y) over (partition by municipality_name) as muni_mean
      from property_signal_rollups
    )
    select
      property_id, parcel_identifier, municipality_name, permit_count_5y,
      source_artifact_uri, source_record_key, source_system,
      round(muni_mean, 2) as neighborhood_mean,
      round(permit_count_5y::numeric / nullif(muni_mean, 0), 2) as ratio_vs_neighborhood
    from scored
    where muni_mean > 0
      and permit_count_5y >= greatest(2 * muni_mean, muni_mean + 4)
    order by permit_count_5y::numeric / nullif(muni_mean, 0) desc
    limit ${limit}
  `);
  return rows.rows.map((r) => ({
    propertyId: r.property_id,
    parcelIdentifier: r.parcel_identifier,
    municipalityName: r.municipality_name,
    permitCount5y: r.permit_count_5y,
    sourceArtifactUri: r.source_artifact_uri,
    sourceRecordKey: r.source_record_key,
    sourceSystem: r.source_system,
    neighborhoodMean: Number(r.neighborhood_mean ?? 0),
    ratioVsNeighborhood: Number(r.ratio_vs_neighborhood ?? 0),
  }));
}

export type EntityGraphRow = {
  role: string;
  name: string | null;
  detail: string | null;
  href?: string;
  citations: Citation[];
};

export async function entityGraph(): Promise<EntityGraphRow[]> {
  const candidates = await db
    .select({ propertyId: ownerships.propertyId })
    .from(ownerships)
    .innerJoin(properties, eq(properties.propertyId, ownerships.propertyId))
    .where(sql`btrim(coalesce(${ownerships.ownedBy}, '')) <> ''`)
    .orderBy(desc(properties.updatedAt))
    .limit(1);
  const chosen = candidates[0]?.propertyId;
  if (!chosen) return [];

  const rows: EntityGraphRow[] = [];

  const [property] = await db
    .select({
      parcelIdentifier: properties.parcelIdentifier,
      propertyUsageType: properties.propertyUsageType,
      sourceArtifactUri: properties.sourceArtifactUri,
      sourceRecordKey: properties.sourceRecordKey,
      sourceSystem: properties.sourceSystem,
    })
    .from(properties)
    .where(eq(properties.propertyId, chosen))
    .limit(1);
  rows.push({
    role: "Property",
    name: property?.parcelIdentifier ?? chosen,
    detail: property?.propertyUsageType ?? null,
    href: `/properties/${chosen}`,
    citations: property?.sourceArtifactUri
      ? [
          {
            label: "Lee County Property Appraiser",
            url: property.sourceArtifactUri,
            recordKey: property.sourceRecordKey ?? null,
            sourceSystem: property.sourceSystem ?? "leepa",
          },
        ]
      : [],
  });

  const [contractor] = await db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      bbbRating: businessReputationProfiles.bbbRating,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(propertyImprovements)
    .innerJoin(companies, eq(companies.companyId, propertyImprovements.contractorCompanyId))
    .leftJoin(
      businessReputationProfiles,
      eq(businessReputationProfiles.companyId, companies.companyId),
    )
    .where(eq(propertyImprovements.propertyId, chosen))
    .limit(1);
  if (contractor) {
    rows.push({
      role: "Contractor",
      name: contractor.name,
      detail: contractor.bbbRating ? `BBB ${contractor.bbbRating}` : null,
      href: `/contractors/${contractor.companyId}`,
      citations: contractor.profileUrl
        ? [
            {
              label: "BBB Profile",
              url: contractor.profileUrl,
              recordKey: contractor.profileRecordKey ?? null,
              sourceSystem: "bbb",
            },
          ]
        : [],
    });
  }

  const [business] = await db
    .select({
      entityName: businessRegistrations.entityName,
      documentNumber: businessRegistrations.documentNumber,
      filingType: businessRegistrations.filingType,
      sourceArtifactUri: businessRegistrations.sourceArtifactUri,
      sourceRecordKey: businessRegistrations.sourceRecordKey,
      sourceSystem: businessRegistrations.sourceSystem,
    })
    .from(occupancies)
    .innerJoin(
      businessRegistrations,
      eq(businessRegistrations.businessRegistrationId, occupancies.businessRegistrationId),
    )
    .where(eq(occupancies.propertyId, chosen))
    .limit(1);
  if (business) {
    rows.push({
      role: "Business",
      name: business.entityName,
      detail: business.filingType ?? null,
      href: business.documentNumber ? `/businesses/${business.documentNumber}` : undefined,
      citations: business.sourceArtifactUri
        ? [
            {
              label: "Florida Sunbiz",
              url: business.sourceArtifactUri,
              recordKey: business.sourceRecordKey ?? null,
              sourceSystem: business.sourceSystem ?? "sunbiz",
            },
          ]
        : [],
    });
  }

  const [tenant] = await db
    .select({
      tenantId: tenants.tenantId,
      tenantName: tenants.tenantName,
      tenantType: tenants.tenantType,
    })
    .from(occupancies)
    .innerJoin(tenants, eq(tenants.tenantId, occupancies.tenantId))
    .where(eq(occupancies.propertyId, chosen))
    .limit(1);
  if (tenant) {
    rows.push({
      role: "Tenant",
      name: tenant.tenantName,
      detail: tenant.tenantType ?? null,
      href: `/tenants/${tenant.tenantId}`,
      citations: [],
    });
  }

  const [owner] = await db
    .select({
      name: sql<string | null>`coalesce(${companies.name}, initcap(btrim(${ownerships.ownedBy})))`,
      ownerCompanyId: ownerships.ownerCompanyId,
    })
    .from(ownerships)
    .leftJoin(companies, eq(companies.companyId, ownerships.ownerCompanyId))
    .where(eq(ownerships.propertyId, chosen))
    .limit(1);
  if (owner?.name) {
    rows.push({
      role: "Owner",
      name: owner.name,
      detail: "owner of record",
      href: `/properties/${chosen}`,
      citations: rows[0]?.citations ?? [],
    });
  }

  return rows;
}


export type EvidenceDocumentRow = {
  documentId: string;
  entityType: string;
  title: string;
  subtitle: string | null;
  sourceUri: string | null;
};

export async function sampleEvidenceDocuments(
  limit = 12,
): Promise<EvidenceDocumentRow[]> {
  const rows = await db
    .select({
      documentId: entityDocuments.documentId,
      entityType: entityDocuments.entityType,
      title: entityDocuments.title,
      subtitle: entityDocuments.subtitle,
      sourceUri: entityDocuments.sourceUri,
    })
    .from(entityDocuments)
    .where(sql`${entityDocuments.embedding} is not null`)
    .orderBy(desc(entityDocuments.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    documentId: r.documentId,
    entityType: r.entityType,
    title: r.title,
    subtitle: r.subtitle ?? null,
    sourceUri: r.sourceUri ?? null,
  }));
}
