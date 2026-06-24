import {
  type AgentRecord,
  type AgentStatus,
  type CertificationDecision,
  type OracleData,
  type RegistryState
} from "@oracle-command-center/domain";

export interface RegistryAction {
  label: string;
  to: AgentStatus;
  tone: "blue" | "green" | "amber" | "red" | "gray";
}

export interface RegistryAdvanceOptions {
  reviewer?: string;
  notes?: string;
  evaluationScore?: number;
  checks?: string[];
}

export interface ManualAgentRegistration {
  id?: string;
  display: string;
  role: string;
  owner: string;
  version?: string;
  summary: string;
  triggers: string;
  skills?: string[];
  deps?: string[];
  runtime?: string;
  docs?: string;
  capabilities?: string[];
  inputs?: string[];
  outputs?: string[];
  usage?: string;
  install?: string;
  dataSources?: string[];
  connectedTools?: string[];
  networkInteractions?: string[];
}

export function createInitialRegistry(data: OracleData, reviewer = "michael.gill"): RegistryState {
  const statuses: Record<string, AgentStatus> = {};
  const certDates: Record<string, string> = {};
  data.agents.forEach((agent) => {
    statuses[agent.id] = agent.id === "oracle" ? "Discovered" : agent.status;
    if (agent.certifiedDate) certDates[agent.id] = agent.certifiedDate;
  });
  return {
    statuses,
    certDates,
    history: data.agents
      .filter((agent) => agent.status === "Certified" && agent.certifiedDate)
      .map((agent) => ({
        id: `seed-${agent.id}-${agent.certifiedDate}`,
        agentId: agent.id,
        from: "In Review",
        to: "Certified",
        reviewer: agent.reviewer ?? reviewer,
        decidedAt: agent.certifiedDate ?? "2026-06-18",
        outcome: "Seed certification from source snapshot",
        notes: "Imported as an already-certified team-kit agent for marketplace demonstration.",
        evaluationScore: 94,
        checks: ["metadata complete", "source path verified", "dependencies declared", "usage guidance available"]
      })),
    reviewer
  };
}

export function getAgentStatus(registry: RegistryState, agentId: string): AgentStatus {
  return registry.statuses[agentId] ?? "Discovered";
}

export function advanceAgent(registry: RegistryState, agentId: string, to: AgentStatus, options: RegistryAdvanceOptions = {}): RegistryState {
  const from = getAgentStatus(registry, agentId);
  const reviewer = options.reviewer ?? registry.reviewer;
  const decidedAt = "2026-06-18";
  const decision = createDecision(agentId, from, to, reviewer, options);
  return {
    ...registry,
    reviewer,
    statuses: { ...registry.statuses, [agentId]: to },
    certDates: to === "Certified" ? { ...registry.certDates, [agentId]: decidedAt } : registry.certDates,
    history: [...registry.history, decision]
  };
}

export function createManualAgent(input: ManualAgentRegistration, reviewer = "michael.gill"): AgentRecord {
  const id = input.id ?? slug(input.display);
  const skills = input.skills?.length ? input.skills : ["manual-registration", "agent-network-governance"];
  return {
    id,
    display: input.display,
    role: input.role,
    status: "Registered",
    version: input.version ?? "0.1.0",
    summary: input.summary,
    triggers: input.triggers,
    skills,
    deps: input.deps ?? ["Agent Network Registry", "Certification reviewer"],
    runtime: input.runtime ?? "Operator submitted · pending runtime verification",
    docs: input.docs ?? `manual://agent-network/${id}`,
    source: "self",
    new: true,
    certifiedDate: null,
    reviewer,
    sourcePath: `manual://${id}`,
    sourceRepo: "operator-submitted",
    sourceCommit: "manual-registration",
    owner: input.owner,
    capabilities: input.capabilities ?? skills,
    inputs: input.inputs ?? ["operator prompt", "approved data source", "agent metadata"],
    outputs: input.outputs ?? ["agent run result", "evidence record", "integration guidance"],
    usage: input.usage ?? input.triggers,
    install: input.install ?? "Register metadata, submit for certification, then reuse from the certified marketplace profile.",
    dataSources: input.dataSources ?? ["Agent Network Registry"],
    connectedTools: input.connectedTools ?? ["Certification workflow"],
    networkInteractions: input.networkInteractions ?? ["manual registration", "reviewer certification", "marketplace publication"],
    runCount: 0,
    lastRunAt: "not yet run"
  };
}

export function registerManualAgent(
  data: OracleData,
  registry: RegistryState,
  input: ManualAgentRegistration
): { data: OracleData; registry: RegistryState; agent: AgentRecord } {
  const agent = createManualAgent(input, registry.reviewer);
  if (data.agents.some((item) => item.id === agent.id)) {
    throw new Error(`Agent already exists in registry: ${agent.id}`);
  }
  const nextData = {
    ...data,
    agents: [...data.agents, agent]
  };
  const nextRegistry = advanceAgent(registry, agent.id, "Registered", {
    notes: "Operator-submitted agent registered without GitHub discovery.",
    evaluationScore: 88,
    checks: ["owner captured", "inputs declared", "outputs declared", "integration guidance attached"]
  });
  return { data: nextData, registry: nextRegistry, agent };
}

export function availableActions(status: AgentStatus): RegistryAction[] {
  if (status === "Discovered") return [{ label: "Register metadata", tone: "blue", to: "Registered" }];
  if (status === "Registered") return [{ label: "Submit for review", tone: "blue", to: "In Review" }];
  if (status === "In Review") {
    return [
      { label: "Approve & certify", tone: "green", to: "Certified" },
      { label: "Request changes", tone: "amber", to: "Changes Requested" },
      { label: "Reject", tone: "red", to: "Rejected" }
    ];
  }
  if (status === "Changes Requested") return [{ label: "Resubmit for review", tone: "blue", to: "In Review" }];
  if (status === "Certified") {
    return [
      { label: "Deprecate", tone: "gray", to: "Deprecated" },
      { label: "Suspend", tone: "red", to: "Suspended" }
    ];
  }
  if (status === "Rejected") return [{ label: "Reopen", tone: "gray", to: "Discovered" }];
  if (status === "Deprecated" || status === "Suspended") return [{ label: "Reinstate", tone: "blue", to: "Certified" }];
  return [];
}

export function listMarketplaceAgents(data: OracleData, registry: RegistryState): AgentRecord[] {
  return data.agents.filter((agent) => getAgentStatus(registry, agent.id) === "Certified");
}

export function hiddenMarketplaceCount(data: OracleData, registry: RegistryState): number {
  return data.agents.length - listMarketplaceAgents(data, registry).length;
}

export function certificationHistory(registry: RegistryState, agentId?: string): CertificationDecision[] {
  return registry.history.filter((decision) => (agentId ? decision.agentId === agentId : true));
}

export function registryMetrics(data: OracleData, registry: RegistryState) {
  const counts = data.agents.reduce<Record<AgentStatus, number>>(
    (acc, agent) => {
      const status = getAgentStatus(registry, agent.id);
      acc[status] += 1;
      return acc;
    },
    {
      Discovered: 0,
      Registered: 0,
      "In Review": 0,
      "Changes Requested": 0,
      Certified: 0,
      Rejected: 0,
      Deprecated: 0,
      Suspended: 0
    }
  );
  return {
    totalAgents: data.agents.length,
    marketplaceAgents: listMarketplaceAgents(data, registry).length,
    hiddenMarketplaceAgents: hiddenMarketplaceCount(data, registry),
    certificationDecisions: registry.history.length,
    externalAgents: data.agents.filter((agent) => agent.source === "self").length,
    networkRuns: data.agents.reduce((sum, agent) => sum + (agent.runCount ?? 0), 0),
    networkParticipants: data.agents.filter((agent) => (agent.networkInteractions?.length ?? 0) > 0).length,
    statuses: counts
  };
}

export function discoveredAgentCount(data: OracleData): number {
  return data.agents.length;
}

export function certifyOracle(registry: RegistryState): RegistryState {
  return advanceAgent(advanceAgent(advanceAgent(registry, "oracle", "Registered"), "oracle", "In Review"), "oracle", "Certified");
}

function createDecision(
  agentId: string,
  from: AgentStatus,
  to: AgentStatus,
  reviewer: string,
  options: RegistryAdvanceOptions
): CertificationDecision {
  return {
    id: `${agentId}-${from.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${to.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-2026-06-18`,
    agentId,
    from,
    to,
    reviewer,
    decidedAt: "2026-06-18",
    outcome: decisionOutcome(to),
    notes: options.notes ?? decisionNotes(to),
    evaluationScore: options.evaluationScore ?? decisionScore(to),
    checks: options.checks ?? decisionChecks(to)
  };
}

function decisionOutcome(status: AgentStatus): string {
  if (status === "Certified") return "approved";
  if (status === "Rejected") return "rejected";
  if (status === "Changes Requested") return "changes requested";
  if (status === "Suspended") return "suspended";
  if (status === "Deprecated") return "deprecated";
  return "lifecycle transition";
}

function decisionNotes(status: AgentStatus): string {
  if (status === "Registered") return "Metadata promoted into the Agent Network Registry.";
  if (status === "In Review") return "Submitted for certification review with dependencies and source path attached.";
  if (status === "Certified") return "Approved for marketplace listing and reuse.";
  if (status === "Changes Requested") return "Reviewer requested metadata or dependency updates before certification.";
  if (status === "Rejected") return "Reviewer rejected the agent for this certification cycle.";
  if (status === "Suspended") return "Certified listing suspended pending review.";
  if (status === "Deprecated") return "Agent kept in registry but removed from active reuse guidance.";
  return "Lifecycle status updated.";
}

function decisionScore(status: AgentStatus): number {
  if (status === "Certified") return 96;
  if (status === "Rejected") return 38;
  if (status === "Changes Requested") return 72;
  if (status === "In Review") return 80;
  return 90;
}

function decisionChecks(status: AgentStatus): string[] {
  if (status === "Registered") return ["owner captured", "purpose captured", "source path attached"];
  if (status === "In Review") return ["capabilities declared", "dependencies declared", "documentation linked"];
  if (status === "Certified") return ["source verified", "required metadata complete", "marketplace guidance present", "provenance traceable"];
  if (status === "Changes Requested") return ["reviewer notes recorded", "marketplace listing blocked"];
  if (status === "Rejected") return ["reviewer decision recorded", "marketplace listing blocked"];
  return ["status transition recorded"];
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "manual-agent";
}
