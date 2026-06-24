import {
  askNaturalLanguage,
  localFixtureDataPlane,
  registerExternalAgent,
  runRequiredInquiry,
  structuredSearch,
  updateAgentStatus,
  type CommandCenterSnapshot
} from "@oracle-command-center/api-client";
import type { ManualAgentRegistration } from "@oracle-command-center/agent-registry";
import type { AgentStatus, DataPlaneStatus, InquiryResult, StructuredQuery } from "@oracle-command-center/domain";

export interface RuntimeActionResponse {
  ok: boolean;
  snapshot: CommandCenterSnapshot;
  dataPlane: DataPlaneStatus;
  result?: InquiryResult;
  agentId?: string;
  error?: string;
}

export async function requestRuntimeAction(input: {
  action: string;
  label?: string;
  query?: string;
  structured?: StructuredQuery;
  agentId?: string;
  status?: AgentStatus;
  registration?: ManualAgentRegistration;
}): Promise<RuntimeActionResponse | null> {
  try {
    const response = await fetch("/api/command-center", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as RuntimeActionResponse;
    return payload.ok ? payload : null;
  } catch {
    return null;
  }
}

export function runLocalRequiredInquiry(snapshot: CommandCenterSnapshot, label: string): RuntimeActionResponse {
  const next = runRequiredInquiry(snapshot, label);
  return {
    ok: true,
    snapshot: next,
    result: next.result,
    dataPlane: localFixtureDataPlane
  };
}

export function runLocalNaturalLanguage(snapshot: CommandCenterSnapshot, query: string): RuntimeActionResponse {
  const next = askNaturalLanguage(snapshot, query);
  return {
    ok: true,
    snapshot: next,
    result: next.result,
    dataPlane: localFixtureDataPlane
  };
}

export function runLocalStructuredSearch(snapshot: CommandCenterSnapshot, query: StructuredQuery): RuntimeActionResponse {
  const next = structuredSearch(snapshot, query);
  return {
    ok: true,
    snapshot: next,
    result: next.result,
    dataPlane: localFixtureDataPlane
  };
}

export function updateLocalAgentStatus(
  snapshot: CommandCenterSnapshot,
  agentId: string,
  status: AgentStatus
): RuntimeActionResponse {
  return {
    ok: true,
    snapshot: updateAgentStatus(snapshot, agentId, status),
    dataPlane: localFixtureDataPlane
  };
}

export function registerLocalExternalAgent(snapshot: CommandCenterSnapshot, registration?: ManualAgentRegistration): RuntimeActionResponse {
  const next = registerExternalAgent(snapshot, registration);
  return {
    ok: true,
    snapshot: next,
    agentId: next.agentId,
    dataPlane: localFixtureDataPlane
  };
}
