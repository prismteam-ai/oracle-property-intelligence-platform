import "server-only";

import { EMBEDDING_DIM } from "@/db/schema/rag";
import type { EmbeddingService } from "./types";
import { StubEmbeddingService } from "./embed-stub";
import { BedrockTitanEmbeddingService } from "./embed-bedrock";
import { OpenAIEmbeddingService } from "./embed-openai";

export type { EmbeddingService };

class LocalSidecarEmbeddingService implements EmbeddingService {
  readonly model: string;
  readonly dim = EMBEDDING_DIM;
  private readonly url: string;

  constructor() {
    this.model = process.env.EMBEDDING_MODEL ?? "BAAI/bge-small-en-v1.5";
    this.url = process.env.EMBEDDINGS_URL ?? "http://localhost:8080";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.url}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts, model: this.model }),
    });
    if (!res.ok) {
      throw new Error(`Embedding sidecar error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}

export function getEmbeddingService(): EmbeddingService {
  const defaultProvider = process.env.NODE_ENV === "test" ? "stub" : "openai";
  const provider = (process.env.EMBEDDING_PROVIDER ?? defaultProvider).toLowerCase();
  switch (provider) {
    case "bedrock":
      return new BedrockTitanEmbeddingService();
    case "openai":
      return new OpenAIEmbeddingService();
    case "local":
      return new LocalSidecarEmbeddingService();
    case "stub":
      return new StubEmbeddingService();
    default:
      throw new Error(
        `[oracle] Unknown EMBEDDING_PROVIDER="${provider}". ` +
          `Expected one of: bedrock | openai | local | stub. Refusing to guess a provider.`,
      );
  }
}
