/**
 * Oracle seed: generates a realistic, internally-consistent Lee County, FL dataset
 * across the canonical lexicon entities and loads it into Postgres, then builds the
 * RAG `entity_documents` index (text). Embeddings are added by `embed.ts`.
 *
 * Run: node --env-file=.env.local --import tsx src/db/seed.ts
 */
import { randomUUID } from "crypto";
import { sql as dsql } from "drizzle-orm";
import { db, sql } from "./client";
import * as S from "./schema";
import {
  MUNICIPALITIES, STREET_NAMES, STREET_SUFFIXES, PRE_DIR, RESIDENTIAL_USAGE, COMMERCIAL_USAGE,
  ZONING, PERMIT_TYPES, OPEN_STATUSES, CLOSED_STATUSES, TERMINAL_OTHER, INSPECTION_TYPES,
  INSPECTION_RESULTS, CONTACT_ROLES, CONTRACTOR_SPECIALTIES, CONTRACTOR_NAME_STEMS,
  CONTRACTOR_NAME_TAILS, COMPANY_SUFFIXES, BBB_RATINGS, ratingToScore, COMPLAINT_TYPES,
  COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, COMPLAINT_SUMMARIES, REVIEW_TITLES_POS,
  REVIEW_TITLES_NEG, REVIEW_TEXT_POS, REVIEW_TEXT_NEG, SUNBIZ_FILING_TYPES, SUNBIZ_STATUSES,
  SUNBIZ_PARTY_ROLES, BUSINESS_KINDS, FIRST_NAMES, LAST_NAMES, SALE_TYPES, SOURCES, slugify,
  normalizeName, makeStrap, makeRng, pick, randInt, randFloat, chance, weightedPick, shuffle,
  dateBetween, addDays, type Rng,
} from "./seed-data";

const rng: Rng = makeRng(20260615);
const BASE = "2026-06-15";
const uuid = () => randomUUID();
const recentTs = (lo: number, hi: number) =>
  new Date(new Date(BASE).getTime() - randInt(rng, lo, hi) * 86400000);

const N_PROPERTIES = 2200;
const N_CONTRACTORS = 230;
const N_BUSINESSES = 560;

/* in-memory row buffers */
const addresses: any[] = [];
const parcels: any[] = [];
const people: any[] = [];
const companies: any[] = [];
const properties: any[] = [];
const ownerships: any[] = [];
const salesHistories: any[] = [];
const improvements: any[] = [];
const inspections: any[] = [];
const permitContacts: any[] = [];
const businessRegistrations: any[] = [];
const businessParties: any[] = [];
const bbbProfiles: any[] = [];
const bbbComplaints: any[] = [];
const bbbReviews: any[] = [];
const qualityScores: any[] = [];
const occupancies: any[] = [];
const entityDocuments: any[] = [];

function fullName() {
  const fn = pick(rng, FIRST_NAMES);
  const ln = pick(rng, LAST_NAMES);
  return { firstName: fn, lastName: ln, full: `${fn} ${ln}` };
}
function makePerson(): string {
  const n = fullName();
  const id = uuid();
  people.push({
    personId: id, firstName: n.firstName, lastName: n.lastName, fullName: n.full,
    normalizedName: normalizeName(n.full),
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `person:${id}`,
    retrievedAt: recentTs(5, 60),
  });
  return id;
}
function makeAddress(muni: (typeof MUNICIPALITIES)[number], opts?: { commercial?: boolean }): string {
  const id = uuid();
  const num = String(randInt(rng, 100, 8999));
  const pre = pick(rng, PRE_DIR);
  const name = pick(rng, STREET_NAMES);
  const suf = pick(rng, STREET_SUFFIXES);
  const zip = pick(rng, muni.zips);
  const unit = opts?.commercial && chance(rng, 0.5) ? `Ste ${randInt(rng, 100, 480)}` : null;
  const street = `${num}${pre ? " " + pre : ""} ${name} ${suf}`;
  const full = `${street}${unit ? " " + unit : ""}, ${muni.name}, FL ${zip}`;
  // approximate Lee County geo bounds
  const lat = randFloat(rng, 26.43, 26.71, 5);
  const lng = randFloat(rng, -82.15, -81.62, 5);
  addresses.push({
    addressId: id, streetNumber: num, streetName: `${pre ? pre + " " : ""}${name}`, streetSuffixType: suf,
    unitIdentifier: unit, cityName: muni.name, municipalityName: muni.name, countyName: "Lee", stateCode: "FL",
    postalCode: zip, latitude: lat, longitude: lng, unnormalizedAddress: full,
    normalizedAddressKey: normalizeName(full),
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `addr:${id}`, retrievedAt: recentTs(5, 60),
  });
  return id;
}

/* ───────────── contractors ───────────── */
console.log("generating contractors…");
interface Contractor { companyId: string; name: string; category: string; types: string[]; permitCount: number; typeCounts: Record<string, number>; bbbRating?: string; score?: number; complaints: number; profileId?: string; }
const contractors: Contractor[] = [];
const contractorsByType: Record<string, Contractor[]> = {};
for (let i = 0; i < N_CONTRACTORS; i++) {
  const spec = pick(rng, CONTRACTOR_SPECIALTIES);
  const stem = pick(rng, CONTRACTOR_NAME_STEMS);
  const tail = pick(rng, CONTRACTOR_NAME_TAILS);
  const suffix = pick(rng, COMPANY_SUFFIXES);
  const name = `${stem} ${tail} ${suffix}`;
  const companyId = uuid();
  companies.push({
    companyId, name, normalizedName: normalizeName(name), isContractor: true,
    sourceSystem: SOURCES.permits.system, sourceRecordKey: `contractor:${slugify(name)}-${i}`,
    retrievedAt: recentTs(5, 60),
  });
  const c: Contractor = { companyId, name, category: spec.category, types: spec.types, permitCount: 0, typeCounts: {}, complaints: 0 };
  // BBB profile for ~85%
  if (chance(rng, 0.85)) {
    // rating distribution: ~25% negative
    const r = rng();
    let rating: string;
    if (r < 0.42) rating = pick(rng, ["A+", "A"]);
    else if (r < 0.62) rating = pick(rng, ["A-", "B+"]);
    else if (r < 0.75) rating = pick(rng, ["B", "B-"]);
    else if (r < 0.86) rating = pick(rng, ["C+", "C", "C-"]);
    else if (r < 0.95) rating = pick(rng, ["D+", "D", "D-"]);
    else rating = pick(rng, ["F", "NR"]);
    const score = rating === "NR" ? 0 : ratingToScore(rating) + randInt(rng, 0, 4);
    const accredited = ["A+", "A", "A-", "B+"].includes(rating) && chance(rng, 0.7);
    const muni = pick(rng, MUNICIPALITIES);
    const addrId = makeAddress(muni, { commercial: true });
    const profileId = uuid();
    const ratingBad = ["C+", "C", "C-", "D+", "D", "D-", "F", "NR"].includes(rating);
    const complaintCount = ratingBad ? randInt(rng, 3, 22) : randInt(rng, 0, 4);
    const reviewCount = randInt(rng, 2, 60);
    const reviewAvg = ratingBad ? randFloat(rng, 1.6, 3.4, 1) : randFloat(rng, 3.8, 5, 1);
    const yib = randInt(rng, 2, 38);
    bbbProfiles.push({
      businessReputationProfileId: profileId, companyId, addressId: addrId, provider: "BBB",
      profileUrl: SOURCES.bbb.profileUrl(muni.name, spec.category, slugify(name), i),
      name, normalizedName: normalizeName(name), bbbRating: rating, ratingScore: score,
      isAccredited: accredited, accreditationStatus: accredited ? "Accredited" : "Not Accredited",
      accreditedSince: accredited ? dateBetween(rng, "2009-01-01", "2022-01-01") : null,
      reviewAverageRating: reviewAvg, reviewCount, complaintCount,
      closedComplaintsPastThreeYears: Math.round(complaintCount * randFloat(rng, 0.4, 0.9)),
      unansweredComplaints: ratingBad ? randInt(rng, 0, 4) : 0, yearsInBusiness: yib,
      primaryCategory: spec.category,
      sourceSystem: SOURCES.bbb.system, sourceRecordKey: `bbb:${slugify(name)}-${i}`,
      sourceUrl: SOURCES.bbb.profileUrl(muni.name, spec.category, slugify(name), i), retrievedAt: recentTs(2, 40),
    });
    c.bbbRating = rating; c.score = score; c.complaints = complaintCount; c.profileId = profileId;
    // complaints
    for (let k = 0; k < complaintCount; k++) {
      const cdate = dateBetween(rng, "2021-06-01", BASE);
      const st = weightedPick(rng, COMPLAINT_STATUSES).type;
      bbbComplaints.push({
        businessReputationComplaintId: uuid(), businessReputationProfileId: profileId,
        complaintDate: cdate,
        complaintClosedDate: st === "Unanswered" || st === "Unresolved" ? null : addDays(cdate, randInt(rng, 10, 120)),
        complaintType: pick(rng, COMPLAINT_TYPES), complaintCategory: pick(rng, COMPLAINT_CATEGORIES),
        complaintStatus: st, complaintSummary: pick(rng, COMPLAINT_SUMMARIES),
        sourceSystem: SOURCES.bbb.system, sourceRecordKey: `bbbc:${profileId}:${k}`, retrievedAt: recentTs(2, 40),
      });
    }
    // reviews
    for (let k = 0; k < reviewCount; k++) {
      const positive = rng() < (ratingBad ? 0.35 : 0.85);
      bbbReviews.push({
        businessReputationReviewId: uuid(), businessReputationProfileId: profileId,
        reviewDate: dateBetween(rng, "2021-01-01", BASE),
        reviewRating: positive ? randFloat(rng, 4, 5, 1) : randFloat(rng, 1, 3, 1),
        reviewTitle: positive ? pick(rng, REVIEW_TITLES_POS) : pick(rng, REVIEW_TITLES_NEG),
        reviewText: positive ? pick(rng, REVIEW_TEXT_POS) : pick(rng, REVIEW_TEXT_NEG),
        reviewerDisplayName: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)[0]}.`,
        sourceSystem: SOURCES.bbb.system, sourceRecordKey: `bbbr:${profileId}:${k}`, retrievedAt: recentTs(2, 40),
      });
    }
    // contractor quality score
    const band = score >= 85 ? "Excellent" : score >= 72 ? "Good" : score >= 58 ? "Fair" : score >= 40 ? "Poor" : "At Risk";
    qualityScores.push({
      contractorQualityScoreId: uuid(), companyId, businessReputationProfileId: profileId,
      scoringModel: "oracle-contractor-quality-v1",
      score: Math.max(0, Math.round((score * 0.6 + reviewAvg * 8 - complaintCount * 1.3) * 10) / 10),
      scoreBand: band, matchConfidence: "high",
      factorPayload: { bbbRating: rating, complaintCount, reviewAvg, yearsInBusiness: yib },
      sourceSystem: "oracle-derived", sourceRecordKey: `cqs:${companyId}`, retrievedAt: recentTs(1, 20),
    });
  }
  contractors.push(c);
  for (const t of spec.types) (contractorsByType[t] ||= []).push(c);
}
const generalContractors = contractors.filter((c) => c.category === "General Contractors");
function pickContractor(type: string): Contractor | null {
  const pool = contractorsByType[type] || generalContractors;
  if (!pool.length) return null;
  return pick(rng, pool);
}

/* ───────────── owner pool ───────────── */
console.log("generating owners…");
const portfolioCompanies: string[] = [];
const ownerCompanies: { id: string; name: string }[] = [];
for (let i = 0; i < 200; i++) {
  const kind = BUSINESS_KINDS.find((b) => b.label === "Real Estate Holding")!;
  const name = `${pick(rng, kind.nameStems)} ${pick(rng, kind.nameTails)} ${pick(rng, COMPANY_SUFFIXES)}`;
  const id = uuid();
  companies.push({
    companyId: id, name, normalizedName: normalizeName(name), isOwner: true,
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `owner-co:${slugify(name)}-${i}`, retrievedAt: recentTs(5, 60),
  });
  ownerCompanies.push({ id, name });
  if (i < 16) portfolioCompanies.push(id); // big portfolios
}

/* ───────────── properties / parcels / ownerships / sales ───────────── */
console.log("generating properties…");
interface Prop { propertyId: string; addressId: string; parcelId: string; commercial: boolean; usage: string; muni: string; neighborhood: string; built: number; value: number; strap: string; strapNorm: string; ownerLabel: string; ownerCompanyId?: string; }
const props: Prop[] = [];
const muniFactor: Record<string, number> = { Sanibel: 2.4, "Fort Myers Beach": 2.0, "Bonita Springs": 1.6, Estero: 1.45, "Cape Coral": 1.0, "Fort Myers": 1.15, "North Fort Myers": 0.85, "Lehigh Acres": 0.7 };

// assign portfolio properties first
const portfolioAssignments: Record<string, number> = {};
for (const id of portfolioCompanies) portfolioAssignments[id] = randInt(rng, 9, 26);

for (let i = 0; i < N_PROPERTIES; i++) {
  const muni = pick(rng, MUNICIPALITIES);
  const neighborhood = pick(rng, muni.neighborhoods);
  const commercial = chance(rng, 0.3);
  const usage = commercial ? weightedPick(rng, COMMERCIAL_USAGE).type : weightedPick(rng, RESIDENTIAL_USAGE).type;
  const addressId = makeAddress(muni, { commercial });
  const strap = makeStrap(rng);
  const parcelId = uuid();
  parcels.push({
    parcelId, parcelIdentifier: strap.display, countyName: "Lee", stateCode: "FL", jurisdictionKey: "FL-LEE",
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: strap.normalized,
    sourceUrl: SOURCES.appraisal.parcelUrl(strap.display), retrievedAt: recentTs(5, 60),
  });
  const built = randInt(rng, 1962, 2024);
  const sqft = commercial ? randInt(rng, 1800, 42000) : randInt(rng, 900, 4200);
  const fac = muniFactor[muni.name] ?? 1;
  const base = commercial ? sqft * randInt(rng, 120, 320) : sqft * randInt(rng, 160, 420);
  const value = Math.round((base * fac) / 1000) * 1000 + randInt(rng, 0, 9) * 1000;
  const propertyId = uuid();
  const addr = addresses.find((a) => a.addressId === addressId)!;

  // owner assignment
  let ownerCompanyId: string | undefined;
  let ownerPersonId: string | undefined;
  let ownerLabel = "";
  const usePortfolio = portfolioCompanies.find((id) => (portfolioAssignments[id] || 0) > 0);
  if (usePortfolio && chance(rng, 0.5)) {
    ownerCompanyId = usePortfolio; portfolioAssignments[usePortfolio]!--;
    ownerLabel = ownerCompanies.find((o) => o.id === usePortfolio)!.name;
  } else if ((commercial && chance(rng, 0.7)) || (!commercial && chance(rng, 0.3))) {
    const oc = pick(rng, ownerCompanies); ownerCompanyId = oc.id; ownerLabel = oc.name;
  } else {
    ownerPersonId = makePerson(); ownerLabel = people.find((p) => p.personId === ownerPersonId)!.fullName;
  }

  props.push({ propertyId, addressId, parcelId, commercial, usage, muni: muni.name, neighborhood, built, value, strap: strap.display, strapNorm: strap.normalized, ownerLabel, ownerCompanyId });
  properties.push({
    propertyId, parcelId, addressId, parcelIdentifier: strap.display, propertyType: commercial ? "Commercial" : "Residential",
    propertyUsageType: usage, propertyLegalDescriptionText: `${neighborhood} UNIT ${randInt(rng, 1, 40)} BLK ${randInt(rng, 1, 60)} LOT ${randInt(rng, 1, 40)}`,
    propertyStructureBuiltYear: built, propertyEffectiveBuiltYear: Math.min(2024, built + randInt(rng, 0, 25)),
    livableFloorAreaSqft: sqft, totalAreaSqft: Math.round(sqft * randFloat(rng, 1.1, 1.8)),
    numberOfUnits: usage.includes("Multi") ? randInt(rng, 2, 9) : commercial && chance(rng, 0.4) ? randInt(rng, 2, 12) : 1,
    subdivision: neighborhood, neighborhood: `${muni.name} — ${neighborhood}`, zoning: pick(rng, ZONING),
    latitude: addr.latitude, longitude: addr.longitude, marketValueAmount: value, assessedValueAmount: Math.round(value * randFloat(rng, 0.78, 0.93)),
    openPermitCount: 0, openPermitCategories: 0, permitCount5y: 0, majorRenovationCount: 0, improvementScore: 0,
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: strap.normalized, sourceUrl: SOURCES.appraisal.parcelUrl(strap.display),
    retrievedAt: recentTs(5, 60), sourcePayload: { useCode: usage, folio: strap.normalized },
  });

  // current ownership
  const acquired = dateBetween(rng, "2004-01-01", "2025-10-01");
  ownerships.push({
    ownershipId: uuid(), propertyId, ownerPersonId: ownerPersonId ?? null, ownerCompanyId: ownerCompanyId ?? null,
    ownedBy: ownerCompanyId ? "company" : "person", ownershipPercentage: 100, ownerOccupiedIndicator: !commercial && !ownerCompanyId && chance(rng, 0.6),
    dateAcquired: acquired, dateSold: null, isCurrent: true,
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `own:${propertyId}:cur`, retrievedAt: recentTs(5, 60),
  });
  // current purchase sale
  salesHistories.push({
    salesHistoryId: uuid(), propertyId, ownershipTransferDate: acquired,
    purchasePriceAmount: Math.round(value * randFloat(rng, 0.55, 1.05)), saleType: pick(rng, SALE_TYPES),
    deedBook: String(randInt(rng, 2000, 4200)), deedPage: String(randInt(rng, 1, 4000)),
    instrumentNumber: `${randInt(rng, 2004, 2025)}${String(randInt(rng, 1, 9999999)).padStart(7, "0")}`,
    sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `sale:${propertyId}:cur`, retrievedAt: recentTs(5, 60),
  });
  // prior ownership(s) → ownership changes
  const priorCount = chance(rng, 0.4) ? randInt(rng, 1, 2) : 0;
  let lastDate = acquired;
  for (let p = 0; p < priorCount; p++) {
    const sold = lastDate;
    const acq = dateBetween(rng, "1996-01-01", addDays(sold, -200));
    const priorPerson = makePerson();
    ownerships.push({
      ownershipId: uuid(), propertyId, ownerPersonId: priorPerson, ownerCompanyId: null, ownedBy: "person",
      ownershipPercentage: 100, ownerOccupiedIndicator: false, dateAcquired: acq, dateSold: sold, isCurrent: false,
      sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `own:${propertyId}:p${p}`, retrievedAt: recentTs(5, 60),
    });
    salesHistories.push({
      salesHistoryId: uuid(), propertyId, ownershipTransferDate: sold,
      purchasePriceAmount: Math.round(value * randFloat(rng, 0.35, 0.8)), saleType: pick(rng, SALE_TYPES),
      deedBook: String(randInt(rng, 1800, 3900)), deedPage: String(randInt(rng, 1, 4000)),
      instrumentNumber: `${sold.slice(0, 4)}${String(randInt(rng, 1, 9999999)).padStart(7, "0")}`,
      sourceSystem: SOURCES.appraisal.system, sourceRecordKey: `sale:${propertyId}:p${p}`, retrievedAt: recentTs(5, 60),
    });
    lastDate = acq;
  }
}
const recentlySold = new Set(
  props.filter((p) => {
    const cur = ownerships.find((o) => o.propertyId === p.propertyId && o.isCurrent);
    return cur && cur.dateAcquired >= "2023-06-01";
  }).map((p) => p.propertyId),
);

/* ───────────── permits ───────────── */
console.log("generating permits…");
const propRollup: Record<string, { open: number; openCats: Set<string>; cnt5y: number; major: number; score: number; contractors: Set<string>; openTypes: Set<string> }> = {};
for (const p of props) propRollup[p.propertyId] = { open: 0, openCats: new Set(), cnt5y: 0, major: 0, score: 0, contractors: new Set(), openTypes: new Set() };

let permitSeq = 1000;
function makePermit(prop: Prop, opts?: { forceType?: string; forceOpen?: boolean; forceMajor?: boolean }) {
  const pt = opts?.forceType ? PERMIT_TYPES.find((t) => t.type === opts.forceType)! : weightedPick(rng, PERMIT_TYPES);
  const commRes = prop.commercial ? (chance(rng, 0.85) ? "Commercial" : "Residential") : (chance(rng, pt.commercialBias) ? "Commercial" : "Residential");
  const appDate = dateBetween(rng, "2017-02-01", BASE);
  const issue = addDays(appDate, randInt(rng, 3, 60));
  const isOpen = opts?.forceOpen ?? (appDate >= "2024-06-01" ? chance(rng, 0.42) : chance(rng, 0.05));
  const id = uuid();
  const year = issue.slice(0, 4);
  const permitNumber = `${pt.prefix}${year}-${String(permitSeq++).padStart(5, "0")}`;
  const value = randInt(rng, pt.valueLo, pt.valueHi);
  const isMajor = (opts?.forceMajor ?? (pt.canBeMajor && !isOpen && value > (pt.valueLo + pt.valueHi) / 2 && chance(rng, 0.55)));
  const contractor = chance(rng, 0.88) ? pickContractor(pt.type) : null;
  let status: string, sourceStatus: string, closeDate: string | null = null, completion: string | null = null, finalInsp: string | null = null;
  if (isOpen) { status = "Open"; sourceStatus = pick(rng, OPEN_STATUSES); }
  else if (chance(rng, 0.92)) { status = "Closed"; sourceStatus = pick(rng, CLOSED_STATUSES); closeDate = addDays(issue, randInt(rng, 20, 420)); completion = closeDate; finalInsp = addDays(closeDate, -randInt(rng, 1, 20)); }
  else { status = "Terminal"; sourceStatus = pick(rng, TERMINAL_OTHER); }
  improvements.push({
    propertyImprovementId: id, propertyId: prop.propertyId, parcelId: prop.parcelId, addressId: prop.addressId,
    contractorCompanyId: contractor?.companyId ?? null, permitNumber, improvementType: pt.type, improvementStatus: status,
    sourceStatus, recordStatus: sourceStatus, commRes, applicationReceivedDate: appDate, permitIssueDate: issue,
    finalInspectionDate: finalInsp, permitCloseDate: closeDate, completionDate: completion,
    expirationDate: addDays(issue, 180), isOwnerBuilder: !contractor, isMajorRenovation: isMajor, isOpen,
    fee: randInt(rng, pt.feeLo, pt.feeHi), estimatedJobValue: value,
    projectDescription: pick(rng, pt.descriptions), applicant: prop.ownerLabel,
    licensedProfessional: contractor?.name ?? null, workLocation: addresses.find((a) => a.addressId === prop.addressId)!.unnormalizedAddress,
    parcelIdentifier: prop.strap, sourceSystem: SOURCES.permits.system, sourceRecordKey: permitNumber,
    sourceUrl: SOURCES.permits.permitUrl(permitNumber), retrievedAt: recentTs(1, 30),
    sourcePayload: { module: "Permitting", recordType: `${pt.type} Permit`, accelaStatus: sourceStatus },
  });
  // rollups
  const r = propRollup[prop.propertyId];
  if (isOpen) { r.open++; r.openCats.add(pt.type); r.openTypes.add(pt.type); }
  if (issue >= addDays(BASE, -365 * 5)) r.cnt5y++;
  if (isMajor) r.major++;
  r.score += isMajor ? 22 : isOpen ? 7 : 3;
  if (contractor) { r.contractors.add(contractor.companyId); contractor.permitCount++; contractor.typeCounts[pt.type] = (contractor.typeCounts[pt.type] || 0) + 1; }
  // inspections for ~35%
  if (!isOpen && chance(rng, 0.35)) {
    const n = randInt(rng, 1, 3);
    for (let k = 0; k < n; k++) {
      const sched = addDays(issue, randInt(rng, 5, 200));
      inspections.push({
        inspectionId: uuid(), propertyImprovementId: id, inspectionType: pick(rng, INSPECTION_TYPES),
        result: weightedPick(rng, INSPECTION_RESULTS).type, scheduledDate: sched, completedDate: addDays(sched, randInt(rng, 0, 5)),
        inspectorName: `Insp. ${pick(rng, LAST_NAMES)}`, sourceSystem: SOURCES.permits.system, sourceRecordKey: `insp:${id}:${k}`, retrievedAt: recentTs(1, 30),
      });
    }
  }
  // contractor contact
  if (contractor) {
    permitContacts.push({
      permitContactId: uuid(), propertyImprovementId: id, contactRole: "Contractor", companyId: contractor.companyId, personId: null,
      rawName: contractor.name, licenseNumber: `${CONTRACTOR_SPECIALTIES.find((s) => s.category === contractor.category)?.license || "CGC"}${randInt(rng, 1000000, 1599999)}`,
      licenseType: contractor.category, sourceSystem: SOURCES.permits.system, sourceRecordKey: `pc:${id}`, retrievedAt: recentTs(1, 30),
    });
  } else {
    permitContacts.push({
      permitContactId: uuid(), propertyImprovementId: id, contactRole: pick(rng, CONTACT_ROLES.slice(1)), companyId: null, personId: null,
      rawName: prop.ownerLabel, sourceSystem: SOURCES.permits.system, sourceRecordKey: `pc:${id}`, retrievedAt: recentTs(1, 30),
    });
  }
  return id;
}
// natural permits
for (const prop of props) {
  const n = prop.commercial ? randInt(rng, 3, 16) : randInt(rng, 1, 9);
  for (let k = 0; k < n; k++) makePermit(prop);
}
// guarantee demo inquiries: hot properties with multiple open permits across categories
const hotProps = shuffle(rng, [...props]).slice(0, 90);
for (const prop of hotProps) {
  const cats = shuffle(rng, ["Roofing", "Electrical", "Plumbing", "HVAC / Mechanical", "Structural / Building", "Concrete"]).slice(0, randInt(rng, 2, 4));
  for (const t of cats) makePermit(prop, { forceType: t, forceOpen: true });
}
// guarantee open roofing & open electrical breadth
for (const prop of shuffle(rng, [...props]).slice(0, 70)) makePermit(prop, { forceType: "Roofing", forceOpen: true });
for (const prop of shuffle(rng, [...props]).slice(0, 70)) makePermit(prop, { forceType: "Electrical", forceOpen: true });
// guarantee major renovations across categories
for (const t of ["Concrete", "Roofing", "Electrical", "Plumbing", "HVAC / Mechanical", "Structural / Building"]) {
  for (const prop of shuffle(rng, [...props]).slice(0, 45)) makePermit(prop, { forceType: t, forceMajor: true });
}

// apply rollups to properties
for (const p of properties) {
  const r = propRollup[p.propertyId];
  p.openPermitCount = r.open;
  p.openPermitCategories = r.openCats.size;
  p.permitCount5y = r.cnt5y;
  p.majorRenovationCount = r.major;
  p.improvementScore = Math.min(100, r.score);
}

/* ───────────── businesses (sunbiz) + occupancies (tenants) ───────────── */
console.log("generating businesses + occupancies…");
const commercialProps = props.filter((p) => p.commercial);
interface Biz { companyId: string; name: string; kind: string; occupancies: number; }
const businesses: Biz[] = [];
for (let i = 0; i < N_BUSINESSES; i++) {
  const kind = weightedPick(rng, BUSINESS_KINDS);
  const name = `${pick(rng, kind.nameStems)} ${pick(rng, kind.nameTails)}${chance(rng, 0.6) ? " " + pick(rng, COMPANY_SUFFIXES) : ""}`;
  const companyId = uuid();
  companies.push({
    companyId, name, normalizedName: normalizeName(name), isTenant: true,
    sourceSystem: SOURCES.sunbiz.system, sourceRecordKey: `biz:${slugify(name)}-${i}`, retrievedAt: recentTs(5, 90),
  });
  const filing = weightedPick(rng, SUNBIZ_FILING_TYPES);
  const status = weightedPick(rng, SUNBIZ_STATUSES).type;
  const docNum = `${filing.code}${randInt(rng, 2008, 2025)}${String(randInt(rng, 1, 9999999)).padStart(7, "0")}`;
  const muni = pick(rng, MUNICIPALITIES);
  const principalAddr = makeAddress(muni, { commercial: true });
  const brId = uuid();
  const filed = dateBetween(rng, "2008-01-01", "2025-06-01");
  businessRegistrations.push({
    businessRegistrationId: brId, companyId, documentNumber: docNum, entityName: name.toUpperCase(), status,
    filingType: filing.type, filedDate: filed, feiNumber: `${randInt(rng, 20, 99)}-${randInt(rng, 1000000, 9999999)}`,
    principalAddressId: principalAddr, lastTransactionDate: dateBetween(rng, filed, BASE),
    sourceSystem: SOURCES.sunbiz.system, sourceRecordKey: docNum, sourceUrl: SOURCES.sunbiz.docUrl(docNum), retrievedAt: recentTs(5, 90),
    sourcePayload: { documentNumber: docNum, filingTypeCode: filing.code },
  });
  // parties: registered agent + officers
  const partyN = randInt(rng, 1, 3);
  for (let k = 0; k < partyN; k++) {
    const pid = makePerson();
    businessParties.push({
      businessRegistrationPartyId: uuid(), businessRegistrationId: brId, partyPersonId: pid,
      partyRole: k === 0 ? "Registered Agent" : pick(rng, SUNBIZ_PARTY_ROLES.slice(1)),
      name: people.find((pp) => pp.personId === pid)!.fullName, title: k === 0 ? "RA" : pick(rng, ["MGR", "MGRM", "PRES", "VP", "DIR"]),
      sourceSystem: SOURCES.sunbiz.system, sourceRecordKey: `brp:${brId}:${k}`, retrievedAt: recentTs(5, 90),
    });
  }
  // occupancies: how many properties this business occupies (most 1, some chains)
  const r = rng();
  const locCount = r < 0.78 ? 1 : r < 0.93 ? randInt(rng, 2, 3) : randInt(rng, 3, 6);
  const targets = shuffle(rng, commercialProps.filter((p) => kind.usageTypes.includes(p.usage)));
  const chosen = targets.slice(0, locCount);
  businesses.push({ companyId, name, kind: kind.label, occupancies: chosen.length });
  for (const prop of chosen.length ? chosen : [pick(rng, commercialProps)]) {
    const start = dateBetween(rng, "2016-01-01", "2025-09-01");
    const ended = chance(rng, 0.25);
    occupancies.push({
      occupancyId: uuid(), businessCompanyId: companyId, propertyId: prop.propertyId, addressId: prop.addressId,
      occupancyType: "tenant", spaceName: chance(rng, 0.5) ? `Suite ${randInt(rng, 100, 480)}` : null,
      startDate: start, endDate: ended ? addDays(start, randInt(rng, 400, 2400)) : null, isCurrent: !ended,
      sourceSystem: SOURCES.occupancy.system, sourceRecordKey: `occ:${companyId}:${prop.propertyId}`,
      sourcePayload: { matchMethod: "normalized_address_key", confidence: "high", basis: "Sunbiz principal/mailing ↔ parcel situs" }, retrievedAt: recentTs(2, 40),
    });
  }
}
// ensure business turnover on a set of commercial props (≥2 occupancy records, one ended)
for (const prop of shuffle(rng, commercialProps).slice(0, 80)) {
  const past = pick(rng, businesses);
  const start = dateBetween(rng, "2015-01-01", "2021-01-01");
  occupancies.push({
    occupancyId: uuid(), businessCompanyId: past.companyId, propertyId: prop.propertyId, addressId: prop.addressId,
    occupancyType: "tenant", spaceName: `Suite ${randInt(rng, 100, 480)}`, startDate: start,
    endDate: addDays(start, randInt(rng, 500, 1800)), isCurrent: false,
    sourceSystem: SOURCES.occupancy.system, sourceRecordKey: `occ:turn:${prop.propertyId}:${past.companyId}`,
    sourcePayload: { matchMethod: "normalized_address_key", confidence: "medium", basis: "historical Sunbiz filing at address" }, retrievedAt: recentTs(2, 40),
  });
}

console.log(
  `built: ${properties.length} properties, ${improvements.length} permits, ${companies.length} companies, ` +
  `${contractors.length} contractors, ${businesses.length} businesses, ${occupancies.length} occupancies, ${people.length} people`,
);

export { addresses, parcels, people, companies, properties, ownerships, salesHistories, improvements, inspections, permitContacts, businessRegistrations, businessParties, bbbProfiles, bbbComplaints, bbbReviews, qualityScores, occupancies, props, contractors, businesses, propRollup, recentlySold };
