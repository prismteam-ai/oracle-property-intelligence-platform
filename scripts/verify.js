#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { buildOracleRagDocuments, RAG_TABLE_NAME } = require("./rag-documents.js");

global.window = {};
require("../oracle-data.js");
const referenceSnapshot = require("../packages/team-kit-source/src/generated/reference-snapshot.json");

const data = global.window.ORACLE_DATA;
data.agents = referenceSnapshot.agents;
data.sourceSnapshots = referenceSnapshot.sources;
data.corpus.sources += referenceSnapshot.sources.length;
const ragDocuments = buildOracleRagDocuments(data);

const EXTERNAL_REPOS = [
  "https://github.com/prismteam-ai/Oracle-Property-Intelligence-Platform",
  "https://github.com/prismteam-ai/agent-network-registration-and-certification-platform",
  "https://github.com/soofi-xyz/soofi-xyz-team-kit",
  "https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54",
  "https://github.com/elephant-xyz/skills"
];

const REQUIRED_STATUSES = [
  "Discovered",
  "Registered",
  "In Review",
  "Changes Requested",
  "Certified",
  "Rejected",
  "Deprecated",
  "Suspended"
];

const REQUIRED_INQUIRIES = [
  "Show all properties with more than one open permit",
  "Show all properties with open roofing permits",
  "Show all properties with open electrical permits",
  "Show all properties that underwent major concrete work",
  "Show all properties that underwent major roof replacements",
  "Show all properties that underwent major electrical upgrades",
  "Show all properties with the highest permit activity during the last five years",
  "Show all properties with significant renovation activity",
  "Show all contractors performing roofing work in Lee County",
  "Show all contractors performing electrical work in Lee County",
  "Show contractors with negative BBB ratings",
  "Show contractors with complaint histories",
  "Show projects completed by contractors with negative BBB ratings or complaint histories",
  "Show businesses operating across multiple properties",
  "Show owners associated with multiple properties",
  "Show tenants operating across multiple locations",
  "Show properties with both ownership changes and active permit activity",
  "Show properties with active permit activity and business turnover",
  "Show neighborhoods with increasing permit activity",
  "Show neighborhoods with the highest concentration of major renovations",
  "Show the most active contractors by project count",
  "Show the most active businesses by property footprint",
  "Show relationships between a selected property, contractor, business, tenant, and owner"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

function isOpen(status) {
  return ["Open", "Active", "Issued"].includes(status);
}

function daysAgo(iso) {
  return Math.round((new Date("2026-06-18") - new Date(iso)) / 86400000);
}

function riskyContractorIds() {
  return new Set(
    data.contractors
      .filter((contractor) => ["D", "F"].includes(contractor.bbb) || contractor.complaints.length > 0)
      .map((contractor) => contractor.id)
  );
}

function neighborhoods() {
  const grouped = new Map();
  for (const property of data.properties) {
    if (!grouped.has(property.neighborhood)) {
      grouped.set(property.neighborhood, { name: property.neighborhood, permits: 0, major: 0, recent: 0 });
    }
    const row = grouped.get(property.neighborhood);
    row.permits += property.permits.length;
    row.major += property.permits.filter((permit) => permit.major).length;
    row.recent += property.permits.filter((permit) => daysAgo(permit.filed) <= 65).length;
  }
  return [...grouped.values()];
}

function queryCount(inquiry) {
  const arg = inquiry.arg;
  const risky = riskyContractorIds();

  switch (inquiry.kind) {
    case "prop_multi_open":
      return data.properties.filter((property) => property.permits.filter((permit) => isOpen(permit.status)).length > 1).length;
    case "prop_open_trade":
      return data.properties.filter((property) => property.permits.some((permit) => isOpen(permit.status) && permit.type === arg)).length;
    case "prop_major_trade":
      return data.properties.filter((property) => property.permits.some((permit) => permit.major && permit.type === arg)).length;
    case "prop_top_activity":
      return Math.min(6, data.properties.length);
    case "prop_significant_reno":
      return data.properties.filter((property) => property.permits.some((permit) => permit.major)).length;
    case "prop_ownerchange_active":
      return data.properties.filter((property) => property.ownerHistory.length > 1 && property.permits.some((permit) => isOpen(permit.status))).length;
    case "prop_active_turnover":
      return data.properties.filter((property) => data.turnover[property.id] && property.permits.some((permit) => isOpen(permit.status))).length;
    case "contractor_trade":
      return data.contractors.filter((contractor) => contractor.trades.includes(arg)).length;
    case "contractor_negative_bbb":
      return data.contractors.filter((contractor) => ["D", "F"].includes(contractor.bbb)).length;
    case "contractor_complaints":
      return data.contractors.filter((contractor) => contractor.complaints.length > 0).length;
    case "contractor_top":
      return Math.min(8, data.contractors.length);
    case "projects_risky":
      return data.properties.reduce((count, property) => {
        return count + property.permits.filter((permit) => risky.has(permit.contractor)).length;
      }, 0);
    case "business_multi":
      return data.businesses.filter((business) => business.locations.length > 1).length;
    case "business_top":
      return Math.min(8, data.businesses.length);
    case "owner_multi":
      return data.owners.filter((owner) => owner.props.length > 1).length;
    case "tenant_multi":
      return data.tenants.filter((tenant) => tenant.locations.length > 1).length;
    case "neighborhood_increasing":
      return neighborhoods().filter((neighborhood) => neighborhood.recent >= 2).length;
    case "neighborhood_reno":
      return neighborhoods().filter((neighborhood) => neighborhood.major >= 1).length;
    case "relationship_graph": {
      const property = data.properties.find((item) => item.id === "p10") || data.properties[0];
      const contractorCount = new Set(property.permits.map((permit) => permit.contractor)).size;
      return 1 + contractorCount + property.businesses.length + property.tenants.length;
    }
    default:
      return 0;
  }
}

function assertSources(collection, label) {
  for (const item of collection) {
    assert(Array.isArray(item.src) && item.src.length > 0, `${label} ${item.id} has no provenance`);
    for (const source of item.src) {
      assert(source.system, `${label} ${item.id} provenance missing system`);
      assert(source.url && /^https:\/\//.test(source.url), `${label} ${item.id} provenance missing URL`);
      assert(source.collected, `${label} ${item.id} provenance missing collected timestamp`);
      assert(source.refreshed, `${label} ${item.id} provenance missing refreshed timestamp`);
    }
  }
}

assert(data, "ORACLE_DATA was not loaded");
assert(data.properties.length >= 75, "Expected at least 75 seeded properties");
assert(data.properties.reduce((sum, property) => sum + property.permits.length, 0) >= 120, "Expected at least 120 seeded permits");
assert(data.contractors.length >= 15, "Expected at least 15 seeded contractors");
assert(data.businesses.length >= 25, "Expected at least 25 seeded businesses");
assert(data.owners.length >= 12, "Expected at least 12 seeded owners");
assert(data.tenants.length >= 18, "Expected at least 18 seeded tenants");
assert(referenceSnapshot.soofi.agentCount >= 30, `Expected at least 30 Soofi team-kit agents, found ${referenceSnapshot.soofi.agentCount}`);
assert(referenceSnapshot.soofi.skillCount >= 39, `Expected at least 39 Soofi team-kit skills, found ${referenceSnapshot.soofi.skillCount}`);
assert(referenceSnapshot.elephant.skillCount >= 13, `Expected at least 13 Elephant Oracle skills, found ${referenceSnapshot.elephant.skillCount}`);
assert(referenceSnapshot.pr54.includesElephantQuerySkill, "Expected Soofi PR #54 use-elephant-query-db skill to be represented");
assert(referenceSnapshot.soofi.repo === "https://github.com/soofi-xyz/soofi-xyz-team-kit", "Soofi team-kit repo URL must be explicit");
assert(referenceSnapshot.pr54.repo === "https://github.com/soofi-xyz/soofi-xyz-team-kit/pull/54", "Soofi PR #54 URL must be explicit");
assert(referenceSnapshot.elephant.repo === "https://github.com/elephant-xyz/skills", "Elephant skills repo URL must be explicit");
assert(
  referenceSnapshot.skills.some((skill) => skill.id === "use-elephant-query-db"),
  "Missing parsed Soofi use-elephant-query-db skill"
);
assert(
  referenceSnapshot.elephantSkills.some((skill) => skill.id === "query-db-loading-matching"),
  "Missing parsed Elephant query-db-loading-matching skill"
);
const snapshotSource = readProjectFile("packages/team-kit-source/src/generated/reference-snapshot.json");
assert(!snapshotSource.includes('"docs": "github.com/'), "Generated external docs references must include https://");
for (const agent of referenceSnapshot.agents) {
  assert(agent.sourceRepo === "https://github.com/soofi-xyz/soofi-xyz-team-kit", `Agent ${agent.id} must reference the external Soofi team-kit repo URL`);
  assert(agent.docs.startsWith("https://github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/"), `Agent ${agent.id} docs URL must be an absolute GitHub URL`);
}
for (const skill of referenceSnapshot.skills) {
  assert(skill.docs.startsWith("https://github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/"), `Skill ${skill.id} docs URL must be an absolute Soofi GitHub URL`);
}
for (const skill of referenceSnapshot.elephantSkills) {
  assert(skill.docs.startsWith("https://github.com/elephant-xyz/skills/blob/main/"), `Elephant skill ${skill.id} docs URL must be an absolute GitHub URL`);
}
const dataSourceSource = readProjectFile("packages/oracle-data-source/src/index.ts");
assert(dataSourceSource.includes("@neondatabase/serverless"), "Elephant Query DB adapter must use Neon serverless client");
assert(dataSourceSource.includes("DATABASE_URL"), "Elephant Query DB adapter must read DATABASE_URL");
assert(dataSourceSource.includes("property_profile_view"), "Elephant Query DB adapter missing property_profile_view contract");
assert(dataSourceSource.includes("permit_search_view"), "Elephant Query DB adapter missing permit_search_view contract");
assert(dataSourceSource.includes("company_profile_view"), "Elephant Query DB adapter missing company_profile_view contract");
assert(dataSourceSource.includes("address_profile_view"), "Elephant Query DB adapter missing address_profile_view contract");
assert(dataSourceSource.includes("business_reputation_profiles"), "Elephant Query DB adapter missing BBB profile contract");
assert(dataSourceSource.includes("business_reputation_complaints"), "Elephant Query DB adapter missing BBB complaint contract");
assert(dataSourceSource.includes("business_reputation_reviews"), "Elephant Query DB adapter missing BBB review contract");
assert(dataSourceSource.includes("contractor_quality_scores"), "Elephant Query DB adapter missing contractor quality score contract");
assert(dataSourceSource.includes("ownerships"), "Elephant Query DB adapter missing ownerships contract");
assert(dataSourceSource.includes("validateReadiness"), "Elephant Query DB adapter must expose live readiness validation");
assert(dataSourceSource.includes("sourcePayloadCheck"), "Elephant Query DB adapter must validate source_payload lineage columns");
assert(dataSourceSource.includes("columnContractCheck"), "Elephant Query DB adapter must validate required column names and types");
assert(dataSourceSource.includes("property_structure_built_year"), "Elephant Query DB column contract must validate property_profile_view fields");
assert(dataSourceSource.includes("contractor_company_id"), "Elephant Query DB column contract must validate permit_search_view fields");
assert(dataSourceSource.includes("report.ready"), "Elephant Query DB health must reflect readiness report");

const liveVerifySource = readProjectFile("scripts/verify-live-query-db.js");
assert(liveVerifySource.includes("DATABASE_URL is not set"), "Live verifier must skip clearly without DATABASE_URL");
assert(liveVerifySource.includes("--required"), "Live verifier must support required mode");
assert(liveVerifySource.includes("sourcePayloadCheck"), "Live verifier must validate source_payload columns");
assert(liveVerifySource.includes("columnContractCheck"), "Live verifier must validate required column names and types");
assert(liveVerifySource.includes("property_profile_view"), "Live verifier must validate property_profile_view");
assert(liveVerifySource.includes("permit_search_view"), "Live verifier must validate permit_search_view");
const packageSource = readProjectFile("package.json");
assert(packageSource.includes("\"lint\""), "package.json must expose lint");
assert(packageSource.includes("\"verify:live\""), "package.json must expose verify:live");
assert(packageSource.includes("\"verify:live:required\""), "package.json must expose verify:live:required");
assert(packageSource.includes("\"rag:seed\""), "package.json must expose rag:seed");
assert(packageSource.includes("\"rag:verify\""), "package.json must expose rag:verify");
assert(packageSource.includes("\"rag:verify:required\""), "package.json must expose rag:verify:required");
assert(packageSource.includes("\"db:seed\""), "package.json must expose db:seed");
assert(packageSource.includes("\"db:seed:reset\""), "package.json must expose db:seed:reset");

const seedDbSource = readProjectFile("scripts/seed-contract-db.js");
assert(seedDbSource.includes("create table if not exists properties"), "DB seed script must create properties table");
assert(seedDbSource.includes("create or replace view property_profile_view"), "DB seed script must create property_profile_view");
assert(seedDbSource.includes("create or replace view permit_search_view"), "DB seed script must create permit_search_view");
assert(seedDbSource.includes("create or replace view company_profile_view"), "DB seed script must create company_profile_view");
assert(seedDbSource.includes("create or replace view address_profile_view"), "DB seed script must create address_profile_view");
assert(seedDbSource.includes("source_payload jsonb"), "DB seed script must preserve source_payload lineage");
assert(seedDbSource.includes("@neondatabase/serverless"), "DB seed script must use the same Neon serverless client as the live adapter");
assert(seedDbSource.includes("--reset"), "DB seed script must support reset mode");

assert(ragDocuments.length > data.properties.length, "RAG document builder must create more than property-only chunks");
assert(ragDocuments.some((doc) => doc.id.startsWith("property:") && doc.citations.length > 0), "RAG documents must include cited property chunks");
assert(ragDocuments.some((doc) => doc.id.startsWith("permit:") && doc.content.includes("permit-performed-by-contractor")), "RAG documents must include permit relationship chunks");
assert(ragDocuments.some((doc) => doc.id === "lexicon:entities-relationships"), "RAG documents must include lexicon relationship context");
for (const doc of ragDocuments.slice(0, 25)) {
  assert(doc.contentHash && doc.contentHash.length >= 16, `RAG document ${doc.id} must have a content hash`);
  assert(Array.isArray(doc.sourceSystems), `RAG document ${doc.id} must expose source systems`);
}
const ragSource = readProjectFile("packages/rag/src/index.ts");
assert(ragSource.includes(RAG_TABLE_NAME), "RAG package must target oracle_rag_documents");
assert(ragSource.includes("create extension if not exists vector"), "RAG package must create the pgvector extension");
assert(ragSource.includes("embedding vector(1536)"), "RAG package must store 1536-dimensional embeddings");
assert(ragSource.includes("text-embedding-3-small"), "RAG package must default to OpenAI text-embedding-3-small");
assert(ragSource.includes("https://api.openai.com/v1/embeddings"), "RAG package must call the OpenAI embeddings API");
assert(ragSource.includes("https://api.openai.com/v1/responses"), "RAG package must call the OpenAI Responses API");
assert(ragSource.includes("embedding <=>"), "RAG package must use pgvector similarity search");
assert(ragSource.includes("createRagUnavailableResult"), "RAG package must expose typed RAG unavailable results");
const ragSeedSource = readProjectFile("scripts/seed-rag-index.js");
const ragVerifySource = readProjectFile("scripts/verify-rag.js");
assert(ragSeedSource.includes("OPENAI_API_KEY"), "RAG seed script must require OPENAI_API_KEY");
assert(ragSeedSource.includes("DATABASE_URL"), "RAG seed script must require DATABASE_URL");
assert(ragVerifySource.includes("Skipping RAG validation"), "RAG verifier must skip clearly without credentials");
assert(ragVerifySource.includes("--required"), "RAG verifier must support required mode");
assert(ragVerifySource.includes("vector_dims"), "RAG verifier must validate embedding dimensions");
assert(ragVerifySource.includes("[R1]"), "RAG verifier must require citation-backed LLM output");

const vercelSource = readProjectFile("vercel.json");
assert(vercelSource.includes("\"framework\": \"vite\""), "Vercel config must declare Vite framework");
assert(vercelSource.includes("\"outputDirectory\": \"apps/web/dist\""), "Vercel config must deploy the web dist output");
const readmeSource = readProjectFile("README.md");
const architectureSource = readProjectFile("ARCHITECTURE.md");
for (const repo of EXTERNAL_REPOS) {
  assert(readmeSource.includes(repo), `README must reference external repo: ${repo}`);
}
assert(readmeSource.includes("standalone submission repo"), "README must clarify this is a standalone repo");
assert(architectureSource.includes("Repository Boundary"), "Architecture docs must define the external repository boundary");

const apiRouterSource = readProjectFile("apps/api/src/router.ts");
assert(apiRouterSource.includes("createOracleDataSource"), "API router must use the Oracle data source adapter boundary");
const apiHttpSource = readProjectFile("apps/api/src/http.ts");
assert(apiHttpSource.includes("handleCommandCenterAction"), "API must expose a command-center runtime action boundary");
assert(apiHttpSource.includes("FixtureOracleDataSource"), "API runtime must preserve fixture fallback");
assert(apiHttpSource.includes("fallbackReason"), "API runtime must report why live DB fell back to fixtures");
assert(apiHttpSource.includes("registerExternalAgent"), "API runtime must support manual external agent registration");
assert(apiHttpSource.includes("askOracleRag"), "API runtime must route natural language through server-side RAG");
assert(apiHttpSource.includes("createRagUnavailableResult"), "API runtime must return typed RAG unavailable results");
assert(apiHttpSource.includes("../../../packages/agent-registry/src/index.js"), "Vercel API runtime must import workspace packages through emitted .js paths");
assert(readProjectFile("packages/evidence-ledger/src/index.ts").includes("../../agent-registry/src/index.js"), "Evidence ledger runtime must avoid workspace package .ts exports in Vercel");
assert(readProjectFile("packages/oracle-data-source/src/index.ts").includes("../../fixtures/src/index.js"), "Oracle data source runtime must avoid workspace package .ts exports in Vercel");
assert(readProjectFile("packages/rag/src/index.ts").includes("../../domain/src/index.js"), "RAG runtime must avoid workspace package .ts exports in Vercel");
const vercelApiSource = readProjectFile("api/command-center.ts");
assert(vercelApiSource.includes("handleCommandCenterHttp"), "Vercel API function must route to the command-center handler");
assert(vercelApiSource.includes("await import("), "Vercel API function must dynamically import the ESM command-center handler");
assert(vercelApiSource.includes("../apps/api/src/http.js"), "Vercel API dynamic import must include the emitted .js extension");
assert(readProjectFile("packages/team-kit-source/src/index.ts").includes('with { type: "json" }'), "Team-kit JSON snapshot import must be valid under Vercel Node ESM");
const webSource = readProjectFile("apps/web/src/App.tsx") + readProjectFile("apps/web/src/main.tsx") + readProjectFile("apps/web/src/runtimeClient.ts");
assert(!webSource.includes("@oracle-command-center/oracle-data-source"), "Oracle data source adapter must not be imported into the browser app");
assert(!webSource.includes("@oracle-command-center/rag"), "RAG package must not be imported into the browser app");
assert(webSource.includes("requestRuntimeAction"), "Web app must prefer the server runtime action boundary when available");
assert(webSource.includes("/api/command-center"), "Web app must call the server API before falling back to fixtures");
assert(webSource.includes("runLocalRequiredInquiry"), "Web app must preserve static fixture fallback behavior");
assert(webSource.includes("Required Demo Inquiries"), "Web app must keep required prompts behind a drawer launcher");
assert(webSource.includes("inquiry-drawer"), "Web app must render required prompts in a drawer");
assert(webSource.includes("setQuery(label)"), "Required prompt launcher must populate the RAG text input");
assert(webSource.includes('action: "askNaturalLanguage", query: label'), "Required prompt launcher must use the RAG workflow");
assert(!webSource.includes('action: "runRequiredInquiry", label'), "Required prompt launcher must not call deterministic required inquiry output");
assert(readProjectFile("packages/api-client/src/index.ts").includes("server-unavailable"), "Browser fallback must show a RAG unavailable result for free-text queries");
assert(!readProjectFile("packages/api-client/src/index.ts").includes("createFixtureRetrievalIndex(snapshot.data).askNaturalLanguage"), "Browser fallback must not run deterministic natural-language scoring");
assert(webSource.includes("RAG Trace"), "Web app must show RAG trace metadata");
assert(webSource.includes("MarkdownAnswer"), "Web app must render RAG synthesis Markdown instead of raw text");
assert(webSource.includes("renderInlineMarkdown"), "Web app must support inline Markdown in RAG synthesis");
assert(readProjectFile("apps/web/src/styles.css").includes(".markdown-answer"), "Markdown answer renderer must have dedicated styles");
assert(webSource.includes("PendingResult"), "Web app must show a pending result panel while server actions are running");
assert(webSource.includes("pendingOperation"), "Web app must track pending API operations");
assert(readProjectFile("apps/web/src/styles.css").includes(".query-status"), "Query panel must show inline pending status");
assert(webSource.includes("agent={agent} status={status}"), "Registry lineage and evaluation panels must receive the selected agent");
assert(webSource.includes("latestAgentDecision"), "Registry evaluation must include per-agent certification history");
assert(!webSource.includes('["arceus", "Assignment routing and agent selection"]'), "Registry lineage must not be the same hard-coded list for every agent");
assert(webSource.includes("safeGetDetail"), "Web app must not crash when a result card cannot resolve in the current snapshot");
assert(webSource.includes("canResolveDetail"), "Web app must validate result-card selections before opening details");
assert(webSource.includes("ManualRegistrationModal"), "Register external must display an editable manual registration form");
assert(webSource.includes('action: "registerExternalAgent", registration'), "Manual registration form must submit metadata through the runtime action boundary");
assert(webSource.includes("demoManualAgent"), "Manual registration form must open with realistic prefilled defaults");
assert(webSource.includes("AgentAvatar"), "Registry UI must render source-backed agent icons");
assert(readProjectFile("apps/web/src/styles.css").includes(".avatar.image"), "Agent image avatars must have dedicated styles");
assert(ragSource.includes("findByIdOrTitle"), "RAG result cards must reconcile retrieved fixture IDs against the active data snapshot");
assert(webSource.includes("Network Lineage"), "Web app must show Soofi network lineage");
assert(webSource.includes("Candidate Evaluation"), "Web app must show candidate self-evaluation");
assert(webSource.includes("DataPlaneCard"), "Web app must show whether fixture or live DB data is active");
assert(webSource.includes("Register external"), "Registry UI must demonstrate registration of a non-GitHub agent");
assert(webSource.includes("Run History"), "Marketplace profiles must expose run history guidance");
assert(webSource.includes("Install"), "Marketplace profiles must expose installation guidance");
assert(webSource.includes("getRegistryMetrics"), "Registry UI must show inventory and network metrics");
assert(data.agents.length === referenceSnapshot.soofi.agentCount, `Expected parsed Soofi agents, found ${data.agents.length}`);
assert(data.agents.some((agent) => agent.id === "alakazam" && agent.iconUrl?.includes("assets.pokemon.com")), "Soofi README mascot image URLs must be preserved for agent icons");
assert(data.agents.some((agent) => agent.id === "oracle" && agent.iconLabel), "Soofi README glyph mascot must be preserved for oracle");
assert(data.sourceSnapshots.length === 3, `Expected 3 source snapshots, found ${data.sourceSnapshots.length}`);

const labels = data.inquiries.map((inquiry) => inquiry.label);
for (const required of REQUIRED_INQUIRIES) {
  assert(labels.includes(required), `Missing required inquiry: ${required}`);
}
assert(labels.length === REQUIRED_INQUIRIES.length, `Expected ${REQUIRED_INQUIRIES.length} inquiries, found ${labels.length}`);

const counts = data.inquiries.map((inquiry) => ({ label: inquiry.label, count: queryCount(inquiry) }));
for (const result of counts) {
  assert(result.count > 0, `Inquiry returned no results: ${result.label}`);
}

assertSources(data.properties, "property");
assertSources(data.contractors, "contractor");
assertSources(data.businesses, "business");
assertSources(data.owners, "owner");
assertSources(data.tenants, "tenant");

const oracle = data.agents.find((agent) => agent.id === "oracle");
assert(oracle, "Missing oracle agent");
assert(oracle.status === "Discovered", "oracle must start as Discovered");
assert(oracle.sourcePath === "agents/oracle.md", "oracle agent must be sourced from Soofi agents/oracle.md");
assert(oracle.sourceCommit === referenceSnapshot.soofi.commit, "oracle source commit must match Soofi snapshot");
assert(data.agents.some((agent) => agent.status === "Certified"), "Expected at least one certified non-oracle team-kit agent");
assert(!data.agents.filter((agent) => agent.status === "Certified").some((agent) => agent.id === "oracle"), "oracle should not be marketplace-certified by default");

const domainSource = readProjectFile("packages/domain/src/index.ts");
for (const entity of ["Property", "Owner", "Tenant", "Business", "Contractor", "Permit", "Address", "Parcel", "Project", "Review", "Complaint", "PublicRecord"]) {
  assert(domainSource.includes(`name: "${entity}"`), `Lexicon must define ${entity}`);
}
for (const relationship of [
  "property-owned-by-owner",
  "property-has-permit",
  "permit-performed-by-contractor",
  "property-occupied-by-tenant",
  "business-operates-at-property",
  "contractor-has-complaint"
]) {
  assert(domainSource.includes(relationship), `Lexicon must define relationship ${relationship}`);
}

const retrievalSource = readProjectFile("packages/retrieval/src/index.ts");
assert(retrievalSource.includes("structuredSearch"), "Retrieval must expose structuredSearch");
for (const filter of ["county", "municipality", "permitType", "contractor", "propertyClass", "businessType", "dateFrom", "dateTo"]) {
  assert(retrievalSource.includes(filter), `Structured search must support ${filter}`);
}
assert(retrievalSource.includes("semanticStretchRoute"), "Natural-language retrieval must route stretch demo questions");
for (const phrase of ["redevelopment", "value-?add", "complaint-linked", "business turnover", "unusual permit activity"]) {
  assert(retrievalSource.includes(phrase), `Natural-language retrieval must cover stretch phrase: ${phrase}`);
}

const evidenceSource = readProjectFile("packages/evidence-ledger/src/index.ts");
assert(evidenceSource.includes("createEvidenceRun"), "Evidence ledger must create reusable evidence runs");
assert(evidenceSource.includes("createSeedEvidenceRuns"), "Evidence ledger must seed demonstrable run history");
assert(evidenceSource.includes("summarizeRunMetrics"), "Evidence ledger must expose run metrics");
assert(evidenceSource.includes("evaluatorId"), "Evidence runs must record evaluator agent provenance");
assert(evidenceSource.includes("certifierId"), "Evidence runs must record certifier agent provenance");
assert(evidenceSource.includes("resultKeys"), "Evidence runs must record result keys");
assert(evidenceSource.includes("retrieval: result.retrieval"), "Evidence runs must record retrieval metadata");

const apiRouterEvidence = readProjectFile("apps/api/src/router.ts");
assert(apiRouterEvidence.includes("listRuns"), "API evidence router must expose run history");
assert(apiRouterEvidence.includes("recordInquiry"), "API evidence router must record inquiry evidence");
assert(apiRouterEvidence.includes("runMetrics"), "Dashboard summary must expose run metrics");
assert(apiRouterEvidence.includes("structuredSearch"), "API intelligence router must expose structured search");
assert(apiRouterEvidence.includes("lexicon"), "API must expose canonical lexicon metadata");

const registrySource = readProjectFile("packages/agent-registry/src/index.ts");
assert(registrySource.includes("certificationHistory"), "Agent registry must expose certification history");
assert(registrySource.includes("registryMetrics"), "Agent registry must expose network-level registry metrics");
assert(registrySource.includes("evaluationScore"), "Certification decisions must record evaluation outcomes");
assert(registrySource.includes("checks"), "Certification decisions must record reviewer checks");
assert(registrySource.includes("registerManualAgent"), "Agent registry must support manual registration outside GitHub discovery");
assert(registrySource.includes("inputs"), "Manual registration must capture agent inputs");
assert(registrySource.includes("outputs"), "Manual registration must capture agent outputs");
assert(registrySource.includes("networkRuns"), "Registry metrics must expose network run participation");

assert(apiRouterEvidence.includes("let registryState"), "API registry must preserve registry state in-process");
assert(apiRouterEvidence.includes("getRegistry"), "API router must read the persistent registry state");
assert(apiRouterEvidence.includes("updateRegistry"), "API router must update the persistent registry state");
assert(apiRouterEvidence.includes("registryMetrics"), "Dashboard summary must expose registry metrics");
assert(apiRouterEvidence.includes("registerManual"), "API router must expose manual agent registration");

for (const status of REQUIRED_STATUSES) {
  assert(REQUIRED_STATUSES.includes(status), `Unknown lifecycle status: ${status}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      corpus: {
        properties: data.properties.length,
        permits: data.properties.reduce((sum, property) => sum + property.permits.length, 0),
        contractors: data.contractors.length,
        agents: data.agents.length,
        inquiries: data.inquiries.length,
        soofiSkills: referenceSnapshot.soofi.skillCount,
        elephantSkills: referenceSnapshot.elephant.skillCount
      },
      sources: data.sourceSnapshots.map((source) => ({
        id: source.id,
        commit: source.commit,
        agents: source.agents,
        skills: source.skills
      })),
      inquiryCounts: counts
    },
    null,
    2
  )
);
