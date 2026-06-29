import { routeInquiry, type InquiryDef } from "@/lib/inquiries";
import type { Citation, RagAnswer, RagEvidence } from "./types";

export const ROUTER_THRESHOLD = 1.5;

export type InquiryRunResult = {
  inquiryId: string;
  label: string;
  columns: string[];
  rows: Array<Record<string, unknown> & { citations?: Citation[] }>;
};

export type SynthesizeDeps = {
  retrieve: (query: string, limit: number) => Promise<RagEvidence[]>;
  runInquiry: (inquiryId: string) => Promise<InquiryRunResult>;
  llmSynthesize?: (
    question: string,
    evidence: RagEvidence[],
  ) => Promise<string | null>;
  router?: (q: string) => { inquiry: InquiryDef; score: number } | null;
  routerThreshold?: number;
  topK?: number;
};

export function dedupeCitations(evidence: RagEvidence[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const e of evidence) {
    for (const c of e.citations) {
      if (!c.url && !c.recordKey) continue;
      const key = `${c.sourceSystem ?? ""}:${c.recordKey ?? ""}:${c.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export function templatedAnswer(question: string, evidence: RagEvidence[]): string {
  if (evidence.length === 0) {
    return `No supporting evidence was found in the knowledge layer for "${question}".`;
  }
  const top = evidence.slice(0, 5);
  const bullets = top
    .map((e, i) => {
      const provenance = e.sourceUri
        ? ` (source: ${e.sourceUri})`
        : e.citations[0]?.url
          ? ` (source: ${e.citations[0]!.url})`
          : "";
      return `[${i + 1}] ${e.title}: ${e.snippet}${provenance}`;
    })
    .join("\n");

  const lead = directLead(question, top);
  return `${lead} Based on ${evidence.length} source-backed record(s) [1]–[${top.length}]:\n${bullets}`;
}

function directLead(question: string, top: RagEvidence[]): string {
  const first = top[0]!;
  const names = top
    .map((e) => e.title)
    .filter((t, i, a) => t && a.indexOf(t) === i)
    .slice(0, 3);
  const subject = first.entityType ? `${first.entityType}` : "record";
  const detail = (first.snippet ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (top.length === 1) {
    return `The closest match to "${question}" is the ${subject} ${first.title}${detail ? ` — ${detail}` : ""} [1].`;
  }
  const others = names.length > 1 ? ` (also: ${names.slice(1).join(", ")})` : "";
  return `The strongest match to "${question}" is the ${subject} ${first.title}${detail ? ` — ${detail}` : ""} [1]${others}.`;
}

function describeTopRow(row: Record<string, unknown>): string {
  const PREFERRED = [
    "contractor",
    "business",
    "parcelIdentifier",
    "tenantId",
    "municipality",
    "name",
    "role",
  ];
  const keys = Object.keys(row).filter((k) => k !== "href" && k !== "citations");
  const labelKey =
    PREFERRED.find((k) => keys.includes(k) && typeof row[k] === "string" && row[k]) ??
    keys.find((k) => typeof row[k] === "string" && row[k]);
  if (!labelKey) return "";
  const value = String(row[labelKey]);
  return `Top result: ${value}.`;
}

async function structuredAnswer(
  question: string,
  inquiry: InquiryDef,
  deps: SynthesizeDeps,
): Promise<RagAnswer> {
  const topK = deps.topK ?? 8;
  const result = await deps.runInquiry(inquiry.id);
  const evidence: RagEvidence[] = result.rows.slice(0, topK).map((row, i) => {
    const citations = row.citations ?? [];
    return {
      documentId: `inquiry:${inquiry.id}:${i}`,
      entityType: "inquiry",
      entityId: null,
      title: inquiry.label,
      snippet: JSON.stringify(row).slice(0, 320),
      score: 1,
      sourceUri: citations[0]?.url ?? null,
      citations,
    };
  });
  const lead =
    result.rows.length > 0
      ? `${describeTopRow(result.rows[0]!)} `
      : "";
  return {
    question,
    answer: `${lead}Matched structured inquiry "${inquiry.label}" — ${result.rows.length} result(s).`,
    mode: "structured",
    route: "structured",
    synthesizedBy: "template",
    evidence,
    citations: dedupeCitations(evidence),
  };
}

async function semanticAnswer(
  question: string,
  deps: SynthesizeDeps,
): Promise<RagAnswer> {
  const topK = deps.topK ?? 8;
  const evidence = await deps.retrieve(question, topK);
  let answer: string;
  let synthesizedBy: "llm" | "template" = "template";
  if (deps.llmSynthesize) {
    const llm = await deps.llmSynthesize(question, evidence);
    if (llm) {
      answer = llm;
      synthesizedBy = "llm";
    } else {
      answer = templatedAnswer(question, evidence);
    }
  } else {
    answer = templatedAnswer(question, evidence);
  }
  return {
    question,
    answer,
    mode: evidence.length ? "semantic" : "none",
    route: "semantic",
    synthesizedBy,
    evidence,
    citations: dedupeCitations(evidence),
  };
}

export async function synthesizeAnswer(
  question: string,
  deps: SynthesizeDeps,
): Promise<RagAnswer> {
  const router = deps.router ?? routeInquiry;
  const threshold = deps.routerThreshold ?? ROUTER_THRESHOLD;
  const routed = router(question);
  if (routed && routed.score >= threshold) {
    return structuredAnswer(question, routed.inquiry, deps);
  }
  return semanticAnswer(question, deps);
}
