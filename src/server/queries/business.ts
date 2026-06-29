import "server-only";

import { and, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  businessRegistrationParties,
  businessRegistrations,
} from "@/db/schema";
import type {
  BusinessRegistration,
  BusinessRegistrationParty,
} from "@/db/schema/types";
import type { BusinessFilters } from "@/server/ports";
import { rowDisplayLimit } from "@/lib/dataset";

const DEFAULT_LIMIT = rowDisplayLimit();

export async function listBusinesses(
  filters: BusinessFilters = {},
): Promise<BusinessRegistration[]> {
  const conds = [];
  if (filters.businessType) {
    conds.push(ilike(businessRegistrations.filingType, `%${filters.businessType}%`));
  }
  if (filters.status) {
    conds.push(eq(businessRegistrations.status, filters.status.toUpperCase()));
  }
  if (filters.query) {
    conds.push(ilike(businessRegistrations.entityName, `%${filters.query}%`));
  }
  return db
    .select()
    .from(businessRegistrations)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(businessRegistrations.filedDate))
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);
}

export async function listPartiesForRegistration(
  businessRegistrationId: string,
): Promise<BusinessRegistrationParty[]> {
  return db
    .select()
    .from(businessRegistrationParties)
    .where(eq(businessRegistrationParties.businessRegistrationId, businessRegistrationId))
    .orderBy(businessRegistrationParties.officerOrdinal);
}

export async function getBusinessByDocumentNumber(
  documentNumber: string,
): Promise<BusinessRegistration | null> {
  const rows = await db
    .select()
    .from(businessRegistrations)
    .where(eq(businessRegistrations.documentNumber, documentNumber))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchBusinesses(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<BusinessRegistration[]> {
  return db
    .select()
    .from(businessRegistrations)
    .where(ilike(businessRegistrations.entityName, `%${query}%`))
    .limit(limit);
}
