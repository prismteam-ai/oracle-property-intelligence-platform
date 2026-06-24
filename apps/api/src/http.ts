import {
  advanceAgent,
  createInitialRegistry,
  registerManualAgent,
  type ManualAgentRegistration
} from "../../../packages/agent-registry/src/index.js";
import type {
  AgentRecord,
  AgentStatus,
  CommandCenterSnapshot,
  DataPlaneMode,
  DataPlaneStatus,
  EvidenceRun,
  InquiryResult,
  OracleData,
  RegistryState,
  StructuredQuery
} from "@oracle-command-center/domain";
import { createEvidenceRun, createSeedEvidenceRuns } from "../../../packages/evidence-ledger/src/index.js";
import {
  createOracleDataSource,
  ELEPHANT_QUERY_DB_CONTRACT,
  FixtureOracleDataSource,
  type OracleDataSourceEnv,
  type OracleDataSourceHealth
} from "../../../packages/oracle-data-source/src/index.js";
import { askOracleRag, createRagUnavailableResult, type OracleRagEnv } from "../../../packages/rag/src/index.js";
import { createFixtureRetrievalIndex } from "../../../packages/retrieval/src/index.js";

const DEFAULT_INQUIRY_LABEL = "Show all properties with more than one open permit";

const DEFAULT_MANUAL_AGENT: ManualAgentRegistration = {
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

interface RuntimeLoad {
  data: OracleData;
  dataPlane: DataPlaneStatus;
}

export interface CommandCenterActionInput {
  action?: string;
  label?: string;
  query?: string;
  structured?: StructuredQuery;
  agentId?: string;
  status?: AgentStatus;
  registration?: ManualAgentRegistration;
}

export interface CommandCenterActionResponse {
  ok: boolean;
  snapshot: CommandCenterSnapshot;
  dataPlane: DataPlaneStatus;
  result?: InquiryResult;
  agentId?: string;
  error?: string;
}

type HttpRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
};

type HttpResponse = {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
  status?: (statusCode: number) => HttpResponse;
  json?: (body: unknown) => void;
};

type RuntimeEnv = OracleDataSourceEnv & OracleRagEnv;

const globalEnv = globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } };
let registryState: RegistryState | null = null;
let registrySeedKey: string | null = null;
let manualAgents: AgentRecord[] = [];
let evidenceRuns: EvidenceRun[] | null = null;

export async function handleCommandCenterAction(
  input: CommandCenterActionInput = {},
  env: RuntimeEnv = globalEnv.process?.env ?? {}
): Promise<CommandCenterActionResponse> {
  const runtime = await loadRuntime(env);
  const data = overlayManualAgents(runtime.data);
  const registry = getRegistry(data);
  const action = input.action ?? "boot";

  if (action === "runRequiredInquiry") {
    return recordInquiry(runtime, data, registry, input.label || DEFAULT_INQUIRY_LABEL, "required");
  }

  if (action === "askNaturalLanguage") {
    return recordNaturalLanguageInquiry(runtime, data, registry, input.query || DEFAULT_INQUIRY_LABEL, env);
  }

  if (action === "structuredSearch") {
    const result = createFixtureRetrievalIndex(data).structuredSearch(input.structured ?? {});
    return withResult(runtime, data, registry, result.headerLabel, result);
  }

  if (action === "updateAgentStatus" && input.agentId && input.status) {
    const nextRegistry = advanceAgent(registry, input.agentId, input.status);
    updateRegistry(data, nextRegistry);
    return {
      ok: true,
      snapshot: snapshotOf(data, nextRegistry),
      dataPlane: runtime.dataPlane
    };
  }

  if (action === "registerExternalAgent") {
    const registration = input.registration ?? DEFAULT_MANUAL_AGENT;
    const existing = data.agents.find((agent) => agent.id === (registration.id ?? ""));
    if (existing) {
      return {
        ok: true,
        snapshot: snapshotOf(data, registry),
        dataPlane: runtime.dataPlane,
        agentId: existing.id
      };
    }
    const result = registerManualAgent(data, registry, registration);
    manualAgents = [...manualAgents.filter((agent) => agent.id !== result.agent.id), result.agent];
    updateRegistry(result.data, result.registry);
    return {
      ok: true,
      snapshot: snapshotOf(result.data, result.registry),
      dataPlane: runtime.dataPlane,
      agentId: result.agent.id
    };
  }

  return recordInquiry(runtime, data, registry, DEFAULT_INQUIRY_LABEL, "required");
}

export async function handleCommandCenterHttp(request: HttpRequest, response: HttpResponse): Promise<void> {
  response.setHeader?.("Content-Type", "application/json; charset=utf-8");
  response.setHeader?.("Cache-Control", "no-store");
  response.setHeader?.("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader?.("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    const input = request.method === "GET" ? readGetInput(request) : await readJsonInput(request);
    const payload = await handleCommandCenterAction(input);
    sendJson(response, 200, payload);
  } catch (error) {
    const runtime = await loadRuntime(globalEnv.process?.env ?? {});
    const data = overlayManualAgents(runtime.data);
    const registry = getRegistry(data);
    sendJson(response, 500, {
      ok: false,
      snapshot: snapshotOf(data, registry),
      dataPlane: {
        ...runtime.dataPlane,
        activeMode: "fixture",
        ready: true,
        fallbackReason: messageOf(error),
        message: "Server action failed; fixture fallback remains available."
      },
      error: messageOf(error)
    } satisfies CommandCenterActionResponse);
  }
}

async function loadRuntime(env: OracleDataSourceEnv): Promise<RuntimeLoad> {
  const configuredMode = configuredModeOf(env);
  if (configuredMode === "elephant-query-db") {
    try {
      const live = createOracleDataSource(env);
      const health = await live.health();
      if (health.ready) {
        const data = await live.getOracleData();
        return {
          data,
          dataPlane: dataPlaneFromHealth(health, configuredMode, "elephant-query-db")
        };
      }
      return fixtureRuntime(configuredMode, health.message ?? "Live Elephant Query DB contract is not ready.", health);
    } catch (error) {
      return fixtureRuntime(configuredMode, messageOf(error));
    }
  }

  return fixtureRuntime(configuredMode);
}

async function fixtureRuntime(
  configuredMode: DataPlaneMode,
  fallbackReason?: string,
  failedHealth?: OracleDataSourceHealth
): Promise<RuntimeLoad> {
  const fixture = new FixtureOracleDataSource();
  const health = await fixture.health();
  return {
    data: await fixture.getOracleData(),
    dataPlane: {
      ...dataPlaneFromHealth(health, configuredMode, "fixture"),
      fallbackReason,
      missing: failedHealth?.missing,
      message: fallbackReason
        ? `Fixture fallback active. ${fallbackReason}`
        : "Fixture corpus active. Set ORACLE_DATA_SOURCE=elephant-query-db and DATABASE_URL to enable live DB mode."
    }
  };
}

function recordInquiry(
  runtime: RuntimeLoad,
  data: OracleData,
  registry: RegistryState,
  text: string,
  mode: "required"
): CommandCenterActionResponse {
  const retrieval = createFixtureRetrievalIndex(data);
  const result = retrieval.runRequiredInquiry(text);
  return withResult(runtime, data, registry, text, result);
}

async function recordNaturalLanguageInquiry(
  runtime: RuntimeLoad,
  data: OracleData,
  registry: RegistryState,
  query: string,
  env: RuntimeEnv
): Promise<CommandCenterActionResponse> {
  let result: InquiryResult;
  try {
    result = await askOracleRag(data, query, env);
  } catch (error) {
    result = createRagUnavailableResult(query, error, env);
  }
  return withResult(runtime, data, registry, query, result);
}

function withResult(
  runtime: RuntimeLoad,
  data: OracleData,
  registry: RegistryState,
  query: string,
  result: InquiryResult
): CommandCenterActionResponse {
  const run = createEvidenceRun(data, registry, query, result);
  evidenceRuns = [run, ...getEvidenceRuns(data, registry)];
  return {
    ok: true,
    snapshot: snapshotOf(data, registry),
    dataPlane: runtime.dataPlane,
    result
  };
}

function overlayManualAgents(data: OracleData): OracleData {
  if (!manualAgents.length) return data;
  const existing = new Set(data.agents.map((agent) => agent.id));
  return {
    ...data,
    agents: [...data.agents, ...manualAgents.filter((agent) => !existing.has(agent.id))]
  };
}

function snapshotOf(data: OracleData, registry: RegistryState): CommandCenterSnapshot {
  return {
    data,
    registry,
    evidenceRuns: getEvidenceRuns(data, registry)
  };
}

function getEvidenceRuns(data: OracleData, registry: RegistryState): EvidenceRun[] {
  evidenceRuns ??= createSeedEvidenceRuns(data, registry, 3);
  return evidenceRuns;
}

function getRegistry(data: OracleData): RegistryState {
  const seedKey = data.agents.map((agent) => `${agent.id}:${agent.sourceCommit ?? agent.version}`).join("|");
  if (!registryState || registrySeedKey !== seedKey) {
    registryState = createInitialRegistry(data);
    registrySeedKey = seedKey;
  }
  return registryState;
}

function updateRegistry(data: OracleData, next: RegistryState): RegistryState {
  registrySeedKey = data.agents.map((agent) => `${agent.id}:${agent.sourceCommit ?? agent.version}`).join("|");
  registryState = next;
  return next;
}

function dataPlaneFromHealth(
  health: OracleDataSourceHealth,
  configuredMode: DataPlaneMode,
  activeMode: DataPlaneMode
): DataPlaneStatus {
  return {
    configuredMode,
    activeMode,
    ready: health.ready,
    server: true,
    resource: health.resource,
    message: health.message ?? "Data source is ready.",
    contractSource: ELEPHANT_QUERY_DB_CONTRACT.source,
    coverage: health.coverage ? { ...health.coverage } : undefined,
    missing: health.missing
  };
}

function configuredModeOf(env: OracleDataSourceEnv): DataPlaneMode {
  return env.ORACLE_DATA_SOURCE === "elephant-query-db" ? "elephant-query-db" : "fixture";
}

async function readJsonInput(request: HttpRequest): Promise<CommandCenterActionInput> {
  if (request.body && typeof request.body === "object") return request.body as CommandCenterActionInput;
  if (typeof request.body === "string") return parseJson(request.body);

  const stream = request as unknown as AsyncIterable<Uint8Array | string>;
  if (typeof stream[Symbol.asyncIterator] !== "function") return {};

  let raw = "";
  for await (const chunk of stream) {
    raw += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }
  return parseJson(raw);
}

function readGetInput(request: HttpRequest): CommandCenterActionInput {
  const url = new URL(request.url ?? "/api/command-center", "http://localhost");
  const action = firstQueryValue(request.query?.action) ?? url.searchParams.get("action") ?? "boot";
  return { action };
}

function parseJson(raw: string): CommandCenterActionInput {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return typeof parsed === "object" && parsed !== null ? (parsed as CommandCenterActionInput) : {};
}

function sendJson(response: HttpResponse, statusCode: number, body: unknown): void {
  if (response.status && response.json) {
    const responder = response.status(statusCode);
    responder.json?.(body);
    return;
  }
  response.statusCode = statusCode;
  response.end?.(statusCode === 204 ? undefined : JSON.stringify(body));
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
