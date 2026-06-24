import {
  advanceAgent,
  availableActions,
  createInitialRegistry,
  getAgentStatus,
  hiddenMarketplaceCount,
  listMarketplaceAgents,
  registerManualAgent,
  registryMetrics,
  type ManualAgentRegistration,
  type RegistryAction
} from "@oracle-command-center/agent-registry";
import {
  type AgentStatus,
  type CommandCenterSnapshot,
  type DataPlaneStatus,
  type EntityType,
  type EvidenceRun,
  type InquiryResult,
  type StructuredQuery
} from "@oracle-command-center/domain";
import { createEvidenceRun, createSeedEvidenceRuns } from "@oracle-command-center/evidence-ledger";
import { fixtureData } from "@oracle-command-center/fixtures";
import { createFixtureRetrievalIndex } from "@oracle-command-center/retrieval";

export const demoManualAgent: ManualAgentRegistration = {
  id: "parcel-risk-scout",
  display: "Parcel Risk Scout",
  role: "Operator-submitted acquisition-risk agent",
  owner: "PRISM demo operator",
  version: "0.1.0",
  summary:
    "Scores parcels for redevelopment, ownership-change, contractor-quality, and occupancy-turnover signals by reusing certified Oracle intelligence outputs.",
  triggers: "/parcel-risk-scout Score a property watchlist",
  skills: ["structured-property-search", "evidence-ledger-read", "risk-signal-ranking"],
  deps: ["oracle", "evidence-ledger", "agent-network-registry"],
  runtime: "Vercel AI SDK ToolLoopAgent · Bedrock-ready",
  docs: "manual://agent-network/parcel-risk-scout",
  capabilities: ["risk scoring", "watchlist triage", "evidence-backed recommendations"],
  inputs: ["parcel identifiers", "risk-weighting profile", "certified Oracle result set"],
  outputs: ["ranked parcel watchlist", "risk rationale", "source-backed evidence bundle"],
  usage: "Select certified Oracle results, run a parcel risk score, then attach the Evidence run to reviewer notes.",
  install: "Certify in the Agent Network Registry, then invoke from Marketplace with a parcel watchlist payload.",
  dataSources: ["Oracle property intelligence", "Evidence ledger", "Agent registry"],
  connectedTools: ["ToolLoopAgent", "Bedrock embeddings", "OpenSearch retrieval"],
  networkInteractions: ["consumes oracle", "writes evidence", "publishes marketplace profile"]
};

export type { CommandCenterSnapshot } from "@oracle-command-center/domain";

export const localFixtureDataPlane: DataPlaneStatus = {
  configuredMode: "fixture",
  activeMode: "fixture",
  ready: true,
  server: false,
  resource: "deterministic-fixture-corpus",
  message: "Static fixture mode is active in the browser. The initial fixture view and structured filters work locally; typed RAG and required prompt launches require the server API with Neon pgvector and OpenAI.",
  contractSource: "soofi-xyz/soofi-xyz-team-kit#54",
  coverage: {
    properties: fixtureData.properties.length,
    permits: fixtureData.properties.reduce((sum, property) => sum + property.permits.length, 0)
  }
};

export function createInitialSnapshot(): CommandCenterSnapshot {
  const registry = createInitialRegistry(fixtureData);
  return {
    data: fixtureData,
    registry,
    evidenceRuns: createSeedEvidenceRuns(fixtureData, registry, 3)
  };
}

export function runRequiredInquiry(snapshot: CommandCenterSnapshot, label: string): CommandCenterSnapshot & { result: InquiryResult } {
  const result = createFixtureRetrievalIndex(snapshot.data).runRequiredInquiry(label);
  return withEvidence(snapshot, label, result);
}

export function askNaturalLanguage(snapshot: CommandCenterSnapshot, query: string): CommandCenterSnapshot & { result: InquiryResult } {
  const result: InquiryResult = {
    query,
    headerLabel: query,
    count: 0,
    note: "Server-side RAG is required for free-text natural-language queries.",
    cards: [],
    citations: [],
    hasAnswer: true,
    answer:
      "The browser fallback no longer runs deterministic regex or keyword scoring for natural language. Start the server, set DATABASE_URL and OPENAI_API_KEY, run pnpm rag:seed, then submit this query again.",
    isGraph: false,
    retrieval: {
      mode: "pgvector",
      provider: "neon-openai",
      status: "unconfigured",
      embeddingModel: "text-embedding-3-small",
      answerModel: "gpt-5.4-mini",
      topK: 8,
      retrieved: [],
      citationCount: 0,
      errorCode: "server-unavailable",
      message: "No server RAG response was available."
    }
  };
  return withEvidence(snapshot, query, result);
}

export function structuredSearch(snapshot: CommandCenterSnapshot, query: StructuredQuery): CommandCenterSnapshot & { result: InquiryResult } {
  const result = createFixtureRetrievalIndex(snapshot.data).structuredSearch(query);
  return withEvidence(snapshot, result.headerLabel, result);
}

export function getLexicon(snapshot: CommandCenterSnapshot) {
  return createFixtureRetrievalIndex(snapshot.data).lexicon();
}

export function getDetail(snapshot: CommandCenterSnapshot, type: EntityType, id: string) {
  return createFixtureRetrievalIndex(snapshot.data).getDetail(type, id);
}

export function getRelationshipGraph(snapshot: CommandCenterSnapshot, propertyId: string) {
  return createFixtureRetrievalIndex(snapshot.data).getRelationshipGraph(propertyId);
}

export function updateAgentStatus(snapshot: CommandCenterSnapshot, agentId: string, to: AgentStatus): CommandCenterSnapshot {
  return {
    ...snapshot,
    registry: advanceAgent(snapshot.registry, agentId, to)
  };
}

export function registerExternalAgent(
  snapshot: CommandCenterSnapshot,
  input: ManualAgentRegistration = demoManualAgent
): CommandCenterSnapshot & { agentId: string } {
  const existing = snapshot.data.agents.find((agent) => agent.id === (input.id ?? ""));
  if (existing) {
    return {
      ...snapshot,
      agentId: existing.id
    };
  }
  const result = registerManualAgent(snapshot.data, snapshot.registry, input);
  return {
    ...snapshot,
    data: result.data,
    registry: result.registry,
    agentId: result.agent.id
  };
}

export function agentStatus(snapshot: CommandCenterSnapshot, agentId: string): AgentStatus {
  return getAgentStatus(snapshot.registry, agentId);
}

export function agentActions(snapshot: CommandCenterSnapshot, agentId: string): RegistryAction[] {
  return availableActions(agentStatus(snapshot, agentId));
}

export function marketplaceAgents(snapshot: CommandCenterSnapshot) {
  return listMarketplaceAgents(snapshot.data, snapshot.registry);
}

export function hiddenAgents(snapshot: CommandCenterSnapshot): number {
  return hiddenMarketplaceCount(snapshot.data, snapshot.registry);
}

export function getRegistryMetrics(snapshot: CommandCenterSnapshot) {
  return registryMetrics(snapshot.data, snapshot.registry);
}

function withEvidence(snapshot: CommandCenterSnapshot, query: string, result: InquiryResult): CommandCenterSnapshot & { result: InquiryResult } {
  const run: EvidenceRun = createEvidenceRun(snapshot.data, snapshot.registry, query, result);
  return {
    ...snapshot,
    evidenceRuns: [run, ...snapshot.evidenceRuns],
    result
  };
}
