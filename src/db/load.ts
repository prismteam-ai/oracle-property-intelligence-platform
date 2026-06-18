/**
 * Oracle loader: inserts the generated dataset into Postgres in FK-safe order,
 * builds the RAG `entity_documents` corpus (denormalized text + provenance
 * citations), and records the ingestion/refresh ledger.
 *
 * Run: node --env-file=.env.local --import tsx src/db/load.ts
 */
import { db, sql } from "./client";
import * as S from "./schema";
import { SOURCES } from "./seed-data";
import {
  addresses, parcels, people, companies, properties, ownerships, salesHistories, improvements,
  inspections, permitContacts, businessRegistrations, businessParties, bbbProfiles, bbbComplaints,
  bbbReviews, qualityScores, occupancies, props, contractors, businesses, propRollup,
} from "./seed";

const fmtUsd = (n: number) => "$" + n.toLocaleString("en-US");

async function insertBatched(table: any, rows: any[], batch = 600) {
  for (let i = 0; i < rows.length; i += batch) {
    await db.insert(table).values(rows.slice(i, i + batch));
  }
}

/* ───────── build entity_documents (RAG corpus) ───────── */
function buildDocuments() {
  const docs: any[] = [];
  const addrById = new Map(addresses.map((a) => [a.addressId, a]));
  const companyById = new Map(companies.map((c) => [c.companyId, c]));
  const profileByCompany = new Map(bbbProfiles.map((p) => [p.companyId, p]));
  const regByCompany = new Map(businessRegistrations.map((r) => [r.companyId, r]));

  // permits + occupants grouped by property
  const permitsByProp = new Map<string, any[]>();
  for (const pi of improvements) (permitsByProp.get(pi.propertyId) ?? permitsByProp.set(pi.propertyId, []).get(pi.propertyId)!).push(pi);
  const occByProp = new Map<string, any[]>();
  for (const o of occupancies) (occByProp.get(o.propertyId) ?? occByProp.set(o.propertyId, []).get(o.propertyId)!).push(o);
  const occByCompany = new Map<string, any[]>();
  for (const o of occupancies) (occByCompany.get(o.businessCompanyId) ?? occByCompany.set(o.businessCompanyId, []).get(o.businessCompanyId)!).push(o);

  // PROPERTY docs
  for (const p of props) {
    const r = propRollup[p.propertyId];
    const permits = permitsByProp.get(p.propertyId) ?? [];
    const contractorNames = [...new Set(permits.map((x) => x.licensedProfessional).filter(Boolean))].slice(0, 6);
    const occ = (occByProp.get(p.propertyId) ?? []).map((o) => companyById.get(o.businessCompanyId)?.name).filter(Boolean);
    const openTypes = [...r.openTypes];
    const majorTypes = [...new Set(permits.filter((x) => x.isMajorRenovation).map((x) => x.improvementType))];
    const addr = addrById.get(p.addressId)!;
    const body =
      `Property at ${addr.unnormalizedAddress}. ${p.usage} (${p.commercial ? "commercial" : "residential"}) built ${p.built}, ` +
      `in the ${p.neighborhood} area of Lee County, FL. Parcel STRAP ${p.strap}. Market value ${fmtUsd(p.value)}. ` +
      `Current owner: ${p.ownerLabel}. ` +
      `${r.open} open permit(s)` + (openTypes.length ? ` across ${r.openCats.size} categories (${openTypes.join(", ")})` : "") + `. ` +
      `${r.major} major renovation(s)` + (majorTypes.length ? ` (${majorTypes.join(", ")})` : "") + `. ` +
      `${r.cnt5y} permits in the last 5 years. Property improvement score ${Math.min(100, r.score)}. ` +
      (contractorNames.length ? `Contractors involved: ${contractorNames.join("; ")}. ` : "") +
      (occ.length ? `Business occupants/tenants: ${occ.slice(0, 6).join("; ")}.` : "");
    const citations = [
      { source: SOURCES.appraisal.label, sourceSystem: SOURCES.appraisal.system, url: SOURCES.appraisal.parcelUrl(p.strap), recordKey: p.strapNorm },
      ...(permits.slice(0, 3).map((x) => ({ source: SOURCES.permits.label, sourceSystem: SOURCES.permits.system, url: x.sourceUrl, recordKey: x.permitNumber }))),
    ];
    docs.push({
      entityType: "property", entityId: p.propertyId, title: addr.unnormalizedAddress,
      subtitle: `${p.usage} · ${p.neighborhood} · STRAP ${p.strap}`, body,
      metadata: { propertyId: p.propertyId, municipality: p.muni, neighborhood: p.neighborhood, usage: p.usage, commercial: p.commercial, value: p.value, openPermitCount: r.open, openPermitCategories: r.openCats.size, majorRenovationCount: r.major, permitCount5y: r.cnt5y, improvementScore: Math.min(100, r.score) },
      sourceSystems: [SOURCES.appraisal.system, SOURCES.permits.system], citations,
    });
  }

  // CONTRACTOR docs
  for (const c of contractors) {
    const prof = profileByCompany.get(c.companyId);
    const typeBreak = Object.entries(c.typeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`).join(", ");
    const body =
      `${c.name} is a ${c.category} operating in Lee County, FL. ` +
      (prof ? `BBB rating ${prof.bbbRating} (reputation score ${Math.round(prof.ratingScore)}/100), ${prof.complaintCount} complaints, ${prof.reviewCount} reviews averaging ${prof.reviewAverageRating}/5. ${prof.isAccredited ? "BBB Accredited." : "Not BBB accredited."} ${prof.yearsInBusiness} years in business. ` : `No BBB profile on file. `) +
      `Pulled ${c.permitCount} permitted projects in the county` + (typeBreak ? `: ${typeBreak}.` : ".");
    const citations = prof ? [{ source: SOURCES.bbb.label, sourceSystem: SOURCES.bbb.system, url: prof.profileUrl, recordKey: prof.sourceRecordKey }] : [];
    docs.push({
      entityType: "contractor", entityId: c.companyId, title: c.name,
      subtitle: `${c.category}${prof ? ` · BBB ${prof.bbbRating}` : ""}`, body,
      metadata: { companyId: c.companyId, category: c.category, bbbRating: prof?.bbbRating ?? null, score: prof?.ratingScore ?? null, complaints: prof?.complaintCount ?? 0, permitCount: c.permitCount, types: Object.keys(c.typeCounts) },
      sourceSystems: prof ? [SOURCES.bbb.system, SOURCES.permits.system] : [SOURCES.permits.system], citations,
    });
  }

  // BUSINESS docs
  for (const b of businesses) {
    const reg = regByCompany.get(b.companyId);
    const occ = occByCompany.get(b.companyId) ?? [];
    const locs = occ.map((o) => addrById.get(o.addressId)?.unnormalizedAddress).filter(Boolean);
    const body =
      `${b.name} is a ${b.kind} business in Lee County, FL. ` +
      (reg ? `Registered with the Florida Division of Corporations (Sunbiz) as a ${reg.filingType}, document number ${reg.documentNumber}, status ${reg.status}, filed ${reg.filedDate}. ` : "") +
      `Operates at ${occ.length} location(s)${locs.length ? ": " + locs.slice(0, 5).join("; ") : ""}.`;
    const citations = reg ? [{ source: SOURCES.sunbiz.label, sourceSystem: SOURCES.sunbiz.system, url: SOURCES.sunbiz.docUrl(reg.documentNumber), recordKey: reg.documentNumber }] : [];
    docs.push({
      entityType: "business", entityId: b.companyId, title: b.name,
      subtitle: `${b.kind}${reg ? ` · ${reg.status}` : ""}`, body,
      metadata: { companyId: b.companyId, kind: b.kind, status: reg?.status ?? null, locations: occ.length },
      sourceSystems: [SOURCES.sunbiz.system, SOURCES.occupancy.system], citations,
    });
    // TENANT doc for multi-location businesses
    if (occ.length >= 2) {
      docs.push({
        entityType: "tenant", entityId: b.companyId, title: b.name,
        subtitle: `Multi-location tenant · ${occ.length} locations`,
        body: `${b.name} (${b.kind}) is a tenant operating across ${occ.length} locations in Lee County: ${locs.slice(0, 6).join("; ")}. ${occ.filter((o) => o.isCurrent).length} currently active.`,
        metadata: { companyId: b.companyId, kind: b.kind, locations: occ.length },
        sourceSystems: [SOURCES.occupancy.system, SOURCES.sunbiz.system], citations,
      });
    }
  }

  // OWNER docs (companies owning ≥2 properties)
  const propsByOwnerCo = new Map<string, any[]>();
  for (const p of props) if (p.ownerCompanyId) (propsByOwnerCo.get(p.ownerCompanyId) ?? propsByOwnerCo.set(p.ownerCompanyId, []).get(p.ownerCompanyId)!).push(p);
  for (const [coId, owned] of propsByOwnerCo) {
    if (owned.length < 2) continue;
    const co = companyById.get(coId)!;
    const sum = owned.reduce((s, x) => s + x.value, 0);
    const munis = [...new Set(owned.map((x) => x.muni))];
    docs.push({
      entityType: "owner", entityId: coId, title: co.name,
      subtitle: `Owner · ${owned.length} properties`,
      body: `${co.name} owns ${owned.length} properties in Lee County, FL totaling ${fmtUsd(sum)} in market value across ${munis.join(", ")}. Holdings include: ${owned.slice(0, 6).map((x) => x.strap).join(", ")}.`,
      metadata: { companyId: coId, propertyCount: owned.length, totalValue: sum, municipalities: munis },
      sourceSystems: [SOURCES.appraisal.system], citations: [],
    });
  }

  // NEIGHBORHOOD docs
  const byHood = new Map<string, any[]>();
  for (const p of props) (byHood.get(p.neighborhood) ?? byHood.set(p.neighborhood, []).get(p.neighborhood)!).push(p);
  for (const [hood, ps] of byHood) {
    const open = ps.reduce((s, p) => s + propRollup[p.propertyId].open, 0);
    const major = ps.reduce((s, p) => s + propRollup[p.propertyId].major, 0);
    const c5 = ps.reduce((s, p) => s + propRollup[p.propertyId].cnt5y, 0);
    const avg = Math.round(ps.reduce((s, p) => s + p.value, 0) / ps.length);
    docs.push({
      entityType: "neighborhood", entityId: ps[0].propertyId, title: hood,
      subtitle: `Neighborhood · ${ps.length} properties`,
      body: `${hood} (Lee County, FL) has ${ps.length} tracked properties, ${c5} permits in the last 5 years, ${open} currently open permits, and ${major} major renovations. Average property value ${fmtUsd(avg)}.`,
      metadata: { neighborhood: hood, properties: ps.length, openPermits: open, majorRenovations: major, permits5y: c5, avgValue: avg },
      sourceSystems: [SOURCES.appraisal.system, SOURCES.permits.system], citations: [],
    });
  }

  return docs;
}

async function main() {
  console.log("truncating…");
  await sql.unsafe(
    `TRUNCATE TABLE addresses, parcels, people, companies, properties, ownerships, sales_histories,
     property_improvements, inspections, permit_contacts, business_registrations,
     business_registration_parties, business_reputation_profiles, business_reputation_complaints,
     business_reputation_reviews, contractor_quality_scores, occupancies, entity_documents,
     ingestion_runs RESTART IDENTITY CASCADE`,
  );

  console.log("inserting core…");
  await insertBatched(S.addresses, addresses);
  await insertBatched(S.parcels, parcels);
  await insertBatched(S.people, people);
  await insertBatched(S.companies, companies);
  console.log("inserting properties + ownership…");
  await insertBatched(S.properties, properties, 400);
  await insertBatched(S.ownerships, ownerships);
  await insertBatched(S.salesHistories, salesHistories);
  console.log("inserting permits…");
  await insertBatched(S.propertyImprovements, improvements, 350);
  await insertBatched(S.inspections, inspections);
  await insertBatched(S.permitContacts, permitContacts);
  console.log("inserting businesses + bbb…");
  await insertBatched(S.businessRegistrations, businessRegistrations);
  await insertBatched(S.businessRegistrationParties, businessParties);
  await insertBatched(S.businessReputationProfiles, bbbProfiles);
  await insertBatched(S.businessReputationComplaints, bbbComplaints);
  await insertBatched(S.businessReputationReviews, bbbReviews);
  await insertBatched(S.contractorQualityScores, qualityScores);
  await insertBatched(S.occupancies, occupancies);

  console.log("building RAG documents…");
  const docs = buildDocuments();
  await insertBatched(S.entityDocuments, docs, 300);

  // ingestion / refresh ledger (lineage metadata)
  const now = new Date();
  await db.insert(S.ingestionRuns).values([
    { sourceSystem: SOURCES.appraisal.system, sourceLabel: SOURCES.appraisal.label, sourceUrl: SOURCES.appraisal.base, recordsLoaded: properties.length, refreshedAt: now, collectionStartedAt: new Date(now.getTime() - 3 * 86400000), status: "complete", notes: "Parcels, properties, ownership, sales, valuations" },
    { sourceSystem: SOURCES.permits.system, sourceLabel: SOURCES.permits.label, sourceUrl: SOURCES.permits.base, recordsLoaded: improvements.length, refreshedAt: now, collectionStartedAt: new Date(now.getTime() - 2 * 86400000), status: "complete", notes: "Accela permits, inspections, contacts" },
    { sourceSystem: SOURCES.sunbiz.system, sourceLabel: SOURCES.sunbiz.label, sourceUrl: SOURCES.sunbiz.base, recordsLoaded: businessRegistrations.length, refreshedAt: now, collectionStartedAt: new Date(now.getTime() - 5 * 86400000), status: "complete", notes: "Corporate registrations + officers" },
    { sourceSystem: SOURCES.bbb.system, sourceLabel: SOURCES.bbb.label, sourceUrl: SOURCES.bbb.base, recordsLoaded: bbbProfiles.length, refreshedAt: now, collectionStartedAt: new Date(now.getTime() - 4 * 86400000), status: "complete", notes: "Contractor reputation, complaints, reviews" },
    { sourceSystem: SOURCES.occupancy.system, sourceLabel: SOURCES.occupancy.label, recordsLoaded: occupancies.length, refreshedAt: now, status: "complete", notes: "Derived tenant/occupancy reconciliation" },
  ]);

  // report (verify directly against the DB)
  const tables = [
    "addresses", "parcels", "people", "companies", "properties", "ownerships", "sales_histories",
    "property_improvements", "inspections", "permit_contacts", "business_registrations",
    "business_registration_parties", "business_reputation_profiles", "business_reputation_complaints",
    "business_reputation_reviews", "contractor_quality_scores", "occupancies", "entity_documents",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const r = await sql.unsafe(`select count(*)::int as n from ${t}`);
    counts[t] = (r[0] as any).n;
  }
  console.log("✅ load complete. row counts:");
  console.table(counts);
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
