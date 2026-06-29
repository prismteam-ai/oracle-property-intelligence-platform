import "server-only";

import { and, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/server/pg";
import { propertyImprovements } from "@/db/schema";
import type { PropertyImprovement } from "@/db/schema/types";
import type { PropertyFilters } from "@/server/ports";

const DEFAULT_LIMIT = 50;

export async function searchPermits(
  filters: PropertyFilters = {},
): Promise<PropertyImprovement[]> {
  const conds = [];
  if (filters.permitType) {
    conds.push(ilike(propertyImprovements.improvementType, `%${filters.permitType}%`));
  }
  if (filters.municipality) {
    conds.push(ilike(propertyImprovements.planningCommunity, `%${filters.municipality}%`));
  }
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(propertyImprovements)
    .where(where)
    .orderBy(desc(propertyImprovements.permitIssueDate))
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);
}

export async function getPermitByNumber(
  permitNumber: string,
): Promise<PropertyImprovement | null> {
  const rows = await db
    .select()
    .from(propertyImprovements)
    .where(eq(propertyImprovements.permitNumber, permitNumber))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPermitsForProperty(
  propertyId: string,
): Promise<PropertyImprovement[]> {
  return db
    .select()
    .from(propertyImprovements)
    .where(eq(propertyImprovements.propertyId, propertyId))
    .orderBy(desc(propertyImprovements.permitIssueDate));
}
