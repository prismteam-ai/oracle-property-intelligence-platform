import "server-only";

import { generate } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { createInMemoryAccess, type InMemoryAccess } from "@/db/seed/in-memory-access";
import type {
  BusinessDetail,
  BusinessFilters,
  ContractorDetail,
  ContractorFilters,
  ContractorListItem,
  DashboardStats,
  DataAccess,
  FilterFacets,
  InquiryResult,
  PropertyDetail,
  PropertyFilters,
  RagAnswer,
  RagEvidence,
  TenantDetail,
  TenantFilters,
} from "@/server/ports";
import type {
  BusinessRegistration,
  BusinessReputationProfile,
  Company,
  EntityDocument,
  Occupancy,
  Project,
  Property,
  PropertyImprovement,
  PropertySignalRollup,
  Tenant,
} from "@/db/schema/types";

const globalForMemory = globalThis as unknown as {
  __oracleMemoryAccess?: InMemoryAccess;
};

function access(): InMemoryAccess {
  globalForMemory.__oracleMemoryAccess ??= createInMemoryAccess(generate(SEED));
  return globalForMemory.__oracleMemoryAccess;
}

export const memoryProvider: DataAccess = {
  listProperties: async (f: PropertyFilters = {}): Promise<Property[]> =>
    access().listProperties(f),
  getPropertyById: async (id: string) => access().getPropertyById(id),
  getPropertyByParcelIdentifier: async (pid: string) =>
    access().getPropertyByParcelIdentifier(pid),
  getPropertyDetail: async (id: string): Promise<PropertyDetail | null> =>
    access().getPropertyDetail(id),

  searchPermits: async (f: PropertyFilters = {}): Promise<PropertyImprovement[]> => {
    const a = access();
    let rows = a.searchPermits({ permitType: f.permitType });
    if (f.municipality) {
      const m = f.municipality.toLowerCase();
      rows = rows.filter((p) => (p.planningCommunity ?? p.subdivision ?? "").toLowerCase().includes(m));
    }
    if (f.contractor) {
      const q = f.contractor.toLowerCase();
      rows = rows.filter((p) => {
        const detail = p.contractorCompanyId
          ? a.getContractorDetail(p.contractorCompanyId)
          : null;
        return (detail?.company.name ?? "").toLowerCase().includes(q);
      });
    }
    if (f.dateFrom) rows = rows.filter((p) => (p.permitIssueDate ?? "") >= f.dateFrom!);
    if (f.dateTo) rows = rows.filter((p) => (p.permitIssueDate ?? "") <= f.dateTo!);
    const offset = f.offset ?? 0;
    return rows.slice(offset, offset + (f.limit ?? 50));
  },
  getPermitByNumber: async (n: string) => access().getPermitByNumber(n),
  listPermitsForProperty: async (id: string) => access().listPermitsForProperty(id),

  searchCompanies: async (q: string, limit?: number): Promise<Company[]> =>
    access().searchCompanies(q, limit),
  listContractors: async (f: ContractorFilters = {}): Promise<ContractorListItem[]> =>
    access().listContractors(f),
  getBusinessReputationDetail: async (
    id: string,
  ): Promise<BusinessReputationProfile | null> =>
    (access().getBusinessReputationDetail(id) as BusinessReputationProfile | null) ?? null,
  listContractorQualityScoresForPermitNumber: async (n: string): Promise<Company[]> =>
    access().listContractorQualityScoresForPermitNumber(n),
  getContractorDetail: async (id: string): Promise<ContractorDetail | null> =>
    access().getContractorDetail(id),

  listBusinesses: async (f: BusinessFilters = {}): Promise<BusinessRegistration[]> =>
    access().listBusinesses(f),
  getBusinessDetail: async (doc: string): Promise<BusinessDetail | null> =>
    access().getBusinessDetail(doc),

  listTenants: async (f: TenantFilters = {}): Promise<Tenant[]> => access().listTenants(f),
  getTenantById: async (id: string) => access().getTenantById(id),
  listOccupanciesForTenant: async (id: string): Promise<Occupancy[]> =>
    access().listOccupanciesForTenant(id),
  listOccupanciesForProperty: async (id: string): Promise<Occupancy[]> =>
    access().listOccupanciesForProperty(id),
  getTenantDetail: async (id: string): Promise<TenantDetail | null> =>
    access().getTenantDetail(id),

  listProjects: async (limit?: number): Promise<Project[]> => access().listProjects(limit),
  listProjectsForProperty: async (id: string): Promise<Project[]> =>
    access().listProjectsForProperty(id),

  getRollupForProperty: async (id: string): Promise<PropertySignalRollup | null> =>
    access().getRollupForProperty(id),
  runInquiry: async (id: string): Promise<InquiryResult> => access().runInquiry(id),
  getDashboardStats: async (): Promise<DashboardStats> => access().getDashboardStats(),
  getFilterFacets: async (): Promise<FilterFacets> => access().getFilterFacets(),

  ragRetrieve: async (q: string, limit?: number): Promise<RagEvidence[]> =>
    access().ragRetrieve(q, { limit }),
  ragSearchDocuments: async (q: string, limit?: number): Promise<EntityDocument[]> =>
    (await access().ragSearchDocuments(q, { limit })) as EntityDocument[],
  answerQuestion: async (question: string): Promise<RagAnswer> =>
    access().answerQuestion(question),
};
