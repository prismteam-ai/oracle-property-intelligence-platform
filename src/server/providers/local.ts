import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/server/pg";
import { entityDocuments, occupancies } from "@/db/schema";
import type {
  BusinessDetail,
  BusinessFilters,
  ContractorActivity,
  ContractorDetail,
  ContractorFilters,
  ContractorListItem,
  DashboardStats,
  DataAccess,
  FilterFacets,
  InquiryResult,
  PropertyDetail,
  PropertyFilters,
  RagEvidence,
  RelatedBusiness,
  RelatedProperty,
  TenantDetail,
  TenantFilters,
} from "@/server/ports";
import type { EntityDocument } from "@/db/schema/types";
import {
  getPropertyById,
  getPropertyByParcelIdentifier,
  listOwnershipHistory,
  listProperties,
  listSalesHistory,
} from "@/server/queries/property";
import {
  getPermitByNumber,
  listPermitsForProperty,
  searchPermits,
} from "@/server/queries/permits";
import {
  getBusinessReputationDetail,
  getCompaniesByIds,
  listComplaintsForProfile,
  listContractorQualityScoresForPermitNumber,
  listContractors,
  listPermitsForContractor,
  listReviewsForProfile,
  searchCompanies,
} from "@/server/queries/contractor";
import {
  getBusinessByDocumentNumber,
  listBusinesses,
  listPartiesForRegistration,
} from "@/server/queries/business";
import {
  getTenantById,
  listOccupanciesForProperty,
  listOccupanciesForTenant,
  listProjects,
  listProjectsForContractor,
  listProjectsForProperty,
  listPropertiesForTenant,
  listTenants,
} from "@/server/queries/tenant";
import {
  getDashboardStats,
  getFilterFacets,
  getRollupForProperty,
} from "@/server/queries/analytics";
import { runInquiry } from "@/server/queries/runInquiry";
import { ragRetrieve } from "@/server/rag/retrieve";
import { answerQuestion } from "@/server/rag/answer";
import { classifyTrades, isMajorRenovation } from "@/lib/renovation";

export const localProvider: DataAccess = {
  listProperties: (f?: PropertyFilters) => listProperties(f),
  getPropertyById: (id: string) => getPropertyById(id),
  getPropertyByParcelIdentifier: (pid: string) => getPropertyByParcelIdentifier(pid),
  getPropertyDetail: async (id: string): Promise<PropertyDetail | null> => {
    const property = await getPropertyById(id);
    if (!property) return null;
    const propertyId = property.propertyId;
    const [ownershipHistory, salesHistory, permits, occupancies, projects, rollup] =
      await Promise.all([
        listOwnershipHistory(propertyId),
        listSalesHistory(propertyId),
        listPermitsForProperty(propertyId),
        listOccupanciesForProperty(propertyId),
        listProjectsForProperty(propertyId),
        getRollupForProperty(propertyId),
      ]);

    const openPermits = permits.filter((p) => p.improvementStatus === "open");
    const majorImprovements = permits.filter((p) =>
      isMajorRenovation({
        improvementType: p.improvementType,
        projectDescription: p.projectDescription,
        description: p.description,
        estimatedJobValue: p.estimatedJobValue,
      }),
    );

    const byContractor = new Map<string, typeof permits>();
    for (const p of permits) {
      if (!p.contractorCompanyId) continue;
      const arr = byContractor.get(p.contractorCompanyId) ?? [];
      arr.push(p);
      byContractor.set(p.contractorCompanyId, arr);
    }
    const companyRows = await getCompaniesByIds([...byContractor.keys()]);
    const nameById = new Map(companyRows.map((c) => [c.companyId, c.name]));
    const contractorActivity: ContractorActivity[] = await Promise.all(
      [...byContractor.entries()].map(async ([companyId, ps]) => {
        const profile = await getBusinessReputationDetail(companyId);
        const trades = new Set<string>();
        for (const p of ps) {
          for (const t of classifyTrades({
            improvementType: p.improvementType,
            projectDescription: p.projectDescription,
            description: p.description,
            volts: p.volts,
          })) {
            trades.add(t);
          }
        }
        return {
          companyId,
          name: nameById.get(companyId) ?? profile?.name ?? null,
          permitCount: ps.length,
          trades: [...trades],
          bbbRating: profile?.bbbRating ?? null,
          complaintCount: profile?.complaintCount ?? null,
        };
      }),
    );

    const businesses: RelatedBusiness[] = occupancies
      .filter((o) => o.businessRegistrationId)
      .map((o) => ({
        businessRegistrationId: o.businessRegistrationId ?? null,
        documentNumber: null,
        entityName: null,
        status: null,
        filingType: null,
        occupancyStatus: o.occupancyStatus ?? null,
        startDate: o.startDate ?? null,
        endDate: o.endDate ?? null,
      }));

    return {
      property,
      ownershipHistory,
      salesHistory,
      permits,
      openPermits,
      majorImprovements,
      contractorActivity: contractorActivity.sort((a, b) => b.permitCount - a.permitCount),
      businesses,
      occupancies,
      projects,
      rollup,
    };
  },

  searchPermits: (f?: PropertyFilters) => searchPermits(f),
  getPermitByNumber: (n: string) => getPermitByNumber(n),
  listPermitsForProperty: (id: string) => listPermitsForProperty(id),

  searchCompanies: (q: string, limit?: number) => searchCompanies(q, limit),
  listContractors: (f?: ContractorFilters): Promise<ContractorListItem[]> =>
    listContractors(f),
  getBusinessReputationDetail: (id: string) => getBusinessReputationDetail(id),
  listContractorQualityScoresForPermitNumber: (n: string) =>
    listContractorQualityScoresForPermitNumber(n),
  getContractorDetail: async (companyId: string): Promise<ContractorDetail | null> => {
    const reputation = await getBusinessReputationDetail(companyId);
    const [companyRows, permits, projects] = await Promise.all([
      getCompaniesByIds([companyId]),
      listPermitsForContractor(companyId),
      listProjectsForContractor(companyId),
    ]);
    const company =
      companyRows[0] ??
      (reputation
        ? ({
            companyId,
            name: reputation.name ?? "Contractor",
            sourceSystem: reputation.sourceSystem,
          } as ContractorDetail["company"])
        : null);
    if (!company && !reputation) return null;

    const [reviews, complaints] = reputation
      ? await Promise.all([
          listReviewsForProfile(reputation.businessReputationProfileId),
          listComplaintsForProfile(reputation.businessReputationProfileId),
        ])
      : [[], []];
    const positiveCount = reviews.filter((r) => Number(r.reviewRating ?? 0) >= 4).length;
    const negativeCount = reviews.filter((r) => Number(r.reviewRating ?? 0) <= 2).length;

    const propMap = new Map<string, number>();
    for (const p of permits) {
      if (p.propertyId) propMap.set(p.propertyId, (propMap.get(p.propertyId) ?? 0) + 1);
    }
    const properties: RelatedProperty[] = (
      await Promise.all(
        [...propMap.entries()].map(
          async ([pid, permitCount]): Promise<RelatedProperty | null> => {
            const prop = await getPropertyById(pid);
            if (!prop) return null;
            const rollup = await getRollupForProperty(pid);
            return {
              propertyId: pid,
              parcelIdentifier: prop.parcelIdentifier ?? null,
              subdivision: prop.subdivision ?? null,
              municipalityName: rollup?.municipalityName ?? null,
              propertyUsageType: prop.propertyUsageType ?? null,
              relationship: "permit",
              permitCount,
            };
          },
        ),
      )
    )
      .filter((r): r is RelatedProperty => !!r)
      .sort((a, b) => (b.permitCount ?? 0) - (a.permitCount ?? 0));

    const NEGATIVE = ["D", "D-", "D+", "F", "NR"];
    return {
      company: company!,
      reputation: reputation ?? null,
      reviews,
      complaints,
      reviewSummary: {
        averageRating: reputation?.reviewAverageRating
          ? Number(reputation.reviewAverageRating)
          : null,
        reviewCount: reputation?.reviewCount ?? reviews.length,
        positiveCount,
        negativeCount,
      },
      permits,
      projects,
      properties,
      isNegative: NEGATIVE.includes(reputation?.bbbRating ?? ""),
    };
  },

  listBusinesses: (f?: BusinessFilters) => listBusinesses(f),
  getBusinessDetail: async (documentNumber: string): Promise<BusinessDetail | null> => {
    const business = await getBusinessByDocumentNumber(documentNumber);
    if (!business) return null;
    const parties = await listPartiesForRegistration(business.businessRegistrationId);
    const occ = await db
      .select({ propertyId: occupancies.propertyId })
      .from(occupancies)
      .where(eq(occupancies.businessRegistrationId, business.businessRegistrationId));
    const propIds = [...new Set(occ.map((o) => o.propertyId).filter((x): x is string => !!x))];
    const properties: RelatedProperty[] = (
      await Promise.all(
        propIds.map(async (pid): Promise<RelatedProperty | null> => {
          const prop = await getPropertyById(pid);
          if (!prop) return null;
          const rollup = await getRollupForProperty(pid);
          return {
            propertyId: pid,
            parcelIdentifier: prop.parcelIdentifier ?? null,
            subdivision: prop.subdivision ?? null,
            municipalityName: rollup?.municipalityName ?? null,
            propertyUsageType: prop.propertyUsageType ?? null,
            relationship: "occupancy",
          };
        }),
      )
    ).filter((r): r is RelatedProperty => !!r);

    const permits = (await Promise.all(propIds.map((pid) => listPermitsForProperty(pid)))).flat();
    const projects = (
      await Promise.all(propIds.map((pid) => listProjectsForProperty(pid)))
    ).flat();

    return {
      business,
      company: null,
      parties,
      properties,
      permits,
      projects,
    };
  },

  listTenants: (f?: TenantFilters) => listTenants(f),
  getTenantById: (id: string) => getTenantById(id),
  listOccupanciesForTenant: (id: string) => listOccupanciesForTenant(id),
  listOccupanciesForProperty: (id: string) => listOccupanciesForProperty(id),
  getTenantDetail: async (tenantId: string): Promise<TenantDetail | null> => {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return null;
    const [occupancies, properties] = await Promise.all([
      listOccupanciesForTenant(tenantId),
      listPropertiesForTenant(tenantId),
    ]);
    const businesses: RelatedBusiness[] = occupancies
      .filter((o) => o.businessRegistrationId)
      .map((o) => ({
        businessRegistrationId: o.businessRegistrationId ?? null,
        documentNumber: null,
        entityName: null,
        status: null,
        filingType: null,
        occupancyStatus: o.occupancyStatus ?? null,
        startDate: o.startDate ?? null,
        endDate: o.endDate ?? null,
      }));
    const propIds = properties.map((p) => p.propertyId);
    const permits = (await Promise.all(propIds.map((pid) => listPermitsForProperty(pid)))).flat();
    const projects = (
      await Promise.all(propIds.map((pid) => listProjectsForProperty(pid)))
    ).flat();
    return { tenant, occupancies, properties, businesses, permits, projects };
  },

  listProjects: (limit?: number) => listProjects(limit),
  listProjectsForProperty: (id: string) => listProjectsForProperty(id),

  getRollupForProperty: (id: string) => getRollupForProperty(id),
  runInquiry: (id: string): Promise<InquiryResult> => runInquiry(id),
  getDashboardStats: (): Promise<DashboardStats> => getDashboardStats(),
  getFilterFacets: (): Promise<FilterFacets> => getFilterFacets(),

  ragRetrieve: (q: string, limit?: number): Promise<RagEvidence[]> => ragRetrieve(q, limit),
  answerQuestion: (question: string) => answerQuestion(question),
  ragSearchDocuments: async (q: string, limit = 20): Promise<EntityDocument[]> => {
    const evidence = await ragRetrieve(q, limit);
    const ids = evidence.map((e) => e.documentId);
    if (ids.length === 0) return [];
    const fetched = await db
      .select()
      .from(entityDocuments)
      .where(inArray(entityDocuments.documentId, ids));
    const order = new Map(ids.map((id, i) => [id, i]));
    return fetched.sort(
      (a, b) => (order.get(a.documentId) ?? 0) - (order.get(b.documentId) ?? 0),
    );
  },
};
