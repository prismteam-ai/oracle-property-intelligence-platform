import "server-only";

import type { EmbeddingService } from "./types";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 512;

const MAX_RETRIES = 8;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 8_000;
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_EMBED_TIMEOUT_MS ?? 30_000);

const BULK_CONCURRENCY = Number(process.env.OPENAI_EMBED_CONCURRENCY ?? 4);
const BULK_BATCH = Number(process.env.OPENAI_EMBED_BATCH ?? 64);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const backoffDelay = (attempt: number): number =>
  Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.floor(Math.random() * 250);

const envOr = (name: string, fallback: string): string => {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
};

type EmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
  usage: { prompt_tokens: number; total_tokens: number };
};

export class OpenAIEmbeddingService implements EmbeddingService {
  readonly model: string;
  readonly dim: number;
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly baseUrl: string;
  private tokensUsed = 0;
  private requestsMade = 0;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[oracle] EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY. " +
          "Set OPENAI_API_KEY, or use EMBEDDING_PROVIDER=stub for offline tests.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = envOr("OPENAI_BASE_URL", "https://api.openai.com/v1");
    this.modelId = envOr("OPENAI_EMBED_MODEL", DEFAULT_MODEL);
    this.dim = Number(envOr("OPENAI_EMBED_DIM", String(DEFAULT_DIMENSIONS)));
    this.model = `${this.modelId}-${this.dim}`;
  }

  get totalTokens(): number {
    return this.tokensUsed;
  }

  get totalRequests(): number {
    return this.requestsMade;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embeddings`;
    const body = JSON.stringify({
      model: this.modelId,
      input: texts,
      dimensions: this.dim,
    });

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
            authorization: `Bearer ${this.apiKey}`,
          },
          body,
          signal: ctrl.signal,
        });
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          throw new Error(
            `[oracle] OpenAI embed network error after ${MAX_RETRIES} retries: ${
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
        const data = (await res.json()) as EmbeddingResponse;
        this.tokensUsed += data.usage?.total_tokens ?? 0;
        this.requestsMade += 1;
        const ordered = data.data.slice().sort((a, b) => a.index - b.index);
        const vectors = ordered.map((d) => d.embedding);
        if (vectors.length !== texts.length || vectors.some((v) => v.length !== this.dim)) {
          throw new Error(
            `[oracle] OpenAI returned an unexpected embedding shape (got ${vectors.length} vectors, want ${texts.length}; dim mismatch possible).`,
          );
        }
        return vectors;
      }
      lastDetail = (await res.text().catch(() => "")).slice(0, 300);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(`[oracle] OpenAI embed failed ${res.status}: ${lastDetail}`);
      }
      await sleep(backoffDelay(attempt));
    }
    throw new Error(`[oracle] OpenAI embed exhausted retries: ${lastDetail}`);
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BULK_BATCH) {
      const batch = texts.slice(i, i + BULK_BATCH);
      const vectors = await this.embedBatch(batch);
      for (const v of vectors) out.push(v);
    }
    return out;
  }

  async embedConcurrent(
    texts: string[],
    concurrency = BULK_CONCURRENCY,
    onProgress?: (done: number) => void,
  ): Promise<number[][]> {
    const batches: { start: number; texts: string[] }[] = [];
    for (let i = 0; i < texts.length; i += BULK_BATCH) {
      batches.push({ start: i, texts: texts.slice(i, i + BULK_BATCH) });
    }
    const out: number[][] = new Array(texts.length);
    let next = 0;
    let done = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const b = batches[next++];
        if (!b) return;
        const vectors = await this.embedBatch(b.texts);
        for (let j = 0; j < vectors.length; j++) out[b.start + j] = vectors[j]!;
        done += vectors.length;
        onProgress?.(done);
      }
    };
    const pool = Math.max(1, Math.min(concurrency, batches.length));
    await Promise.all(Array.from({ length: pool }, () => worker()));
    return out;
  }
}
