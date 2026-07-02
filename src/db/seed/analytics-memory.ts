import type { Citation } from "@/server/rag/types";
import type { InquiryResult, InquiryResultRow } from "@/server/ports";
import { getInquiry, INQUIRIES, type InquiryDef } from "@/lib/inquiries";
import { rowDisplayLimit } from "@/lib/dataset";
import {
  classifyTrades,
  computeImprovementIndicators,
  isMajorRenovation,
  permitMatchesTrade,
  SIGNIFICANT_RENOVATION_SCORE,
  type RenovationTrade,
} from "@/lib/renovation";
import type { GeneratedGraph } from "./generate";
import type {
  NewBusinessRegistration,
  NewBusinessReputationProfile,
  NewCompany,
  NewOccupancy,
  NewProperty,
  NewPropertyImprovement,
  NewPropertySignalRollup,
} from "@/db/schema/types";

const NEGATIVE_RATINGS = new Set(["D+", "D", "D-", "F", "NR"]);
const LIMIT = rowDisplayLimit();

export type AnalyticsIndex = {
  graph: GeneratedGraph;
  propertyById: Map<string, NewProperty>;
  rollupByProperty: Map<string, NewPropertySignalRollup>;
  companyById: Map<string, NewCompany>;
  profileByCompany: Map<string, NewBusinessReputationProfile>;
  registrationById: Map<string, NewBusinessRegistration>;
  permitsByProperty: Map<string, NewPropertyImprovement[]>;
  permitsByContractor: Map<string, NewPropertyImprovement[]>;
  occupanciesByProperty: Map<string, NewOccupancy[]>;
  tradeByCompany: Map<string, string>;
};

export function buildAnalyticsIndex(graph: GeneratedGraph): AnalyticsIndex {
  const propertyById = new Map(graph.properties.map((p) => [p.propertyId!, p]));
  const rollupByProperty = new Map(graph.rollups.map((r) => [r.propertyId!, r]));
  const companyById = new Map(graph.companies.map((c) => [c.companyId!, c]));
  const profileByCompany = new Map(
    graph.businessReputationProfiles.map((p) => [p.companyId!, p]),
  );
  const registrationById = new Map(
    graph.businessRegistrations.map((r) => [r.businessRegistrationId!, r]),
  );

  const permitsByProperty = new Map<string, NewPropertyImprovement[]>();
  const permitsByContractor = new Map<string, NewPropertyImprovement[]>();
  const tradeByCompany = new Map<string, string>();
  for (const p of graph.propertyImprovements) {
    if (p.propertyId) {
      const arr = permitsByProperty.get(p.propertyId) ?? [];
      arr.push(p);
      permitsByProperty.set(p.propertyId, arr);
    }
    if (p.contractorCompanyId) {
      const arr = permitsByContractor.get(p.contractorCompanyId) ?? [];
      arr.push(p);
      permitsByContractor.set(p.contractorCompanyId, arr);
      if (p.contractorType && !tradeByCompany.has(p.contractorCompanyId)) {
        tradeByCompany.set(p.contractorCompanyId, p.contractorType);
      }
    }
  }

  const occupanciesByProperty = new Map<string, NewOccupancy[]>();
  for (const o of graph.occupancies) {
    if (!o.propertyId) continue;
    const arr = occupanciesByProperty.get(o.propertyId) ?? [];
    arr.push(o);
    occupanciesByProperty.set(o.propertyId, arr);
  }

  return {
    graph,
    propertyById,
    rollupByProperty,
    companyById,
    profileByCompany,
    registrationById,
    permitsByProperty,
    permitsByContractor,
    occupanciesByProperty,
    tradeByCompany,
  };
}

function propertyCitations(p: NewProperty | undefined): Citation[] {
  if (!p?.sourceArtifactUri) return [];
  return [
    {
      label: "Lee County Property Appraiser",
      url: p.sourceArtifactUri,
      recordKey: p.sourceRecordKey ?? null,
      sourceSystem: p.sourceSystem ?? "leepa",
    },
  ];
}

function profileCitations(profile: NewBusinessReputationProfile | undefined): Citation[] {
  if (!profile?.profileUrl) return [];
  return [
    {
      label: "BBB Profile",
      url: profile.profileUrl,
      recordKey: profile.sourceRecordKey ?? null,
      sourceSystem: profile.sourceSystem ?? "bbb",
    },
  ];
}

function registrationCitations(reg: NewBusinessRegistration | undefined): Citation[] {
  if (!reg?.sourceArtifactUri) return [];
  return [
    {
      label: "Florida Sunbiz",
      url: reg.sourceArtifactUri,
      recordKey: reg.sourceRecordKey ?? null,
      sourceSystem: reg.sourceSystem ?? "sunbiz",
    },
  ];
}

function permitCitations(permit: NewPropertyImprovement | undefined): Citation[] {
  if (!permit?.sourceArtifactUri) return [];
  return [
    {
      label: `Permit ${permit.permitNumber ?? ""}`.trim(),
      url: permit.sourceArtifactUri,
      recordKey: permit.sourceRecordKey ?? null,
      sourceSystem: permit.sourceSystem ?? "lee_accela",
    },
  ];
}

type Row = InquiryResultRow;

function propsMultiOpen(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter((r) => (r.openPermitCount ?? 0) > 1)
    .sort((a, b) => (b.openPermitCount ?? 0) - (a.openPermitCount ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? p?.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        openPermitCount: r.openPermitCount ?? 0,
        openCategories: r.openPermitCategories ?? [],
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

function propsOpenTrade(ix: AnalyticsIndex, trade: RenovationTrade): Row[] {
  const rows: Row[] = [];
  for (const [propertyId, permits] of ix.permitsByProperty) {
    const open = permits.filter(
      (p) => p.improvementStatus === "open" && permitMatchesTrade(p, trade),
    );
    if (open.length === 0) continue;
    const p = ix.propertyById.get(propertyId);
    rows.push({
      parcelIdentifier: p?.parcelIdentifier ?? null,
      municipality: ix.rollupByProperty.get(propertyId)?.municipalityName ?? null,
      openTradePermits: open.length,
      permitNumbers: open.map((o) => o.permitNumber).filter(Boolean).slice(0, 3),
      href: `/properties/${propertyId}`,
      citations: [...propertyCitations(p), ...permitCitations(open[0])],
    });
  }
  return rows.sort((a, b) => Number(b.openTradePermits) - Number(a.openTradePermits)).slice(0, LIMIT);
}

function propsMajorTrade(ix: AnalyticsIndex, trade: RenovationTrade): Row[] {
  const rows: Row[] = [];
  for (const [propertyId, permits] of ix.permitsByProperty) {
    const major = permits.filter((p) => isMajorRenovation(p) && permitMatchesTrade(p, trade));
    if (major.length === 0) continue;
    const p = ix.propertyById.get(propertyId);
    const topValue = Math.max(...major.map((m) => Number(m.estimatedJobValue ?? 0)));
    rows.push({
      parcelIdentifier: p?.parcelIdentifier ?? null,
      municipality: ix.rollupByProperty.get(propertyId)?.municipalityName ?? null,
      trade,
      majorPermits: major.length,
      topJobValue: topValue,
      href: `/properties/${propertyId}`,
      citations: [...propertyCitations(p), ...permitCitations(major[0])],
    });
  }
  return rows.sort((a, b) => Number(b.topJobValue) - Number(a.topJobValue)).slice(0, LIMIT);
}

function highestPermit5y(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter((r) => (r.permitCount5y ?? 0) > 0)
    .sort((a, b) => (b.permitCount5y ?? 0) - (a.permitCount5y ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        permitCount5y: r.permitCount5y ?? 0,
        improvementScore: Number(r.improvementScore ?? 0),
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

function significantReno(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter((r) => Number(r.improvementScore ?? 0) >= SIGNIFICANT_RENOVATION_SCORE)
    .sort((a, b) => Number(b.improvementScore ?? 0) - Number(a.improvementScore ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        improvementScore: Number(r.improvementScore ?? 0),
        majorRenovations: r.majorRenovationCount ?? 0,
        trades: r.renovationTrades ?? [],
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

function contractorsByTrade(ix: AnalyticsIndex, trade: string): Row[] {
  const rows: Row[] = [];
  for (const [companyId, permits] of ix.permitsByContractor) {
    const company = ix.companyById.get(companyId);
    const t = ix.tradeByCompany.get(companyId) ?? "";
    const doesTrade =
      t.toLowerCase() === trade.toLowerCase() ||
      permits.some((p) => permitMatchesTrade(p, trade.toLowerCase() as RenovationTrade));
    if (!doesTrade) continue;
    const profile = ix.profileByCompany.get(companyId);
    rows.push({
      contractor: company?.name ?? companyId,
      trade: t || trade,
      permitCount: permits.length,
      bbbRating: profile?.bbbRating ?? null,
      href: `/contractors/${companyId}`,
      citations: [...profileCitations(profile), ...permitCitations(permits[0])],
    });
  }
  return rows.sort((a, b) => Number(b.permitCount) - Number(a.permitCount)).slice(0, LIMIT);
}

function contractorsNegativeBbb(ix: AnalyticsIndex): Row[] {
  return ix.graph.businessReputationProfiles
    .filter((p) => NEGATIVE_RATINGS.has(p.bbbRating ?? ""))
    .sort((a, b) => (b.complaintCount ?? 0) - (a.complaintCount ?? 0))
    .slice(0, LIMIT)
    .map((profile) => {
      const company = profile.companyId ? ix.companyById.get(profile.companyId) : undefined;
      return {
        contractor: company?.name ?? profile.name ?? profile.companyId,
        bbbRating: profile.bbbRating ?? null,
        complaintCount: profile.complaintCount ?? 0,
        reviewAverageRating: profile.reviewAverageRating ?? null,
        href: profile.companyId ? `/contractors/${profile.companyId}` : undefined,
        citations: profileCitations(profile),
      };
    });
}

function contractorsWithComplaints(ix: AnalyticsIndex): Row[] {
  return ix.graph.businessReputationProfiles
    .filter((p) => (p.complaintCount ?? 0) > 0)
    .sort((a, b) => (b.complaintCount ?? 0) - (a.complaintCount ?? 0))
    .slice(0, LIMIT)
    .map((profile) => {
      const company = profile.companyId ? ix.companyById.get(profile.companyId) : undefined;
      return {
        contractor: company?.name ?? profile.name ?? profile.companyId,
        complaintCount: profile.complaintCount ?? 0,
        bbbRating: profile.bbbRating ?? null,
        href: profile.companyId ? `/contractors/${profile.companyId}` : undefined,
        citations: profileCitations(profile),
      };
    });
}

function projectsByBadContractors(ix: AnalyticsIndex): Row[] {
  const badCompanyIds = new Set(
    ix.graph.businessReputationProfiles
      .filter((p) => NEGATIVE_RATINGS.has(p.bbbRating ?? "") || (p.complaintCount ?? 0) > 0)
      .map((p) => p.companyId!),
  );
  const projectsByCompany = new Map<string, Set<string>>();
  for (const pc of ix.graph.projectContractors) {
    if (!badCompanyIds.has(pc.companyId!)) continue;
    const set = projectsByCompany.get(pc.companyId!) ?? new Set<string>();
    set.add(pc.projectId!);
    projectsByCompany.set(pc.companyId!, set);
  }
  const projectById = new Map(ix.graph.projects.map((p) => [p.projectId!, p]));
  const rows: Row[] = [];
  for (const [companyId, projectIds] of projectsByCompany) {
    const company = ix.companyById.get(companyId);
    const profile = ix.profileByCompany.get(companyId);
    for (const projectId of projectIds) {
      const project = projectById.get(projectId);
      if (!project) continue;
      const p = project.propertyId ? ix.propertyById.get(project.propertyId) : undefined;
      rows.push({
        project: project.projectName ?? projectId,
        contractor: company?.name ?? companyId,
        bbbRating: profile?.bbbRating ?? null,
        complaintCount: profile?.complaintCount ?? 0,
        projectStatus: project.projectStatus ?? null,
        href: project.propertyId ? `/properties/${project.propertyId}` : undefined,
        citations: [...profileCitations(profile), ...propertyCitations(p)],
      });
    }
  }
  return rows.slice(0, LIMIT);
}

function businessesMultiProperty(ix: AnalyticsIndex): Row[] {
  const propsByReg = new Map<string, Set<string>>();
  for (const o of ix.graph.occupancies) {
    if (!o.businessRegistrationId) continue;
    const set = propsByReg.get(o.businessRegistrationId) ?? new Set<string>();
    if (o.propertyId) set.add(o.propertyId);
    else if (o.addressId) set.add(`addr:${o.addressId}`);
    propsByReg.set(o.businessRegistrationId, set);
  }
  return [...propsByReg.entries()]
    .filter(([, set]) => set.size > 1)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, LIMIT)
    .map(([regId, set]) => {
      const reg = ix.registrationById.get(regId);
      return {
        business: reg?.entityName ?? regId,
        documentNumber: reg?.documentNumber ?? null,
        propertyCount: set.size,
        href: reg?.documentNumber ? `/businesses/${reg.documentNumber}` : undefined,
        citations: registrationCitations(reg),
      };
    });
}

function ownersMultiProperty(ix: AnalyticsIndex): Row[] {
  const counts = new Map<string, Set<string>>();
  for (const o of ix.graph.ownerships) {
    if (!o.ownerCompanyId || !o.propertyId) continue;
    const set = counts.get(o.ownerCompanyId) ?? new Set<string>();
    set.add(o.propertyId);
    counts.set(o.ownerCompanyId, set);
  }
  return [...counts.entries()]
    .filter(([, set]) => set.size > 1)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, LIMIT)
    .map(([companyId, set]) => {
      const company = ix.companyById.get(companyId);
      const firstProp = [...set][0];
      return {
        owner: company?.name ?? companyId,
        propertyCount: set.size,
        href: firstProp ? `/properties/${firstProp}` : undefined,
        citations: propertyCitations(firstProp ? ix.propertyById.get(firstProp) : undefined),
      };
    });
}

function tenantsMultiLocation(ix: AnalyticsIndex): Row[] {
  const locsByTenant = new Map<string, Set<string>>();
  for (const o of ix.graph.occupancies) {
    if (!o.tenantId) continue;
    const set = locsByTenant.get(o.tenantId) ?? new Set<string>();
    const loc = o.addressId ?? o.propertyId;
    if (loc) set.add(loc);
    locsByTenant.set(o.tenantId, set);
  }
  const tenantById = new Map(ix.graph.tenants.map((t) => [t.tenantId!, t]));
  return [...locsByTenant.entries()]
    .filter(([, set]) => set.size > 1)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, LIMIT)
    .map(([tenantId, set]) => {
      const tenant = tenantById.get(tenantId);
      const citations: Citation[] = tenant
        ? [
            {
              label: `Oracle tenant match (${tenant.matchMethod ?? "reconciled"}, conf ${
                tenant.matchConfidence ?? "n/a"
              })`,
              url: null,
              recordKey: tenant.sourceRecordKey ?? null,
              sourceSystem: tenant.sourceSystem ?? "oracle",
            },
          ]
        : [];
      return {
        tenant: tenant?.tenantName ?? tenantId,
        tenantType: tenant?.tenantType ?? null,
        locationCount: set.size,
        href: `/tenants/${tenantId}`,
        citations,
      };
    });
}

function ownershipChangeOpenPermit(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter((r) => (r.ownershipChangeCount ?? 0) > 0 && (r.openPermitCount ?? 0) > 0)
    .sort((a, b) => (b.ownershipChangeCount ?? 0) - (a.ownershipChangeCount ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        ownershipChanges: r.ownershipChangeCount ?? 0,
        openPermits: r.openPermitCount ?? 0,
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

function permitBusinessTurnover(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter((r) => (r.openPermitCount ?? 0) > 0 && (r.businessTurnoverCount ?? 0) > 0)
    .sort((a, b) => (b.businessTurnoverCount ?? 0) - (a.businessTurnoverCount ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        openPermits: r.openPermitCount ?? 0,
        businessTurnover: r.businessTurnoverCount ?? 0,
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

type NeighborhoodAgg = {
  municipality: string;
  propertyCount: number;
  openPermits: number;
  majorRenovations: number;
  permitTotal5y: number;
  representativePropertyId: string | null;
};

function neighborhoodAggregates(ix: AnalyticsIndex): NeighborhoodAgg[] {
  const byMuni = new Map<string, NeighborhoodAgg>();
  for (const r of ix.graph.rollups) {
    const muni = r.municipalityName ?? "Unknown";
    const agg =
      byMuni.get(muni) ??
      ({
        municipality: muni,
        propertyCount: 0,
        openPermits: 0,
        majorRenovations: 0,
        permitTotal5y: 0,
        representativePropertyId: r.propertyId ?? null,
      } satisfies NeighborhoodAgg);
    agg.propertyCount++;
    agg.openPermits += r.openPermitCount ?? 0;
    agg.majorRenovations += r.majorRenovationCount ?? 0;
    agg.permitTotal5y += r.permitCount5y ?? 0;
    byMuni.set(muni, agg);
  }
  return [...byMuni.values()];
}

const TREND_WINDOW_MONTHS = Number(process.env.NEIGHBORHOOD_TREND_WINDOW_MONTHS ?? 24);
const DAY_MS = 24 * 60 * 60 * 1000;

function neighborhoodsIncreasingPermits(ix: AnalyticsIndex): Row[] {
  const windowMs = TREND_WINDOW_MONTHS * 30 * DAY_MS;
  let anchor = 0;
  for (const permits of ix.permitsByProperty.values()) {
    for (const permit of permits) {
      const t = permit.permitIssueDate ? Date.parse(permit.permitIssueDate) : NaN;
      if (!Number.isNaN(t) && t > anchor) anchor = t;
    }
  }
  if (anchor === 0) return [];
  const recentStart = anchor - windowMs;
  const priorStart = anchor - 2 * windowMs;

  type TrendAgg = {
    municipality: string;
    recentPermits: number;
    priorPermits: number;
    representativePropertyId: string | null;
    representativePermitCount5y: number;
  };
  const byMuni = new Map<string, TrendAgg>();
  for (const [propertyId, permits] of ix.permitsByProperty) {
    const rollup = ix.rollupByProperty.get(propertyId);
    const muni = rollup?.municipalityName ?? "Unknown";
    const permitCount5y = rollup?.permitCount5y ?? 0;
    const agg =
      byMuni.get(muni) ??
      ({
        municipality: muni,
        recentPermits: 0,
        priorPermits: 0,
        representativePropertyId: null,
        representativePermitCount5y: -1,
      } satisfies TrendAgg);
    if (permitCount5y > agg.representativePermitCount5y) {
      agg.representativePropertyId = propertyId;
      agg.representativePermitCount5y = permitCount5y;
    }
    for (const permit of permits) {
      const t = permit.permitIssueDate ? Date.parse(permit.permitIssueDate) : NaN;
      if (Number.isNaN(t)) continue;
      if (t > recentStart && t <= anchor) agg.recentPermits++;
      else if (t > priorStart && t <= recentStart) agg.priorPermits++;
    }
    byMuni.set(muni, agg);
  }

  return [...byMuni.values()]
    .filter((a) => a.recentPermits > a.priorPermits)
    .sort((a, b) => (b.recentPermits - b.priorPermits) - (a.recentPermits - a.priorPermits))
    .slice(0, LIMIT)
    .map((a) => ({
      municipality: a.municipality,
      recentPermits: a.recentPermits,
      priorPermits: a.priorPermits,
      permitIncrease: a.recentPermits - a.priorPermits,
      growthRatePct:
        a.priorPermits > 0
          ? Number((100 * (a.recentPermits - a.priorPermits) / a.priorPermits).toFixed(1))
          : null,
      href: a.representativePropertyId
        ? `/properties/${a.representativePropertyId}`
        : undefined,
      citations: propertyCitations(
        a.representativePropertyId ? ix.propertyById.get(a.representativePropertyId) : undefined,
      ),
    }));
}

function neighborhoodsMajorReno(ix: AnalyticsIndex): Row[] {
  return neighborhoodAggregates(ix)
    .filter((a) => a.majorRenovations > 0)
    .sort((a, b) => b.majorRenovations - a.majorRenovations)
    .slice(0, LIMIT)
    .map((a) => ({
      municipality: a.municipality,
      majorRenovations: a.majorRenovations,
      properties: a.propertyCount,
      concentration: Number((a.majorRenovations / a.propertyCount).toFixed(3)),
      href: `/properties?municipality=${encodeURIComponent(a.municipality)}`,
      citations: propertyCitations(
        a.representativePropertyId ? ix.propertyById.get(a.representativePropertyId) : undefined,
      ),
    }));
}

function mostActiveContractors(ix: AnalyticsIndex): Row[] {
  const projectCountByCompany = new Map<string, number>();
  for (const pc of ix.graph.projectContractors) {
    projectCountByCompany.set(
      pc.companyId!,
      (projectCountByCompany.get(pc.companyId!) ?? 0) + 1,
    );
  }
  return [...ix.permitsByContractor.entries()]
    .map(([companyId, permits]) => {
      const company = ix.companyById.get(companyId);
      const profile = ix.profileByCompany.get(companyId);
      return {
        contractor: company?.name ?? companyId,
        projectCount: projectCountByCompany.get(companyId) ?? 0,
        permitCount: permits.length,
        bbbRating: profile?.bbbRating ?? null,
        href: `/contractors/${companyId}`,
        citations: [...profileCitations(profile), ...permitCitations(permits[0])],
      };
    })
    .sort((a, b) => Number(b.projectCount) - Number(a.projectCount) || Number(b.permitCount) - Number(a.permitCount))
    .slice(0, LIMIT);
}

function entityGraph(ix: AnalyticsIndex): Row[] {
  const ownershipByProperty = new Map<string, (typeof ix.graph.ownerships)[number]>();
  for (const o of ix.graph.ownerships) {
    if (o.propertyId && !ownershipByProperty.has(o.propertyId)) {
      ownershipByProperty.set(o.propertyId, o);
    }
  }
  const tenantById = new Map(ix.graph.tenants.map((t) => [t.tenantId!, t]));

  let chosen: string | null = null;
  for (const [propertyId, permits] of ix.permitsByProperty) {
    const occ = ix.occupanciesByProperty.get(propertyId) ?? [];
    const own = ownershipByProperty.get(propertyId);
    const hasContractor = permits.some((p) => p.contractorCompanyId);
    const hasBusiness = occ.some((o) => o.businessRegistrationId);
    if (hasContractor && hasBusiness && own?.ownerCompanyId) {
      chosen = propertyId;
      break;
    }
  }
  if (!chosen) {
    for (const [propertyId, permits] of ix.permitsByProperty) {
      const occ = ix.occupanciesByProperty.get(propertyId) ?? [];
      if (permits.some((p) => p.contractorCompanyId) && occ.length) {
        chosen = propertyId;
        break;
      }
    }
  }
  if (!chosen) return [];

  const property = ix.propertyById.get(chosen);
  const permits = ix.permitsByProperty.get(chosen) ?? [];
  const occ = ix.occupanciesByProperty.get(chosen) ?? [];
  const own = ownershipByProperty.get(chosen);
  const rows: Row[] = [];

  rows.push({
    role: "Property",
    name: property?.parcelIdentifier ?? chosen,
    detail: property?.propertyUsageType ?? null,
    href: `/properties/${chosen}`,
    citations: propertyCitations(property),
  });

  const contractorId = permits.find((p) => p.contractorCompanyId)?.contractorCompanyId;
  if (contractorId) {
    const c = ix.companyById.get(contractorId);
    const profile = ix.profileByCompany.get(contractorId);
    rows.push({
      role: "Contractor",
      name: c?.name ?? contractorId,
      detail: profile?.bbbRating ? `BBB ${profile.bbbRating}` : null,
      href: `/contractors/${contractorId}`,
      citations: profileCitations(profile),
    });
  }

  const regId = occ.find((o) => o.businessRegistrationId)?.businessRegistrationId;
  if (regId) {
    const reg = ix.registrationById.get(regId);
    rows.push({
      role: "Business",
      name: reg?.entityName ?? regId,
      detail: reg?.filingType ?? null,
      href: reg?.documentNumber ? `/businesses/${reg.documentNumber}` : undefined,
      citations: registrationCitations(reg),
    });
  }

  const tenantId = occ.find((o) => o.tenantId)?.tenantId;
  if (tenantId) {
    const tenant = tenantById.get(tenantId);
    rows.push({
      role: "Tenant",
      name: tenant?.tenantName ?? tenantId,
      detail: tenant?.tenantType ?? null,
      href: `/tenants/${tenantId}`,
      citations: [],
    });
  }

  if (own?.ownerCompanyId) {
    const owner = ix.companyById.get(own.ownerCompanyId);
    rows.push({
      role: "Owner",
      name: owner?.name ?? own.ownerCompanyId,
      detail: "owner of record",
      href: `/properties/${chosen}`,
      citations: propertyCitations(property),
    });
  }

  return rows;
}

function likelyRedevelopment(ix: AnalyticsIndex): Row[] {
  const rows: Row[] = [];
  for (const r of ix.graph.rollups) {
    if (!r.propertyId) continue;
    const trades = r.renovationTrades ?? [];
    const structural = trades.includes("structural") || trades.includes("concrete");
    const signal =
      structural &&
      (r.majorRenovationCount ?? 0) > 0 &&
      ((r.ownershipChangeCount ?? 0) > 0 || (r.openPermitCount ?? 0) > 1);
    if (!signal) continue;
    const p = ix.propertyById.get(r.propertyId);
    rows.push({
      parcelIdentifier: r.parcelIdentifier ?? null,
      municipality: r.municipalityName ?? null,
      signal: "structural + ownership/permit churn",
      majorRenovations: r.majorRenovationCount ?? 0,
      improvementScore: Number(r.improvementScore ?? 0),
      href: `/properties/${r.propertyId}`,
      citations: propertyCitations(p),
    });
  }
  return rows.sort((a, b) => Number(b.improvementScore) - Number(a.improvementScore)).slice(0, LIMIT);
}

function valueAddActivity(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter(
      (r) =>
        Number(r.improvementScore ?? 0) >= SIGNIFICANT_RENOVATION_SCORE &&
        (r.majorRenovationCount ?? 0) > 0,
    )
    .sort((a, b) => Number(b.improvementScore ?? 0) - Number(a.improvementScore ?? 0))
    .slice(0, LIMIT)
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        improvementScore: Number(r.improvementScore ?? 0),
        majorRenovations: r.majorRenovationCount ?? 0,
        totalPermitValue: Number(r.totalPermitValue ?? 0),
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    });
}

function complaintLinkedProjects(ix: AnalyticsIndex): Row[] {
  const projectCountByCompany = new Map<string, number>();
  for (const pc of ix.graph.projectContractors) {
    projectCountByCompany.set(pc.companyId!, (projectCountByCompany.get(pc.companyId!) ?? 0) + 1);
  }
  return ix.graph.businessReputationProfiles
    .filter((p) => (p.complaintCount ?? 0) > 0 && projectCountByCompany.has(p.companyId!))
    .map((profile) => {
      const company = ix.companyById.get(profile.companyId!);
      return {
        contractor: company?.name ?? profile.companyId,
        complaintCount: profile.complaintCount ?? 0,
        projectCount: projectCountByCompany.get(profile.companyId!) ?? 0,
        complaintLinkedProjects:
          (profile.complaintCount ?? 0) * (projectCountByCompany.get(profile.companyId!) ?? 0),
        href: `/contractors/${profile.companyId}`,
        citations: profileCitations(profile),
      };
    })
    .sort((a, b) => Number(b.complaintLinkedProjects) - Number(a.complaintLinkedProjects))
    .slice(0, LIMIT);
}

function permitPrecedesTurnover(ix: AnalyticsIndex): Row[] {
  const rows: Row[] = [];
  for (const r of ix.graph.rollups) {
    if (!r.propertyId || (r.businessTurnoverCount ?? 0) === 0) continue;
    const permits = ix.permitsByProperty.get(r.propertyId) ?? [];
    if (permits.length === 0) continue;
    const trades = new Set<string>();
    for (const p of permits) for (const t of classifyTrades(p)) trades.add(t);
    const p = ix.propertyById.get(r.propertyId);
    rows.push({
      parcelIdentifier: r.parcelIdentifier ?? null,
      municipality: r.municipalityName ?? null,
      businessTurnover: r.businessTurnoverCount ?? 0,
      permitPattern: [...trades],
      permitCount: permits.length,
      href: `/properties/${r.propertyId}`,
      citations: propertyCitations(p),
    });
  }
  return rows.sort((a, b) => Number(b.businessTurnover) - Number(a.businessTurnover)).slice(0, LIMIT);
}

function acquisitionCandidates(ix: AnalyticsIndex): Row[] {
  return ix.graph.rollups
    .filter(
      (r) =>
        (r.openPermitCount ?? 0) > 0 &&
        (r.ownershipChangeCount ?? 0) > 0 &&
        (r.businessTurnoverCount ?? 0) > 0,
    )
    .map((r) => {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      const acquisitionScore =
        (r.openPermitCount ?? 0) * 2 +
        (r.ownershipChangeCount ?? 0) * 3 +
        (r.businessTurnoverCount ?? 0) * 3;
      return {
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: r.municipalityName ?? null,
        openPermits: r.openPermitCount ?? 0,
        ownershipChanges: r.ownershipChangeCount ?? 0,
        businessTurnover: r.businessTurnoverCount ?? 0,
        acquisitionScore,
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      };
    })
    .sort((a, b) => Number(b.acquisitionScore) - Number(a.acquisitionScore))
    .slice(0, LIMIT);
}

function cleanMajorContractors(ix: AnalyticsIndex): Row[] {
  const rows: Row[] = [];
  for (const [companyId, permits] of ix.permitsByContractor) {
    const majorCount = permits.filter((p) => isMajorRenovation(p)).length;
    if (majorCount === 0) continue;
    const profile = ix.profileByCompany.get(companyId);
    if (profile && NEGATIVE_RATINGS.has(profile.bbbRating ?? "")) continue;
    if ((profile?.complaintCount ?? 0) > 0) continue;
    const company = ix.companyById.get(companyId);
    rows.push({
      contractor: company?.name ?? companyId,
      bbbRating: profile?.bbbRating ?? null,
      majorRenovations: majorCount,
      reviewAverageRating: profile?.reviewAverageRating ?? null,
      href: `/contractors/${companyId}`,
      citations: [...profileCitations(profile), ...permitCitations(permits[0])],
    });
  }
  return rows.sort((a, b) => Number(b.majorRenovations) - Number(a.majorRenovations)).slice(0, LIMIT);
}

function expandingBusinesses(ix: AnalyticsIndex): Row[] {
  const occByReg = new Map<string, NewOccupancy[]>();
  for (const o of ix.graph.occupancies) {
    if (!o.businessRegistrationId) continue;
    const arr = occByReg.get(o.businessRegistrationId) ?? [];
    arr.push(o);
    occByReg.set(o.businessRegistrationId, arr);
  }
  const rows: Row[] = [];
  for (const [regId, occs] of occByReg) {
    const locs = new Set(occs.map((o) => o.addressId ?? o.propertyId).filter(Boolean));
    if (locs.size < 2) continue;
    const reg = ix.registrationById.get(regId);
    const starts = occs.map((o) => o.startDate).filter(Boolean).sort();
    rows.push({
      business: reg?.entityName ?? regId,
      documentNumber: reg?.documentNumber ?? null,
      locationCount: locs.size,
      firstSeen: starts[0] ?? null,
      latestSeen: starts[starts.length - 1] ?? null,
      href: reg?.documentNumber ? `/businesses/${reg.documentNumber}` : undefined,
      citations: registrationCitations(reg),
    });
  }
  return rows.sort((a, b) => Number(b.locationCount) - Number(a.locationCount)).slice(0, LIMIT);
}

function anomalousPermits(ix: AnalyticsIndex): Row[] {
  const sumByMuni = new Map<string, { total: number; n: number }>();
  for (const r of ix.graph.rollups) {
    const muni = r.municipalityName ?? "Unknown";
    const agg = sumByMuni.get(muni) ?? { total: 0, n: 0 };
    agg.total += r.permitCount5y ?? 0;
    agg.n++;
    sumByMuni.set(muni, agg);
  }
  const meanByMuni = new Map<string, number>();
  for (const [muni, agg] of sumByMuni) meanByMuni.set(muni, agg.n ? agg.total / agg.n : 0);

  const rows: Row[] = [];
  for (const r of ix.graph.rollups) {
    const muni = r.municipalityName ?? "Unknown";
    const mean = meanByMuni.get(muni) ?? 0;
    const count = r.permitCount5y ?? 0;
    if (mean > 0 && count >= Math.max(2 * mean, mean + 4)) {
      const p = r.propertyId ? ix.propertyById.get(r.propertyId) : undefined;
      rows.push({
        parcelIdentifier: r.parcelIdentifier ?? null,
        municipality: muni,
        permitCount5y: count,
        neighborhoodMean: Number(mean.toFixed(2)),
        ratioVsNeighborhood: Number((count / mean).toFixed(2)),
        href: r.propertyId ? `/properties/${r.propertyId}` : undefined,
        citations: propertyCitations(p),
      });
    }
  }
  return rows.sort((a, b) => Number(b.ratioVsNeighborhood) - Number(a.ratioVsNeighborhood)).slice(0, LIMIT);
}

export function computeInquiryRows(ix: AnalyticsIndex, inquiryId: string): Row[] {
  switch (inquiryId) {
    case "props-multi-open-permit":
      return propsMultiOpen(ix);
    case "props-open-roofing":
      return propsOpenTrade(ix, "roofing");
    case "props-open-electrical":
      return propsOpenTrade(ix, "electrical");
    case "props-major-concrete":
      return propsMajorTrade(ix, "concrete");
    case "props-major-roof":
      return propsMajorTrade(ix, "roofing");
    case "props-major-electrical":
      return propsMajorTrade(ix, "electrical");
    case "props-highest-permit-5y":
      return highestPermit5y(ix);
    case "props-significant-reno":
      return significantReno(ix);
    case "contractors-roofing-lee":
      return contractorsByTrade(ix, "Roofing");
    case "contractors-electrical-lee":
      return contractorsByTrade(ix, "Electrical");
    case "contractors-negative-bbb":
      return contractorsNegativeBbb(ix);
    case "contractors-complaints":
      return contractorsWithComplaints(ix);
    case "projects-bad-contractor":
      return projectsByBadContractors(ix);
    case "businesses-multi-property":
      return businessesMultiProperty(ix);
    case "owners-multi-property":
      return ownersMultiProperty(ix);
    case "tenants-multi-location":
      return tenantsMultiLocation(ix);
    case "props-ownership-change-open-permit":
      return ownershipChangeOpenPermit(ix);
    case "props-permit-business-turnover":
      return permitBusinessTurnover(ix);
    case "neighborhoods-increasing-permits":
      return neighborhoodsIncreasingPermits(ix);
    case "neighborhoods-major-reno-concentration":
      return neighborhoodsMajorReno(ix);
    case "contractors-most-active":
      return mostActiveContractors(ix);
    case "businesses-most-active-footprint":
      return businessesMultiProperty(ix);
    case "entity-graph":
      return entityGraph(ix);
    case "rag-nl-evidence":
      return [
        {
          info: "Open-ended questions are answered by the RAG layer with cited evidence.",
          href: "/explore?q=Which+properties+show+signs+of+value-add+investment+activity%3F",
          citations: [],
        },
      ];
    case "stretch-redevelopment":
      return likelyRedevelopment(ix);
    case "stretch-value-add":
      return valueAddActivity(ix);
    case "stretch-complaint-linked-projects":
      return complaintLinkedProjects(ix);
    case "stretch-owner-footprint":
      return ownersMultiProperty(ix);
    case "stretch-permit-precedes-turnover":
      return permitPrecedesTurnover(ix);
    case "stretch-redevelopment-neighborhoods":
      return neighborhoodsMajorReno(ix);
    case "stretch-acquisition-candidates":
      return acquisitionCandidates(ix);
    case "stretch-clean-major-reno-contractors":
      return cleanMajorContractors(ix);
    case "stretch-expanding-businesses":
      return expandingBusinesses(ix);
    case "stretch-anomalous-permits":
      return anomalousPermits(ix);
    default:
      return [];
  }
}

export function runInquiryInMemory(ix: AnalyticsIndex, inquiryId: string): InquiryResult {
  const def: InquiryDef | undefined = getInquiry(inquiryId);
  const rows = computeInquiryRows(ix, inquiryId);
  const columns = rows.length
    ? Object.keys(rows[0]!).filter((c) => c !== "href" && c !== "citations")
    : [];
  return {
    inquiryId,
    label: def?.label ?? inquiryId,
    columns,
    rows,
  };
}

export const ALL_INQUIRY_IDS = INQUIRIES.map((i) => i.id);
