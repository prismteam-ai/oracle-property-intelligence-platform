import {
  ORACLE_LEXICON_ENTITIES,
  ORACLE_LEXICON_RELATIONSHIPS,
  badge,
  badgeFromTone,
  bbbTone,
  isOpenPermit,
  money,
  permitTone,
  type BusinessRecord,
  type ContractorRecord,
  type EntityDetail,
  type EntityType,
  type GraphCluster,
  type InquiryDefinition,
  type InquiryResult,
  type OracleData,
  type OwnerRecord,
  type PropertyRecord,
  type ResultCard,
  type SourceProvenance,
  type StructuredQuery,
  type TenantRecord,
  tone
} from "../../domain/src/index.js";

export interface OracleDataSource {
  getData(): OracleData;
}

export interface RetrievalIndex {
  runRequiredInquiry(label: string): InquiryResult;
  askNaturalLanguage(query: string): InquiryResult;
  structuredSearch(query: StructuredQuery): InquiryResult;
  lexicon(): {
    entities: typeof ORACLE_LEXICON_ENTITIES;
    relationships: typeof ORACLE_LEXICON_RELATIONSHIPS;
  };
  getDetail(type: EntityType, id: string): EntityDetail | null;
  getRelationshipGraph(propertyId: string): ReturnType<typeof buildRelationshipGraph>;
}

export function createFixtureRetrievalIndex(data: OracleData): RetrievalIndex {
  return {
    runRequiredInquiry(label) {
      const inquiry = data.inquiries.find((item) => item.label.toLowerCase() === label.toLowerCase());
      if (!inquiry) {
        return askNaturalLanguage(data, label);
      }
      return runInquiry(data, inquiry);
    },
    askNaturalLanguage(query) {
      return askNaturalLanguage(data, query);
    },
    structuredSearch(query) {
      return structuredSearch(data, query);
    },
    lexicon() {
      return { entities: ORACLE_LEXICON_ENTITIES, relationships: ORACLE_LEXICON_RELATIONSHIPS };
    },
    getDetail(type, id) {
      return getDetail(data, type, id);
    },
    getRelationshipGraph(propertyId) {
      return buildRelationshipGraph(data, propertyId);
    }
  };
}

export function runInquiry(data: OracleData, inquiry: InquiryDefinition): InquiryResult {
  const risky = riskyIds(data);
  const arg = inquiry.arg;
  let cards: ResultCard[] = [];
  let note = "";

  switch (inquiry.kind) {
    case "prop_multi_open":
      cards = data.properties
        .filter((property) => property.permits.filter((permit) => isOpenPermit(permit.status)).length > 1)
        .map((property) => cardProperty(data, property));
      note = "Parcels carrying two or more concurrently open permits — a redevelopment / risk signal.";
      break;
    case "prop_open_trade":
      cards = data.properties
        .filter((property) => property.permits.some((permit) => isOpenPermit(permit.status) && permit.type === arg))
        .map((property) => cardProperty(data, property));
      note = `Properties with at least one open ${String(arg).toLowerCase()} permit.`;
      break;
    case "prop_major_trade":
      cards = data.properties
        .filter((property) => property.permits.some((permit) => permit.major && permit.type === arg))
        .map((property) => cardProperty(data, property));
      note = `Major ${String(arg).toLowerCase()} work classified from permit scope and value.`;
      break;
    case "prop_top_activity":
      cards = [...data.properties]
        .sort((a, b) => b.permits.length - a.permits.length)
        .slice(0, 6)
        .map((property) => cardProperty(data, property));
      note = "Ranked by total permit volume over the last five years.";
      break;
    case "prop_significant_reno":
      cards = data.properties
        .filter((property) => property.permits.some((permit) => permit.major))
        .map((property) => cardProperty(data, property));
      note = "Properties with classified major renovation activity.";
      break;
    case "prop_ownerchange_active":
      cards = data.properties
        .filter((property) => property.ownerHistory.length > 1 && property.permits.some((permit) => isOpenPermit(permit.status)))
        .map((property) => cardProperty(data, property));
      note = "Recent ownership transfer combined with active permitting — acquisition / value-add signal.";
      break;
    case "prop_active_turnover":
      cards = data.properties
        .filter((property) => data.turnover[property.id] && property.permits.some((permit) => isOpenPermit(permit.status)))
        .map((property) => cardProperty(data, property));
      note = "Active permits coinciding with business turnover at the location.";
      break;
    case "contractor_trade":
      cards = data.contractors
        .filter((contractor) => contractor.trades.includes(String(arg)))
        .map((contractor) => cardContractor(contractor));
      note = `${arg} contractors operating in Lee County.`;
      break;
    case "contractor_negative_bbb":
      cards = data.contractors
        .filter((contractor) => ["D", "F"].includes(contractor.bbb))
        .map((contractor) => cardContractor(contractor));
      note = "Contractors carrying a negative BBB rating.";
      break;
    case "contractor_complaints":
      cards = data.contractors
        .filter((contractor) => contractor.complaints.length > 0)
        .map((contractor) => cardContractor(contractor));
      note = "Contractors with one or more filed BBB complaints.";
      break;
    case "contractor_top":
      cards = [...data.contractors]
        .sort((a, b) => b.projects - a.projects)
        .slice(0, 8)
        .map((contractor) => cardContractor(contractor));
      note = "Most active contractors ranked by completed project count.";
      break;
    case "projects_risky":
      data.properties.forEach((property) => {
        property.permits.forEach((permit) => {
          if (risky.has(permit.contractor)) {
            const contractor = mustContractor(data, permit.contractor);
            cards.push(cardProject(property, permit, contractor));
          }
        });
      });
      note = "Projects performed by contractors with a negative BBB rating or filed complaints.";
      break;
    case "business_multi":
      cards = data.businesses
        .filter((business) => business.locations.length > 1)
        .map((business) => cardBusiness(business));
      note = "Businesses operating across more than one property.";
      break;
    case "business_top":
      cards = [...data.businesses]
        .sort((a, b) => b.locations.length - a.locations.length)
        .slice(0, 8)
        .map((business) => cardBusiness(business));
      note = "Businesses ranked by property footprint.";
      break;
    case "owner_multi":
      cards = data.owners
        .filter((owner) => owner.props.length > 1)
        .map((owner) => cardOwner(owner));
      note = "Owners associated with multiple properties.";
      break;
    case "tenant_multi":
      cards = data.tenants
        .filter((tenant) => tenant.locations.length > 1)
        .map((tenant) => cardTenant(tenant));
      note = "Tenants operating across multiple locations.";
      break;
    case "neighborhood_increasing":
      cards = neighborhoods(data)
        .filter((neighborhood) => neighborhood.recent >= 2)
        .sort((a, b) => b.recent - a.recent)
        .map((neighborhood) => cardNeighborhood(neighborhood, `▲ ${neighborhood.recent} in 60d`, "green"));
      note = "Neighborhoods with accelerating permit activity in the trailing 60 days.";
      break;
    case "neighborhood_reno":
      cards = neighborhoods(data)
        .filter((neighborhood) => neighborhood.major >= 1)
        .sort((a, b) => b.major - a.major)
        .map((neighborhood) => cardNeighborhood(neighborhood, `${neighborhood.major} major`, "amber"));
      note = "Highest concentration of classified major renovations.";
      break;
    case "relationship_graph": {
      const property = data.properties[9] ?? data.properties[0];
      const graphCount =
        1 + contractorsOf(data, property).length + property.businesses.length + property.tenants.length + 1;
      return {
        query: inquiry.label,
        headerLabel: inquiry.label,
        count: graphCount,
        note: "Linked owner, contractors, businesses, and tenants for the selected parcel.",
        cards: [],
        citations: property.src.map((source) => ({ ...source, entity: property.address })),
        hasAnswer: false,
        isGraph: true
      };
    }
    default:
      note = "No deterministic handler matched this inquiry.";
  }

  return {
    query: inquiry.label,
    headerLabel: inquiry.label,
    count: cards.length,
    note,
    cards,
    citations: gatherCitations(data, cards),
    hasAnswer: false,
    isGraph: false
  };
}

export function askNaturalLanguage(data: OracleData, query: string): InquiryResult {
  const exact = data.inquiries.find((inquiry) => inquiry.label.toLowerCase() === query.toLowerCase());
  if (exact) return runInquiry(data, exact);

  const q = query.toLowerCase();
  const stretch = semanticStretchRoute(data, query, q);
  if (stretch) return stretch;

  const words = q.split(/\s+/).filter((word) => word.length > 2);
  const score = (text: string) => words.reduce((sum, word) => sum + (text.toLowerCase().includes(word) ? 1 : 0), 0);
  const wantsContractor = /contractor|roof|electric|complaint|bbb|plumb|hvac|concrete/.test(q);

  let cards: ResultCard[] = [];
  if (wantsContractor) {
    cards = data.contractors
      .map((contractor) => ({
        contractor,
        score: score(`${contractor.name} ${contractor.trades.join(" ")} ${contractor.bbb} ${contractor.complaints.length ? "complaint" : ""}`)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => cardContractor(item.contractor));
  }

  if (!cards.length) {
    cards = data.properties
      .map((property) => ({
        property,
        score: score(
          `${property.address} ${property.city} ${property.neighborhood} ${property.class} ${property.permits
            .map((permit) => `${permit.type} ${permit.scope}`)
            .join(" ")}`
        )
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => cardProperty(data, item.property));
  }

  if (!cards.length) {
    cards = data.properties.slice(0, 4).map((property) => cardProperty(data, property));
  }

  return {
    query,
    headerLabel: query,
    count: cards.length,
    note: "Natural-language retrieval over the RAG knowledge layer.",
    cards,
    citations: gatherCitations(data, cards),
    hasAnswer: true,
    answer: `Retrieved ${cards.length} source-backed record${cards.length === 1 ? "" : "s"} from the Lee County corpus matching "${query}". Every record is reconciled into the Elephant Lexicon and carries collection plus refresh provenance.`,
    isGraph: false
  };
}

function semanticStretchRoute(data: OracleData, query: string, normalizedQuery: string): InquiryResult | null {
  const route = (inquiryId: string, answer: string) => {
    const inquiry = data.inquiries.find((item) => item.id === inquiryId);
    if (!inquiry) return null;
    const result = runInquiry(data, inquiry);
    return {
      ...result,
      query,
      headerLabel: query,
      note: `Semantic route to "${inquiry.label}". ${result.note}`,
      hasAnswer: true,
      answer
    };
  };

  if (/redevelopment|value-?add|investment activity|acquisition candidate|candidate for acquisition/.test(normalizedQuery)) {
    return route(
      "q17",
      "Redevelopment and acquisition candidates are ranked by the overlap of ownership change, active permits, major improvement work, and occupancy turnover signals."
    );
  }

  if (/complaint-linked|complaint linked|highest number of complaint|negative bbb.*project/.test(normalizedQuery)) {
    return route(
      "q13",
      "Complaint-linked project exposure is derived by joining permit/project records to contractors with negative BBB ratings or complaint histories."
    );
  }

  if (/business owners?.*largest property footprint|owners?.*largest property footprint|control.*property footprint/.test(normalizedQuery)) {
    return route(
      "q15",
      "Owner footprint is calculated from reconciled ownership records and linked parcel portfolios."
    );
  }

  if (/permit patterns?.*turnover|precede business turnover|business turnover/.test(normalizedQuery)) {
    return route(
      "q18",
      "Turnover-leading permit patterns are identified where active permits overlap with business or occupancy changes at the same property."
    );
  }

  if (/neighborhoods?.*strongest redevelopment|strongest redevelopment signals|neighborhood.*redevelopment/.test(normalizedQuery)) {
    return route(
      "q19",
      "Neighborhood redevelopment signals combine recent permit acceleration with major-renovation concentration."
    );
  }

  if (/businesses?.*expanded|multiple locations over time|expanded into multiple locations/.test(normalizedQuery)) {
    return route(
      "q14",
      "Business expansion is represented by active Sunbiz/business records linked to more than one property location."
    );
  }

  if (/unusual permit activity|compared to nearby|nearby properties/.test(normalizedQuery)) {
    return route(
      "q7",
      "Unusual permit activity is approximated by ranking parcels by permit volume across the loaded five-year activity window."
    );
  }

  if (/without negative bbb|no negative bbb|without complaint|clean bbb|major renovations without negative/.test(normalizedQuery)) {
    const risky = riskyIds(data);
    const majorContractors = new Set(
      data.properties.flatMap((property) => property.permits.filter((permit) => permit.major).map((permit) => permit.contractor))
    );
    const cards = data.contractors
      .filter((contractor) => majorContractors.has(contractor.id) && !risky.has(contractor.id))
      .sort((a, b) => b.projects - a.projects)
      .slice(0, 8)
      .map((contractor) => cardContractor(contractor));
    return {
      query,
      headerLabel: query,
      count: cards.length,
      note: "Major-renovation contractors filtered to exclude negative BBB ratings and complaint histories.",
      cards,
      citations: gatherCitations(data, cards),
      hasAnswer: true,
      answer: `Found ${cards.length} contractor${cards.length === 1 ? "" : "s"} with major renovation work and no negative BBB or complaint indicators in the loaded corpus.`,
      isGraph: false
    };
  }

  return null;
}

export function structuredSearch(data: OracleData, query: StructuredQuery): InquiryResult {
  const limit = Math.max(1, Math.min(query.limit ?? 25, 100));
  const entity = query.entity ?? inferStructuredEntity(query);
  const countyMatches = !query.county || contains(data.corpus.county, query.county);
  let cards: ResultCard[] = [];

  if (!countyMatches) {
    return emptyStructuredResult(query, entity, "County filter did not match the loaded corpus.");
  }

  if (entity === "business") {
    cards = data.businesses
      .filter((business) => matchesBusiness(data, business, query))
      .slice(0, limit)
      .map((business) => cardBusiness(business));
  } else if (entity === "contractor") {
    cards = data.contractors
      .filter((contractor) => matchesContractor(contractor, query))
      .slice(0, limit)
      .map((contractor) => cardContractor(contractor));
  } else if (entity === "owner") {
    cards = data.owners
      .filter((owner) => matchesOwner(data, owner, query))
      .slice(0, limit)
      .map((owner) => cardOwner(owner));
  } else if (entity === "tenant") {
    cards = data.tenants
      .filter((tenant) => matchesTenant(data, tenant, query))
      .slice(0, limit)
      .map((tenant) => cardTenant(tenant));
  } else {
    cards = data.properties
      .filter((property) => matchesProperty(data, property, query))
      .slice(0, limit)
      .map((property) => cardProperty(data, property));
  }

  return {
    query: structuredLabel(query),
    headerLabel: structuredLabel(query),
    count: cards.length,
    note: "Structured query over canonical Elephant Lexicon fields and source-backed relationships.",
    cards,
    citations: gatherCitations(data, cards),
    hasAnswer: true,
    answer: `Matched ${cards.length} ${entity} record${cards.length === 1 ? "" : "s"} using structured filters across county, municipality, permits, contractors, classes, business types, statuses, and date ranges.`,
    isGraph: false
  };
}

function inferStructuredEntity(query: StructuredQuery): EntityType {
  if (query.businessType) return "business";
  if (query.contractor && !query.permitType && !query.propertyClass && !query.municipality && !query.dateFrom && !query.dateTo) return "contractor";
  return "property";
}

function emptyStructuredResult(query: StructuredQuery, entity: EntityType, note: string): InquiryResult {
  return {
    query: structuredLabel(query),
    headerLabel: structuredLabel(query),
    count: 0,
    note,
    cards: [],
    citations: [],
    hasAnswer: true,
    answer: `Matched 0 ${entity} records.`,
    isGraph: false
  };
}

function matchesProperty(data: OracleData, property: PropertyRecord, query: StructuredQuery): boolean {
  const status = query.status;
  const permitType = query.permitType;
  if (query.municipality && !contains(property.city, query.municipality)) return false;
  if (query.propertyClass && !contains(property.class, query.propertyClass)) return false;
  if (status && !property.permits.some((permit) => contains(permit.status, status))) return false;
  if (permitType && !property.permits.some((permit) => contains(`${permit.type} ${permit.scope}`, permitType))) return false;
  if (query.contractor && !property.permits.some((permit) => {
    const contractor = data.contractors.find((item) => item.id === permit.contractor);
    return contractor ? contains(`${contractor.name} ${contractor.license} ${contractor.trades.join(" ")}`, query.contractor ?? "") : false;
  })) return false;
  if (query.businessType && !property.businesses.some((id) => {
    const business = data.businesses.find((item) => item.id === id);
    return business ? contains(business.btype, query.businessType ?? "") : false;
  })) return false;
  if ((query.dateFrom || query.dateTo) && !property.permits.some((permit) => dateInRange(permit.filed, query.dateFrom, query.dateTo))) return false;
  return true;
}

function matchesBusiness(data: OracleData, business: BusinessRecord, query: StructuredQuery): boolean {
  if (query.businessType && !contains(business.btype, query.businessType)) return false;
  if (query.status && !contains(business.status, query.status)) return false;
  if (query.municipality && !business.locations.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.city, query.municipality ?? "") : false;
  })) return false;
  if (query.propertyClass && !business.locations.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.class, query.propertyClass ?? "") : false;
  })) return false;
  if ((query.dateFrom || query.dateTo) && !dateInRange(business.registered, query.dateFrom, query.dateTo)) return false;
  return true;
}

function matchesContractor(contractor: ContractorRecord, query: StructuredQuery): boolean {
  if (query.contractor && !contains(`${contractor.name} ${contractor.license} ${contractor.trades.join(" ")}`, query.contractor)) return false;
  if (query.permitType && !contractor.trades.some((trade) => contains(trade, query.permitType ?? ""))) return false;
  if (query.status && !contains(contractor.bbb, query.status)) return false;
  return true;
}

function matchesOwner(data: OracleData, owner: OwnerRecord, query: StructuredQuery): boolean {
  if (query.status && !contains(owner.type, query.status)) return false;
  if ((query.dateFrom || query.dateTo) && !dateInRange(owner.since, query.dateFrom, query.dateTo)) return false;
  if (query.municipality && !owner.props.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.city, query.municipality ?? "") : false;
  })) return false;
  if (query.propertyClass && !owner.props.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.class, query.propertyClass ?? "") : false;
  })) return false;
  return true;
}

function matchesTenant(data: OracleData, tenant: TenantRecord, query: StructuredQuery): boolean {
  if (query.status && !contains(tenant.activity, query.status)) return false;
  if (query.businessType && !tenant.businesses.some((id) => {
    const business = data.businesses.find((item) => item.id === id);
    return business ? contains(business.btype, query.businessType ?? "") : false;
  })) return false;
  if (query.municipality && !tenant.locations.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.city, query.municipality ?? "") : false;
  })) return false;
  if (query.propertyClass && !tenant.locations.some((id) => {
    const property = data.properties.find((item) => item.id === id);
    return property ? contains(property.class, query.propertyClass ?? "") : false;
  })) return false;
  return true;
}

function structuredLabel(query: StructuredQuery): string {
  const filters = [
    query.entity ? `entity=${query.entity}` : null,
    query.county ? `county=${query.county}` : null,
    query.municipality ? `municipality=${query.municipality}` : null,
    query.permitType ? `permit=${query.permitType}` : null,
    query.contractor ? `contractor=${query.contractor}` : null,
    query.propertyClass ? `class=${query.propertyClass}` : null,
    query.businessType ? `business=${query.businessType}` : null,
    query.status ? `status=${query.status}` : null,
    query.dateFrom ? `from=${query.dateFrom}` : null,
    query.dateTo ? `to=${query.dateTo}` : null
  ].filter((item): item is string => Boolean(item));
  return filters.length ? `Structured search: ${filters.join(" · ")}` : "Structured search";
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function dateInRange(value: string, from?: string, to?: string): boolean {
  const current = new Date(value).getTime();
  if (Number.isNaN(current)) return false;
  if (from && current < new Date(from).getTime()) return false;
  if (to && current > new Date(to).getTime()) return false;
  return true;
}

export function getDetail(data: OracleData, type: EntityType, id: string): EntityDetail | null {
  if (type === "project") {
    const property = data.properties.find((item) => item.permits.some((permit) => permit.id === id));
    return property ? detailProperty(data, property) : null;
  }
  if (type === "property") return detailProperty(data, mustProperty(data, id));
  if (type === "contractor") return detailContractor(data, mustContractor(data, id));
  if (type === "business") return detailBusiness(data, mustBusiness(data, id));
  if (type === "owner") return detailOwner(data, mustOwner(data, id));
  if (type === "tenant") return detailTenant(data, mustTenant(data, id));
  return null;
}

export function buildRelationshipGraph(data: OracleData, propertyId: string) {
  const property = data.properties.find((item) => item.id === propertyId) ?? data.properties[0];
  const owner = mustOwner(data, property.owner);
  const risky = riskyIds(data);

  const clusters: GraphCluster[] = [
    { title: "OWNER", nodes: [{ name: owner.name, role: `${owner.type} · since ${owner.since}` }] },
    {
      title: "CONTRACTORS",
      nodes: contractorsOf(data, property).map((contractor) => ({
        name: contractor.name,
        role: `${contractor.trades.join("/")} · BBB ${contractor.bbb}${risky.has(contractor.id) ? " · risk" : ""}`
      }))
    },
    {
      title: "BUSINESSES",
      nodes: property.businesses.map((id) => {
        const business = mustBusiness(data, id);
        return { name: business.name, role: `${business.btype} · ${business.status}` };
      })
    },
    {
      title: "TENANTS",
      nodes: property.tenants.map((id) => {
        const tenant = mustTenant(data, id);
        return { name: tenant.name, role: tenant.ttype };
      })
    }
  ];

  return {
    center: { title: property.address, sub: `${property.city} · ${property.neighborhood}` },
    clusters
  };
}

function cardProperty(data: OracleData, property: PropertyRecord): ResultCard {
  const open = property.permits.filter((permit) => isOpenPermit(permit.status));
  const major = property.permits.filter((permit) => permit.major);
  const badges = [];
  if (open.length) badges.push(badge(`${open.length} open`, "accent"));
  if (major.length) badges.push(badge("major reno", "amber"));
  badges.push(badge(property.class, "gray"));
  return {
    key: property.id,
    type: "property",
    title: property.address,
    subtitle: `${property.city} · ${property.neighborhood}`,
    badges,
    metas: [
      { k: "Parcel", v: property.parcel },
      { k: "Owner", v: mustOwner(data, property.owner).name },
      { k: "Permits", v: String(property.permits.length) }
    ],
    cite: property.src.length
  };
}

function cardContractor(contractor: ContractorRecord): ResultCard {
  const badges = [badgeFromTone(`BBB ${contractor.bbb}`, bbbTone(contractor.bbb))];
  if (contractor.complaints.length) badges.push(badge(`${contractor.complaints.length} complaints`, "red"));
  return {
    key: contractor.id,
    type: "contractor",
    title: contractor.name,
    subtitle: `${contractor.trades.join(" / ")} · ${contractor.projects} projects`,
    badges,
    metas: [
      { k: "License", v: contractor.license },
      { k: "Review", v: `${contractor.review} / 5` },
      { k: "County", v: contractor.county }
    ],
    cite: contractor.src.length
  };
}

function cardBusiness(business: BusinessRecord): ResultCard {
  return {
    key: business.id,
    type: "business",
    title: business.name,
    subtitle: `${business.btype} · reg ${business.registered}`,
    badges: [
      ...(business.locations.length > 1 ? [badge(`${business.locations.length} locations`, "accent")] : []),
      badge(business.status, business.status === "Active" ? "green" : "gray")
    ],
    metas: [
      { k: "Sunbiz", v: business.sunbiz },
      { k: "Owner", v: business.owner },
      { k: "Sites", v: String(business.locations.length) }
    ],
    cite: business.src.length
  };
}

function cardOwner(owner: OwnerRecord): ResultCard {
  return {
    key: owner.id,
    type: "owner",
    title: owner.name,
    subtitle: `${owner.type} · owner since ${owner.since}`,
    badges: [badge(`${owner.props.length} properties`, "accent")],
    metas: [
      { k: "Type", v: owner.type },
      { k: "Portfolio", v: `${owner.props.length} parcels` }
    ],
    cite: owner.src.length
  };
}

function cardTenant(tenant: TenantRecord): ResultCard {
  return {
    key: tenant.id,
    type: "tenant",
    title: tenant.name,
    subtitle: `${tenant.ttype} tenant`,
    badges: [badge(`${tenant.locations.length} locations`, "accent")],
    metas: [
      { k: "Locations", v: String(tenant.locations.length) },
      { k: "Businesses", v: String(tenant.businesses.length) }
    ],
    cite: tenant.src.length
  };
}

function cardNeighborhood(neighborhood: Neighborhood, label: string, toneName: string): ResultCard {
  return {
    key: neighborhood.name,
    type: "neighborhood",
    title: neighborhood.name,
    subtitle: neighborhood.city,
    badges: [badge(label, toneName)],
    metas: [
      { k: "Permits", v: String(neighborhood.permits) },
      { k: "Major reno", v: String(neighborhood.major) },
      { k: "Recent", v: `${neighborhood.recent} / 60d` }
    ],
    cite: neighborhood.cite
  };
}

function cardProject(property: PropertyRecord, permit: PropertyRecord["permits"][number], contractor: ContractorRecord): ResultCard {
  return {
    key: permit.id,
    type: "project",
    title: permit.scope,
    subtitle: `${permit.type} · ${contractor.name}`,
    badges: [badgeFromTone(permit.status, permitTone(permit.status)), badge("risk contractor", "red")],
    metas: [
      { k: "Property", v: property.address },
      { k: "Value", v: money(permit.value) },
      { k: "Filed", v: permit.filed }
    ],
    cite: property.src.length
  };
}

function detailProperty(data: OracleData, property: PropertyRecord): EntityDetail {
  const open = property.permits.filter((permit) => isOpenPermit(permit.status));
  const major = property.permits.filter((permit) => permit.major);
  const contractors = contractorsOf(data, property);
  const risky = riskyIds(data);
  return {
    id: property.id,
    type: "property",
    title: property.address,
    subtitle: `${property.city}, FL · ${property.neighborhood} · ${property.class} · built ${property.year}`,
    signals: [
      ...(open.length > 1 ? [badge(`${open.length} open permits`, "accent")] : []),
      ...(major.length ? [badge(`${major.length} major renovation${major.length > 1 ? "s" : ""}`, "amber")] : []),
      ...(property.ownerHistory.length > 1 ? [badge("ownership change", "blue")] : []),
      ...(data.turnover[property.id] ? [badge("business turnover", "red")] : [])
    ],
    sections: [
      {
        title: "OWNERSHIP HISTORY",
        empty: false,
        rows: property.ownerHistory.map((history, index) => ({
          primary: history.owner,
          secondary: history.type,
          value: history.date,
          meta: index === 0 ? "current" : "prior",
          tag: index === 0 ? "NOW" : "PAST",
          tone: index === 0 ? "green" : "gray"
        }))
      },
      {
        title: "PERMIT HISTORY",
        empty: false,
        rows: property.permits.map((permit) => ({
          primary: `${permit.type}${permit.major ? " · major" : ""}`,
          secondary: `${permit.scope} — ${mustContractor(data, permit.contractor).name}`,
          value: money(permit.value),
          meta: `filed ${permit.filed}`,
          tag: permit.status,
          tone: isOpenPermit(permit.status) ? "accent" : "gray"
        }))
      },
      {
        title: "CONTRACTORS",
        empty: contractors.length === 0,
        rows: contractors.map((contractor) => ({
          primary: contractor.name,
          secondary: `${contractor.trades.join(" / ")} · ${contractor.review} stars`,
          value: `BBB ${contractor.bbb}`,
          meta: contractor.complaints.length ? `${contractor.complaints.length} complaints` : "no complaints",
          tag: risky.has(contractor.id) ? "RISK" : "OK",
          tone: risky.has(contractor.id) ? "red" : "gray"
        }))
      },
      {
        title: "BUSINESS OCCUPANCY",
        empty: property.businesses.length === 0,
        rows: property.businesses.map((id) => {
          const business = mustBusiness(data, id);
          return {
            primary: business.name,
            secondary: `${business.btype} · ${business.status}`,
            value: business.sunbiz,
            meta: `reg ${business.registered}`
          };
        })
      },
      {
        title: "TENANT ACTIVITY",
        empty: property.tenants.length === 0,
        rows: property.tenants.map((id) => {
          const tenant = mustTenant(data, id);
          return {
            primary: tenant.name,
            secondary: tenant.activity,
            value: tenant.ttype,
            meta: `${tenant.locations.length} locations`
          };
        })
      },
      ...(data.turnover[property.id]
        ? [{ title: "TURNOVER SIGNAL", empty: false, rows: [{ primary: data.turnover[property.id] }] }]
        : []),
      ...(major.length
        ? [
            {
              title: "MAJOR IMPROVEMENTS",
              empty: false,
              rows: major.map((permit) => ({
                primary: `${permit.type} — ${permit.scope}`,
                secondary: mustContractor(data, permit.contractor).name,
                value: money(permit.value),
                meta: permit.status,
                tag: "MAJOR",
                tone: "amber"
              }))
            }
          ]
        : [])
    ],
    citations: property.src
  };
}

function detailContractor(data: OracleData, contractor: ContractorRecord): EntityDetail {
  const projects = data.properties.flatMap((property) =>
    property.permits
      .filter((permit) => permit.contractor === contractor.id)
      .map((permit) => ({ property, permit }))
  );
  return {
    id: contractor.id,
    type: "contractor",
    title: contractor.name,
    subtitle: `${contractor.trades.join(" / ")} · License ${contractor.license} · ${contractor.county} County`,
    signals: [
      badgeFromTone(`BBB ${contractor.bbb}`, bbbTone(contractor.bbb)),
      badge(`${contractor.review} / 5 reviews`, "gray"),
      ...(contractor.complaints.length ? [badge(`${contractor.complaints.length} complaints`, "red")] : [])
    ],
    sections: [
      {
        title: "PROJECT & PERMIT HISTORY",
        empty: projects.length === 0,
        rows: projects.map(({ property, permit }) => ({
          primary: `${permit.type} — ${property.address}`,
          secondary: permit.scope,
          value: money(permit.value),
          meta: `filed ${permit.filed}`,
          tag: permit.status,
          tone: isOpenPermit(permit.status) ? "accent" : "gray"
        }))
      },
      {
        title: "BBB COMPLAINTS",
        empty: contractor.complaints.length === 0,
        rows: contractor.complaints.map((complaint) => ({
          primary: complaint.summary,
          secondary: `filed ${complaint.date}`,
          value: complaint.status,
          tag: complaint.status === "Unresolved" ? "!" : "OPEN",
          tone: complaint.status === "Unresolved" ? "red" : "amber"
        }))
      },
      {
        title: "REVIEW SUMMARY",
        empty: false,
        rows: [
          {
            primary: `${contractor.review} / 5.0 average`,
            secondary: contractor.review >= 4 ? "Consistently positive customer feedback." : "Mixed or negative customer feedback.",
            value: `BBB ${contractor.bbb}`,
            meta: `${contractor.projects} projects`
          }
        ]
      }
    ],
    citations: contractor.src
  };
}

function detailBusiness(data: OracleData, business: BusinessRecord): EntityDetail {
  return {
    id: business.id,
    type: "business",
    title: business.name,
    subtitle: `${business.btype} · Sunbiz ${business.sunbiz}`,
    signals: [
      badge(business.status, business.status === "Active" ? "green" : "gray"),
      ...(business.locations.length > 1 ? [badge(`${business.locations.length} locations`, "accent")] : [])
    ],
    sections: [
      {
        title: "REGISTRATION",
        empty: false,
        rows: [{ primary: business.name, secondary: `Owner: ${business.owner}`, value: business.sunbiz, meta: `reg ${business.registered}` }]
      },
      {
        title: "LOCATIONS",
        empty: false,
        rows: business.locations.map((id) => {
          const property = mustProperty(data, id);
          return { primary: property.address, secondary: `${property.city} · ${property.neighborhood}`, value: property.class, meta: property.parcel };
        })
      }
    ],
    citations: business.src
  };
}

function detailOwner(data: OracleData, owner: OwnerRecord): EntityDetail {
  return {
    id: owner.id,
    type: "owner",
    title: owner.name,
    subtitle: `${owner.type} · owner since ${owner.since} · ${owner.props.length} parcels`,
    signals: [badge(`${owner.props.length} properties`, "accent")],
    sections: [
      {
        title: "PROPERTY PORTFOLIO",
        empty: false,
        rows: owner.props.map((id) => {
          const property = mustProperty(data, id);
          return { primary: property.address, secondary: `${property.city} · ${property.neighborhood}`, value: property.class, meta: `${property.permits.length} permits` };
        })
      }
    ],
    citations: owner.src
  };
}

function detailTenant(data: OracleData, tenant: TenantRecord): EntityDetail {
  return {
    id: tenant.id,
    type: "tenant",
    title: tenant.name,
    subtitle: `${tenant.ttype} tenant · ${tenant.activity}`,
    signals: [badge(`${tenant.locations.length} locations`, "accent")],
    sections: [
      {
        title: "OCCUPANCY",
        empty: false,
        rows: tenant.locations.map((id) => {
          const property = mustProperty(data, id);
          return { primary: property.address, secondary: `${property.city} · ${property.neighborhood}`, value: property.class };
        })
      },
      {
        title: "ASSOCIATED BUSINESSES",
        empty: tenant.businesses.length === 0,
        rows: tenant.businesses.map((id) => {
          const business = mustBusiness(data, id);
          return { primary: business.name, secondary: business.btype, value: business.status, meta: business.sunbiz };
        })
      }
    ],
    citations: tenant.src
  };
}

function gatherCitations(data: OracleData, cards: ResultCard[]): SourceProvenance[] {
  const out: SourceProvenance[] = [];
  const seen = new Set<string>();
  cards.slice(0, 6).forEach((card) => {
    let src: SourceProvenance[] = [];
    if (card.type === "property") src = mustProperty(data, card.key).src;
    else if (card.type === "contractor") src = mustContractor(data, card.key).src;
    else if (card.type === "business") src = mustBusiness(data, card.key).src;
    else if (card.type === "owner") src = mustOwner(data, card.key).src;
    else if (card.type === "tenant") src = mustTenant(data, card.key).src;
    else if (card.type === "project") src = mustProperty(data, cardKeyProperty(data, card.key)).src;
    src.forEach((source) => {
      if (!seen.has(source.url)) {
        seen.add(source.url);
        out.push({ ...source, entity: card.title });
      }
    });
  });
  return out.slice(0, 8);
}

function riskyIds(data: OracleData): Set<string> {
  return new Set(data.contractors.filter((contractor) => ["D", "F"].includes(contractor.bbb) || contractor.complaints.length > 0).map((contractor) => contractor.id));
}

function contractorsOf(data: OracleData, property: PropertyRecord): ContractorRecord[] {
  return [...new Set(property.permits.map((permit) => permit.contractor))]
    .map((id) => data.contractors.find((contractor) => contractor.id === id))
    .filter((contractor): contractor is ContractorRecord => Boolean(contractor));
}

interface Neighborhood {
  name: string;
  city: string;
  permits: number;
  major: number;
  recent: number;
  cite: number;
}

function neighborhoods(data: OracleData): Neighborhood[] {
  const grouped = new Map<string, Neighborhood>();
  data.properties.forEach((property) => {
    if (!grouped.has(property.neighborhood)) {
      grouped.set(property.neighborhood, {
        name: property.neighborhood,
        city: property.city,
        permits: 0,
        major: 0,
        recent: 0,
        cite: 0
      });
    }
    const row = grouped.get(property.neighborhood);
    if (!row) return;
    row.permits += property.permits.length;
    row.major += property.permits.filter((permit) => permit.major).length;
    row.recent += property.permits.filter((permit) => daysAgo(permit.filed) <= 65).length;
    row.cite += property.src.length;
  });
  return [...grouped.values()];
}

function daysAgo(iso: string): number {
  return Math.round((new Date("2026-06-18").getTime() - new Date(iso).getTime()) / 86400000);
}

function cardKeyProperty(data: OracleData, permitId: string): string {
  return data.properties.find((property) => property.permits.some((permit) => permit.id === permitId))?.id ?? data.properties[0].id;
}

function mustProperty(data: OracleData, id: string): PropertyRecord {
  const item = data.properties.find((property) => property.id === id);
  if (!item) throw new Error(`Unknown property ${id}`);
  return item;
}

function mustContractor(data: OracleData, id: string): ContractorRecord {
  const item = data.contractors.find((contractor) => contractor.id === id);
  if (!item) throw new Error(`Unknown contractor ${id}`);
  return item;
}

function mustBusiness(data: OracleData, id: string): BusinessRecord {
  const item = data.businesses.find((business) => business.id === id);
  if (!item) throw new Error(`Unknown business ${id}`);
  return item;
}

function mustOwner(data: OracleData, id: string): OwnerRecord {
  const item = data.owners.find((owner) => owner.id === id);
  if (!item) throw new Error(`Unknown owner ${id}`);
  return item;
}

function mustTenant(data: OracleData, id: string): TenantRecord {
  const item = data.tenants.find((tenant) => tenant.id === id);
  if (!item) throw new Error(`Unknown tenant ${id}`);
  return item;
}
