import type { Citation } from "@/server/ports";

export const SOURCE_LABELS: Record<string, string> = {
  leepa: "Lee County Property Appraiser",
  lee_accela: "Lee County Permits (Accela)",
  accela: "Lee County Permits (Accela)",
  sunbiz: "Florida Sunbiz",
  bbb: "Better Business Bureau",
  oracle: "Oracle ingestion",
};

export type SourceBearingRow = {
  sourceSystem?: string | null;
  sourceRecordKey?: string | null;
  sourceArtifactUri?: string | null;
  sourceUrl?: string | null;
};

export function sourceLabel(sourceSystem?: string | null): string {
  if (!sourceSystem) return "Public record";
  return SOURCE_LABELS[sourceSystem] ?? sourceSystem;
}

export function buildCitation(row: SourceBearingRow, label?: string): Citation {
  const url = row.sourceUrl ?? row.sourceArtifactUri ?? null;
  return {
    label: label ?? sourceLabel(row.sourceSystem),
    url,
    recordKey: row.sourceRecordKey ?? undefined,
    sourceSystem: row.sourceSystem ?? undefined,
  };
}

export function buildCitations(rows: SourceBearingRow[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const row of rows) {
    const c = buildCitation(row);
    const key = `${c.sourceSystem}:${c.recordKey}:${c.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
