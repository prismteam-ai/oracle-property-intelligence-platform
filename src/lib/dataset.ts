export type DatasetMode = "memory" | "local" | "neon";

export function datasetMode(): DatasetMode {
  const v = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
  if (v === "neon") return "neon";
  if (v === "local") return "local";
  return "memory";
}

export function isSynthetic(mode: DatasetMode = datasetMode()): boolean {
  return mode !== "neon";
}

export const DEFAULT_ROW_LIMIT = 200;
export const MAX_ROW_LIMIT = 500;

export function rowDisplayLimit(): number {
  const raw = Number(process.env.ROW_DISPLAY_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_ROW_LIMIT;
  return Math.min(Math.floor(raw), MAX_ROW_LIMIT);
}
