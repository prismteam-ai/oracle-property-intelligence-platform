/**
 * Stub EmbeddingService tests — NO network, NO model, NO API key.
 *
 * Confirms the default offline embedding path: deterministic, normalized, and
 * similarity-meaningful (token overlap drives cosine), so the hybrid retriever's
 * vector leg can be exercised in unit tests with zero external dependencies.
 */

import { describe, expect, it } from "vitest";

import { EMBEDDING_DIM } from "@/db/schema/rag";
import { StubEmbeddingService, cosineSimilarity } from "@/server/rag/embed-stub";

const svc = new StubEmbeddingService();

describe("StubEmbeddingService", () => {
  it("emits vectors of the configured dimension", async () => {
    const [v] = await svc.embed(["roofing contractor in Lee County"]);
    expect(svc.dim).toBe(EMBEDDING_DIM);
    expect(v).toHaveLength(EMBEDDING_DIM);
  });

  it("is L2-normalized (unit length)", async () => {
    const [v] = await svc.embed(["major roof replacement permit"]);
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic — same text => byte-identical vector", async () => {
    const [a] = await svc.embed(["open electrical permit"]);
    const [b] = await new StubEmbeddingService().embed(["open electrical permit"]);
    expect(a).toEqual(b);
  });

  it("requires no API key and no network (offline default)", async () => {
    // No fetch is invoked; the call resolves synchronously offline.
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const out = await svc.embed(["a", "b", "c"]);
    expect(out).toHaveLength(3);
  });

  it("token overlap drives cosine similarity (similar > unrelated)", async () => {
    const [roof1] = await svc.embed(["roof replacement roofing shingle contractor"]);
    const [roof2] = await svc.embed(["roofing contractor performed a roof replacement"]);
    const [elec] = await svc.embed(["electrical panel upgrade wiring voltage"]);
    const sameTopic = cosineSimilarity(roof1!, roof2!);
    const crossTopic = cosineSimilarity(roof1!, elec!);
    expect(sameTopic).toBeGreaterThan(crossTopic);
    expect(sameTopic).toBeGreaterThan(0.2);
  });

  it("self-similarity is 1 and empty text yields a usable (non-zero) vector", async () => {
    const [v] = await svc.embed(["concrete slab"]);
    expect(cosineSimilarity(v!, v!)).toBeCloseTo(1, 5);
    const [empty] = await svc.embed([""]);
    const norm = Math.sqrt(empty!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0);
  });

  it("index is versioned by a stable model id", () => {
    expect(svc.model).toBeTruthy();
    expect(svc.model).toBe(new StubEmbeddingService().model);
  });
});
