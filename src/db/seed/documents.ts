import type { GeneratedGraph } from "./generate";
import type { NewEntityDocument } from "@/db/schema/types";
import {
  bbbProfileUrl,
  leepaParcelUrl,
  sunbizUrl,
} from "./url-builders";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "BAAI/bge-small-en-v1.5";

function primarySourceUri(citations: NewEntityDocument["citations"]): string | null {
  const items = (citations as { items?: Array<{ url?: unknown }> } | undefined)?.items;
  const url = items?.find((c) => c?.url)?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function baseDoc(
  overrides: Partial<NewEntityDocument> & {
    entityType: string;
    title: string;
    body: string;
    sourceRecordKey: string;
  },
): NewEntityDocument {
  return {
    corpusType: overrides.entityType,
    embeddingModel: EMBEDDING_MODEL,
    sourceSystem: "oracle",
    metadata: { entityType: overrides.entityType, jurisdiction: "fl-lee" },
    sourceUri: primarySourceUri(overrides.citations) ?? undefined,
    ...overrides,
  };
}

export function buildDocuments(graph: GeneratedGraph): NewEntityDocument[] {
  const docs: NewEntityDocument[] = [];

  const rollupByProperty = new Map(graph.rollups.map((r) => [r.propertyId, r]));

  for (const p of graph.properties) {
    const normalized = p.parcelIdentifier.replace(/[^0-9]/g, "");
    const url = leepaParcelUrl(normalized);
    const r = rollupByProperty.get(p.propertyId);
    const signals = r
      ? ` ${r.openPermitCount} open permit(s); ${r.permitCount5y} permit(s) in 5y; ${
          r.majorRenovationCount
        } major renovation(s); trades: ${(r.renovationTrades ?? []).join(", ") || "none"}.`
      : "";
    docs.push(
      baseDoc({
        entityType: "property",
        entityId: p.propertyId,
        title: `Property ${p.parcelIdentifier}`,
        subtitle: p.subdivision ?? null,
        body:
          `Property ${p.parcelIdentifier} in ${p.subdivision ?? "Lee County"}, ${
            (p.propertyUsageType ?? "residential")
          }. Type ${p.propertyType ?? "unknown"}, built ${
            p.propertyStructureBuiltYear ?? "unknown"
          }.${signals}`,
        sourceSystems: ["leepa", "lee_accela"],
        citations: {
          items: [
            { label: "Lee County Property Appraiser", url, recordKey: p.sourceRecordKey },
          ],
        },
        sourceRecordKey: `doc:property:${p.propertyId}`,
      }),
    );
  }

  const companyById = new Map(graph.companies.map((c) => [c.companyId, c]));
  for (const profile of graph.businessReputationProfiles) {
    const company = companyById.get(profile.companyId ?? undefined);
    const url = profile.profileUrl ?? bbbProfileUrl(profile.profileSlug ?? "contractor");
    docs.push(
      baseDoc({
        entityType: "contractor",
        entityId: profile.companyId ?? null,
        title: company?.name ?? profile.name ?? "Contractor",
        subtitle: `BBB rating ${profile.bbbRating ?? "NR"}`,
        body:
          `${company?.name ?? profile.name} is a Lee County contractor. BBB rating ${
            profile.bbbRating ?? "NR"
          }, ${profile.reviewCount ?? 0} reviews (avg ${
            profile.reviewAverageRating ?? "n/a"
          }), ${profile.complaintCount ?? 0} complaints.`,
        sourceSystems: ["bbb"],
        citations: {
          items: [
            { label: "BBB Profile", url, recordKey: profile.sourceRecordKey },
          ],
        },
        sourceRecordKey: `doc:contractor:${profile.businessReputationProfileId}`,
      }),
    );
  }

  for (const reg of graph.businessRegistrations) {
    const url = sunbizUrl(reg.documentNumber);
    docs.push(
      baseDoc({
        entityType: "business",
        entityId: reg.businessRegistrationId,
        title: reg.entityName ?? "Business",
        subtitle: reg.filingType ?? null,
        body:
          `${reg.entityName} (doc ${reg.documentNumber}) is a ${
            reg.filingType ?? "Florida entity"
          }, status ${reg.status ?? "unknown"}, filed ${reg.filedDate ?? "unknown"}.`,
        sourceSystems: ["sunbiz"],
        citations: {
          items: [
            { label: "Florida Sunbiz", url, recordKey: reg.sourceRecordKey },
          ],
        },
        sourceRecordKey: `doc:business:${reg.businessRegistrationId}`,
      }),
    );
  }

  for (const t of graph.tenants) {
    docs.push(
      baseDoc({
        entityType: "tenant",
        entityId: t.tenantId,
        title: t.tenantName ?? "Tenant",
        subtitle: t.tenantType ?? null,
        body: `${t.tenantName} is a ${t.tenantType ?? "residential"} tenant in Lee County.`,
        sourceSystems: ["oracle"],
        citations: { items: [] },
        sourceRecordKey: `doc:tenant:${t.tenantId}`,
      }),
    );
  }

  for (const pr of graph.projects) {
    docs.push(
      baseDoc({
        entityType: "project",
        entityId: pr.projectId,
        title: pr.projectName ?? "Project",
        subtitle: pr.projectStatus ?? null,
        body:
          `${pr.projectName}: ${pr.permitCount ?? 0} permit(s), ${
            pr.isMajorRenovation ? "major renovation" : "maintenance"
          }, trades: ${(pr.renovationTrades ?? []).join(", ") || "none"}.`,
        sourceSystems: ["oracle", "lee_accela"],
        citations: { items: [] },
        sourceRecordKey: `doc:project:${pr.projectId}`,
      }),
    );
  }

  return docs;
}
