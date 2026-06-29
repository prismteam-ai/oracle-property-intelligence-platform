import "server-only";

import { and, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  occupancies,
  projectContractors,
  projects,
  properties,
  propertySignalRollups,
  tenants,
} from "@/db/schema";
import type { Occupancy, Project, Tenant } from "@/db/schema/types";
import type { RelatedProperty, TenantFilters } from "@/server/ports";
import { rowDisplayLimit } from "@/lib/dataset";

const DEFAULT_LIMIT = rowDisplayLimit();

export async function listTenants(filters: TenantFilters = {}): Promise<Tenant[]> {
  const conds = [];
  if (filters.tenantType) conds.push(eq(tenants.tenantType, filters.tenantType));
  if (filters.query) conds.push(ilike(tenants.tenantName, `%${filters.query}%`));
  return db
    .select()
    .from(tenants)
    .where(conds.length ? and(...conds) : undefined)
    .limit(filters.limit ?? DEFAULT_LIMIT);
}

export async function listPropertiesForTenant(
  tenantId: string,
): Promise<RelatedProperty[]> {
  const rows = await db
    .selectDistinct({
      propertyId: properties.propertyId,
      parcelIdentifier: properties.parcelIdentifier,
      subdivision: properties.subdivision,
      propertyUsageType: properties.propertyUsageType,
      municipalityName: propertySignalRollups.municipalityName,
    })
    .from(occupancies)
    .innerJoin(properties, eq(properties.propertyId, occupancies.propertyId))
    .leftJoin(
      propertySignalRollups,
      eq(propertySignalRollups.propertyId, properties.propertyId),
    )
    .where(eq(occupancies.tenantId, tenantId));
  return rows.map((r) => ({
    propertyId: r.propertyId!,
    parcelIdentifier: r.parcelIdentifier ?? null,
    subdivision: r.subdivision ?? null,
    municipalityName: r.municipalityName ?? null,
    propertyUsageType: r.propertyUsageType ?? null,
    relationship: "occupancy",
  }));
}

export async function listProjectsForContractor(
  companyId: string,
  limit = 100,
): Promise<Project[]> {
  const ids = (
    await db
      .select({ projectId: projectContractors.projectId })
      .from(projectContractors)
      .where(eq(projectContractors.companyId, companyId))
  ).map((r) => r.projectId);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(projects)
    .where(inArray(projects.projectId, ids))
    .limit(limit);
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  return rows[0] ?? null;
}

export async function listOccupanciesForTenant(tenantId: string): Promise<Occupancy[]> {
  return db.select().from(occupancies).where(eq(occupancies.tenantId, tenantId));
}

export async function listOccupanciesForProperty(propertyId: string): Promise<Occupancy[]> {
  return db.select().from(occupancies).where(eq(occupancies.propertyId, propertyId));
}

export async function listProjects(limit = DEFAULT_LIMIT): Promise<Project[]> {
  return db.select().from(projects).limit(limit);
}

export async function listProjectsForProperty(propertyId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.propertyId, propertyId));
}

export type TenantLocationRow = {
  tenantId: string | null;
  tenantName: string | null;
  tenantType: string | null;
  matchMethod: string | null;
  matchConfidence: string | null;
  sourceRecordKey: string | null;
  sourceSystem: string | null;
  locationCount: number;
};

export async function tenantsWithMultipleLocations(
  limit = DEFAULT_LIMIT,
): Promise<TenantLocationRow[]> {
  const rows = await db
    .select({
      tenantId: occupancies.tenantId,
      tenantName: tenants.tenantName,
      tenantType: tenants.tenantType,
      matchMethod: tenants.matchMethod,
      matchConfidence: tenants.matchConfidence,
      sourceRecordKey: tenants.sourceRecordKey,
      sourceSystem: tenants.sourceSystem,
      locationCount: sql<number>`count(distinct ${occupancies.addressId})`.as(
        "location_count",
      ),
    })
    .from(occupancies)
    .innerJoin(tenants, eq(tenants.tenantId, occupancies.tenantId))
    .groupBy(
      occupancies.tenantId,
      tenants.tenantName,
      tenants.tenantType,
      tenants.matchMethod,
      tenants.matchConfidence,
      tenants.sourceRecordKey,
      tenants.sourceSystem,
    )
    .having(sql`count(distinct ${occupancies.addressId}) > 1`)
    .orderBy(sql`count(distinct ${occupancies.addressId}) desc`)
    .limit(limit);
  return rows.map((r) => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName ?? null,
    tenantType: r.tenantType ?? null,
    matchMethod: r.matchMethod ?? null,
    matchConfidence: r.matchConfidence ?? null,
    sourceRecordKey: r.sourceRecordKey ?? null,
    sourceSystem: r.sourceSystem ?? null,
    locationCount: Number(r.locationCount ?? 0),
  }));
}
