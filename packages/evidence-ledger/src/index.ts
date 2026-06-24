import type { EvidenceRun, InquiryResult, OracleData, RegistryState } from "@oracle-command-center/domain";
import { getAgentStatus } from "../../agent-registry/src/index.js";
import { createFixtureRetrievalIndex } from "../../retrieval/src/index.js";

const ORACLE_AGENT_ID = "oracle";
const DEFAULT_EVALUATOR_ID = "alakazam";
const DEFAULT_CERTIFIER_ID = "arceus";
const FIXED_DEMO_DATE = "2026-06-18";

export interface EvidenceRunOptions {
  agentId?: string;
  evaluatorId?: string;
  certifierId?: string;
  now?: Date;
  runId?: string;
}

export function createEvidenceRun(
  data: OracleData,
  registry: RegistryState,
  query: string,
  result: InquiryResult,
  options: EvidenceRunOptions = {}
): EvidenceRun {
  const agentId = options.agentId ?? ORACLE_AGENT_ID;
  const cert = getAgentStatus(registry, agentId);
  const now = options.now ?? new Date();
  const certifierId = options.certifierId ?? DEFAULT_CERTIFIER_ID;
  return {
    id: options.runId ?? runId(query, now),
    query,
    ts: `${FIXED_DEMO_DATE} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    cert,
    agentId,
    evaluatorId: options.evaluatorId ?? DEFAULT_EVALUATOR_ID,
    certifierId: cert === "Certified" ? certifierId : null,
    certifiedAt: cert === "Certified" ? registry.certDates[agentId] ?? FIXED_DEMO_DATE : null,
    count: result.count,
    summary: result.note || result.headerLabel,
    sources: [...new Set(result.citations.map((citation) => citation.system))],
    citations: result.citations,
    resultKeys: result.cards.map((card) => card.key),
    retrieval: result.retrieval
  };
}

export function createSeedEvidenceRuns(data: OracleData, registry: RegistryState, limit = 5): EvidenceRun[] {
  const retrieval = createFixtureRetrievalIndex(data);
  return data.inquiries.slice(0, limit).map((inquiry, index) => {
    const result = retrieval.runRequiredInquiry(inquiry.label);
    return createEvidenceRun(data, registry, inquiry.label, result, {
      runId: `seed-${inquiry.id}`,
      now: seededTime(index)
    });
  });
}

export function summarizeRunMetrics(runs: readonly EvidenceRun[]) {
  const certifiedRuns = runs.filter((run) => run.cert === "Certified").length;
  const sourceSystems = new Set(runs.flatMap((run) => run.sources));
  const citedRecords = runs.reduce((sum, run) => sum + run.citations.length, 0);
  return {
    totalRuns: runs.length,
    certifiedRuns,
    provisionalRuns: runs.length - certifiedRuns,
    sourceSystems: sourceSystems.size,
    citedRecords
  };
}

function runId(query: string, now: Date): string {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
  return `run-${now.getTime()}-${slug}`;
}

function seededTime(index: number): Date {
  const date = new Date("2026-06-18T17:30:00");
  date.setMinutes(date.getMinutes() + index * 7);
  return date;
}
