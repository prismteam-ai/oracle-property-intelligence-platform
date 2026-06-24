import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  advanceAgent,
  certificationHistory,
  createInitialRegistry,
  getAgentStatus,
  hiddenMarketplaceCount,
  listMarketplaceAgents,
  registerManualAgent,
  registryMetrics
} from "@oracle-command-center/agent-registry";
import { createEvidenceRun, createSeedEvidenceRuns, summarizeRunMetrics } from "@oracle-command-center/evidence-ledger";
import { createOracleDataSource, type OracleDataSourceEnv } from "@oracle-command-center/oracle-data-source";
import { askOracleRag, createRagUnavailableResult, type OracleRagEnv } from "@oracle-command-center/rag";
import { createFixtureRetrievalIndex } from "@oracle-command-center/retrieval";
import { AGENT_STATUSES, type AgentRecord, type AgentStatus, type OracleData, type RegistryState } from "@oracle-command-center/domain";

const t = initTRPC.create();
const statusSchema = z.enum(AGENT_STATUSES);
const structuredQuerySchema = z.object({
  entity: z.enum(["property", "contractor", "business", "owner", "tenant", "project", "neighborhood", "graph"]).optional(),
  county: z.string().optional(),
  municipality: z.string().optional(),
  permitType: z.string().optional(),
  contractor: z.string().optional(),
  propertyClass: z.string().optional(),
  businessType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).optional()
});
const manualAgentSchema = z.object({
  id: z.string().optional(),
  display: z.string().min(2),
  role: z.string().min(2),
  owner: z.string().min(2),
  version: z.string().optional(),
  summary: z.string().min(10),
  triggers: z.string().min(2),
  skills: z.array(z.string()).optional(),
  deps: z.array(z.string()).optional(),
  runtime: z.string().optional(),
  docs: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  usage: z.string().optional(),
  install: z.string().optional(),
  dataSources: z.array(z.string()).optional(),
  connectedTools: z.array(z.string()).optional(),
  networkInteractions: z.array(z.string()).optional()
});
type RuntimeEnv = OracleDataSourceEnv & OracleRagEnv;

const env = globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } };
const dataSource = createOracleDataSource(env.process?.env ?? {});
let registryState: RegistryState | null = null;
let registrySeedKey: string | null = null;
let manualAgents: AgentRecord[] = [];

async function getData(): Promise<OracleData> {
  const data = await dataSource.getOracleData();
  if (!manualAgents.length) return data;
  const existing = new Set(data.agents.map((agent) => agent.id));
  return {
    ...data,
    agents: [...data.agents, ...manualAgents.filter((agent) => !existing.has(agent.id))]
  };
}

async function getRetrieval() {
  return createFixtureRetrievalIndex(await getData());
}

async function askServerRag(query: string) {
  const data = await getData();
  try {
    return await askOracleRag(data, query, env.process?.env ?? {});
  } catch (error) {
    return createRagUnavailableResult(query, error, env.process?.env ?? {});
  }
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

export const appRouter = t.router({
  property: t.router({
    search: t.procedure.input(z.object({ query: z.string() })).query(async ({ input }) => askServerRag(input.query)),
    detail: t.procedure.input(z.object({ type: z.string(), id: z.string() })).query(async ({ input }) => (await getRetrieval()).getDetail(input.type as never, input.id)),
    relatedEntities: t.procedure.input(z.object({ propertyId: z.string() })).query(async ({ input }) => (await getRetrieval()).getRelationshipGraph(input.propertyId))
  }),
  intelligence: t.router({
    ask: t.procedure.input(z.object({ query: z.string() })).query(async ({ input }) => askServerRag(input.query)),
    runRequiredInquiry: t.procedure.input(z.object({ label: z.string() })).query(async ({ input }) => (await getRetrieval()).runRequiredInquiry(input.label)),
    structuredSearch: t.procedure.input(structuredQuerySchema).query(async ({ input }) => (await getRetrieval()).structuredSearch(input)),
    lexicon: t.procedure.query(async () => (await getRetrieval()).lexicon())
  }),
  registry: t.router({
    discoverFromGithub: t.procedure.query(async () => (await getData()).agents),
    state: t.procedure.query(async () => getRegistry(await getData())),
    metrics: t.procedure.query(async () => {
      const data = await getData();
      return registryMetrics(data, getRegistry(data));
    }),
    history: t.procedure.input(z.object({ agentId: z.string().optional() })).query(async ({ input }) => certificationHistory(getRegistry(await getData()), input.agentId)),
    promote: t.procedure.input(z.object({ agentId: z.string() })).mutation(async ({ input }) => {
      const data = await getData();
      return updateRegistry(data, advanceAgent(getRegistry(data), input.agentId, "Registered"));
    }),
    registerManual: t.procedure.input(manualAgentSchema).mutation(async ({ input }) => {
      const data = await getData();
      const result = registerManualAgent(data, getRegistry(data), input);
      manualAgents = [...manualAgents, result.agent];
      return {
        agent: result.agent,
        registry: updateRegistry(result.data, result.registry)
      };
    }),
    updateMetadata: t.procedure.input(z.object({ agentId: z.string() })).mutation(async ({ input }) => {
      const data = await getData();
      const registry = getRegistry(data);
      return {
        agentId: input.agentId,
        status: getAgentStatus(registry, input.agentId),
        history: certificationHistory(registry, input.agentId),
        ok: true
      };
    })
  }),
  certification: t.router({
    submitReview: t.procedure.input(z.object({ agentId: z.string() })).mutation(async ({ input }) => {
      const data = await getData();
      return updateRegistry(data, advanceAgent(getRegistry(data), input.agentId, "In Review"));
    }),
    approve: t.procedure.input(z.object({ agentId: z.string() })).mutation(async ({ input }) => {
      const data = await getData();
      return updateRegistry(data, advanceAgent(getRegistry(data), input.agentId, "Certified"));
    }),
    reject: t.procedure.input(z.object({ agentId: z.string() })).mutation(async ({ input }) => {
      const data = await getData();
      return updateRegistry(data, advanceAgent(getRegistry(data), input.agentId, "Rejected"));
    }),
    history: t.procedure.input(z.object({ agentId: z.string().optional() })).query(async ({ input }) => certificationHistory(getRegistry(await getData()), input.agentId))
  }),
  marketplace: t.router({
    listCertified: t.procedure.query(async () => {
      const data = await getData();
      const registry = getRegistry(data);
      return listMarketplaceAgents(data, registry);
    }),
    profile: t.procedure.input(z.object({ agentId: z.string() })).query(async ({ input }) => (await getData()).agents.find((agent) => agent.id === input.agentId) ?? null)
  }),
  evidence: t.router({
    listRuns: t.procedure.query(async () => {
      const data = await getData();
      return createSeedEvidenceRuns(data, getRegistry(data));
    }),
    detail: t.procedure.input(z.object({ runId: z.string() })).query(async ({ input }) => {
      const data = await getData();
      return createSeedEvidenceRuns(data, getRegistry(data)).find((run) => run.id === input.runId) ?? null;
    }),
    recordInquiry: t.procedure.input(z.object({ label: z.string() })).query(async ({ input }) => {
      const data = await getData();
      const registry = getRegistry(data);
      const result = createFixtureRetrievalIndex(data).runRequiredInquiry(input.label);
      return createEvidenceRun(data, registry, input.label, result);
    }),
    metrics: t.procedure.query(async () => {
      const data = await getData();
      return summarizeRunMetrics(createSeedEvidenceRuns(data, getRegistry(data)));
    })
  }),
  dashboard: t.router({
    dataSource: t.procedure.query(async () => dataSource.health()),
    lexicon: t.procedure.query(async () => (await getRetrieval()).lexicon()),
    readiness: t.procedure.query(async () => dataSource.health()),
    summary: t.procedure.query(async () => {
      const data = await getData();
      const registry = getRegistry(data);
      return {
        corpus: data.corpus,
        dataSource: await dataSource.health(),
        runMetrics: summarizeRunMetrics(createSeedEvidenceRuns(data, registry)),
        registryMetrics: registryMetrics(data, registry),
        discoveredAgents: data.agents.length,
        hiddenMarketplaceCount: hiddenMarketplaceCount(data, registry),
        oracleStatus: getAgentStatus(registry, "oracle") satisfies AgentStatus
      };
    })
  }),
  _statusSchema: t.procedure.input(statusSchema).query(({ input }) => input)
});

export type AppRouter = typeof appRouter;
