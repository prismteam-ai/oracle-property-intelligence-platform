import type { GeneratedGraph } from "./generate";
import type {
  BusinessRegistration,
  Company,
  NewEntityDocument,
  Occupancy,
  Project,
  Property,
  PropertyImprovement,
  PropertySignalRollup,
  SalesHistory,
  Tenant,
} from "@/db/schema/types";
import type {
  BusinessDetail,
  BusinessFilters,
  ContractorActivity,
  ContractorDetail,
  ContractorListItem,
  DashboardStats,
  FilterFacets,
  OwnershipRecord,
  PropertyDetail,
  RelatedBusiness,
  RelatedProperty,
  TenantDetail,
  TenantFilters,
} from "@/server/ports";
import { classifyTrades, isMajorRenovation } from "@/lib/renovation";
import type {
  EmbeddingService,
  RagAnswer,
  RagEvidence,
} from "@/server/rag/types";
import { InMemoryRagIndex, type RetrieveOptions } from "./memory-index";
import { synthesizeAnswer } from "@/server/rag/synthesize";
import type { InquiryResult } from "@/server/ports";
import {
  buildAnalyticsIndex,
  runInquiryInMemory,
  type AnalyticsIndex,
} from "./analytics-memory";

const NEGATIVE_RATINGS = new Set(["D+", "D", "D-", "F", "NR"]);

export type InMemoryAccess = ReturnType<typeof createInMemoryAccess>;

export function createInMemoryAccess(
  graph: GeneratedGraph,
  embeddings?: EmbeddingService,
) {
  const propertyById = new Map(graph.properties.map((p) => [p.propertyId, p]));
  const rollupByProperty = new Map(graph.rollups.map((r) => [r.propertyId, r]));
  const companyById = new Map(graph.companies.map((c) => [c.companyId, c]));
  const personById = new Map(graph.people.map((p) => [p.personId, p]));
  const tenantById = new Map(graph.tenants.map((t) => [t.tenantId, t]));
  const addressById = new Map(graph.addresses.map((a) => [a.addressId, a]));
  const profileByCompany = new Map(
    graph.businessReputationProfiles.map((p) => [p.companyId, p]),
  );
  const profileById = new Map(
    graph.businessReputationProfiles.map((p) => [p.businessReputationProfileId, p]),
  );
  const registrationById = new Map(
    graph.businessRegistrations.map((r) => [r.businessRegistrationId, r]),
  );
  const registrationByDocNumber = new Map(
    graph.businessRegistrations.map((r) => [r.documentNumber, r]),
  );

  const permitsByProperty = new Map<string, PropertyImprovement[]>();
  for (const p of graph.propertyImprovements) {
    if (!p.propertyId) continue;
    const arr = permitsByProperty.get(p.propertyId) ?? [];
    arr.push(p as PropertyImprovement);
    permitsByProperty.set(p.propertyId, arr);
  }
  const permitsByContractor = new Map<string, PropertyImprovement[]>();
  for (const p of graph.propertyImprovements) {
    if (!p.contractorCompanyId) continue;
    const arr = permitsByContractor.get(p.contractorCompanyId) ?? [];
    arr.push(p as PropertyImprovement);
    permitsByContractor.set(p.contractorCompanyId, arr);
  }
  const ownershipsByProperty = new Map<string, (typeof graph.ownerships)[number][]>();
  for (const o of graph.ownerships) {
    if (!o.propertyId) continue;
    const arr = ownershipsByProperty.get(o.propertyId) ?? [];
    arr.push(o);
    ownershipsByProperty.set(o.propertyId, arr);
  }
  const salesByProperty = new Map<string, SalesHistory[]>();
  for (const s of graph.salesHistories) {
    if (!s.propertyId) continue;
    const arr = salesByProperty.get(s.propertyId) ?? [];
    arr.push(s as SalesHistory);
    salesByProperty.set(s.propertyId, arr);
  }
  const projectsByProperty = new Map<string, Project[]>();
  for (const pr of graph.projects) {
    if (!pr.propertyId) continue;
    const arr = projectsByProperty.get(pr.propertyId) ?? [];
    arr.push(pr as Project);
    projectsByProperty.set(pr.propertyId, arr);
  }
  const projectIdsByCompany = new Map<string, Set<string>>();
  for (const pc of graph.projectContractors) {
    const set = projectIdsByCompany.get(pc.companyId) ?? new Set<string>();
    set.add(pc.projectId);
    projectIdsByCompany.set(pc.companyId, set);
  }
  const projectById = new Map(graph.projects.map((p) => [p.projectId, p]));
  const occupanciesByProperty = new Map<string, Occupancy[]>();
  for (const o of graph.occupancies) {
    if (!o.propertyId) continue;
    const arr = occupanciesByProperty.get(o.propertyId) ?? [];
    arr.push(o as Occupancy);
    occupanciesByProperty.set(o.propertyId, arr);
  }
  const reviewsByProfile = new Map<string, (typeof graph.businessReputationReviews)[number][]>();
  for (const rv of graph.businessReputationReviews) {
    const arr = reviewsByProfile.get(rv.businessReputationProfileId) ?? [];
    arr.push(rv);
    reviewsByProfile.set(rv.businessReputationProfileId, arr);
  }
  const complaintsByProfile = new Map<
    string,
    (typeof graph.businessReputationComplaints)[number][]
  >();
  for (const c of graph.businessReputationComplaints) {
    const arr = complaintsByProfile.get(c.businessReputationProfileId) ?? [];
    arr.push(c);
    complaintsByProfile.set(c.businessReputationProfileId, arr);
  }
  const propertyByAddress = new Map<string, Property>();
  for (const p of graph.properties) {
    if (p.addressId) propertyByAddress.set(p.addressId, p as Property);
  }
  const tradeByCompany = new Map<string, string>();
  for (const p of graph.propertyImprovements) {
    if (p.contractorCompanyId && p.contractorType && !tradeByCompany.has(p.contractorCompanyId)) {
      tradeByCompany.set(p.contractorCompanyId, p.contractorType);
    }
  }

  function companyName(companyId: string | null | undefined): string | null {
    if (!companyId) return null;
    return companyById.get(companyId)?.name ?? null;
  }

  function relatedPropertyFor(
    propertyId: string,
    relationship: string,
    permitCount?: number,
  ): RelatedProperty | null {
    const p = propertyById.get(propertyId);
    if (!p) return null;
    return {
      propertyId,
      parcelIdentifier: p.parcelIdentifier ?? null,
      subdivision: p.subdivision ?? null,
      municipalityName:
        rollupByProperty.get(propertyId)?.municipalityName ??
        (p.addressId ? addressById.get(p.addressId)?.municipalityName ?? null : null),
      propertyUsageType: p.propertyUsageType ?? null,
      relationship,
      permitCount,
    };
  }

  let ragIndexPromise: Promise<InMemoryRagIndex> | null = null;
  function ragIndex(): Promise<InMemoryRagIndex> {
    ragIndexPromise ??= InMemoryRagIndex.fromGraph(graph, embeddings);
    return ragIndexPromise;
  }

  let analyticsIndex: AnalyticsIndex | null = null;
  function analytics(): AnalyticsIndex {
    analyticsIndex ??= buildAnalyticsIndex(graph);
    return analyticsIndex;
  }

  const api = {
    getPropertyByParcelIdentifier(parcelIdentifier: string): Property | null {
      return (
        (graph.properties.find(
          (p) => p.parcelIdentifier === parcelIdentifier,
        ) as Property | undefined) ?? null
      );
    },

    getPropertyById(propertyId: string): Property | null {
      return (propertyById.get(propertyId) as Property | undefined) ?? null;
    },

    searchPermits(filters?: {
      permitType?: string;
      status?: "open" | "closed";
      contractorCompanyId?: string;
    }): PropertyImprovement[] {
      return graph.propertyImprovements.filter((p) => {
        if (filters?.permitType && p.improvementType !== filters.permitType) return false;
        if (filters?.status && p.improvementStatus !== filters.status) return false;
        if (
          filters?.contractorCompanyId &&
          p.contractorCompanyId !== filters.contractorCompanyId
        ) {
          return false;
        }
        return true;
      }) as PropertyImprovement[];
    },

    getPermitByNumber(permitNumber: string): PropertyImprovement | null {
      return (
        (graph.propertyImprovements.find(
          (p) => p.permitNumber === permitNumber,
        ) as PropertyImprovement | undefined) ?? null
      );
    },

    listPermitsForProperty(propertyId: string): PropertyImprovement[] {
      return graph.propertyImprovements.filter(
        (p) => p.propertyId === propertyId,
      ) as PropertyImprovement[];
    },

    listContractorsWithNegativeBbb(): Company[] {
      const ids = new Set(
        graph.businessReputationProfiles
          .filter((p) => NEGATIVE_RATINGS.has(p.bbbRating ?? ""))
          .map((p) => p.companyId),
      );
      return graph.companies.filter((c) => ids.has(c.companyId)) as Company[];
    },

    listContractorQualityScoresForPermitNumber(permitNumber: string): Company[] {
      const permit = graph.propertyImprovements.find(
        (p) => p.permitNumber === permitNumber,
      );
      if (!permit?.contractorCompanyId) return [];
      const company = companyById.get(permit.contractorCompanyId);
      return company ? [company as Company] : [];
    },

    getBusinessReputationDetail(companyId: string) {
      return profileByCompany.get(companyId) ?? null;
    },

    listOccupanciesForProperty(propertyId: string): Occupancy[] {
      return graph.occupancies.filter(
        (o) => o.propertyId === propertyId,
      ) as Occupancy[];
    },

    listOccupanciesForTenant(tenantId: string): Occupancy[] {
      return graph.occupancies.filter((o) => o.tenantId === tenantId) as Occupancy[];
    },

    getTenantById(tenantId: string): Tenant | null {
      return (
        (graph.tenants.find((t) => t.tenantId === tenantId) as Tenant | undefined) ??
        null
      );
    },

    getRollupForProperty(propertyId: string): PropertySignalRollup | null {
      return (
        (rollupByProperty.get(propertyId) as PropertySignalRollup | undefined) ?? null
      );
    },

    listProperties(filters: {
      county?: string;
      municipality?: string;
      propertyClass?: string;
      permitType?: string;
      contractor?: string;
      businessType?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    } = {}): Property[] {
      let rows = graph.properties as Property[];
      if (filters.municipality) {
        const m = filters.municipality.toLowerCase();
        rows = rows.filter((p) => {
          const muni =
            rollupByProperty.get(p.propertyId!)?.municipalityName ??
            (p.addressId ? addressById.get(p.addressId)?.municipalityName : null) ??
            p.subdivision;
          return (muni ?? "").toLowerCase().includes(m);
        });
      }
      if (filters.propertyClass) {
        const c = filters.propertyClass.toLowerCase();
        rows = rows.filter((p) => (p.propertyUsageType ?? "").toLowerCase().includes(c));
      }
      if (filters.permitType) {
        const t = filters.permitType.toLowerCase();
        rows = rows.filter((p) =>
          (permitsByProperty.get(p.propertyId!) ?? []).some(
            (perm) => (perm.improvementType ?? "").toLowerCase() === t,
          ),
        );
      }
      if (filters.contractor) {
        const q = filters.contractor.toLowerCase();
        rows = rows.filter((p) =>
          (permitsByProperty.get(p.propertyId!) ?? []).some((perm) =>
            (companyName(perm.contractorCompanyId) ?? "").toLowerCase().includes(q),
          ),
        );
      }
      if (filters.businessType) {
        const q = filters.businessType.toLowerCase();
        rows = rows.filter((p) => {
          const occ = occupanciesByProperty.get(p.propertyId!) ?? [];
          return occ.some((o) => {
            const reg = o.businessRegistrationId
              ? registrationById.get(o.businessRegistrationId)
              : undefined;
            return (reg?.filingType ?? "").toLowerCase().includes(q);
          });
        });
      }
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      return rows.slice(offset, offset + limit);
    },

    listBusinesses(filters: BusinessFilters = {}): BusinessRegistration[] {
      let rows = graph.businessRegistrations as BusinessRegistration[];
      if (filters.businessType) {
        const q = filters.businessType.toLowerCase();
        rows = rows.filter((b) => (b.filingType ?? "").toLowerCase().includes(q));
      }
      if (filters.status) {
        const q = filters.status.toLowerCase();
        rows = rows.filter((b) => (b.status ?? "").toLowerCase() === q);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        rows = rows.filter((b) => (b.entityName ?? "").toLowerCase().includes(q));
      }
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      return rows.slice(offset, offset + limit);
    },

    listTenants(filters: TenantFilters = {}): Tenant[] {
      let rows = graph.tenants as Tenant[];
      if (filters.tenantType) {
        const q = filters.tenantType.toLowerCase();
        rows = rows.filter((t) => (t.tenantType ?? "").toLowerCase() === q);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        rows = rows.filter((t) => (t.tenantName ?? "").toLowerCase().includes(q));
      }
      const limit = filters.limit ?? 50;
      return rows.slice(0, limit);
    },

    listProjects(limit = 50): Project[] {
      return (graph.projects as Project[]).slice(0, limit);
    },

    listProjectsForProperty(propertyId: string): Project[] {
      return projectsByProperty.get(propertyId) ?? [];
    },

    listContractors(filters: {
      rating?: "negative" | "positive" | "all";
      sort?: "complaints" | "reviews" | "projects" | "score";
      trade?: string;
      query?: string;
      limit?: number;
      offset?: number;
    } = {}): ContractorListItem[] {
      let items: ContractorListItem[] = [...permitsByContractor.keys()].map((companyId) => {
        const company = companyById.get(companyId)!;
        const profile = profileByCompany.get(companyId);
        const negative = NEGATIVE_RATINGS.has(profile?.bbbRating ?? "");
        return {
          ...company,
          bbbRating: profile?.bbbRating ?? null,
          complaintCount: profile?.complaintCount ?? null,
          reviewAverageRating: profile?.reviewAverageRating ?? null,
          reviewCount: profile?.reviewCount ?? null,
          permitCount: permitsByContractor.get(companyId)?.length ?? 0,
          trade: tradeByCompany.get(companyId) ?? null,
          isNegative: negative,
        } as ContractorListItem;
      });

      if (filters.rating === "negative") items = items.filter((c) => c.isNegative);
      if (filters.rating === "positive") items = items.filter((c) => !c.isNegative);
      if (filters.trade) {
        const t = filters.trade.toLowerCase();
        items = items.filter((c) => (c.trade ?? "").toLowerCase() === t);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        items = items.filter((c) => (c.name ?? "").toLowerCase().includes(q));
      }

      const sort = filters.sort ?? "projects";
      items.sort((a, b) => {
        switch (sort) {
          case "complaints":
            return (b.complaintCount ?? 0) - (a.complaintCount ?? 0);
          case "reviews":
            return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
          case "score":
            return Number(b.reviewAverageRating ?? 0) - Number(a.reviewAverageRating ?? 0);
          case "projects":
          default:
            return b.permitCount - a.permitCount;
        }
      });

      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      return items.slice(offset, offset + limit);
    },

    searchCompanies(query: string, limit = 50): Company[] {
      const q = query.toLowerCase();
      return (graph.companies as Company[])
        .filter((c) => (c.name ?? "").toLowerCase().includes(q))
        .slice(0, limit);
    },

    getPropertyDetail(propertyId: string): PropertyDetail | null {
      const property = propertyById.get(propertyId) as Property | undefined;
      if (!property) return null;
      const permits = permitsByProperty.get(propertyId) ?? [];
      const openPermits = permits.filter((p) => p.improvementStatus === "open");
      const majorImprovements = permits.filter((p) =>
        isMajorRenovation({
          improvementType: p.improvementType,
          projectDescription: p.projectDescription,
          description: p.description,
          estimatedJobValue: p.estimatedJobValue,
        }),
      );

      const byContractor = new Map<string, PropertyImprovement[]>();
      for (const p of permits) {
        if (!p.contractorCompanyId) continue;
        const arr = byContractor.get(p.contractorCompanyId) ?? [];
        arr.push(p);
        byContractor.set(p.contractorCompanyId, arr);
      }
      const contractorActivity: ContractorActivity[] = [...byContractor.entries()]
        .map(([companyId, ps]) => {
          const profile = profileByCompany.get(companyId);
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
            name: companyName(companyId),
            permitCount: ps.length,
            trades: [...trades],
            bbbRating: profile?.bbbRating ?? null,
            complaintCount: profile?.complaintCount ?? null,
          };
        })
        .sort((a, b) => b.permitCount - a.permitCount);

      const occupancies = occupanciesByProperty.get(propertyId) ?? [];
      const businesses: RelatedBusiness[] = occupancies
        .filter((o) => o.businessRegistrationId)
        .map((o) => {
          const reg = o.businessRegistrationId
            ? registrationById.get(o.businessRegistrationId)
            : undefined;
          return {
            businessRegistrationId: reg?.businessRegistrationId ?? null,
            documentNumber: reg?.documentNumber ?? null,
            entityName: reg?.entityName ?? companyName(o.companyId),
            status: reg?.status ?? null,
            filingType: reg?.filingType ?? null,
            occupancyStatus: o.occupancyStatus ?? null,
            startDate: o.startDate ?? null,
            endDate: o.endDate ?? null,
          };
        });

      const ownershipHistory: OwnershipRecord[] = (
        ownershipsByProperty.get(propertyId) ?? []
      ).map((o) => {
        const ownerName = o.ownerCompanyId
          ? companyName(o.ownerCompanyId)
          : o.ownerPersonId
            ? personById.get(o.ownerPersonId)?.fullName ?? null
            : null;
        return {
          ...o,
          ownerName,
          ownerKind: o.ownerCompanyId ? "company" : o.ownerPersonId ? "person" : "unknown",
        } as OwnershipRecord;
      });

      return {
        property,
        ownershipHistory,
        salesHistory: salesByProperty.get(propertyId) ?? [],
        permits,
        openPermits,
        majorImprovements,
        contractorActivity,
        businesses,
        occupancies,
        projects: projectsByProperty.get(propertyId) ?? [],
        rollup: (rollupByProperty.get(propertyId) as PropertySignalRollup | undefined) ?? null,
      };
    },

    getContractorDetail(companyId: string): ContractorDetail | null {
      const company = companyById.get(companyId) as Company | undefined;
      const profile = profileByCompany.get(companyId);
      if (!company && !profile) return null;
      const resolved: Company =
        company ??
        ({
          companyId,
          name: profile?.name ?? "Contractor",
          sourceSystem: profile?.sourceSystem ?? "bbb",
        } as Company);

      const profileKey = profile?.businessReputationProfileId;
      const reviews = profileKey ? reviewsByProfile.get(profileKey) ?? [] : [];
      const complaints = profileKey ? complaintsByProfile.get(profileKey) ?? [] : [];
      const positiveCount = reviews.filter((r) => Number(r.reviewRating ?? 0) >= 4).length;
      const negativeCount = reviews.filter((r) => Number(r.reviewRating ?? 0) <= 2).length;

      const permits = permitsByContractor.get(companyId) ?? [];
      const projectIds = projectIdsByCompany.get(companyId) ?? new Set<string>();
      const projects = [...projectIds]
        .map((id) => projectById.get(id))
        .filter((p): p is Project => !!p) as Project[];

      const propIds = new Map<string, number>();
      for (const p of permits) {
        if (p.propertyId) propIds.set(p.propertyId, (propIds.get(p.propertyId) ?? 0) + 1);
      }
      const properties = [...propIds.entries()]
        .map(([pid, count]) => relatedPropertyFor(pid, "permit", count))
        .filter((r): r is RelatedProperty => !!r)
        .sort((a, b) => (b.permitCount ?? 0) - (a.permitCount ?? 0));

      return {
        company: resolved,
        reputation: profile ?? null,
        reviews,
        complaints,
        reviewSummary: {
          averageRating: profile?.reviewAverageRating
            ? Number(profile.reviewAverageRating)
            : null,
          reviewCount: profile?.reviewCount ?? reviews.length,
          positiveCount,
          negativeCount,
        },
        permits,
        projects,
        properties,
        isNegative: NEGATIVE_RATINGS.has(profile?.bbbRating ?? ""),
      };
    },

    getBusinessDetail(documentNumber: string): BusinessDetail | null {
      const business = registrationByDocNumber.get(documentNumber) as
        | BusinessRegistration
        | undefined;
      if (!business) return null;
      const company = business.companyId
        ? (companyById.get(business.companyId) as Company | undefined) ?? null
        : null;
      const parties = graph.businessRegistrationParties.filter(
        (p) => p.businessRegistrationId === business.businessRegistrationId,
      );

      const occ = graph.occupancies.filter(
        (o) => o.businessRegistrationId === business.businessRegistrationId,
      );
      const propIds = new Set<string>();
      for (const o of occ) {
        if (o.propertyId) propIds.add(o.propertyId);
        else if (o.addressId && propertyByAddress.has(o.addressId)) {
          propIds.add(propertyByAddress.get(o.addressId)!.propertyId!);
        }
      }
      const properties = [...propIds]
        .map((pid) => relatedPropertyFor(pid, "occupancy"))
        .filter((r): r is RelatedProperty => !!r);

      const permits: PropertyImprovement[] = [];
      const projects: Project[] = [];
      for (const pid of propIds) {
        permits.push(...(permitsByProperty.get(pid) ?? []));
        projects.push(...(projectsByProperty.get(pid) ?? []));
      }

      return { business, company, parties, properties, permits, projects };
    },

    getTenantDetail(tenantId: string): TenantDetail | null {
      const tenant = tenantById.get(tenantId) as Tenant | undefined;
      if (!tenant) return null;
      const occupancies = graph.occupancies.filter(
        (o) => o.tenantId === tenantId,
      ) as Occupancy[];

      const propIds = new Set<string>();
      const businesses: RelatedBusiness[] = [];
      for (const o of occupancies) {
        if (o.propertyId) propIds.add(o.propertyId);
        else if (o.addressId && propertyByAddress.has(o.addressId)) {
          propIds.add(propertyByAddress.get(o.addressId)!.propertyId!);
        }
        if (o.businessRegistrationId) {
          const reg = registrationById.get(o.businessRegistrationId);
          if (reg) {
            businesses.push({
              businessRegistrationId: reg.businessRegistrationId ?? null,
              documentNumber: reg.documentNumber ?? null,
              entityName: reg.entityName ?? null,
              status: reg.status ?? null,
              filingType: reg.filingType ?? null,
              occupancyStatus: o.occupancyStatus ?? null,
              startDate: o.startDate ?? null,
              endDate: o.endDate ?? null,
            });
          }
        }
      }

      const properties = [...propIds]
        .map((pid) => relatedPropertyFor(pid, "occupancy"))
        .filter((r): r is RelatedProperty => !!r);

      const permits: PropertyImprovement[] = [];
      const projects: Project[] = [];
      for (const pid of propIds) {
        permits.push(...(permitsByProperty.get(pid) ?? []));
        projects.push(...(projectsByProperty.get(pid) ?? []));
      }

      return { tenant, occupancies, properties, businesses, permits, projects };
    },

    getDashboardStats(): DashboardStats {
      const openPermits = graph.propertyImprovements.filter(
        (p) => p.improvementStatus === "open",
      ).length;
      const negativeContractors = new Set(
        graph.businessReputationProfiles
          .filter((p) => NEGATIVE_RATINGS.has(p.bbbRating ?? ""))
          .map((p) => p.companyId),
      ).size;
      const majorRenovations = graph.rollups.reduce(
        (sum, r) => sum + (r.majorRenovationCount ?? 0),
        0,
      );
      const multiOpen = graph.rollups.filter((r) => (r.openPermitCount ?? 0) > 1).length;
      return {
        properties: graph.properties.length,
        permits: graph.propertyImprovements.length,
        openPermits,
        contractors: permitsByContractor.size,
        negativeContractors,
        businesses: graph.businessRegistrations.length,
        tenants: graph.tenants.length,
        projects: graph.projects.length,
        majorRenovations,
        multiOpenPermitProperties: multiOpen,
      };
    },

    getFilterFacets(): FilterFacets {
      const municipalities = new Set<string>();
      const counties = new Set<string>();
      for (const a of graph.addresses) {
        if (a.municipalityName) municipalities.add(a.municipalityName);
        if (a.countyName) counties.add(a.countyName);
      }
      const permitTypes = new Set<string>();
      for (const p of graph.propertyImprovements) {
        if (p.improvementType) permitTypes.add(p.improvementType);
      }
      const propertyClasses = new Set<string>();
      for (const p of graph.properties) {
        if (p.propertyUsageType) propertyClasses.add(p.propertyUsageType);
      }
      const businessTypes = new Set<string>();
      for (const b of graph.businessRegistrations) {
        if (b.filingType) businessTypes.add(b.filingType);
      }
      const contractorTrades = new Set<string>();
      for (const t of tradeByCompany.values()) contractorTrades.add(t);
      return {
        counties: [...counties].sort(),
        municipalities: [...municipalities].sort(),
        permitTypes: [...permitTypes].sort(),
        propertyClasses: [...propertyClasses].sort(),
        businessTypes: [...businessTypes].sort(),
        contractorTrades: [...contractorTrades].sort(),
      };
    },

    propertiesWithMultipleOpenPermits(): PropertySignalRollup[] {
      return graph.rollups.filter(
        (r) => (r.openPermitCount ?? 0) > 1,
      ) as PropertySignalRollup[];
    },

    ownersWithMultipleProperties(): { ownerCompanyId: string; propertyCount: number }[] {
      const counts = new Map<string, number>();
      for (const o of graph.ownerships) {
        if (o.ownerCompanyId) {
          counts.set(o.ownerCompanyId, (counts.get(o.ownerCompanyId) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .filter(([, n]) => n > 1)
        .map(([ownerCompanyId, propertyCount]) => ({ ownerCompanyId, propertyCount }));
    },

    async ragRetrieve(query: string, opts: RetrieveOptions = {}): Promise<RagEvidence[]> {
      const index = await ragIndex();
      return index.retrieve(query, opts);
    },

    async ragSearchDocuments(
      query: string,
      opts: RetrieveOptions = {},
    ): Promise<NewEntityDocument[]> {
      const index = await ragIndex();
      return index.searchDocuments(query, opts);
    },

    async answerQuestion(question: string): Promise<RagAnswer> {
      const index = await ragIndex();
      return synthesizeAnswer(question, {
        retrieve: (q, limit) => index.retrieve(q, { limit }),
        runInquiry: (id) => Promise.resolve(api.runInquiry(id)),
      });
    },

    runInquiry(inquiryId: string): InquiryResult {
      return runInquiryInMemory(analytics(), inquiryId);
    },
  };

  return api;
}
