import "server-only";

import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  businessReputationComplaints,
  businessReputationProfiles,
  businessReputationReviews,
  companies,
  contractorQualityScores,
  permitContacts,
  propertyImprovements,
} from "@/db/schema";
import type {
  BusinessReputationComplaint,
  BusinessReputationProfile,
  BusinessReputationReview,
  Company,
} from "@/db/schema/types";
import type { ContractorFilters, ContractorListItem } from "@/server/ports";
import { rowDisplayLimit } from "@/lib/dataset";

const DEFAULT_LIMIT = rowDisplayLimit();
const NEGATIVE_RATINGS = ["D", "D-", "D+", "F", "NR"];

export async function searchCompanies(query: string, limit = DEFAULT_LIMIT): Promise<Company[]> {
  return db
    .select()
    .from(companies)
    .where(ilike(companies.name, `%${query}%`))
    .limit(limit);
}

export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  if (ids.length === 0) return [];
  return db.select().from(companies).where(inArray(companies.companyId, ids));
}

export async function listContractors(
  filters: ContractorFilters = {},
): Promise<ContractorListItem[]> {
  const conds = [];
  if (filters.query) conds.push(ilike(companies.name, `%${filters.query}%`));
  if (filters.rating === "negative") {
    conds.push(inArray(businessReputationProfiles.bbbRating, NEGATIVE_RATINGS));
  }
  if (filters.rating === "positive") {
    conds.push(
      sql`(${businessReputationProfiles.bbbRating} IS NULL OR ${
        businessReputationProfiles.bbbRating
      } NOT IN (${sql.join(NEGATIVE_RATINGS.map((r) => sql`${r}`), sql`, `)}))`,
    );
  }
  if (filters.trade) conds.push(sql`1 = 0`);

  const orderCol =
    filters.sort === "reviews"
      ? desc(businessReputationProfiles.reviewCount)
      : filters.sort === "score"
        ? desc(businessReputationProfiles.reviewAverageRating)
        : desc(businessReputationProfiles.complaintCount);

  const rows = await db
    .select({
      company: companies,
      bbbRating: businessReputationProfiles.bbbRating,
      complaintCount: businessReputationProfiles.complaintCount,
      reviewAverageRating: businessReputationProfiles.reviewAverageRating,
      reviewCount: businessReputationProfiles.reviewCount,
    })
    .from(businessReputationProfiles)
    .innerJoin(
      companies,
      eq(companies.companyId, businessReputationProfiles.companyId),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(orderCol)
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);

  return rows.map((r) => ({
    ...r.company,
    bbbRating: r.bbbRating ?? null,
    complaintCount: r.complaintCount ?? null,
    reviewAverageRating: r.reviewAverageRating ?? null,
    reviewCount: r.reviewCount ?? null,
    permitCount: 0,
    trade: null,
    isNegative: NEGATIVE_RATINGS.includes(r.bbbRating ?? ""),
  }));
}

export async function listReviewsForProfile(
  businessReputationProfileId: string,
  limit = 50,
): Promise<BusinessReputationReview[]> {
  return db
    .select()
    .from(businessReputationReviews)
    .where(
      eq(businessReputationReviews.businessReputationProfileId, businessReputationProfileId),
    )
    .orderBy(desc(businessReputationReviews.reviewDate))
    .limit(limit);
}

export async function listComplaintsForProfile(
  businessReputationProfileId: string,
  limit = 50,
): Promise<BusinessReputationComplaint[]> {
  return db
    .select()
    .from(businessReputationComplaints)
    .where(
      eq(
        businessReputationComplaints.businessReputationProfileId,
        businessReputationProfileId,
      ),
    )
    .orderBy(desc(businessReputationComplaints.complaintDate))
    .limit(limit);
}

export async function listPermitsForContractor(
  companyId: string,
  limit = 100,
) {
  return db
    .select()
    .from(propertyImprovements)
    .where(eq(propertyImprovements.contractorCompanyId, companyId))
    .orderBy(desc(propertyImprovements.permitIssueDate))
    .limit(limit);
}

export async function getBusinessReputationDetail(
  companyId: string,
): Promise<BusinessReputationProfile | null> {
  const rows = await db
    .select()
    .from(businessReputationProfiles)
    .where(eq(businessReputationProfiles.companyId, companyId))
    .limit(1);
  return rows[0] ?? null;
}

export async function contractorsWithNegativeBbb(limit = DEFAULT_LIMIT) {
  return db
    .select({
      companyId: companies.companyId,
      name: companies.name,
      bbbRating: businessReputationProfiles.bbbRating,
      complaintCount: businessReputationProfiles.complaintCount,
      reviewAverageRating: businessReputationProfiles.reviewAverageRating,
      profileUrl: businessReputationProfiles.profileUrl,
      profileRecordKey: businessReputationProfiles.sourceRecordKey,
    })
    .from(businessReputationProfiles)
    .innerJoin(companies, eq(companies.companyId, businessReputationProfiles.companyId))
    .where(inArray(businessReputationProfiles.bbbRating, NEGATIVE_RATINGS))
    .orderBy(desc(businessReputationProfiles.complaintCount))
    .limit(limit);
}

export async function listContractorQualityScoresForPermitNumber(
  permitNumber: string,
): Promise<Company[]> {
  const rows = await db
    .select({ companyId: permitContacts.companyId })
    .from(permitContacts)
    .innerJoin(
      propertyImprovements,
      eq(propertyImprovements.propertyImprovementId, permitContacts.propertyImprovementId),
    )
    .where(eq(propertyImprovements.permitNumber, permitNumber));
  const ids = rows.map((r) => r.companyId).filter((x): x is string => !!x);
  if (ids.length === 0) return [];
  return db.select().from(companies).where(inArray(companies.companyId, ids));
}

export { contractorQualityScores, NEGATIVE_RATINGS, sql };
