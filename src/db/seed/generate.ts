import { Rng, SEED, deterministicUuid } from "./rng";
import {
  BBB_RATINGS,
  BUSINESS_KINDS,
  CATEGORY_KEY_TO_TRADE,
  COMPANY_STEMS,
  COMPANY_SUFFIXES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  CONTRACTOR_TRADES,
  COUNTY,
  DOR_USE_CODES,
  FIRST_NAMES,
  LAST_NAMES,
  MUNICIPALITIES,
  NEGATIVE_BBB_RATINGS,
  NEIGHBORHOODS,
  PERMIT_CATEGORIES,
  REVIEW_NEGATIVE,
  REVIEW_POSITIVE,
  STREET_NAMES,
  STREET_SUFFIXES,
  SUNBIZ_FILING_TYPES,
  SUNBIZ_STATUS,
  TRADE_TO_CATEGORY_KEYS,
  normalizeName,
  normalizedAddressHash,
  strap,
  type PermitCategory,
} from "./vocab";
import {
  accelaPermitUrl,
  bbbProfileUrl,
  leepaParcelUrl,
  sunbizUrl,
} from "./url-builders";
import { classifyTrades, isMajorRenovation } from "@/lib/renovation";
import type {
  NewAddress,
  NewBusinessRegistration,
  NewBusinessRegistrationAddress,
  NewBusinessRegistrationParty,
  NewBusinessReputationComplaint,
  NewBusinessReputationComplaintEvent,
  NewBusinessReputationProfile,
  NewBusinessReputationReview,
  NewCompany,
  NewContractorQualityScore,
  NewOccupancy,
  NewOwnership,
  NewParcel,
  NewPermitContact,
  NewPerson,
  NewProject,
  NewProjectContractor,
  NewProjectPermit,
  NewProperty,
  NewPropertyImprovement,
  NewPropertySignalRollup,
  NewPropertyValuation,
  NewPublicRecord,
  NewSalesHistory,
  NewTax,
  NewTenant,
} from "@/db/schema/types";

export const VOLUMES = {
  properties: 2500,
  permits: 16000,
  contractors: 250,
  businesses: 600,
  occupancies: 1000,
  complaints: 1000,
  reviews: 6500,
  ragDocuments: 3500,
} as const;

const GENERATED_CONTRACTORS = 340;

export const FORCE = {
  hotPropertiesMultiOpen: 90,
  openRoofing: 70,
  openElectrical: 70,
  majorRenovations: 45,
  commercialTurnover: 80,
  multiLocationBusinesses: 30,
  multiLocationTenants: 30,
} as const;

export type GeneratedGraph = {
  people: NewPerson[];
  companies: NewCompany[];
  addresses: NewAddress[];
  parcels: NewParcel[];
  properties: NewProperty[];
  ownerships: NewOwnership[];
  taxes: NewTax[];
  salesHistories: NewSalesHistory[];
  propertyValuations: NewPropertyValuation[];
  propertyImprovements: NewPropertyImprovement[];
  permitContacts: NewPermitContact[];
  businessRegistrations: NewBusinessRegistration[];
  businessRegistrationParties: NewBusinessRegistrationParty[];
  businessRegistrationAddresses: NewBusinessRegistrationAddress[];
  businessReputationProfiles: NewBusinessReputationProfile[];
  businessReputationReviews: NewBusinessReputationReview[];
  businessReputationComplaints: NewBusinessReputationComplaint[];
  businessReputationComplaintEvents: NewBusinessReputationComplaintEvent[];
  contractorQualityScores: NewContractorQualityScore[];
  tenants: NewTenant[];
  occupancies: NewOccupancy[];
  projects: NewProject[];
  projectPermits: NewProjectPermit[];
  projectContractors: NewProjectContractor[];
  rollups: NewPropertySignalRollup[];
  publicRecords: NewPublicRecord[];
};

function emptyGraph(): GeneratedGraph {
  return {
    people: [],
    companies: [],
    addresses: [],
    parcels: [],
    properties: [],
    ownerships: [],
    taxes: [],
    salesHistories: [],
    propertyValuations: [],
    propertyImprovements: [],
    permitContacts: [],
    businessRegistrations: [],
    businessRegistrationParties: [],
    businessRegistrationAddresses: [],
    businessReputationProfiles: [],
    businessReputationReviews: [],
    businessReputationComplaints: [],
    businessReputationComplaintEvents: [],
    contractorQualityScores: [],
    tenants: [],
    occupancies: [],
    projects: [],
    projectPermits: [],
    projectContractors: [],
    rollups: [],
    publicRecords: [],
  };
}

function publicRecord(
  rng: Rng,
  args: {
    entityType: string;
    entityId: string;
    sourceSystem: string;
    sourceRecordKey: string;
    sourceUrl: string;
  },
): NewPublicRecord {
  const collectedDays = -rng.int(1, 120);
  const refreshedDays = -rng.int(0, 30);
  return {
    publicRecordId: deterministicUuid(rng),
    entityType: args.entityType,
    entityId: args.entityId,
    sourceUrl: args.sourceUrl,
    collectionTimestamp: new Date(`${rng.dateOffset(collectedDays)}T12:00:00Z`),
    refreshTimestamp: new Date(`${rng.dateOffset(refreshedDays)}T12:00:00Z`),
    lineage: {
      synthetic: true,
      pipeline: "oracle-node@synthetic",
      lexicon: "@elephant-xyz/query-db",
      sourceSystem: args.sourceSystem,
      sourceRecordKey: args.sourceRecordKey,
    },
    sourceSystem: args.sourceSystem,
    sourceRecordKey: `pubrec:${args.entityType}:${args.entityId}`,
    sourceArtifactUri: args.sourceUrl,
  };
}

type MakePermitOpts = {
  forceCategory?: PermitCategory;
  forceOpen?: boolean;
  forceMajor?: boolean;
  forceClosed?: boolean;
};

function pickCategoryForTrade(rng: Rng, trade: string): PermitCategory | undefined {
  const keys = TRADE_TO_CATEGORY_KEYS[trade];
  if (!keys || keys.length === 0) return undefined;
  const key = rng.pick(keys);
  return PERMIT_CATEGORIES.find((c) => c.key === key);
}

function makePermit(
  rng: Rng,
  ctx: {
    property: NewProperty;
    parcel: NewParcel;
    contractor: NewCompany;
    contractorTrade: string;
    commercial: boolean;
  },
  opts: MakePermitOpts = {},
): NewPropertyImprovement {
  const category =
    opts.forceCategory ??
    pickCategoryForTrade(rng, ctx.contractorTrade) ??
    rng.pick(PERMIT_CATEGORIES);

  const open = opts.forceClosed ? false : opts.forceOpen ?? rng.bool(0.28);
  let value = rng.int(category.valueLo, category.valueHi);
  if (opts.forceMajor) value = Math.max(value, 75_000);

  const description = rng.pick(category.descriptions);
  const issueDays = -rng.int(30, 5 * 365);
  const permitNumber = `${category.prefix}-${rng.int(100000, 999999)}`;
  const improvementId = deterministicUuid(rng);

  const status = open ? "open" : "closed";
  const sourceStatus = open ? rng.pick(["Issued", "In Review", "Active"]) : "Finaled";

  return {
    propertyImprovementId: improvementId,
    propertyId: ctx.property.propertyId,
    parcelId: ctx.parcel.parcelId,
    parcelIdentifier: ctx.property.parcelIdentifier,
    contractorCompanyId: ctx.contractor.companyId,
    permitNumber,
    improvementType: category.key,
    improvementStatus: status,
    sourceStatus,
    recordStatus: sourceStatus,
    contractorType: ctx.contractorTrade,
    commRes: ctx.commercial ? "Commercial" : "Residential",
    volts: category.key === "electrical" ? rng.pick(["120", "240", "480"]) : null,
    projectDescription: description,
    description,
    estimatedJobValue: String(value),
    fee: String(rng.int(category.feeLo, category.feeHi)),
    applicationReceivedDate: rng.dateOffset(issueDays - rng.int(5, 30)),
    permitIssueDate: rng.dateOffset(issueDays),
    permitCloseDate: open ? null : rng.dateOffset(issueDays + rng.int(20, 200)),
    completionDate: open ? null : rng.dateOffset(issueDays + rng.int(20, 200)),
    subdivision: ctx.property.subdivision,
    source: "lee_accela",
    sourceUrl: accelaPermitUrl(permitNumber),
    propertyMatchMethod: "parcel_identifier",
    propertyMatchConfidence: "1.0",
    sourceSystem: "lee_accela",
    sourceRecordKey: `accela:permit:${improvementId}`,
    sourceArtifactUri: accelaPermitUrl(permitNumber),
  };
}

function makeContractorCompany(rng: Rng, trade: string): NewCompany {
  const name = `${rng.pick(COMPANY_STEMS)} ${trade} ${rng.pick(COMPANY_SUFFIXES)}`;
  const companyId = deterministicUuid(rng);
  return {
    companyId,
    name,
    normalizedName: normalizeName(name),
    sourceSystem: "bbb",
    sourceRecordKey: `bbb:company:${companyId}`,
  };
}

function scoreForRating(rating: string): number {
  const idx = BBB_RATINGS.indexOf(rating as (typeof BBB_RATINGS)[number]);
  if (idx < 0) return 0;
  return Math.round((idx / (BBB_RATINGS.length - 1)) * 100);
}

function makeReputationProfile(
  rng: Rng,
  company: NewCompany,
  rating: string,
): {
  profile: NewBusinessReputationProfile;
  reviews: NewBusinessReputationReview[];
  complaints: NewBusinessReputationComplaint[];
  complaintEvents: NewBusinessReputationComplaintEvent[];
  qualityScore: NewContractorQualityScore;
} {
  const profileId = deterministicUuid(rng);
  const negative = (NEGATIVE_BBB_RATINGS as readonly string[]).includes(rating);
  const complaintCount = negative ? rng.int(3, 12) : rng.int(0, 3);
  const reviewCount = negative ? rng.int(3, 16) : rng.int(12, 44);
  const avgRating = negative ? 1 + rng.float() * 2 : 3.5 + rng.float() * 1.5;
  const slug = normalizeName(company.name ?? "contractor").replace(/ /g, "-");

  const profile: NewBusinessReputationProfile = {
    businessReputationProfileId: profileId,
    companyId: company.companyId,
    provider: "BBB",
    profileUrl: bbbProfileUrl(slug),
    profileSlug: slug,
    name: company.name,
    normalizedName: company.normalizedName,
    bbbRating: rating,
    ratingScore: String(scoreForRating(rating)),
    isAccredited: !negative && rng.bool(0.6),
    reviewAverageRating: avgRating.toFixed(2),
    reviewCount,
    complaintCount,
    closedComplaintsPastThreeYears: complaintCount,
    closedComplaintsPastTwelveMonths: Math.floor(complaintCount / 2),
    sourceSystem: "bbb",
    sourceRecordKey: `bbb:profile:${profileId}`,
    sourceArtifactUri: bbbProfileUrl(slug),
  };

  const reviews: NewBusinessReputationReview[] = [];
  for (let i = 0; i < reviewCount; i++) {
    const positive = !negative ? rng.bool(0.8) : rng.bool(0.25);
    const id = deterministicUuid(rng);
    reviews.push({
      businessReputationReviewId: id,
      businessReputationProfileId: profileId,
      reviewRating: String(positive ? rng.int(4, 5) : rng.int(1, 2)),
      reviewText: positive ? rng.pick(REVIEW_POSITIVE) : rng.pick(REVIEW_NEGATIVE),
      reviewDate: rng.dateOffset(-rng.int(1, 1000)),
      reviewerDisplayName: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)[0]}.`,
      sourceSystem: "bbb",
      sourceRecordKey: `bbb:review:${id}`,
    });
  }

  const complaints: NewBusinessReputationComplaint[] = [];
  const complaintEvents: NewBusinessReputationComplaintEvent[] = [];
  for (let i = 0; i < complaintCount; i++) {
    const cid = deterministicUuid(rng);
    const cDate = rng.dateOffset(-rng.int(1, 1000));
    complaints.push({
      businessReputationComplaintId: cid,
      businessReputationProfileId: profileId,
      complaintCategory: rng.pick(COMPLAINT_CATEGORIES),
      complaintStatus: rng.pick(COMPLAINT_STATUSES),
      complaintDate: cDate,
      complaintSummary: "Customer reported an issue with service delivery.",
      sourceSystem: "bbb",
      sourceRecordKey: `bbb:complaint:${cid}`,
    });
    const events = rng.int(1, 2);
    for (let e = 0; e < events; e++) {
      const eid = deterministicUuid(rng);
      complaintEvents.push({
        businessReputationComplaintEventId: eid,
        businessReputationComplaintId: cid,
        eventType: e === 0 ? "filed" : "responded",
        eventDate: cDate,
        sourceSystem: "bbb",
        sourceRecordKey: `bbb:complaint_event:${eid}`,
      });
    }
  }

  const scoreBand = negative ? "low" : avgRating >= 4 ? "high" : "medium";
  const qualityScore: NewContractorQualityScore = {
    contractorQualityScoreId: deterministicUuid(rng),
    companyId: company.companyId,
    businessReputationProfileId: profileId,
    scoringModel: "oracle.contractor_quality.v1",
    score: String(
      Math.round((negative ? 20 + rng.float() * 40 : 60 + rng.float() * 40) * 100) / 100,
    ),
    scoreBand,
    matchMethod: "normalized_name",
    matchConfidence: "0.97",
    factorPayload: {
      bbbRating: rating,
      complaintCount,
      reviewAverageRating: Number(avgRating.toFixed(2)),
    },
    sourceSystem: "oracle",
    sourceRecordKey: `oracle:quality:${company.companyId}`,
  };

  return { profile, reviews, complaints, complaintEvents, qualityScore };
}

export function generate(seed: number = SEED): GeneratedGraph {
  const rng = new Rng(seed);
  const graph = emptyGraph();

  const contractors: { company: NewCompany; trade: string; negative: boolean }[] = [];
  for (let i = 0; i < GENERATED_CONTRACTORS; i++) {
    const trade = rng.pick(CONTRACTOR_TRADES);
    const company = makeContractorCompany(rng, trade);
    graph.companies.push(company);

    const negative = rng.bool(0.28);
    const rating = negative
      ? rng.pick(NEGATIVE_BBB_RATINGS)
      : rng.pick(["A+", "A", "A-", "B+", "B"] as const);
    const rep = makeReputationProfile(rng, company, rating);
    graph.businessReputationProfiles.push(rep.profile);
    graph.businessReputationReviews.push(...rep.reviews);
    graph.businessReputationComplaints.push(...rep.complaints);
    graph.businessReputationComplaintEvents.push(...rep.complaintEvents);
    graph.contractorQualityScores.push(rep.qualityScore);
    graph.publicRecords.push(
      publicRecord(rng, {
        entityType: "contractor",
        entityId: company.companyId!,
        sourceSystem: "bbb",
        sourceRecordKey: rep.profile.sourceRecordKey,
        sourceUrl: rep.profile.profileUrl!,
      }),
    );
    contractors.push({ company, trade, negative });
  }

  const PORTFOLIO_OWNER_COUNT = 16;
  const portfolioOwners: NewCompany[] = [];
  for (let i = 0; i < PORTFOLIO_OWNER_COUNT; i++) {
    const name = `${rng.pick(COMPANY_STEMS)} ${rng.pick([
      "Holdings",
      "Capital",
      "Property Group",
      "Investments",
    ])} ${rng.pick(COMPANY_SUFFIXES)}`;
    const companyId = deterministicUuid(rng);
    const company: NewCompany = {
      companyId,
      name,
      normalizedName: normalizeName(name),
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:owner_company:${companyId}`,
    };
    graph.companies.push(company);
    portfolioOwners.push(company);
  }
  const portfolioCapacity = portfolioOwners.map(() => rng.int(9, 26));

  type PropEntry = {
    property: NewProperty;
    parcel: NewParcel;
    municipality: (typeof MUNICIPALITIES)[number];
    commercial: boolean;
    ownerCompanyId?: string;
  };
  const props: PropEntry[] = [];

  for (let i = 0; i < VOLUMES.properties; i++) {
    const muni = rng.pick(MUNICIPALITIES);
    const dor = rng.pick(DOR_USE_CODES);
    const commercial = dor.commercial;
    const subdivision = rng.pick(NEIGHBORHOODS);
    const zip = rng.pick(muni.zips);

    const strapParts = {
      township: rng.int(43, 46),
      range: rng.int(23, 26),
      section: rng.int(1, 36),
      block: String(rng.int(0, 9999)).padStart(4, "0"),
      parcel: String(rng.int(0, 9999)).padStart(4, "0"),
    };
    const { formatted: parcelIdentifier, normalized } = strap(strapParts);

    const parcelId = deterministicUuid(rng);
    const propertyId = deterministicUuid(rng);
    const addressId = deterministicUuid(rng);

    const streetNumber = String(rng.int(100, 9999));
    const streetName = `${rng.pick(STREET_NAMES)} ${rng.pick(STREET_SUFFIXES)}`;

    const address: NewAddress = {
      addressId,
      streetNumber,
      streetName,
      cityName: muni.name,
      municipalityName: muni.name,
      countyName: COUNTY.name,
      stateCode: COUNTY.stateCode,
      postalCode: zip,
      normalizedAddressKey: normalizeName(`${streetNumber} ${streetName} ${muni.name} ${zip}`),
      normalizedAddressHash: normalizedAddressHash({
        streetNumber,
        streetName,
        city: muni.name,
        postalCode: zip,
      }),
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:address:${addressId}`,
    };
    graph.addresses.push(address);

    const parcel: NewParcel = {
      parcelId,
      parcelIdentifier,
      countyName: COUNTY.name,
      stateCode: COUNTY.stateCode,
      jurisdictionKey: COUNTY.jurisdictionKey,
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:parcel:${normalized}`,
      sourceArtifactUri: leepaParcelUrl(normalized),
    };
    graph.parcels.push(parcel);

    const builtYear = rng.int(1965, 2023);
    const property: NewProperty = {
      propertyId,
      parcelId,
      addressId,
      parcelIdentifier,
      propertyType: commercial ? "commercial" : "single_family",
      propertyUsageType: dor.usageType,
      propertyStructureBuiltYear: builtYear,
      subdivision,
      zoning: commercial ? "C-1" : "RS-1",
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:property:${normalized}`,
      sourceArtifactUri: leepaParcelUrl(normalized),
    };
    graph.properties.push(property);
    graph.publicRecords.push(
      publicRecord(rng, {
        entityType: "property",
        entityId: propertyId,
        sourceSystem: "leepa",
        sourceRecordKey: property.sourceRecordKey,
        sourceUrl: leepaParcelUrl(normalized),
      }),
    );

    let ownerCompanyId: string | undefined;
    const wantPortfolio = rng.bool(0.32);
    const availIdx = wantPortfolio ? portfolioCapacity.findIndex((c) => c > 0) : -1;
    if (availIdx >= 0) {
      const owner = portfolioOwners[availIdx]!;
      portfolioCapacity[availIdx]!--;
      ownerCompanyId = owner.companyId;
      graph.ownerships.push({
        ownershipId: deterministicUuid(rng),
        propertyId,
        ownerCompanyId,
        ownershipPercentage: "100",
        dateAcquired: rng.dateOffset(-rng.int(200, 5000)),
        sourceSystem: "leepa",
        sourceRecordKey: `leepa:ownership:${propertyId}`,
      });
    } else {
      const personId = deterministicUuid(rng);
      const first = rng.pick(FIRST_NAMES);
      const last = rng.pick(LAST_NAMES);
      const fullName = `${first} ${last}`;
      graph.people.push({
        personId,
        firstName: first,
        lastName: last,
        fullName,
        normalizedName: normalizeName(fullName),
        sourceSystem: "leepa",
        sourceRecordKey: `leepa:person:${personId}`,
      });
      graph.ownerships.push({
        ownershipId: deterministicUuid(rng),
        propertyId,
        ownerPersonId: personId,
        ownerOccupiedIndicator: !commercial && rng.bool(0.7),
        ownershipPercentage: "100",
        dateAcquired: rng.dateOffset(-rng.int(200, 5000)),
        sourceSystem: "leepa",
        sourceRecordKey: `leepa:ownership:${propertyId}`,
      });
    }

    const marketBase = Math.round(
      (commercial ? rng.int(300_000, 4_000_000) : rng.int(180_000, 1_200_000)) *
        muni.priceMultiplier,
    );
    graph.taxes.push({
      taxId: deterministicUuid(rng),
      propertyId,
      taxYear: 2025,
      propertyMarketValueAmount: String(marketBase),
      propertyAssessedValueAmount: String(Math.round(marketBase * 0.85)),
      propertyTaxableValueAmount: String(Math.round(marketBase * 0.8)),
      yearlyTaxAmount: String(Math.round(marketBase * 0.0125)),
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:tax:${propertyId}:2025`,
    });
    graph.propertyValuations.push({
      propertyValuationId: deterministicUuid(rng),
      propertyId,
      valuationDate: rng.dateOffset(-rng.int(1, 365)),
      valuationMethodType: "avm",
      currentAvmValue: String(marketBase),
      highValue: String(Math.round(marketBase * 1.08)),
      lowValue: String(Math.round(marketBase * 0.92)),
      sourceSystem: "leepa",
      sourceRecordKey: `leepa:valuation:${propertyId}`,
    });
    const ownershipChanges = rng.bool(0.4) ? rng.int(1, 3) : 0;
    for (let s = 0; s < ownershipChanges; s++) {
      graph.salesHistories.push({
        salesHistoryId: deterministicUuid(rng),
        propertyId,
        ownershipTransferDate: rng.dateOffset(-rng.int(365, 6000)),
        purchasePriceAmount: String(Math.round(marketBase * (0.6 + rng.float() * 0.5))),
        saleType: rng.pick(["warranty_deed", "quit_claim", "special_warranty"]),
        sourceSystem: "leepa",
        sourceRecordKey: `leepa:sale:${propertyId}:${s}`,
      });
    }

    props.push({ property, parcel, municipality: muni, commercial, ownerCompanyId });
  }

  const permitsByProperty = new Map<string, NewPropertyImprovement[]>();
  function addPermit(p: NewPropertyImprovement, contractorCompany: NewCompany) {
    graph.propertyImprovements.push(p);
    const arr = permitsByProperty.get(p.propertyId!) ?? [];
    arr.push(p);
    permitsByProperty.set(p.propertyId!, arr);
    graph.permitContacts.push({
      permitContactId: deterministicUuid(rng),
      propertyImprovementId: p.propertyImprovementId!,
      contactRole: "contractor",
      companyId: contractorCompany.companyId,
      rawName: contractorCompany.name,
      sourceSystem: "lee_accela",
      sourceRecordKey: `accela:contact:${p.propertyImprovementId}:contractor`,
    });
  }

  let permitBudget = VOLUMES.permits;
  for (const entry of props) {
    if (permitBudget <= 0) break;
    const n = Math.min(permitBudget, rng.int(2, 11));
    for (let k = 0; k < n; k++) {
      const c = rng.pick(contractors);
      const permit = makePermit(rng, {
        property: entry.property,
        parcel: entry.parcel,
        contractor: c.company,
        contractorTrade: c.trade,
        commercial: entry.commercial,
      });
      addPermit(permit, c.company);
    }
    permitBudget -= n;
  }

  type BizEntry = {
    company: NewCompany;
    registration: NewBusinessRegistration;
    homeProp: PropEntry;
  };
  const businesses: BizEntry[] = [];
  const commercialProps = props.filter((p) => p.commercial);
  for (let i = 0; i < VOLUMES.businesses; i++) {
    const name = `${rng.pick(COMPANY_STEMS)} ${rng.pick(BUSINESS_KINDS)} ${rng.pick(
      COMPANY_SUFFIXES,
    )}`;
    const companyId = deterministicUuid(rng);
    const company: NewCompany = {
      companyId,
      name,
      normalizedName: normalizeName(name),
      sourceSystem: "sunbiz",
      sourceRecordKey: `sunbiz:company:${companyId}`,
    };
    graph.companies.push(company);

    const filingType = rng.pick(SUNBIZ_FILING_TYPES);
    const documentNumber = `${rng.pick(["L", "P", "F"])}${rng.int(10, 24)}000${rng.int(
      100000,
      999999,
    )}`;
    const regId = deterministicUuid(rng);
    const registration: NewBusinessRegistration = {
      businessRegistrationId: regId,
      companyId,
      requestIdentifier: `req:${regId}`,
      documentNumber,
      entityName: name,
      status: rng.pick(SUNBIZ_STATUS),
      statusCode: "A",
      filingType: filingType.label,
      filingTypeCode: filingType.code,
      filedDate: rng.dateOffset(-rng.int(200, 8000)),
      sourceSystem: "sunbiz",
      sourceRecordKey: `sunbiz:registration:${documentNumber}`,
      sourceArtifactUri: sunbizUrl(documentNumber),
    };
    graph.businessRegistrations.push(registration);
    graph.publicRecords.push(
      publicRecord(rng, {
        entityType: "business",
        entityId: regId,
        sourceSystem: "sunbiz",
        sourceRecordKey: registration.sourceRecordKey,
        sourceUrl: sunbizUrl(documentNumber),
      }),
    );

    const partyCount = rng.int(1, 3);
    for (let p = 0; p < partyCount; p++) {
      const first = rng.pick(FIRST_NAMES);
      const last = rng.pick(LAST_NAMES);
      const personName = `${first} ${last}`;
      const partyId = deterministicUuid(rng);
      graph.businessRegistrationParties.push({
        businessRegistrationPartyId: partyId,
        businessRegistrationId: regId,
        requestIdentifier: `req:${partyId}`,
        documentNumber,
        partyRole: p === 0 ? "Registered Agent" : "Officer",
        name: personName,
        normalizedName: normalizeName(personName),
        title: p === 0 ? "AGENT" : rng.pick(["PRES", "MGR", "VP", "SEC"]),
        officerOrdinal: p,
        sourceSystem: "sunbiz",
        sourceRecordKey: `sunbiz:party:${partyId}`,
      });
    }

    const homeProp =
      commercialProps.length > 0 ? rng.pick(commercialProps) : rng.pick(props);
    const addr = graph.addresses.find((a) => a.addressId === homeProp.property.addressId);
    graph.businessRegistrationAddresses.push({
      businessRegistrationAddressId: deterministicUuid(rng),
      businessRegistrationId: regId,
      requestIdentifier: `req:addr:${regId}`,
      documentNumber,
      addressRole: "PRINCIPAL",
      line1: `${addr?.streetNumber ?? ""} ${addr?.streetName ?? ""}`.trim(),
      city: addr?.cityName ?? homeProp.municipality.name,
      state: COUNTY.stateCode,
      zip: addr?.postalCode ?? rng.pick(homeProp.municipality.zips),
      normalized: addr?.normalizedAddressKey ?? null,
      addressMatchMethod: "normalized_address_hash",
      addressMatchConfidence: "0.92",
      sourceSystem: "sunbiz",
      sourceRecordKey: `sunbiz:reg_address:${regId}`,
    });

    businesses.push({ company, registration, homeProp });
  }

  let occupancyBudget = VOLUMES.occupancies;
  const turnoverByProperty = new Map<string, number>();

  for (const biz of businesses) {
    if (occupancyBudget <= 0) break;
    const targetProp = biz.homeProp;
    const tenantId = deterministicUuid(rng);
    graph.tenants.push({
      tenantId,
      companyId: biz.company.companyId,
      tenantName: biz.company.name,
      normalizedName: biz.company.normalizedName,
      tenantType: "commercial",
      matchMethod: "normalized_name",
      matchConfidence: "0.95",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant:${tenantId}`,
    });

    const ended = rng.bool(0.35);
    const startDays = -rng.int(400, 3000);
    graph.occupancies.push({
      occupancyId: deterministicUuid(rng),
      tenantId,
      propertyId: targetProp.property.propertyId,
      addressId: targetProp.property.addressId,
      businessRegistrationId: biz.registration.businessRegistrationId,
      companyId: biz.company.companyId,
      occupancyType: "commercial",
      occupancyStatus: ended ? "ended" : "active",
      startDate: rng.dateOffset(startDays),
      endDate: ended ? rng.dateOffset(startDays + rng.int(200, 1500)) : null,
      matchMethod: "normalized_address_hash",
      matchConfidence: "0.9",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:occupancy:${tenantId}`,
    });
    if (ended) {
      turnoverByProperty.set(
        targetProp.property.propertyId!,
        (turnoverByProperty.get(targetProp.property.propertyId!) ?? 0) + 1,
      );
    }
    occupancyBudget--;
  }

  while (occupancyBudget > 0) {
    const targetProp = rng.pick(props);
    const personId = deterministicUuid(rng);
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const fullName = `${first} ${last}`;
    graph.people.push({
      personId,
      firstName: first,
      lastName: last,
      fullName,
      normalizedName: normalizeName(fullName),
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant_person:${personId}`,
    });
    const tenantId = deterministicUuid(rng);
    graph.tenants.push({
      tenantId,
      personId,
      tenantName: fullName,
      normalizedName: normalizeName(fullName),
      tenantType: "residential",
      matchMethod: "normalized_name",
      matchConfidence: "0.9",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant:${tenantId}`,
    });
    const startDays = -rng.int(100, 2000);
    const ended = rng.bool(0.3);
    graph.occupancies.push({
      occupancyId: deterministicUuid(rng),
      tenantId,
      propertyId: targetProp.property.propertyId,
      addressId: targetProp.property.addressId,
      occupancyType: "lease",
      occupancyStatus: ended ? "ended" : "active",
      startDate: rng.dateOffset(startDays),
      endDate: ended ? rng.dateOffset(startDays + rng.int(180, 1000)) : null,
      matchMethod: "normalized_address_hash",
      matchConfidence: "0.85",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:occupancy:${tenantId}`,
    });
    occupancyBudget--;
  }

  const extraCommercialProps = commercialProps.length > 0 ? commercialProps : props;
  for (let i = 0; i < FORCE.multiLocationBusinesses && i < businesses.length; i++) {
    const biz = businesses[i]!;
    const tenantId = deterministicUuid(rng);
    graph.tenants.push({
      tenantId,
      companyId: biz.company.companyId,
      tenantName: biz.company.name,
      normalizedName: biz.company.normalizedName,
      tenantType: "commercial",
      matchMethod: "normalized_name",
      matchConfidence: "0.95",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant:multi:${tenantId}`,
    });
    const extra = rng.int(1, 3);
    const seen = new Set<string>([biz.homeProp.property.propertyId!]);
    for (let k = 0; k < extra; k++) {
      const target = rng.pick(extraCommercialProps);
      if (seen.has(target.property.propertyId!)) continue;
      seen.add(target.property.propertyId!);
      const startDays = -rng.int(300, 2600);
      graph.occupancies.push({
        occupancyId: deterministicUuid(rng),
        tenantId,
        propertyId: target.property.propertyId,
        addressId: target.property.addressId,
        businessRegistrationId: biz.registration.businessRegistrationId,
        companyId: biz.company.companyId,
        occupancyType: "commercial",
        occupancyStatus: rng.bool(0.7) ? "active" : "ended",
        startDate: rng.dateOffset(startDays),
        endDate: rng.bool(0.7) ? null : rng.dateOffset(startDays + rng.int(200, 1200)),
        matchMethod: "normalized_address_hash",
        matchConfidence: "0.9",
        sourceSystem: "oracle",
        sourceRecordKey: `oracle:occupancy:multi:${tenantId}:${k}`,
      });
    }
  }

  for (let i = 0; i < FORCE.multiLocationTenants; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const fullName = `${first} ${last}`;
    const personId = deterministicUuid(rng);
    graph.people.push({
      personId,
      firstName: first,
      lastName: last,
      fullName,
      normalizedName: normalizeName(fullName),
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant_person:multi:${personId}`,
    });
    const tenantId = deterministicUuid(rng);
    graph.tenants.push({
      tenantId,
      personId,
      tenantName: fullName,
      normalizedName: normalizeName(fullName),
      tenantType: "residential",
      matchMethod: "normalized_name",
      matchConfidence: "0.9",
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:tenant:multi:${tenantId}`,
    });
    const locCount = rng.int(2, 3);
    const seen = new Set<string>();
    for (let k = 0; k < locCount; k++) {
      const target = rng.pick(props);
      if (seen.has(target.property.addressId!)) continue;
      seen.add(target.property.addressId!);
      const startDays = -rng.int(100, 1800);
      const ended = k < locCount - 1;
      graph.occupancies.push({
        occupancyId: deterministicUuid(rng),
        tenantId,
        propertyId: target.property.propertyId,
        addressId: target.property.addressId,
        occupancyType: "lease",
        occupancyStatus: ended ? "ended" : "active",
        startDate: rng.dateOffset(startDays),
        endDate: ended ? rng.dateOffset(startDays + rng.int(180, 700)) : null,
        matchMethod: "normalized_address_hash",
        matchConfidence: "0.85",
        sourceSystem: "oracle",
        sourceRecordKey: `oracle:occupancy:multi:${tenantId}:${k}`,
      });
    }
  }

  const roofCat = PERMIT_CATEGORIES.find((c) => c.key === "roofing")!;
  const elecCat = PERMIT_CATEGORIES.find((c) => c.key === "electrical")!;
  const concCat = PERMIT_CATEGORIES.find((c) => c.key === "concrete")!;
  const structCat = PERMIT_CATEGORIES.find((c) => c.key === "structural")!;

  function forcedContractor(
    trade: string,
    negative?: boolean,
  ): { company: NewCompany; trade: string } {
    const pool = contractors.filter(
      (c) => c.trade === trade && (negative === undefined || c.negative === negative),
    );
    const chosen = pool.length > 0 ? rng.pick(pool) : rng.pick(contractors);
    return { company: chosen.company, trade: chosen.trade };
  }

  let cursor = 0;
  function nextProp(): PropEntry {
    const p = props[cursor % props.length]!;
    cursor++;
    return p;
  }

  for (let i = 0; i < FORCE.hotPropertiesMultiOpen; i++) {
    const entry = nextProp();
    const count = rng.int(2, 4);
    for (let k = 0; k < count; k++) {
      const cat = rng.pick(PERMIT_CATEGORIES);
      const c = forcedContractor(rng.pick(CONTRACTOR_TRADES));
      addPermit(
        makePermit(
          rng,
          {
            property: entry.property,
            parcel: entry.parcel,
            contractor: c.company,
            contractorTrade: c.trade,
            commercial: entry.commercial,
          },
          { forceCategory: cat, forceOpen: true },
        ),
        c.company,
      );
    }
  }

  for (let i = 0; i < FORCE.openRoofing; i++) {
    const entry = nextProp();
    const c = forcedContractor("Roofing");
    addPermit(
      makePermit(
        rng,
        {
          property: entry.property,
          parcel: entry.parcel,
          contractor: c.company,
          contractorTrade: c.trade,
          commercial: entry.commercial,
        },
        { forceCategory: roofCat, forceOpen: true },
      ),
      c.company,
    );
  }

  for (let i = 0; i < FORCE.openElectrical; i++) {
    const entry = nextProp();
    const c = forcedContractor("Electrical");
    addPermit(
      makePermit(
        rng,
        {
          property: entry.property,
          parcel: entry.parcel,
          contractor: c.company,
          contractorTrade: c.trade,
          commercial: entry.commercial,
        },
        { forceCategory: elecCat, forceOpen: true },
      ),
      c.company,
    );
  }

  for (let i = 0; i < FORCE.majorRenovations; i++) {
    const entry = nextProp();
    const cat = rng.pick([concCat, roofCat, structCat]);
    const c = forcedContractor("General");
    addPermit(
      makePermit(
        rng,
        {
          property: entry.property,
          parcel: entry.parcel,
          contractor: c.company,
          contractorTrade: c.trade,
          commercial: entry.commercial,
        },
        { forceCategory: cat, forceMajor: true, forceClosed: true },
      ),
      c.company,
    );
  }

  for (const entry of props) {
    const permits = permitsByProperty.get(entry.property.propertyId!) ?? [];
    if (permits.length === 0) continue;
    if (!rng.bool(0.55)) continue;

    const projectId = deterministicUuid(rng);
    const trades = new Set<string>();
    let major = 0;
    let totalValue = 0;
    const contractorIds = new Set<string>();
    for (const p of permits) {
      for (const t of classifyTrades({
        improvementType: p.improvementType,
        projectDescription: p.projectDescription,
        description: p.description,
        volts: p.volts,
      })) {
        trades.add(t);
      }
      const key = p.improvementType ?? "";
      const mapped = CATEGORY_KEY_TO_TRADE[key];
      if (mapped) trades.add(mapped);
      if (
        isMajorRenovation({
          estimatedJobValue: p.estimatedJobValue,
          projectDescription: p.projectDescription,
        })
      ) {
        major++;
      }
      totalValue += Number(p.estimatedJobValue ?? 0);
      if (p.contractorCompanyId) contractorIds.add(p.contractorCompanyId);
    }

    const project: NewProject = {
      projectId,
      propertyId: entry.property.propertyId,
      parcelId: entry.parcel.parcelId,
      projectName: `${entry.property.subdivision ?? "Lee County"} improvement project`,
      projectDescription: `Aggregated improvements at ${entry.property.parcelIdentifier}.`,
      projectStatus: permits.some((p) => p.improvementStatus === "open")
        ? "active"
        : "completed",
      projectType: major > 0 ? "renovation" : "maintenance",
      isMajorRenovation: major > 0 ? 1 : 0,
      renovationTrades: Array.from(trades),
      permitCount: permits.length,
      totalEstimatedValue: String(totalValue),
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:project:${projectId}`,
    };
    graph.projects.push(project);

    for (const p of permits) {
      graph.projectPermits.push({
        projectPermitId: deterministicUuid(rng),
        projectId,
        propertyImprovementId: p.propertyImprovementId!,
        sourceSystem: "oracle",
        sourceRecordKey: `oracle:project_permit:${projectId}:${p.propertyImprovementId}`,
      });
    }
    for (const cid of contractorIds) {
      graph.projectContractors.push({
        projectContractorId: deterministicUuid(rng),
        projectId,
        companyId: cid,
        contractorRole: "general",
        sourceSystem: "oracle",
        sourceRecordKey: `oracle:project_contractor:${projectId}:${cid}`,
      });
    }
  }

  const salesByProperty = new Map<string, number>();
  for (const s of graph.salesHistories) {
    salesByProperty.set(s.propertyId!, (salesByProperty.get(s.propertyId!) ?? 0) + 1);
  }

  for (const entry of props) {
    const permits = permitsByProperty.get(entry.property.propertyId!) ?? [];
    const openPermits = permits.filter((p) => p.improvementStatus === "open");
    const openCategories = Array.from(
      new Set(openPermits.map((p) => p.improvementType).filter(Boolean) as string[]),
    );
    const trades = new Set<string>();
    let major = 0;
    let totalValue = 0;
    for (const p of permits) {
      for (const t of classifyTrades({
        improvementType: p.improvementType,
        projectDescription: p.projectDescription,
        description: p.description,
        volts: p.volts,
      })) {
        trades.add(t);
      }
      if (
        isMajorRenovation({
          estimatedJobValue: p.estimatedJobValue,
          projectDescription: p.projectDescription,
        })
      ) {
        major++;
      }
      totalValue += Number(p.estimatedJobValue ?? 0);
    }
    const permitCount5y = permits.length;
    const score = permitCount5y * 2 + major * 10 + totalValue / 100_000;

    graph.rollups.push({
      propertySignalRollupId: deterministicUuid(rng),
      propertyId: entry.property.propertyId,
      parcelId: entry.parcel.parcelId,
      parcelIdentifier: entry.property.parcelIdentifier,
      municipalityName: entry.municipality.name,
      subdivision: entry.property.subdivision,
      openPermitCount: openPermits.length,
      openPermitCategories: openCategories,
      permitCount5y,
      majorRenovationCount: major,
      renovationTrades: Array.from(trades),
      improvementScore: score.toFixed(2),
      ownershipChangeCount: salesByProperty.get(entry.property.propertyId!) ?? 0,
      businessTurnoverCount: turnoverByProperty.get(entry.property.propertyId!) ?? 0,
      totalPermitValue: String(totalValue),
      sourceSystem: "oracle",
      sourceRecordKey: `oracle:rollup:${entry.property.propertyId}`,
    });
  }

  return graph;
}
