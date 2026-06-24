"use strict";

const crypto = require("crypto");

const RAG_TABLE_NAME = "oracle_rag_documents";
const DEFAULT_RAG_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_RAG_ANSWER_MODEL = "gpt-5.4-mini";
const DEFAULT_RAG_TOP_K = 8;
const RAG_EMBEDDING_DIMENSIONS = 1536;

function buildOracleRagDocuments(data) {
  const docs = [];

  for (const property of data.properties) {
    const contractors = contractorsFor(data, property);
    const businesses = property.businesses.map((id) => data.businesses.find((item) => item.id === id)).filter(Boolean);
    const tenants = property.tenants.map((id) => data.tenants.find((item) => item.id === id)).filter(Boolean);
    docs.push(doc({
      id: `property:${property.id}`,
      entityType: "property",
      entityId: property.id,
      title: property.address,
      content: [
        `Entity: Property ${property.address}`,
        `Parcel ${property.parcel}; county ${data.corpus.county}; city ${property.city}; neighborhood ${property.neighborhood}.`,
        `Class ${property.class}; built ${property.year}; owner ${property.owner}.`,
        `Ownership history: ${property.ownerHistory.map((item) => `${item.owner} ${item.type} ${item.date}`).join("; ")}.`,
        `Permits: ${property.permits.map((permit) => `${permit.id} ${permit.status} ${permit.type} ${permit.scope} ${money(permit.value)} filed ${permit.filed}${permit.major ? " major" : ""}`).join("; ")}.`,
        `Contractors: ${contractors.map((contractor) => `${contractor.name} BBB ${contractor.bbb} trades ${contractor.trades.join("/")}`).join("; ") || "none linked"}.`,
        `Businesses: ${businesses.map((business) => `${business.name} ${business.btype} ${business.status}`).join("; ") || "none linked"}.`,
        `Tenants: ${tenants.map((tenant) => `${tenant.name} ${tenant.activity}`).join("; ") || "none linked"}.`,
        data.turnover[property.id] ? `Turnover signal: ${data.turnover[property.id]}.` : "Turnover signal: none in loaded corpus.",
        `Open permits ${property.permits.filter((permit) => isOpen(permit.status)).length}; major improvements ${property.permits.filter((permit) => permit.major).length}.`
      ].join("\n"),
      citations: property.src,
      metadata: { city: property.city, neighborhood: property.neighborhood, class: property.class, permits: property.permits.length }
    }));

    for (const permit of property.permits) {
      const contractor = data.contractors.find((item) => item.id === permit.contractor);
      docs.push(doc({
        id: `permit:${permit.id}`,
        entityType: "property",
        entityId: property.id,
        title: `${permit.type} permit ${permit.id}`,
        content: [
          `Entity: Permit ${permit.id} for ${property.address}`,
          `Property ${property.address}, ${property.city}; parcel ${property.parcel}.`,
          `Permit ${permit.status} ${permit.type}; scope ${permit.scope}; value ${money(permit.value)}; filed ${permit.filed}; major ${permit.major ? "yes" : "no"}.`,
          contractor ? `Contractor ${contractor.name}; license ${contractor.license}; BBB ${contractor.bbb}; complaints ${contractor.complaints.length}; review ${contractor.review}.` : "Contractor not resolved.",
          "Relationships: property-has-permit and permit-performed-by-contractor."
        ].join("\n"),
        citations: [...property.src, ...(contractor ? contractor.src : [])],
        metadata: { propertyId: property.id, permitType: permit.type, status: permit.status, major: permit.major }
      }));
    }
  }

  for (const contractor of data.contractors) {
    const projects = data.properties.flatMap((property) =>
      property.permits
        .filter((permit) => permit.contractor === contractor.id)
        .map((permit) => `${property.address}: ${permit.status} ${permit.type} ${permit.scope} ${money(permit.value)}`)
    );
    docs.push(doc({
      id: `contractor:${contractor.id}`,
      entityType: "contractor",
      entityId: contractor.id,
      title: contractor.name,
      content: [
        `Entity: Contractor ${contractor.name}`,
        `License ${contractor.license}; county ${contractor.county}; trades ${contractor.trades.join(", ")}.`,
        `Project count ${contractor.projects}; BBB ${contractor.bbb}; review ${contractor.review}; complaints ${contractor.complaints.length}.`,
        `Complaints: ${contractor.complaints.map((complaint) => `${complaint.date} ${complaint.status}: ${complaint.summary}`).join("; ") || "none"}.`,
        `Linked projects: ${projects.join("; ") || "none in loaded corpus"}.`
      ].join("\n"),
      citations: contractor.src,
      metadata: { county: contractor.county, bbb: contractor.bbb, projects: contractor.projects, complaints: contractor.complaints.length }
    }));
  }

  for (const business of data.businesses) {
    const locations = business.locations.map((id) => data.properties.find((item) => item.id === id)).filter(Boolean);
    docs.push(doc({
      id: `business:${business.id}`,
      entityType: "business",
      entityId: business.id,
      title: business.name,
      content: [
        `Entity: Business ${business.name}`,
        `Type ${business.btype}; Sunbiz ${business.sunbiz}; status ${business.status}; owner ${business.owner}; registered ${business.registered}.`,
        `Locations: ${locations.map((property) => `${property.address}, ${property.city}`).join("; ") || "none linked"}.`,
        `Property footprint: ${business.locations.length}.`
      ].join("\n"),
      citations: business.src,
      metadata: { businessType: business.btype, status: business.status, locations: business.locations.length }
    }));
  }

  for (const owner of data.owners) {
    const properties = owner.props.map((id) => data.properties.find((item) => item.id === id)).filter(Boolean);
    docs.push(doc({
      id: `owner:${owner.id}`,
      entityType: "owner",
      entityId: owner.id,
      title: owner.name,
      content: [
        `Entity: Owner ${owner.name}`,
        `Owner type ${owner.type}; since ${owner.since}.`,
        `Properties: ${properties.map((property) => `${property.address}, ${property.city}, ${property.class}`).join("; ") || "none linked"}.`,
        `Property footprint: ${owner.props.length}.`
      ].join("\n"),
      citations: owner.src,
      metadata: { ownerType: owner.type, properties: owner.props.length }
    }));
  }

  for (const tenant of data.tenants) {
    const locations = tenant.locations.map((id) => data.properties.find((item) => item.id === id)).filter(Boolean);
    const businesses = tenant.businesses.map((id) => data.businesses.find((item) => item.id === id)).filter(Boolean);
    docs.push(doc({
      id: `tenant:${tenant.id}`,
      entityType: "tenant",
      entityId: tenant.id,
      title: tenant.name,
      content: [
        `Entity: Tenant ${tenant.name}`,
        `Tenant type ${tenant.ttype}; activity ${tenant.activity}.`,
        `Locations: ${locations.map((property) => `${property.address}, ${property.city}`).join("; ") || "none linked"}.`,
        `Associated businesses: ${businesses.map((business) => `${business.name} ${business.btype}`).join("; ") || "none linked"}.`
      ].join("\n"),
      citations: tenant.src,
      metadata: { tenantType: tenant.ttype, locations: tenant.locations.length, businesses: tenant.businesses.length }
    }));
  }

  docs.push(doc({
    id: "lexicon:entities-relationships",
    entityType: "graph",
    entityId: "oracle-lexicon",
    title: "Oracle Elephant Lexicon",
    content: [
      "Entity: Oracle Elephant Lexicon",
      "Canonical entities: Property, Owner, Tenant, Business, Contractor, Permit, Address, Parcel, Project, Review, Complaint, PublicRecord.",
      "Canonical relationships: property-owned-by-owner, property-has-permit, permit-performed-by-contractor, property-occupied-by-tenant, business-operates-at-property, contractor-has-complaint.",
      "Responses must preserve source provenance, source URLs, collection timestamps, refresh timestamps, and lineage metadata."
    ].join("\n"),
    citations: (data.sourceSnapshots || []).map((source) => ({
      system: source.label,
      url: source.repo,
      collected: data.corpus.lastRefresh,
      refreshed: data.corpus.lastRefresh,
      entity: `${source.id}@${source.commit}`
    })),
    metadata: { sourceSnapshots: (data.sourceSnapshots || []).length }
  }));

  return docs;
}

function doc(input) {
  const citations = uniqueCitations(input.citations || []);
  return {
    ...input,
    citations,
    sourceSystems: [...new Set(citations.map((source) => source.system).filter(Boolean))],
    contentHash: crypto.createHash("sha256").update(input.content).digest("hex")
  };
}

function loadOracleData() {
  global.window = {};
  require("../oracle-data.js");
  const referenceSnapshot = require("../packages/team-kit-source/src/generated/reference-snapshot.json");
  const data = global.window.ORACLE_DATA;
  if (!data) throw new Error("Oracle fixture corpus was not loaded.");
  data.agents = referenceSnapshot.agents;
  data.sourceSnapshots = referenceSnapshot.sources;
  data.corpus.sources += referenceSnapshot.sources.length;
  return data;
}

function uniqueCitations(citations) {
  const out = new Map();
  for (const citation of citations) {
    out.set(`${citation.system}:${citation.url}:${citation.entity || ""}`, citation);
  }
  return [...out.values()];
}

function contractorsFor(data, property) {
  const ids = new Set(property.permits.map((permit) => permit.contractor));
  return data.contractors.filter((contractor) => ids.has(contractor.id));
}

function isOpen(status) {
  return ["Open", "Active", "Issued"].includes(status);
}

function money(value) {
  return `$${Number(value).toLocaleString("en-US")}`;
}

module.exports = {
  RAG_TABLE_NAME,
  DEFAULT_RAG_EMBEDDING_MODEL,
  DEFAULT_RAG_ANSWER_MODEL,
  DEFAULT_RAG_TOP_K,
  RAG_EMBEDDING_DIMENSIONS,
  buildOracleRagDocuments,
  loadOracleData
};
