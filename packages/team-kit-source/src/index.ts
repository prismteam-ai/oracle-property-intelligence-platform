import type { AgentRecord, SourceSnapshot } from "@oracle-command-center/domain";

import referenceSnapshot from "./generated/reference-snapshot.json" with { type: "json" };

interface ReferenceSnapshotShape {
  agents: AgentRecord[];
  sources: SourceSnapshot[];
  soofi: {
    agentCount: number;
    skillCount: number;
    version: string;
    commit: string;
  };
  elephant: {
    skillCount: number;
    commit: string;
  };
  pr54: {
    commit: string | null;
    includesElephantQuerySkill: boolean;
  };
}

const snapshot = referenceSnapshot as ReferenceSnapshotShape;

export function listSourceBackedAgents(): AgentRecord[] {
  return snapshot.agents.map((agent) => ({ ...agent, skills: [...agent.skills], deps: [...agent.deps] }));
}

export function listSourceSnapshots(): SourceSnapshot[] {
  return snapshot.sources.map((source) => ({ ...source }));
}

export function getReferenceSnapshot(): ReferenceSnapshotShape {
  return snapshot;
}
