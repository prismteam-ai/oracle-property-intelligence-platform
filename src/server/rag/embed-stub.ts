import { EMBEDDING_DIM } from "@/db/schema/rag";
import type { EmbeddingService } from "./types";

const STUB_MODEL = "stub-hash-bow-v1";

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function embedOne(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vec[fnv1a(text || "empty") % dim] = 1;
    return vec;
  }
  for (const tok of tokens) {
    const h = fnv1a(tok);
    const bucket = h % dim;
    const sign = (h >>> 31) & 1 ? -1 : 1;
    vec[bucket]! += sign;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i]! /= norm;
  return vec;
}

export class StubEmbeddingService implements EmbeddingService {
  readonly model = STUB_MODEL;
  readonly dim: number;

  constructor(dim: number = EMBEDDING_DIM) {
    this.dim = dim;
  }

  // Async to satisfy the port; the work is synchronous and offline.
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => embedOne(t, this.dim));
  }
}

/** Cosine similarity for two equal-length vectors (already-normalized OK). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
