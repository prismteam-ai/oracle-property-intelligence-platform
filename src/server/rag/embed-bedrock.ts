import "server-only";

import { Agent, setGlobalDispatcher } from "undici";

import type { EmbeddingService } from "./types";

const DEFAULT_MODEL_ID = "amazon.titan-embed-text-v2:0";

const DEFAULT_DIMENSIONS = 1024;

setGlobalDispatcher(
  new Agent({
    connections: Number(process.env.BEDROCK_EMBED_POOL ?? 16),
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 60_000,
    headersTimeout: 10_000,
    bodyTimeout: 15_000,
    connect: { timeout: 5_000 },
  }),
);

const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 8_000;
const REQUEST_TIMEOUT_MS = Number(process.env.BEDROCK_EMBED_TIMEOUT_MS ?? 20_000);

const BULK_CONCURRENCY = Number(process.env.BEDROCK_EMBED_CONCURRENCY ?? 4);
const BULK_RATE_PER_SEC = Number(process.env.BEDROCK_EMBED_RATE_PER_SEC ?? 2.5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const backoffDelay = (attempt: number): number =>
  Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.floor(Math.random() * 250);

const envOr = (name: string, fallback: string): string => {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
};

class RatePacer {
  private nextAt = 0;
  private readonly intervalMs: number;
  constructor(ratePerSec: number) {
    this.intervalMs = ratePerSec > 0 ? 1000 / ratePerSec : 0;
  }
  async take(): Promise<void> {
    if (this.intervalMs <= 0) return;
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + this.intervalMs;
    const wait = at - now;
    if (wait > 0) await sleep(wait);
  }
}

export class BedrockTitanEmbeddingService implements EmbeddingService {
  readonly model: string;
  readonly dim: number;
  private readonly region: string;
  private readonly token: string;
  private readonly modelId: string;

  constructor() {
    const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
    if (!token) {
      throw new Error(
        "[oracle] EMBEDDING_PROVIDER=bedrock requires AWS_BEARER_TOKEN_BEDROCK. " +
          "Refusing to embed: not falling back to the lexical stub. " +
          "Set AWS_BEARER_TOKEN_BEDROCK (and AWS_REGION), or use EMBEDDING_PROVIDER=stub for offline tests.",
      );
    }
    this.token = token;
    this.region = envOr("AWS_REGION", "us-east-1");
    this.modelId = envOr("BEDROCK_EMBED_MODEL_ID", DEFAULT_MODEL_ID);
    this.dim = Number(envOr("BEDROCK_EMBED_DIM", String(DEFAULT_DIMENSIONS)));
    this.model = `titan-embed-v2-${this.dim}`;
  }

  private async embedOne(text: string): Promise<number[]> {
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${encodeURIComponent(
      this.modelId,
    )}/invoke`;
    const body = JSON.stringify({ inputText: text, dimensions: this.dim, normalize: true });

    let lastDetail = "";
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: `Bearer ${this.token}`,
          },
          body,
          signal: ctrl.signal,
        });
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          throw new Error(
            `[oracle] Bedrock Titan embed network error after ${MAX_RETRIES} retries: ${
              (err as Error).message
            }`,
          );
        }
        await sleep(backoffDelay(attempt));
        continue;
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) {
        const data = (await res.json()) as { embedding?: number[] };
        const vec = data.embedding;
        if (!Array.isArray(vec) || vec.length !== this.dim) {
          throw new Error(
            `[oracle] Bedrock Titan returned an unexpected embedding (len=${vec?.length}, want ${this.dim}).`,
          );
        }
        return vec;
      }
      lastDetail = (await res.text().catch(() => "")).slice(0, 300);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(`[oracle] Bedrock Titan embed failed ${res.status}: ${lastDetail}`);
      }
      await sleep(backoffDelay(attempt));
    }
    throw new Error(`[oracle] Bedrock Titan embed exhausted retries: ${lastDetail}`);
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      out.push(await this.embedOne(texts[i]!));
    }
    return out;
  }

  async embedConcurrent(
    texts: string[],
    concurrency = BULK_CONCURRENCY,
    onProgress?: (done: number) => void,
  ): Promise<number[][]> {
    const out: number[][] = new Array(texts.length);
    const pacer = new RatePacer(BULK_RATE_PER_SEC);
    let next = 0;
    let done = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const i = next++;
        if (i >= texts.length) return;
        await pacer.take();
        out[i] = await this.embedOne(texts[i]!);
        done++;
        onProgress?.(done);
      }
    };
    const pool = Math.max(1, Math.min(concurrency, texts.length));
    await Promise.all(Array.from({ length: pool }, () => worker()));
    return out;
  }
}
