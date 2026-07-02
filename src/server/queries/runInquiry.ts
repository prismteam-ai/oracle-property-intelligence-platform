import "server-only";

import { getInquiry } from "@/lib/inquiries";
import { SIGNIFICANT_RENOVATION_SCORE } from "@/lib/renovation";
import type { Citation, InquiryResult, InquiryResultRow } from "@/server/ports";
import {
  acquisitionCandidateRollups,
  anomalousPermitProperties,
  businessesWithMultipleProperties,
  cleanMajorRenovationContractors,
  complaintLinkedProjectContractors,
  contractorsByTrade,
  contractorsWithComplaints,
  entityGraph,
  expandingBusinesses,
  highestPermitActivity5y,
  mostActiveContractors,
  neighborhoodPermitActivity,
  neighborhoodRenovationConcentration,
  openPermitsWithBusinessTurnover,
  ownershipChangeWithOpenPermits,
  permitPatternPrecedingTurnover,
  projectsByBadContractors,
  propertiesWithMajorTrade,
  propertiesWithMultipleOpenPermits,
  propertiesWithOpenCategory,
  redevelopmentRollups,
  sampleEvidenceDocuments,
  significantRenovationAboveScore,
  valueAddProperties,
} from "./analytics";
import { contractorsWithNegativeBbb } from "./contractor";
import { ownersWithMultipleProperties } from "./property";
import { tenantsWithMultipleLocations } from "./tenant";

type RollupRow = {
  propertyId: string | null;
  parcelIdentifier: string | null;
  municipalityName: string | null;
  openPermitCount: number | null;
  openPermitCategories: string[] | null;
  permitCount5y: number | null;
  majorRenovationCount: number | null;
  renovationTrades: string[] | null;
  improvementScore: string | null;
  ownershipChangeCount: number | null;
  businessTurnoverCount: number | null;
  totalPermitValue: string | null;
  sourceArtifactUri?: string | null;
  sourceRecordKey?: string | null;
  sourceSystem?: string | null;
};

function propertyCitation(r: {
  sourceArtifactUri?: string | null;
  sourceRecordKey?: string | null;
  sourceSystem?: string | null;
}): Citation[] {
  if (!r.sourceArtifactUri) return [];
  return [
    {
      label: "Lee County Property Appraiser",
      url: r.sourceArtifactUri,
      recordKey: r.sourceRecordKey ?? null,
      sourceSystem: r.sourceSystem ?? "leepa",
    },
  ];
}

function propHref(propertyId: string | null): string | undefined {
  return propertyId ? `/properties/${propertyId}` : undefined;
}

function bbbCitation(r: {
  profileUrl?: string | null;
  profileRecordKey?: string | null;
}): Citation[] {
  if (!r.profileUrl) return [];
  return [
    {
      label: "BBB Profile",
      url: r.profileUrl,
      recordKey: r.profileRecordKey ?? null,
      sourceSystem: "bbb",
    },
  ];
}

function representativePropertyCitation(r: {
  sourceArtifactUri?: string | null;
  sourceRecordKey?: string | null;
  sourceSystem?: string | null;
}): Citation[] {
  if (!r.sourceArtifactUri) return [];
  return [
    {
      label: "Lee County Property Appraiser (representative property)",
      url: r.sourceArtifactUri,
      recordKey: r.sourceRecordKey ?? null,
      sourceSystem: r.sourceSystem ?? "leepa",
    },
  ];
}

function tenantMatchCitation(r: {
  matchMethod?: string | null;
  matchConfidence?: string | null;
  sourceRecordKey?: string | null;
  sourceSystem?: string | null;
}): Citation[] {
  if (!r.sourceRecordKey) return [];
  return [
    {
      label: `Oracle tenant match (${r.matchMethod ?? "reconciled"}, conf ${
        r.matchConfidence ?? "n/a"
      })`,
      url: null,
      recordKey: r.sourceRecordKey,
      sourceSystem: r.sourceSystem ?? "oracle",
    },
  ];
}

function shape(rows: InquiryResultRow[]): { columns: string[]; rows: InquiryResultRow[] } {
  const columns = rows.length
    ? Object.keys(rows[0]!).filter((c) => c !== "href" && c !== "citations")
    : [];
  return { columns, rows };
}

export async function runInquiry(inquiryId: string): Promise<InquiryResult> {
  const def = getInquiry(inquiryId);
  const label = def?.label ?? inquiryId;
  let rows: InquiryResultRow[] = [];

  switch (inquiryId) {
    case "props-multi-open-permit": {
      rows = (await propertiesWithMultipleOpenPermits()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        openPermitCount: r.openPermitCount ?? 0,
        openCategories: r.openPermitCategories ?? [],
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "props-open-roofing":
    case "props-open-electrical": {
      const cat = inquiryId === "props-open-roofing" ? "roofing" : "electrical";
      rows = (await propertiesWithOpenCategory(cat)).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        openTradePermits: r.openPermitCount ?? 0,
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "props-major-concrete":
    case "props-major-roof":
    case "props-major-electrical": {
      const trade =
        inquiryId === "props-major-concrete"
          ? "concrete"
          : inquiryId === "props-major-roof"
            ? "roofing"
            : "electrical";
      rows = (await propertiesWithMajorTrade(trade)).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        trade,
        majorPermits: r.majorRenovationCount ?? 0,
        improvementScore: Number(r.improvementScore ?? 0),
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "props-highest-permit-5y": {
      rows = (await highestPermitActivity5y()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        permitCount5y: r.permitCount5y ?? 0,
        improvementScore: Number(r.improvementScore ?? 0),
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "props-significant-reno": {
      rows = (await significantRenovationAboveScore(SIGNIFICANT_RENOVATION_SCORE)).map(
        (r: RollupRow) => ({
          parcelIdentifier: r.parcelIdentifier,
          municipality: r.municipalityName,
          improvementScore: Number(r.improvementScore ?? 0),
          majorRenovations: r.majorRenovationCount ?? 0,
          trades: r.renovationTrades ?? [],
          href: propHref(r.propertyId),
          citations: propertyCitation(r),
        }),
      );
      break;
    }
    case "stretch-value-add": {
      rows = (await valueAddProperties(SIGNIFICANT_RENOVATION_SCORE)).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        improvementScore: Number(r.improvementScore ?? 0),
        majorRenovations: r.majorRenovationCount ?? 0,
        totalPermitValue: Number(r.totalPermitValue ?? 0),
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "contractors-roofing-lee":
    case "contractors-electrical-lee": {
      const trade = inquiryId === "contractors-roofing-lee" ? "Roofing" : "Electrical";
      rows = (await contractorsByTrade(trade)).map((c) => ({
        contractor: c.name,
        trade: c.trade ?? trade,
        reviewCount: Number(c.permitCount ?? 0),
        bbbRating: c.bbbRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: c.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: c.profileUrl,
                recordKey: c.profileRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "contractors-negative-bbb": {
      rows = (await contractorsWithNegativeBbb()).map((c) => ({
        contractor: c.name,
        bbbRating: c.bbbRating ?? null,
        complaintCount: c.complaintCount ?? 0,
        reviewAverageRating: c.reviewAverageRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: bbbCitation(c),
      }));
      break;
    }
    case "contractors-complaints": {
      rows = (await contractorsWithComplaints()).map((c) => ({
        contractor: c.name,
        complaintCount: c.complaintCount ?? 0,
        bbbRating: c.bbbRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: c.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: c.profileUrl,
                recordKey: c.sourceRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "projects-bad-contractor": {
      rows = (await projectsByBadContractors()).map((r) => ({
        project: r.projectName ?? "(unnamed project)",
        parcelIdentifier: r.parcelIdentifier ?? null,
        contractor: r.contractor,
        bbbRating: r.bbbRating ?? null,
        complaintCount: r.complaintCount ?? 0,
        projectStatus: r.projectStatus ?? null,
        href: r.propertyId ? propHref(r.propertyId) : undefined,
        citations: r.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: r.profileUrl,
                recordKey: r.profileRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "stretch-complaint-linked-projects": {
      rows = (await complaintLinkedProjectContractors()).map((c) => ({
        contractor: c.name,
        complaintCount: c.complaintCount ?? 0,
        projectCount: Number(c.projectCount ?? 0),
        complaintLinkedProjects: Number(c.complaintLinkedProjects ?? 0),
        bbbRating: c.bbbRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: c.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: c.profileUrl,
                recordKey: c.profileRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "businesses-multi-property":
    case "businesses-most-active-footprint": {
      rows = (await businessesWithMultipleProperties()).map((b) => ({
        business: b.entityName,
        documentNumber: b.documentNumber,
        propertyCount: Number(b.propertyCount ?? 0),
        href: b.documentNumber ? `/businesses/${b.documentNumber}` : undefined,
        citations: b.sourceArtifactUri
          ? [
              {
                label: "Florida Sunbiz",
                url: b.sourceArtifactUri,
                recordKey: b.sourceRecordKey ?? null,
                sourceSystem: "sunbiz",
              },
            ]
          : [],
      }));
      break;
    }
    case "stretch-expanding-businesses": {
      rows = (await expandingBusinesses()).map((b) => ({
        business: b.entityName,
        documentNumber: b.documentNumber,
        locationCount: Number(b.locationCount ?? 0),
        firstSeen: b.firstSeen ?? null,
        latestSeen: b.latestSeen ?? null,
        href: b.documentNumber ? `/businesses/${b.documentNumber}` : undefined,
        citations: b.sourceArtifactUri
          ? [
              {
                label: "Florida Sunbiz",
                url: b.sourceArtifactUri,
                recordKey: b.sourceRecordKey ?? null,
                sourceSystem: "sunbiz",
              },
            ]
          : [],
      }));
      break;
    }
    case "owners-multi-property":
    case "stretch-owner-footprint": {
      rows = (await ownersWithMultipleProperties()).map((o) => ({
        owner: o.ownerName ?? o.ownerCompanyId ?? o.ownerPersonId,
        propertyCount: Number(o.propertyCount ?? 0),
        href: propHref(o.representativePropertyId),
        citations: representativePropertyCitation(o),
      }));
      break;
    }
    case "tenants-multi-location": {
      rows = (await tenantsWithMultipleLocations()).map((t) => ({
        tenant: t.tenantName ?? t.tenantId,
        tenantType: t.tenantType ?? null,
        locationCount: Number(t.locationCount ?? 0),
        href: t.tenantId ? `/tenants/${t.tenantId}` : undefined,
        citations: tenantMatchCitation(t),
      }));
      break;
    }
    case "props-ownership-change-open-permit": {
      rows = (await ownershipChangeWithOpenPermits()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        ownershipChanges: r.ownershipChangeCount ?? 0,
        openPermits: r.openPermitCount ?? 0,
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "props-permit-business-turnover": {
      rows = (await openPermitsWithBusinessTurnover()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        openPermits: r.openPermitCount ?? 0,
        businessTurnover: r.businessTurnoverCount ?? 0,
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "stretch-permit-precedes-turnover": {
      rows = (await permitPatternPrecedingTurnover()).map((r) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        businessTurnover: r.businessTurnoverCount ?? 0,
        permitCount: r.permitCount5y ?? 0,
        permitPattern: r.renovationTrades ?? [],
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "neighborhoods-increasing-permits": {
      rows = (await neighborhoodPermitActivity()).map((n) => ({
        municipality: n.municipalityName,
        recentPermits: n.recentPermits,
        priorPermits: n.priorPermits,
        permitIncrease: n.permitIncrease,
        growthRatePct: n.growthRatePct,
        href: propHref(n.representativePropertyId),
        citations: representativePropertyCitation(n),
      }));
      break;
    }
    case "neighborhoods-major-reno-concentration":
    case "stretch-redevelopment-neighborhoods": {
      rows = (await neighborhoodRenovationConcentration()).map((n) => ({
        municipality: n.municipalityName,
        majorRenovations: Number(n.majorRenovations ?? 0),
        properties: Number(n.propertyCount ?? 0),
        openPermits: Number(n.openPermits ?? 0),
        href: propHref(n.representativePropertyId),
        citations: representativePropertyCitation(n),
      }));
      break;
    }
    case "contractors-most-active": {
      rows = (await mostActiveContractors()).map((c) => ({
        contractor: c.name,
        reviewCount: Number(c.projectCount ?? 0),
        complaintCount: Number(c.permitCount ?? 0),
        bbbRating: c.bbbRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: c.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: c.profileUrl,
                recordKey: c.profileRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "stretch-clean-major-reno-contractors": {
      rows = (await cleanMajorRenovationContractors()).map((c) => ({
        contractor: c.name,
        reviewCount: Number(c.majorRenovations ?? 0),
        bbbRating: c.bbbRating ?? null,
        reviewAverageRating: c.reviewAverageRating ?? null,
        href: c.companyId ? `/contractors/${c.companyId}` : undefined,
        citations: c.profileUrl
          ? [
              {
                label: "BBB Profile",
                url: c.profileUrl,
                recordKey: c.profileRecordKey ?? null,
                sourceSystem: "bbb",
              },
            ]
          : [],
      }));
      break;
    }
    case "stretch-redevelopment": {
      rows = (await redevelopmentRollups()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        signal: "structural + ownership/permit churn",
        majorRenovations: r.majorRenovationCount ?? 0,
        improvementScore: Number(r.improvementScore ?? 0),
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "stretch-acquisition-candidates": {
      rows = (await acquisitionCandidateRollups()).map((r: RollupRow) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        openPermits: r.openPermitCount ?? 0,
        ownershipChanges: r.ownershipChangeCount ?? 0,
        businessTurnover: r.businessTurnoverCount ?? 0,
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "stretch-anomalous-permits": {
      rows = (await anomalousPermitProperties()).map((r) => ({
        parcelIdentifier: r.parcelIdentifier,
        municipality: r.municipalityName,
        permitCount5y: r.permitCount5y ?? 0,
        neighborhoodMean: r.neighborhoodMean,
        ratioVsNeighborhood: r.ratioVsNeighborhood,
        href: propHref(r.propertyId),
        citations: propertyCitation(r),
      }));
      break;
    }
    case "entity-graph": {
      rows = (await entityGraph()).map((r) => ({
        role: r.role,
        name: r.name,
        detail: r.detail,
        href: r.href,
        citations: r.citations,
      }));
      break;
    }
    case "rag-nl-evidence": {
      const docs = await sampleEvidenceDocuments();
      rows = docs.map((d) => ({
        title: d.title,
        entityType: d.entityType,
        detail: d.subtitle,
        href: `/explore?q=${encodeURIComponent(d.title)}`,
        citations: d.sourceUri
          ? [
              {
                label: "Source record",
                url: d.sourceUri,
                recordKey: d.documentId,
                sourceSystem: "oracle:corpus",
              },
            ]
          : [],
      }));
      break;
    }
    default:
      rows = [];
      break;
  }

  const shaped = shape(rows);
  return { inquiryId, label, columns: shaped.columns, rows: shaped.rows };
}
