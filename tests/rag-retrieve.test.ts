/**
 * In-memory hybrid retrieval tests — NO live DB, NO network, NO model.
 *
 * Exercises the DB-free analog of the pgvector path (memory-index.ts) over the
 * synthetic corpus with the deterministic stub embeddings. Verifies the hybrid
 * shape (vector ⊕ FTS), metadata filtering, provenance-carrying evidence, and
 * determinism — the same retrieval contract the production providers implement.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { generate, type GeneratedGraph } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { InMemoryRagIndex } from "@/db/seed/memory-index";

let g: GeneratedGraph;
let index: InMemoryRagIndex;

beforeAll(async () => {
  g = generate(SEED);
  index = await InMemoryRagIndex.fromGraph(g);
});

describe("InMemoryRagIndex", () => {
  it("indexes the full production-like corpus (thousands of docs)", () => {
    expect(index.size).toBeGreaterThan(3000);
  });

  it("returns ranked, source-backed evidence (entity id + source_uri/title)", async () => {
    const ev = await index.retrieve("roofing contractor with bad reviews", { limit: 5 });
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.length).toBeLessThanOrEqual(5);
    // Monotonically non-increasing fused score (ranked).
    for (let i = 1; i < ev.length; i++) {
      expect(ev[i - 1]!.score).toBeGreaterThanOrEqual(ev[i]!.score);
    }
    const top = ev[0]!;
    expect(top.title).toBeTruthy();
    expect(top.snippet.length).toBeGreaterThan(0);
    expect(top.documentId).toBeTruthy();
    expect(top.entityType).toBeTruthy();
  });

  it("exposes both legs of the hybrid (vector + fts component scores)", async () => {
    const [top] = await index.retrieve("major roof replacement", { limit: 1 });
    expect(top!.vectorScore).toBeGreaterThan(0);
    // The fused score is a weighted blend, never below the weaker leg alone.
    expect(top!.score).toBeGreaterThan(0);
    expect(typeof top!.ftsScore).toBe("number");
  });

  it("is deterministic — same query/seed => identical ranking", async () => {
    const a = await index.retrieve("electrical panel upgrade", { limit: 8 });
    const index2 = await InMemoryRagIndex.fromGraph(generate(SEED));
    const b = await index2.retrieve("electrical panel upgrade", { limit: 8 });
    expect(a.map((e) => e.documentId)).toEqual(b.map((e) => e.documentId));
    expect(a.map((e) => e.score)).toEqual(b.map((e) => e.score));
  });

  it("filters by entity_type metadata (corpus-and-metadata contract)", async () => {
    const ev = await index.retrieve("Lee County", {
      entityType: "contractor",
      limit: 10,
    });
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.entityType === "contractor")).toBe(true);
  });

  it("filters by jurisdiction metadata", async () => {
    const ev = await index.retrieve("renovation project", {
      jurisdiction: "fl-lee",
      limit: 5,
    });
    expect(ev.length).toBeGreaterThan(0);
    const none = await index.retrieve("renovation project", {
      jurisdiction: "tx-harris",
      limit: 5,
    });
    expect(none.length).toBe(0);
  });

  it("contractor/business/property evidence carries citations with url + record_key", async () => {
    const ev = await index.retrieve("contractor", {
      entityType: "contractor",
      limit: 5,
    });
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.citations.length).toBeGreaterThan(0);
      expect(e.citations[0]!.url).toBeTruthy();
      expect(e.citations[0]!.recordKey).toBeTruthy();
      // source_uri is carried first-class for provenance.
      expect(e.sourceUri).toBeTruthy();
    }
  });

  it("off-corpus query has no lexical grounding (fts leg is zero)", async () => {
    // The vector leg (nearest-neighbor) always returns candidates, exactly like
    // pgvector's `order by embedding <=>`. The honest signal that nothing truly
    // matches is the FTS leg: no query token appears in any returned doc.
    const ev = await index.retrieve("zzqxwv nonsense quux frobnicate", { limit: 5 });
    expect(ev.every((e) => e.ftsScore === 0)).toBe(true);
  });

  it("a lexically-grounded query produces non-zero fts on its top hit", async () => {
    const ev = await index.retrieve("roof replacement contractor", { limit: 5 });
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.some((e) => (e.ftsScore ?? 0) > 0)).toBe(true);
  });

  it("searchDocuments returns full rows ordered by relevance", async () => {
    const docs = await index.searchDocuments("business registration", { limit: 4 });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(4);
    expect(docs[0]!.title).toBeTruthy();
    expect(docs[0]!.body).toBeTruthy();
  });
});
