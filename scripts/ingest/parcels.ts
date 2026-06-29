import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  LEEPA_OBJECT_ID_FIELD,
  LEEPA_PARCELS_LAYER,
  type LeepaFeature,
} from "./leepa-source";

const PAGE_SIZE = 2000;
const REQUEST_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1500;

export const STAGING_PATH = resolve(process.cwd(), ".data", "leepa-parcels.ndjson");

type QueryResponse = {
  features?: LeepaFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
};

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

async function fetchJson(url: string): Promise<QueryResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const json = (await response.json()) as QueryResponse;
      if (json.error) {
        throw new Error(`ArcGIS error: ${json.error.message ?? "unknown"}`);
      }
      return json;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const wait = BACKOFF_BASE_MS * attempt;
      console.warn(
        `[ingest] request attempt ${attempt}/${MAX_ATTEMPTS} failed (${(error as Error).message}); retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw new Error(
    `[ingest] giving up after ${MAX_ATTEMPTS} attempts: ${(lastError as Error).message}`,
  );
}

async function fetchTotalCount(): Promise<number> {
  const url = `${LEEPA_PARCELS_LAYER}/query?where=1%3D1&returnCountOnly=true&f=json`;
  const response = await fetchJson(url);
  const count = (response as unknown as { count?: number }).count;
  if (typeof count !== "number") {
    throw new Error("[ingest] count query did not return a numeric count");
  }
  return count;
}

function buildPageUrl(offset: number): string {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    orderByFields: LEEPA_OBJECT_ID_FIELD,
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    returnGeometry: "false",
    f: "json",
  });
  return `${LEEPA_PARCELS_LAYER}/query?${params.toString()}`;
}

export async function ingestParcels(): Promise<{ total: number; written: number; path: string }> {
  mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
  const total = await fetchTotalCount();
  console.log(`[ingest] Lee County parcels reported by source: ${total}`);

  const out = createWriteStream(STAGING_PATH, { encoding: "utf8" });
  let written = 0;
  let offset = 0;

  while (offset < total) {
    const page = await fetchJson(buildPageUrl(offset));
    const features = page.features ?? [];
    if (features.length === 0) {
      console.log(`[ingest] empty page at offset ${offset}; stopping`);
      break;
    }
    for (const feature of features) {
      out.write(`${JSON.stringify(feature.attributes)}\n`);
    }
    written += features.length;
    offset += features.length;
    console.log(`[ingest] fetched ${written}/${total} parcels (offset now ${offset})`);
    if (features.length < PAGE_SIZE && page.exceededTransferLimit !== true) {
      break;
    }
  }

  await new Promise<void>((done, fail) => {
    out.end((error?: Error | null) => (error ? fail(error) : done()));
  });
  console.log(`[ingest] wrote ${written} parcels to ${STAGING_PATH}`);
  return { total, written, path: STAGING_PATH };
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith("parcels.ts");

if (isMain) {
  ingestParcels()
    .then((result) => {
      console.log(`[ingest] complete: ${result.written} parcels staged`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[ingest] failed:", error);
      process.exit(1);
    });
}
